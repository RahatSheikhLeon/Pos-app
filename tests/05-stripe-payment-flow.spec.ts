/**
 * Suite 5 — Stripe Payment Flow
 *
 * Verifies the full subscription payment lifecycle:
 *   TC-STRIPE-01: payment_status = "pending" immediately after checkout session creation
 *   TC-STRIPE-02: payment_status changes to "completed" after card payment on Stripe
 *   TC-STRIPE-03: debug page renders all payments with live status badges
 *   TC-STRIPE-04: webhook endpoint rejects unsigned requests (400)
 *
 * Prerequisites:
 *   • NestJS backend running  → localhost:3001
 *   • Vite frontend running   → localhost:3000
 *   • stripe listen running   → forwarding to localhost:3001/api/stripe/webhook
 *   • STRIPE_WEBHOOK_SECRET   → set in backend/.env
 */

import { test, expect } from '@playwright/test';
import { loginViaUI, ensureTestUserExists } from './helpers/auth';

const API = 'http://localhost:3001/api';

// Helper: read payment status from the DB via our authenticated API
async function getPaymentStatus(page: any): Promise<string | null> {
  const res = await page.request.get(`${API}/stripe/payment-status`);
  if (!res.ok()) return null;
  const body = await res.json();
  return body.status ?? null;
}

// Helper: poll until DB status matches the expected value (or timeout)
async function waitForStatus(
  page: any,
  expected: string,
  timeoutMs = 25_000,
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await getPaymentStatus(page);
    console.log(`  [poll] payment_status in DB = ${status}`);
    if (status === expected) return status;
    await new Promise((r) => setTimeout(r, 1_500));
  }
  return getPaymentStatus(page);
}

test.describe('Stripe Payment Flow — pending → completed', () => {
  test.setTimeout(90_000); // generous timeout for real Stripe checkout

  test.beforeAll(async () => {
    await ensureTestUserExists();
  });

  // Log in once per test; cancel any active subscription so purchasing works
  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);

    // If an active subscription exists, cancel it so the test can purchase fresh
    try {
      const subRes = await page.request.get(`${API}/stripe/subscription`);
      if (subRes.ok()) {
        const sub = await subRes.json();
        if (sub?.stripeSubscriptionId && sub?.status === 'active') {
          await page.request.delete(`${API}/stripe/subscription`);
          console.log('[beforeEach] Cancelled existing active subscription');
          await new Promise((r) => setTimeout(r, 800));
        }
      }
    } catch { /* no subscription — that's fine */ }

    const before = await getPaymentStatus(page);
    console.log(`[beforeEach] current payment_status = ${before ?? 'none'}`);
  });

  // ── TC-STRIPE-01: DB shows "pending" right after checkout session creation ──
  test('TC-STRIPE-01 | payment_status = "pending" immediately after session creation', async ({ page }) => {
    // Get a paid plan
    const plansRes = await page.request.get(`${API}/stripe/plans`);
    expect(plansRes.ok()).toBe(true);
    const plans = await plansRes.json();
    const paidPlan = plans.find((p: any) => p.type !== 'free' && p.price > 0);
    expect(paidPlan, 'No paid plan found — seed plans in DB first').toBeDefined();
    console.log(`[TC-STRIPE-01] Plan: ${paidPlan.name} $${paidPlan.price}/mo`);

    // Create the Stripe checkout session
    const sessionRes = await page.request.post(`${API}/stripe/checkout`, {
      data: { planId: paidPlan.id, billingCycle: 'monthly' },
    });
    expect(sessionRes.ok(), `Checkout failed: ${await sessionRes.text()}`).toBeTruthy();

    const { sessionId } = await sessionRes.json();
    console.log(`[TC-STRIPE-01] Stripe session ID: ${sessionId}`);
    expect(sessionId).toMatch(/^cs_test_/);

    // ── ASSERTION 1: DB is "pending" right after creation ─────────────
    const dbStatus = await getPaymentStatus(page);
    console.log(`[TC-STRIPE-01] DB status after session creation: "${dbStatus}"`);
    expect(dbStatus).toBe('pending');

    // ── ASSERTION 2: per-session endpoint also shows "pending" ─────────
    const sessionCheckRes = await page.request.get(`${API}/stripe/payment-status/${sessionId}`);
    expect(sessionCheckRes.ok()).toBe(true);
    const sessionCheck = await sessionCheckRes.json();
    console.log(`[TC-STRIPE-01] Per-session check: ${JSON.stringify(sessionCheck)}`);
    expect(sessionCheck.dbStatus).toBe('pending');

    console.log('[TC-STRIPE-01] ✅ payment_status is "pending" before payment is made');
  });

  // ── TC-STRIPE-02: complete real Stripe checkout → webhook → "completed" ─────
  test('TC-STRIPE-02 | payment_status changes to "completed" after Stripe payment', async ({ page }) => {
    // Get a paid plan
    const plansRes = await page.request.get(`${API}/stripe/plans`);
    const plans = await plansRes.json();
    const paidPlan = plans.find((p: any) => p.type !== 'free' && p.price > 0);
    expect(paidPlan).toBeDefined();
    console.log(`[TC-STRIPE-02] Plan: ${paidPlan.name} $${paidPlan.price}/mo`);

    // Create checkout session and get the hosted URL
    const sessionRes = await page.request.post(`${API}/stripe/checkout`, {
      data: { planId: paidPlan.id, billingCycle: 'monthly' },
    });
    expect(sessionRes.ok()).toBeTruthy();
    const { sessionUrl, sessionId } = await sessionRes.json();
    console.log(`[TC-STRIPE-02] Session: ${sessionId}`);

    // Confirm "pending" before touching Stripe
    const beforeStatus = await getPaymentStatus(page);
    console.log(`[TC-STRIPE-02] Status before payment: "${beforeStatus}"`);
    expect(beforeStatus).toBe('pending');

    // ── Navigate to Stripe hosted checkout ────────────────────────────
    await page.goto(sessionUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
    console.log('[TC-STRIPE-02] Navigated to Stripe checkout page');
    await page.waitForTimeout(3_000); // let Stripe's JS render

    // ── Fill card details ─────────────────────────────────────────────
    // Stripe's hosted checkout uses an iframe for the card element
    const frames = page.frames();
    console.log('[TC-STRIPE-02] Frames on page:', frames.map((f: any) => f.url()).slice(0, 5));

    // Strategy: try direct inputs first (Stripe's hosted page sometimes exposes them directly)
    const cardFilled = await fillCardDetails(page);
    if (!cardFilled) {
      throw new Error('[TC-STRIPE-02] Could not locate card input fields on Stripe checkout page');
    }
    console.log('[TC-STRIPE-02] Card details filled ✓');

    // ── Submit payment ────────────────────────────────────────────────
    const submitBtn = page.getByRole('button', { name: /Subscribe|Pay|Confirm|Submit/i });
    await submitBtn.waitFor({ state: 'visible', timeout: 10_000 });
    await submitBtn.click();
    console.log('[TC-STRIPE-02] Clicked pay button');

    // ── Wait for redirect back to success page ────────────────────────
    await page.waitForURL('**/payment/success**', { timeout: 30_000 });
    console.log('[TC-STRIPE-02] Redirected to /payment/success ✓');

    // ── Poll DB until webhook fires and marks payment "completed" ──────
    console.log('[TC-STRIPE-02] Polling DB for status change...');
    const finalStatus = await waitForStatus(page, 'completed', 25_000);
    console.log(`[TC-STRIPE-02] Final DB payment_status: "${finalStatus}"`);
    expect(finalStatus).toBe('completed');

    // ── Confirm subscription is now active ────────────────────────────
    const subRes = await page.request.get(`${API}/stripe/subscription`);
    const sub = await subRes.json();
    console.log(`[TC-STRIPE-02] Subscription: status=${sub?.status} plan=${sub?.planName}`);
    expect(sub?.status).toBe('active');

    console.log('[TC-STRIPE-02] ✅ payment_status correctly changed to "completed"');
  });

  // ── TC-STRIPE-03: debug page renders correctly ───────────────────────────────
  test('TC-STRIPE-03 | debug page shows payments with live status badges', async ({ page }) => {
    const res = await page.request.get(`${API}/stripe/debug-payments`);
    expect(res.ok()).toBe(true);

    const html = await res.text();
    console.log('[TC-STRIPE-03] debug-payments HTML length:', html.length);
    expect(html).toContain('ShopIQ · Payment Debug');
    expect(html).toContain('Auto-refreshes every 2 seconds');
    expect(html).toMatch(/pending|completed|failed/);
    console.log('[TC-STRIPE-03] ✅ Debug page renders with payment status badges');
  });

  // ── TC-STRIPE-04: webhook rejects unsigned requests ──────────────────────────
  test('TC-STRIPE-04 | webhook endpoint returns 400 for unsigned requests', async ({ page }) => {
    const res = await page.request.post(`${API}/stripe/webhook`, {
      data: JSON.stringify({ type: 'test' }),
      headers: { 'Content-Type': 'application/json' },
      // Intentionally NO stripe-signature header
    });
    expect(res.status()).toBe(400);
    console.log('[TC-STRIPE-04] ✅ Unsigned webhook correctly rejected with 400');
  });
});

// ── Card-filling helper: handles Stripe's iframe structure ────────────────────
async function fillCardDetails(page: any): Promise<boolean> {
  // Stripe hosted checkout embeds the card number in an iframe
  // The iframe src contains "js.stripe.com" and the name attribute varies
  try {
    // Look for card number input across all frames
    for (const frame of page.frames()) {
      const cardInput = frame.locator('[name="cardnumber"], [placeholder*="1234"], [autocomplete="cc-number"]');
      if (await cardInput.count() > 0) {
        await cardInput.first().fill('4242424242424242');

        const expiry = frame.locator('[name="exp-date"], [placeholder*="MM"], [autocomplete="cc-exp"]');
        await expiry.first().fill('1226');

        const cvc = frame.locator('[name="cvc"], [placeholder*="CVC"], [autocomplete="cc-csc"]');
        await cvc.first().fill('123');

        const name = frame.locator('[name="name"], [autocomplete="cc-name"]');
        if (await name.count() > 0) await name.first().fill('Test User');

        return true;
      }
    }

    // Fallback: try direct page-level inputs (some Stripe hosted pages don't use iframes)
    const cardDirect = page.locator('[name="cardnumber"], [placeholder*="1234"]');
    if (await cardDirect.count() > 0) {
      await cardDirect.first().fill('4242424242424242');
      await page.locator('[name="exp-date"]').first().fill('1226');
      await page.locator('[name="cvc"]').first().fill('123');
      return true;
    }

    return false;
  } catch (err: any) {
    console.error('[fillCardDetails] Error:', err.message);
    return false;
  }
}
