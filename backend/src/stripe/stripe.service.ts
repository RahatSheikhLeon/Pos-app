import { Injectable } from '@nestjs/common';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const StripeSDK = require('stripe');

function requireStripeKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key || (!key.startsWith('sk_test_') && !key.startsWith('sk_live_'))) {
    throw new Error('[Stripe] STRIPE_SECRET_KEY is missing or invalid. Get it from https://dashboard.stripe.com/apikeys');
  }
  return key;
}

@Injectable()
export class StripeService {
  private readonly stripe: InstanceType<typeof StripeSDK>;

  constructor() {
    this.stripe = new StripeSDK(requireStripeKey(), { apiVersion: '2026-04-22.dahlia' });
  }

  // Create or retrieve a Stripe Customer for a user
  async getOrCreateCustomer(userId: string, email: string, name: string): Promise<string> {
    // Search existing customers by email
    const existing = await this.stripe.customers.list({ email, limit: 1 });
    if (existing.data.length > 0) return existing.data[0].id;

    const customer = await this.stripe.customers.create({ email, name, metadata: { userId } });
    return customer.id;
  }

  // Create Stripe Checkout Session for subscription
  async createSubscriptionSession(params: {
    customerId: string;
    planName: string;
    amount: number;          // USD
    billingCycle: 'monthly' | 'yearly';
    trxId: string;           // internal reference
    userId: string;
    planId: string;
    stripePriceId?: string;  // use pre-created Price if available
    successUrl: string;
    cancelUrl: string;
  }) {
    const interval = params.billingCycle === 'yearly' ? 'year' : 'month';

    // Build line item — use existing Stripe Price or create inline
    const lineItem = params.stripePriceId
      ? { price: params.stripePriceId, quantity: 1 }
      : {
          price_data: {
            currency: 'usd',
            product_data: { name: params.planName },
            unit_amount: Math.round(params.amount * 100),
            recurring: { interval },
          },
          quantity: 1,
        };

    return this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: params.customerId,
      line_items: [lineItem],
      metadata: { trxId: params.trxId, userId: params.userId, planId: params.planId },
      subscription_data: { metadata: { trxId: params.trxId, userId: params.userId, planId: params.planId } },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    });
  }

  // Cancel a Stripe subscription at period end
  async cancelSubscription(stripeSubscriptionId: string) {
    return this.stripe.subscriptions.update(stripeSubscriptionId, {
      cancel_at_period_end: true,
    });
  }

  // Immediately cancel a Stripe subscription
  async cancelSubscriptionImmediately(stripeSubscriptionId: string) {
    return this.stripe.subscriptions.cancel(stripeSubscriptionId);
  }

  constructWebhookEvent(rawBody: Buffer, sig: string) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new Error('[Stripe] STRIPE_WEBHOOK_SECRET is not set');
    return this.stripe.webhooks.constructEvent(rawBody, sig, secret);
  }
}
