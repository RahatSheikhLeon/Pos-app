import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { v4 as uuid } from 'uuid';
import { PrismaService } from '../prisma/prisma.service';
import { UserSubscriptionsService } from '../user-subscriptions/user-subscriptions.service';

const PLAN_DURATION_DAYS = 30; // Monthly billing

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userSubscriptionsService: UserSubscriptionsService,
  ) {}

  // ── Step 2: Create pending payment and return gateway URL ─────────
  async initiate(userId: string, userEmail: string, planId: string) {
    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan not found');
    if (plan.type === 'free') throw new BadRequestException('Free plan does not require payment');

    // Guard 1: block if user already has a pending payment
    const existingPending = await this.prisma.payment.findFirst({
      where: { userId, status: 'pending' },
    });
    if (existingPending) {
      throw new BadRequestException('You already have a pending payment request. Please wait for it to be processed or contact support.');
    }

    // Guard 2: block if user already has an active non-free subscription that hasn't expired
    const sub = await this.prisma.userSubscription.findUnique({ where: { userId } });
    if (sub && sub.planId !== 'plan_free' && sub.status === 'active') {
      const notExpired = !sub.expiresAt || sub.expiresAt > new Date();
      if (notExpired) {
        throw new BadRequestException('You already have an active Pro subscription. It must expire before purchasing a new plan.');
      }
    }

    const trxId = `TRX-${uuid().slice(0, 12).toUpperCase()}`;

    const payment = await this.prisma.payment.create({
      data: { userId, userEmail, planId, planName: plan.name, amount: plan.price, trxId, status: 'pending' },
    });

    // TODO: Replace with real gateway (SSLCommerz / bKash / Stripe)
    // Example SSLCommerz integration point:
    //   const sslData = await sslcommerz.init({ total_amount: plan.price, tran_id: trxId, ... });
    //   return { ...payment, paymentUrl: sslData.GatewayPageURL };
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const paymentUrl: string | null = null; // Set to gateway URL in production

    return {
      payment,
      trxId,
      paymentUrl,
      successUrl: `${frontendUrl}/payment/success?trx_id=${trxId}`,
      failUrl: `${frontendUrl}/payment/failed?trx_id=${trxId}`,
    };
  }

  // ── Step 5A+B: Confirm payment success & activate subscription ────
  async confirmSuccess(trxId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { trxId } });
    if (!payment) throw new NotFoundException('Transaction not found');
    if (payment.status === 'success') return { success: true, alreadyActivated: true };
    if (payment.status !== 'pending') {
      throw new BadRequestException(`Cannot confirm: payment is ${payment.status}`);
    }

    // A. Update payment status
    await this.prisma.payment.update({ where: { trxId }, data: { status: 'success' } });

    // B. Activate subscription (upgrades plan + sets expiresAt)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + PLAN_DURATION_DAYS);

    await this.prisma.userSubscription.upsert({
      where: { userId: payment.userId },
      create: { userId: payment.userId, planId: payment.planId, status: 'active', expiresAt },
      update: { planId: payment.planId, status: 'active', startedAt: new Date(), expiresAt },
    });

    const plan = await this.prisma.subscriptionPlan.findUnique({ where: { id: payment.planId } });
    await this.prisma.user.update({
      where: { id: payment.userId },
      data: { plan: plan?.slug ?? 'pro' },
    });

    return { success: true, alreadyActivated: false };
  }

  async markFailed(trxId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { trxId } });
    if (!payment) throw new NotFoundException('Transaction not found');
    if (payment.status !== 'pending') return { success: false };
    await this.prisma.payment.update({ where: { trxId }, data: { status: 'failed' } });
    return { success: false };
  }

  async findByTrxId(trxId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { trxId } });
    if (!payment) throw new NotFoundException('Transaction not found');
    return payment;
  }

  async findMine(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── Gateway webhook (SSLCommerz / bKash format) ───────────────────
  async handleWebhook(body: any) {
    const trxId: string = body.tran_id || body.trx_id || body.trxId;
    const status: string = (body.status || '').toLowerCase();

    if (!trxId) return { received: true };

    if (status === 'valid' || status === 'success' || status === 'completed') {
      await this.confirmSuccess(trxId).catch(() => null);
    } else if (status === 'failed' || status === 'invalid' || status === 'cancelled') {
      await this.markFailed(trxId).catch(() => null);
    }

    return { received: true };
  }
}
