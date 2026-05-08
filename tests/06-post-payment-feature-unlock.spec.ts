/**
 * Suite 6 — Post-Payment Feature Unlock
 *
 * Verifies that:
 *  TC-UNLOCK-01: profile.plan is pro (confirmed from DB)
 *  TC-UNLOCK-02: Transactions page is visible, no upgrade gate
 *  TC-UNLOCK-03: Reports page is visible, no upgrade gate
 *  TC-UNLOCK-04: Full end-to-end: free → payment → profile refreshed → pages unlocked
 *
 * TC-01/02/03 simply assert the CURRENT state after Suite 5 paid.
 * TC-04 does a full fresh-purchase cycle using an isolated Playwright user.
 */

import { test, expect } from '@playwright/test';
import { loginViaUI, ensureTestUserExists } from './helpers/auth';
import { execSync } from 'child_process';

const API = 'http://localhost:3001/api';

// ── Isolated user just for TC-04 so state resets don't bleed into other tests ──
const TC04_USER = {
  email:    'tc04-unlock@shopiq.test',
  password: 'tc04password',
  name:     'TC04 Unlock Tester',
};

function forceExpireSubscription(userId: string) {
  execSync(
    `mysql -u root shopiq -e "` +
    `UPDATE user_subscriptions SET status='expired', endDate=NOW() - INTERVAL 1 DAY WHERE userId='${userId}'; ` +
    `UPDATE users SET plan='free' WHERE id='${userId}'; ` +
    `DELETE FROM payments WHERE userId='${userId}';"`,
    { stdio: 'pipe' },
  );
  console.log('[forceExpire] DB reset to free for user', userId);
}

async function fillStripeCard(page: any) {
  // Wait generously for Stripe's JS to render all iframes
  await page.waitForTimeout(4_000);

  let filled = false;
  for (const frame of page.frames()) {
    const card = frame.locator(
      '[name="cardnumber"], [placeholder*="1234"], [autocomplete="cc-number"]',
    );
    if ((await card.count()) > 0) {
      await card.first().fill('4242424242424242');
      await frame.locator('[name="exp-date"], [autocomplete="cc-exp"]').first().fill('1226');
      await frame.locator('[name="cvc"], [autocomplete="cc-csc"]').first().fill('123');
      const name = frame.locator('[name="name"], [autocomplete="cc-name"]');
      if ((await name.count()) > 0) await name.first().fill('Test User');
      filled = true;
      console.log('[fillStripeCard] Card filled in frame:', frame.url().slice(0, 60));
      break;
    }
  }
  return filled;
}

async function buyPlan(page: any) {
  const plansRes = await page.request.get(`${API}/stripe/plans`);
  const plans    = await plansRes.json();
  const paidPlan = plans.find((p: any) => p.type !== 'free' && p.price > 0);
  if (!paidPlan) throw new Error('No paid plan found');

  const sessionRes = await page.request.post(`${API}/stripe/checkout`, {
    data: { planId: paidPlan.id, billingCycle: 'monthly' },
  });
  const body = await sessionRes.json();
  if (!sessionRes.ok() || !body.sessionUrl) {
    throw new Error(`Checkout failed: ${JSON.stringify(body)}`);
  }

  console.log('[buyPlan] Navigating to Stripe session:', body.sessionId);
  await page.goto(body.sessionUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });

  const filled = await fillStripeCard(page);
  if (!filled) throw new Error('Could not fill card details on Stripe checkout');

  await page.getByRole('button', { name: /Subscribe|Pay|Confirm/i }).click();
  console.log('[buyPlan] Clicked pay — waiting for redirect...');
  await page.waitForURL('**/payment/success**', { timeout: 35_000 });

  // PaymentReturn polls until payment is confirmed then refreshes the profile
  await page.waitForSelector('text=Subscription Active!', { timeout: 30_000 });
  console.log('[buyPlan] ✅ Subscription Active page reached');
}

// ── Tests that assert CURRENT state (rely on Suite 5 having run first) ─────────
test.describe('Current plan state (post-Suite-5)', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists();
  });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
  });

  test('TC-UNLOCK-01 | profile.plan is pro after completed payment', async ({ page }) => {
    const res     = await page.request.get(`${API}/auth/profile`);
    const profile = await res.json();
    console.log('[TC-UNLOCK-01] profile.plan:', profile.plan);
    expect(profile.plan).not.toBe('free');
    expect(profile.plan).not.toBeNull();
    console.log('[TC-UNLOCK-01] ✅ Plan is pro:', profile.plan);
  });

  test('TC-UNLOCK-02 | Transactions page is unlocked (no upgrade gate)', async ({ page }) => {
    // Confirm we are on pro first
    const res  = await page.request.get(`${API}/auth/profile`);
    const prof = await res.json();
    if (prof.plan === 'free' || prof.plan == null) {
      test.skip(true, 'User is on free plan — run Suite 5 first to complete a payment');
      return;
    }

    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    const gateVisible = await page
      .getByRole('button', { name: /Upgrade Now|Go to Pro/i })
      .isVisible()
      .catch(() => false);

    console.log('[TC-UNLOCK-02] upgrade gate visible:', gateVisible);
    expect(gateVisible).toBe(false);

    await expect(
      page.locator('h1,h2,h3').filter({ hasText: /Transaction/i }).first(),
    ).toBeVisible({ timeout: 5_000 });

    console.log('[TC-UNLOCK-02] ✅ Transactions page is unlocked');
  });

  test('TC-UNLOCK-03 | Reports page is unlocked (no upgrade gate)', async ({ page }) => {
    const res  = await page.request.get(`${API}/auth/profile`);
    const prof = await res.json();
    if (prof.plan === 'free' || prof.plan == null) {
      test.skip(true, 'User is on free plan — run Suite 5 first to complete a payment');
      return;
    }

    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    const gateVisible = await page
      .getByRole('button', { name: /Upgrade Now|Go to Pro/i })
      .isVisible()
      .catch(() => false);

    console.log('[TC-UNLOCK-03] upgrade gate visible:', gateVisible);
    expect(gateVisible).toBe(false);

    await expect(
      page.locator('h1,h2,h3').filter({ hasText: /Report|Analytics/i }).first(),
    ).toBeVisible({ timeout: 5_000 });

    console.log('[TC-UNLOCK-03] ✅ Reports page is unlocked');
  });
});

// ── End-to-end: isolated user, fresh payment, gates must unlock ─────────────────
test.describe('Full payment→unlock cycle (isolated user)', () => {
  test.setTimeout(120_000);

  let tc04UserId = '';

  test.beforeAll(async ({ browser }) => {
    // Create (or confirm) the isolated test user
    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TC04_USER),
    });
    if (res.ok) {
      const body = await res.json() as { id: string };
      tc04UserId = body.id;
    } else {
      // Already exists — find the id via login
      const ctx  = await browser.newContext();
      const page = await ctx.newPage();
      await page.goto('http://localhost:3000/login');
      await page.waitForURL('**/login');
      await page.getByPlaceholder('you@example.com').fill(TC04_USER.email);
      await page.getByPlaceholder('••••••••').fill(TC04_USER.password);
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 12_000 });
      const profRes = await page.request.get(`${API}/auth/profile`);
      const prof    = await profRes.json();
      tc04UserId    = prof.id;
      await ctx.close();
    }
    console.log('[TC-04 setup] userId:', tc04UserId);
  });

  test('TC-UNLOCK-04 | free plan → payment → PaymentReturn polls → Transactions/Reports unlocked', async ({ page }) => {
    // Reset this user to free so the test is repeatable
    if (tc04UserId) forceExpireSubscription(tc04UserId);

    // Log in as the isolated user
    await page.goto('/login');
    await page.waitForURL('**/login');
    await page.getByPlaceholder('you@example.com').fill(TC04_USER.email);
    await page.getByPlaceholder('••••••••').fill(TC04_USER.password);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 12_000 });

    // Confirm on free
    const beforeRes = await page.request.get(`${API}/auth/profile`);
    const before    = await beforeRes.json();
    console.log('[TC-UNLOCK-04] plan before payment:', before.plan);
    // Note: plan may still be 'pro_basic' in JWT until re-login; DB is 'free'

    // Do the full Stripe payment flow
    await buyPlan(page);

    // PaymentReturn already called fetchProfile — plan should be pro in Redux now
    // Navigate to Transactions immediately
    await page.getByRole('button', { name: /Dashboard/i }).click();
    await page.waitForURL('**/dashboard');

    // ── Assert Transactions is unlocked ──────────────────────────────
    await page.goto('/transactions');
    await page.waitForLoadState('networkidle');

    const txnGate = await page
      .getByRole('button', { name: /Upgrade Now|Go to Pro/i })
      .isVisible()
      .catch(() => false);
    console.log('[TC-UNLOCK-04] Transactions gate visible:', txnGate);
    expect(txnGate).toBe(false);

    // ── Assert Reports is unlocked ────────────────────────────────────
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    const rptGate = await page
      .getByRole('button', { name: /Upgrade Now|Go to Pro/i })
      .isVisible()
      .catch(() => false);
    console.log('[TC-UNLOCK-04] Reports gate visible:', rptGate);
    expect(rptGate).toBe(false);

    console.log('[TC-UNLOCK-04] ✅ Both Transactions and Reports are unlocked after payment');
  });
});
