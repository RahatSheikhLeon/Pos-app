import {
  Controller, Post, Get, Delete, Body, Headers, Req, Param, HttpCode, BadRequestException,
} from '@nestjs/common';
import { StripeService } from './stripe.service';
import { PrismaService } from '../prisma/prisma.service';
import { CurrentUser } from '../auth/current-user.decorator';
import { Public } from '../auth/public.decorator';

@Controller('stripe')
export class StripeController {
  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
  ) {}

  // ── GET /stripe/plans ────────────────────────────────────────────
  @Get('plans')
  getPlans() {
    return this.prisma.subscriptionPlan.findMany({ orderBy: { price: 'asc' } });
  }

  // ── POST /stripe/checkout ────────────────────────────────────────
  @Post('checkout')
  async createCheckout(
    @CurrentUser() user: any,
    @Body() body: { planId: string; billingCycle?: 'monthly' | 'yearly' },
  ) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: body.planId } });
    if (!plan) throw new BadRequestException('Plan not found');
    if (plan.type === 'free') throw new BadRequestException('Free plan requires no payment');

    // Block if already active non-expired Pro subscription
    const sub = await this.prisma.userSubscription.findUnique({ where: { userId: user.id } });
    if (sub && sub.planId !== 'plan_free' && sub.status === 'active') {
      const notExpired = !sub.endDate || new Date(sub.endDate) > new Date();
      if (notExpired) throw new BadRequestException('You already have an active Pro subscription');
    }

    const billingCycle = body.billingCycle ?? 'monthly';
    const amount = billingCycle === 'yearly' ? plan.yearlyPrice : plan.price;
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const trxId = `TRX-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

    // Get or create Stripe customer
    const userRecord = await this.prisma.user.findUnique({ where: { id: user.id } });
    let stripeCustomerId = userRecord?.stripeCustomerId;

    if (!stripeCustomerId) {
      stripeCustomerId = await this.stripeService.getOrCreateCustomer(user.id, user.email, user.name);
      await this.prisma.user.update({ where: { id: user.id }, data: { stripeCustomerId } });
    }

    const stripePriceId = billingCycle === 'yearly'
      ? plan.stripePriceIdYearly ?? undefined
      : plan.stripePriceIdMonthly ?? undefined;

    const session = await this.stripeService.createSubscriptionSession({
      customerId: stripeCustomerId,
      planName: plan.name,
      amount,
      billingCycle,
      trxId,
      userId: user.id,
      planId: plan.id,
      stripePriceId,
      successUrl: `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl:  `${frontendUrl}/payment/cancel`,
    });

    // Single payment record per user — block only when already subscribed (completed).
    // Pending records are UPDATED in place, allowing plan changes before payment.
    const existing = await this.prisma.payment.findUnique({ where: { userId: user.id } });
    if (existing?.paymentStatus === 'completed') {
      throw new BadRequestException('You already have an active subscription. Cancel it before purchasing a new plan.');
    }

    // Upsert: create on first attempt; UPDATE amount/status on plan switch while pending
    await this.prisma.payment.upsert({
      where:  { userId: user.id },
      create: { userId: user.id, amount, currency: 'usd', paymentStatus: 'pending' },
      update: { amount, currency: 'usd', paymentStatus: 'pending', subscriptionId: null,
                stripePaymentIntentId: null, stripeInvoiceId: null },
    });

    return { sessionUrl: session.url, sessionId: session.id };
  }

  // ── GET /stripe/subscription ─────────────────────────────────────
  @Get('subscription')
  async getSubscription(@CurrentUser() user: any) {
    const sub = await this.prisma.userSubscription.findUnique({
      where: { userId: user.id },
      include: { plan: true },
    });

    // Auto-downgrade expired subscriptions
    if (sub && sub.planId !== 'plan_free' && sub.endDate && new Date(sub.endDate) < new Date()) {
      await this.prisma.userSubscription.update({
        where: { userId: user.id },
        data: { planId: 'plan_free', status: 'expired', stripeSubscriptionId: null },
      });
      await this.prisma.user.update({ where: { id: user.id }, data: { plan: 'free' } });
      return this.prisma.userSubscription.findUnique({ where: { userId: user.id }, include: { plan: true } });
    }

    return sub;
  }

  // ── GET /stripe/payment-status ───────────────────────────────────
  @Get('payment-status')
  async getPaymentStatus(@CurrentUser() user: any) {
    const payment = await this.prisma.payment.findUnique({ where: { userId: user.id } });
    return {
      exists: !!payment,
      status: payment?.paymentStatus ?? null,
      amount: payment?.amount ?? null,
    };
  }

  // ── DELETE /stripe/subscription ──────────────────────────────────
  @Delete('subscription')
  async cancelSubscription(@CurrentUser() user: any) {
    const sub = await this.prisma.userSubscription.findUnique({ where: { userId: user.id } });
    if (!sub?.stripeSubscriptionId) throw new BadRequestException('No active subscription found');

    await this.stripeService.cancelSubscription(sub.stripeSubscriptionId);
    await this.prisma.userSubscription.update({
      where: { userId: user.id },
      data: { status: 'cancelled' },
    });
    return { success: true, message: 'Subscription will cancel at end of billing period' };
  }

  // ── POST /stripe/webhook ─────────────────────────────────────────
  @Public()
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: any, @Headers('stripe-signature') sig: string) {
    console.log('[Webhook] Received. sig present:', !!sig);
    console.log('[Webhook] rawBody type:', typeof req.rawBody, '| length:', req.rawBody?.length);

    if (!sig) {
      console.error('[Webhook] Missing stripe-signature header');
      throw new BadRequestException('Missing stripe-signature');
    }

    let event: any;
    try {
      event = this.stripeService.constructWebhookEvent(req.rawBody, sig);
      console.log('[Webhook] Signature verified ✅ | event type:', event.type);
    } catch (err: any) {
      console.error('[Webhook] Signature verification FAILED:', err.message);
      console.error('[Webhook] Hint: STRIPE_WEBHOOK_SECRET may be wrong or rawBody is missing');
      throw new BadRequestException(`Webhook signature error: ${err.message}`);
    }

    await this.handleWebhookEvent(event);
    return { received: true };
  }

  private async handleWebhookEvent(event: any) {
    const data = event.data.object;
    console.log(`[Webhook] event: ${event.type}`);

    switch (event.type) {
      // ── Initial subscription created after checkout ──
      case 'checkout.session.completed': {
        console.log('[Webhook] session metadata:', JSON.stringify(data.metadata));
        console.log('[Webhook] customer:', data.customer);
        console.log('[Webhook] subscription:', data.subscription);

        const meta = data.metadata ?? {};
        let { userId, planId } = meta as { userId?: string; planId?: string };

        // Fallback 1: find userId via stripeCustomerId stored in users table
        if (!userId && data.customer) {
          const userRecord = await this.prisma.user.findFirst({
            where: { stripeCustomerId: data.customer },
          });
          userId = userRecord?.id;
          console.log('[Webhook] Fallback: found userId by stripeCustomerId:', userId);
        }

        // Fallback 2: find userId via pending payment record
        if (!userId) {
          const pendingPayment = await this.prisma.payment.findFirst({
            where: { paymentStatus: 'pending' },
            orderBy: { createdAt: 'desc' },
          });
          userId = pendingPayment?.userId;
          console.log('[Webhook] Fallback: found userId by pending payment:', userId);
        }

        if (!userId) {
          console.error('[Webhook] FAILED: could not resolve userId — skipping');
          break;
        }

        // Resolve planId from pending payment if missing from metadata
        if (!planId) {
          const pendingPayment = await this.prisma.payment.findUnique({ where: { userId } });
          const sub = await this.prisma.userSubscription.findUnique({ where: { userId } });
          planId = sub?.planId;
          console.log('[Webhook] Fallback: resolved planId from subscription:', planId);
        }

        if (!planId) {
          console.error('[Webhook] FAILED: could not resolve planId — skipping');
          break;
        }

        const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
        const stripeSubscriptionId = data.subscription;
        const endDate = new Date();
        endDate.setMonth(endDate.getMonth() + 1);

        await this.prisma.userSubscription.upsert({
          where: { userId },
          create: {
            userId, planId, stripeCustomerId: data.customer,
            stripeSubscriptionId, stripeSessionId: data.id,
            planName: plan?.name ?? '', billingCycle: 'monthly',
            status: 'active', startDate: new Date(), endDate,
          },
          update: {
            planId, stripeCustomerId: data.customer,
            stripeSubscriptionId, stripeSessionId: data.id,
            planName: plan?.name ?? '', status: 'active', endDate,
          },
        });

        await this.prisma.user.update({
          where: { id: userId },
          data: { plan: plan?.slug ?? 'pro', stripeCustomerId: data.customer },
        });

        const activeSub = await this.prisma.userSubscription.findUnique({ where: { userId } });
        await this.prisma.payment.upsert({
          where:  { userId },
          create: { userId, amount: data.amount_total ? data.amount_total / 100 : 0,
                    currency: data.currency ?? 'usd', paymentStatus: 'completed',
                    subscriptionId: activeSub?.id ?? undefined },
          update: { paymentStatus: 'completed', subscriptionId: activeSub?.id ?? undefined },
        });

        console.log(`[Webhook] ✅ Subscription activated for userId: ${userId}, plan: ${plan?.slug}`);
        break;
      }

      // ── Recurring invoice paid — extend subscription ──
      case 'invoice.paid': {
        const subscriptionId = data.subscription;
        if (!subscriptionId) break;

        const sub = await this.prisma.userSubscription.findUnique({
          where: { stripeSubscriptionId: subscriptionId },
        });
        if (!sub) break;

        const periodEnd = new Date(data.lines?.data?.[0]?.period?.end * 1000 || Date.now());
        await this.prisma.userSubscription.update({
          where: { stripeSubscriptionId: subscriptionId },
          data: { status: 'active', endDate: periodEnd },
        });

        // Update the single payment record for this user (recurring invoice renewal)
        await this.prisma.payment.upsert({
          where:  { userId: sub.userId },
          create: { userId: sub.userId, subscriptionId: sub.id,
                    amount: data.amount_paid / 100, currency: data.currency,
                    paymentStatus: 'completed', stripeInvoiceId: data.id,
                    stripePaymentIntentId: data.payment_intent ?? undefined },
          update: { subscriptionId: sub.id, amount: data.amount_paid / 100,
                    currency: data.currency, paymentStatus: 'completed',
                    stripeInvoiceId: data.id,
                    stripePaymentIntentId: data.payment_intent ?? undefined },
        });
        break;
      }

      // ── Recurring invoice failed ──
      case 'invoice.payment_failed': {
        const subscriptionId = data.subscription;
        if (!subscriptionId) break;

        const sub = await this.prisma.userSubscription.findFirst({
          where: { stripeSubscriptionId: subscriptionId },
        });
        if (sub) {
          await this.prisma.userSubscription.update({
            where: { stripeSubscriptionId: subscriptionId },
            data: { status: 'past_due' },
          });
          await this.prisma.payment.upsert({
            where:  { userId: sub.userId },
            create: { userId: sub.userId, subscriptionId: sub.id,
                      amount: data.amount_due / 100, currency: data.currency,
                      paymentStatus: 'failed', stripeInvoiceId: data.id },
            update: { paymentStatus: 'failed', stripeInvoiceId: data.id,
                      amount: data.amount_due / 100 },
          });
        }
        break;
      }

      // ── Subscription deleted / cancelled ──
      case 'customer.subscription.deleted': {
        const sub = await this.prisma.userSubscription.findFirst({
          where: { stripeSubscriptionId: data.id },
        });
        if (sub) {
          await this.prisma.userSubscription.update({
            where: { id: sub.id },
            data: { planId: 'plan_free', status: 'cancelled', endDate: new Date() },
          });
          await this.prisma.user.update({
            where: { id: sub.userId },
            data: { plan: 'free' },
          });
        }
        break;
      }

      // ── Subscription updated (upgrade / downgrade) ──
      case 'customer.subscription.updated': {
        const sub = await this.prisma.userSubscription.findFirst({
          where: { stripeSubscriptionId: data.id },
        });
        if (sub) {
          const status = data.status === 'active' ? 'active'
            : data.status === 'past_due' ? 'past_due'
            : 'cancelled';
          await this.prisma.userSubscription.update({
            where: { id: sub.id },
            data: { status },
          });
        }
        break;
      }
    }
  }
}
