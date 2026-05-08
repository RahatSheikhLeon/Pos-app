import {
  Controller, Post, Get, Delete, Body, Headers, Req, HttpCode, BadRequestException,
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

    // Block only when already fully subscribed (completed); pending → update in place
    const existing = await this.prisma.payment.findUnique({ where: { userId: user.id } });
    if (existing?.paymentStatus === 'completed') {
      throw new BadRequestException('You already have an active subscription. Cancel it before purchasing a new plan.');
    }

    // ── FIX: store stripeSessionId so the webhook has a primary key to look up this row ──
    await this.prisma.payment.upsert({
      where:  { userId: user.id },
      create: {
        userId: user.id,
        amount,
        currency: 'usd',
        paymentStatus: 'pending',
        stripeSessionId: session.id,   // ← stored immediately
      },
      update: {
        amount,
        currency: 'usd',
        paymentStatus: 'pending',
        stripeSessionId: session.id,   // ← updated on plan switch
        subscriptionId: null,
        stripePaymentIntentId: null,
        stripeInvoiceId: null,
      },
    });

    console.log(`[Checkout] Session created: ${session.id} | user: ${user.id} | plan: ${plan.id}`);
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
  // @Public() bypasses the global JWT guard — Stripe webhooks are server-to-server,
  // there is no user session. rawBody is captured by NestFactory({ rawBody: true }).
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

    if (!req.rawBody || req.rawBody.length === 0) {
      console.error('[Webhook] rawBody is empty — NestFactory must be created with { rawBody: true }');
      throw new BadRequestException('Empty body');
    }

    let event: any;
    try {
      event = this.stripeService.constructWebhookEvent(req.rawBody, sig);
      console.log('[Webhook] ✅ Signature verified | event type:', event.type, '| id:', event.id);
    } catch (err: any) {
      console.error('[Webhook] ❌ Signature verification FAILED:', err.message);
      throw new BadRequestException(`Webhook error: ${err.message}`);
    }

    // Handle event in the background — always return 200 to Stripe immediately
    this.handleWebhookEvent(event).catch((err) =>
      console.error(`[Webhook] Unhandled error in ${event.type}:`, err),
    );

    return { received: true };
  }

  // ── Webhook event router ─────────────────────────────────────────
  private async handleWebhookEvent(event: any) {
    const data = event.data.object;
    console.log(`[Webhook] Processing event: ${event.type} | id: ${event.id}`);

    switch (event.type) {

      // ── Checkout completed → activate subscription ────────────────
      case 'checkout.session.completed': {
        await this.handleCheckoutCompleted(data);
        break;
      }

      // ── Recurring invoice paid → extend subscription period ───────
      case 'invoice.paid': {
        await this.handleInvoicePaid(data);
        break;
      }

      // ── Recurring invoice failed → mark past_due ──────────────────
      case 'invoice.payment_failed': {
        await this.handleInvoicePaymentFailed(data);
        break;
      }

      // ── Subscription cancelled ────────────────────────────────────
      case 'customer.subscription.deleted': {
        await this.handleSubscriptionDeleted(data);
        break;
      }

      // ── Subscription status updated ───────────────────────────────
      case 'customer.subscription.updated': {
        await this.handleSubscriptionUpdated(data);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }
  }

  // ── checkout.session.completed ───────────────────────────────────
  private async handleCheckoutCompleted(data: any) {
    console.log('[Webhook:checkout] session id:', data.id);
    console.log('[Webhook:checkout] metadata:', JSON.stringify(data.metadata));
    console.log('[Webhook:checkout] customer:', data.customer);
    console.log('[Webhook:checkout] subscription:', data.subscription);

    // ── IDEMPOTENCY: skip if this exact session was already processed ──
    // Stripe can deliver the same event more than once (retries after failures).
    const existingPayment = await this.prisma.payment.findUnique({
      where: { stripeSessionId: data.id },
    });
    if (existingPayment?.paymentStatus === 'completed') {
      console.log('[Webhook:checkout] Already processed — skipping (idempotent) for session:', data.id);
      return;
    }

    // ── RESOLVE userId ─────────────────────────────────────────────
    const meta = data.metadata ?? {};
    let userId: string | undefined = meta.userId;
    let planId: string | undefined  = meta.planId;
    let billingCycle: 'monthly' | 'yearly' = meta.billingCycle === 'yearly' ? 'yearly' : 'monthly';

    // Lookup #1: payment row already has this sessionId (stored at checkout creation)
    if (!userId && existingPayment) {
      userId = existingPayment.userId;
      console.log('[Webhook:checkout] Resolved userId via stripeSessionId in payments table:', userId);
    }

    // Lookup #2: find user by the Stripe customerId stored in the users table
    if (!userId && data.customer) {
      const userRecord = await this.prisma.user.findFirst({
        where: { stripeCustomerId: data.customer },
      });
      userId = userRecord?.id;
      console.log('[Webhook:checkout] Resolved userId via stripeCustomerId:', userId);
    }

    // Lookup #3: last-resort — find the most recent pending payment (single-tenant fallback)
    if (!userId) {
      const pending = await this.prisma.payment.findFirst({
        where: { paymentStatus: 'pending' },
        orderBy: { createdAt: 'desc' },
      });
      userId = pending?.userId;
      console.log('[Webhook:checkout] Resolved userId via pending payment fallback:', userId);
    }

    if (!userId) {
      console.error('[Webhook:checkout] ❌ Could not resolve userId — event cannot be processed:', data.id);
      return;
    }

    // ── RESOLVE planId ─────────────────────────────────────────────
    if (!planId) {
      const existingSub = await this.prisma.userSubscription.findUnique({ where: { userId } });
      planId = existingSub?.planId;
      console.log('[Webhook:checkout] Resolved planId from existing subscription:', planId);
    }

    if (!planId || planId === 'plan_free') {
      console.error('[Webhook:checkout] ❌ Could not resolve a valid paid planId:', planId);
      return;
    }

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) {
      console.error('[Webhook:checkout] ❌ Plan not found in DB:', planId);
      return;
    }

    // ── RESOLVE endDate from the actual Stripe subscription ────────
    // Stripe gives us the exact billing period end — far more accurate than +1 month.
    let endDate = new Date();
    if (data.subscription) {
      try {
        const stripeSub = await this.stripeService.retrieveSubscription(data.subscription);
        if (stripeSub.current_period_end) {
          endDate = new Date(stripeSub.current_period_end * 1000);
        } else {
          billingCycle === 'yearly'
            ? endDate.setFullYear(endDate.getFullYear() + 1)
            : endDate.setMonth(endDate.getMonth() + 1);
        }
        // Honour the actual billing interval from the Stripe subscription
        const interval = stripeSub.items?.data?.[0]?.price?.recurring?.interval;
        if (interval === 'year') billingCycle = 'yearly';
        else if (interval === 'month') billingCycle = 'monthly';
      } catch (err) {
        console.warn('[Webhook:checkout] Could not retrieve Stripe subscription — using period fallback:', err);
        billingCycle === 'yearly'
          ? endDate.setFullYear(endDate.getFullYear() + 1)
          : endDate.setMonth(endDate.getMonth() + 1);
      }
    } else {
      billingCycle === 'yearly'
        ? endDate.setFullYear(endDate.getFullYear() + 1)
        : endDate.setMonth(endDate.getMonth() + 1);
    }

    // ── WRITE: subscription ────────────────────────────────────────
    await this.prisma.userSubscription.upsert({
      where: { userId },
      create: {
        userId,
        planId,
        stripeCustomerId: data.customer,
        stripeSubscriptionId: data.subscription,
        stripeSessionId: data.id,
        planName: plan.name,
        billingCycle,
        status: 'active',
        startDate: new Date(),
        endDate,
      },
      update: {
        planId,
        stripeCustomerId: data.customer,
        stripeSubscriptionId: data.subscription,
        stripeSessionId: data.id,
        planName: plan.name,
        billingCycle,
        status: 'active',
        endDate,
      },
    });

    // ── WRITE: user plan field ─────────────────────────────────────
    await this.prisma.user.update({
      where: { id: userId },
      data: { plan: plan.slug, stripeCustomerId: data.customer },
    });

    // ── WRITE: payment record → mark completed ─────────────────────
    const activeSub = await this.prisma.userSubscription.findUnique({ where: { userId } });
    await this.prisma.payment.upsert({
      where:  { userId },
      create: {
        userId,
        amount: data.amount_total ? data.amount_total / 100 : 0,
        currency: data.currency ?? 'usd',
        paymentStatus: 'completed',
        stripeSessionId: data.id,
        subscriptionId: activeSub?.id,
      },
      update: {
        paymentStatus: 'completed',
        stripeSessionId: data.id,
        subscriptionId: activeSub?.id,
        amount: data.amount_total ? data.amount_total / 100 : undefined,
      },
    });

    console.log(`[Webhook:checkout] ✅ Subscription activated | userId: ${userId} | plan: ${plan.slug} | endDate: ${endDate.toISOString()}`);
  }

  // ── invoice.paid ─────────────────────────────────────────────────
  private async handleInvoicePaid(data: any) {
    const stripeSubscriptionId = data.subscription;
    if (!stripeSubscriptionId) return;

    const sub = await this.prisma.userSubscription.findUnique({
      where: { stripeSubscriptionId },
    });
    if (!sub) {
      console.warn('[Webhook:invoice.paid] No subscription found for stripeSubscriptionId:', stripeSubscriptionId);
      return;
    }

    // Use the actual period end from the invoice line item
    const periodEnd = data.lines?.data?.[0]?.period?.end;
    const endDate = periodEnd ? new Date(periodEnd * 1000) : (() => {
      const d = new Date();
      d.setMonth(d.getMonth() + 1);
      return d;
    })();

    await this.prisma.userSubscription.update({
      where: { stripeSubscriptionId },
      data: { status: 'active', endDate },
    });

    await this.prisma.payment.upsert({
      where:  { userId: sub.userId },
      create: {
        userId: sub.userId,
        subscriptionId: sub.id,
        amount: data.amount_paid / 100,
        currency: data.currency ?? 'usd',
        paymentStatus: 'completed',
        stripeInvoiceId: data.id,
        stripePaymentIntentId: data.payment_intent ?? null,
      },
      update: {
        subscriptionId: sub.id,
        amount: data.amount_paid / 100,
        currency: data.currency ?? 'usd',
        paymentStatus: 'completed',
        stripeInvoiceId: data.id,
        stripePaymentIntentId: data.payment_intent ?? null,
      },
    });

    console.log(`[Webhook:invoice.paid] ✅ Renewed | userId: ${sub.userId} | endDate: ${endDate.toISOString()}`);
  }

  // ── invoice.payment_failed ────────────────────────────────────────
  private async handleInvoicePaymentFailed(data: any) {
    const stripeSubscriptionId = data.subscription;
    if (!stripeSubscriptionId) return;

    const sub = await this.prisma.userSubscription.findFirst({
      where: { stripeSubscriptionId },
    });
    if (!sub) return;

    await this.prisma.userSubscription.update({
      where: { stripeSubscriptionId },
      data: { status: 'past_due' },
    });

    await this.prisma.payment.upsert({
      where:  { userId: sub.userId },
      create: {
        userId: sub.userId,
        subscriptionId: sub.id,
        amount: data.amount_due / 100,
        currency: data.currency ?? 'usd',
        paymentStatus: 'failed',
        stripeInvoiceId: data.id,
      },
      update: {
        paymentStatus: 'failed',
        stripeInvoiceId: data.id,
        amount: data.amount_due / 100,
      },
    });

    console.log(`[Webhook:invoice.payment_failed] ⚠️ Payment failed | userId: ${sub.userId}`);
  }

  // ── customer.subscription.deleted ────────────────────────────────
  private async handleSubscriptionDeleted(data: any) {
    const sub = await this.prisma.userSubscription.findFirst({
      where: { stripeSubscriptionId: data.id },
    });
    if (!sub) return;

    await this.prisma.userSubscription.update({
      where: { id: sub.id },
      data: { planId: 'plan_free', status: 'cancelled', endDate: new Date() },
    });
    await this.prisma.user.update({
      where: { id: sub.userId },
      data: { plan: 'free' },
    });

    console.log(`[Webhook:subscription.deleted] Subscription cancelled | userId: ${sub.userId}`);
  }

  // ── customer.subscription.updated ────────────────────────────────
  private async handleSubscriptionUpdated(data: any) {
    const sub = await this.prisma.userSubscription.findFirst({
      where: { stripeSubscriptionId: data.id },
    });
    if (!sub) return;

    const status =
      data.status === 'active'   ? 'active'   :
      data.status === 'past_due' ? 'past_due' : 'cancelled';

    await this.prisma.userSubscription.update({
      where: { id: sub.id },
      data: { status },
    });

    console.log(`[Webhook:subscription.updated] Status: ${status} | userId: ${sub.userId}`);
  }
}
