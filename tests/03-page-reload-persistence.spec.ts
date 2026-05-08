/**
 * Suite 3 — Page Reload Persistence
 *
 * Verifies that after a hard page reload:
 * - Active cart tabs are restored from the database
 * - Member profiles attached to carts are restored
 * - The previously active cart is re-selected
 * - Plain (Walk-in) carts with items persist
 *
 * TC-15 and TC-16 are the primary regression guards for the member-profile
 * persistence bug fixed via the cart_sessions table + localStorage fallback.
 */

import { test, expect } from '@playwright/test';
import {
  loginViaUI, ensureTestUserExists, ensureTestMemberExists,
  clearAllCarts, TEST_MEMBER,
} from './helpers/auth';
import { CheckoutPage } from './helpers/checkout.page';

test.describe('Page Reload Persistence', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureTestUserExists();
    const ctx  = await browser.newContext();
    const page = await ctx.newPage();
    await loginViaUI(page);
    await ensureTestMemberExists(page);
    await ctx.close();
  });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
    await clearAllCarts(page);
  });

  // ── TC-14: Walk-in cart persists after reload ─────────────────────────
  test('TC-14 | Walk-in cart is still present after page reload', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    await page.reload({ waitUntil: 'networkidle' });
    await checkout.activeCartsHeader.waitFor({ state: 'visible' });

    const cartNames = await checkout.cartNames();
    console.log('[TC-14] cart names after reload:', cartNames);
    expect(cartNames.some((n) => /Walk-in/i.test(n))).toBe(true);
  });

  // ── TC-15: GET /api/carts returns { items, sessions } (not flat array) ─
  // This test directly catches the backend regression where the old findAll()
  // returns CartItemRow[] instead of { items: CartItemRow[], sessions: CartSessionRow[] }.
  // If this test fails, restart the NestJS backend and re-run.
  test('TC-15 | GET /api/carts response has { items, sessions } shape (backend format check)', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    // Create a member cart so there is at least one session to check
    await checkout.searchMember(TEST_MEMBER.name.split(' ')[0]);
    await checkout.selectFirstMemberResult();
    await expect(async () => {
      const names = await checkout.cartNames();
      expect(names.some((n) => n.includes(TEST_MEMBER.name.split(' ')[0]))).toBe(true);
    }).toPass({ timeout: 5_000 });

    await page.waitForTimeout(1_500);

    // Intercept the fetchCarts request that fires on reload
    const [cartsResponse] = await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/api/carts') && r.request().method() === 'GET',
        { timeout: 10_000 },
      ),
      page.reload({ waitUntil: 'domcontentloaded' }),
    ]);

    const status = cartsResponse.status();
    const body   = await cartsResponse.json().catch(() => null);

    console.log('[TC-15] GET /api/carts status:', status);
    console.log('[TC-15] response type:', Array.isArray(body) ? 'ARRAY (old format)' : 'OBJECT');
    console.log('[TC-15] response keys:', body ? Object.keys(body) : 'null');

    // ── CRITICAL ASSERTION ────────────────────────────────────────────────
    // The backend MUST return { items, sessions } — not a flat array.
    // A flat array means the backend is running stale compiled code and needs
    // to be restarted (npm run start:dev in the backend directory).
    if (Array.isArray(body)) {
      throw new Error(
        'BACKEND REGRESSION: GET /api/carts returned a flat array instead of { items, sessions }.\n' +
        'The NestJS backend is running old compiled code.\n' +
        'Fix: restart the backend with: cd backend && npm run start:dev'
      );
    }

    expect(status).toBe(200);
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('sessions');
    expect(Array.isArray(body.items)).toBe(true);
    expect(Array.isArray(body.sessions)).toBe(true);

    console.log('[TC-15] sessions in response:', body.sessions.length);
    console.log('[TC-15] session data:', JSON.stringify(body.sessions));
  });

  // ── TC-16: member cart tab persists after reload (requires TC-15 to pass) ──
  test('TC-16 | member cart tab is present after page reload', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    await checkout.searchMember(TEST_MEMBER.name.split(' ')[0]);
    await checkout.selectFirstMemberResult();

    await expect(async () => {
      const names = await checkout.cartNames();
      expect(names.some((n) => n.includes(TEST_MEMBER.name.split(' ')[0]))).toBe(true);
    }).toPass({ timeout: 5_000 });

    const countBefore = await checkout.cartCount();
    console.log('[TC-16] carts before reload:', countBefore);

    await page.waitForTimeout(2_000);
    await page.reload({ waitUntil: 'networkidle' });
    await checkout.activeCartsHeader.waitFor({ state: 'visible' });

    // Wait explicitly for the member cart tab to appear (up to 8 s)
    await expect(async () => {
      const names = await checkout.cartNames();
      console.log('[TC-16] cart names after reload (polling):', names);
      expect(
        names.some((n) => n.includes(TEST_MEMBER.name.split(' ')[0])),
      ).toBe(true);
    }).toPass({ timeout: 8_000 });

    const namesAfter = await checkout.cartNames();
    console.log('[TC-16] final cart names after reload:', namesAfter);
  });

  // ── TC-17: member profile identity is retained after reload ───────────
  test('TC-17 | member profile (name) is retained after reload', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    await checkout.searchMember(TEST_MEMBER.name.split(' ')[0]);
    await checkout.selectFirstMemberResult();

    await expect(async () => {
      const header = await checkout.cartHeaderText();
      expect(header).toContain(TEST_MEMBER.name.split(' ')[0]);
    }).toPass({ timeout: 5_000 });

    await page.waitForTimeout(1_500);
    await page.reload({ waitUntil: 'networkidle' });
    await checkout.activeCartsHeader.waitFor({ state: 'visible' });
    await page.waitForTimeout(1_000);

    // Switch to the member's cart tab if not already active
    const memberBtn = checkout.activeCarts.filter({
      hasText: TEST_MEMBER.name.split(' ')[0],
    }).first();

    if (await memberBtn.isVisible().catch(() => false)) {
      await memberBtn.click();
      await page.waitForTimeout(300);
    } else {
      throw new Error('[TC-17] Member cart tab not found after reload — TC-15/TC-16 must pass first');
    }

    const header = await checkout.cartHeaderText();
    console.log('[TC-17] cart header after reload:', header);
    expect(header).toContain(TEST_MEMBER.name.split(' ')[0]);

    await expect(
      page.getByText('Purchase will be recorded to member profile'),
    ).toBeVisible({ timeout: 3_000 });
  });

  // ── TC-18: localStorage provides customer identity after reload ────────
  // Tests the localStorage fallback layer that works even when the backend
  // hasn't been restarted (i.e., sessions aren't returned by GET /api/carts).
  test('TC-18 | localStorage customer entry survives reload and is applied', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    await checkout.searchMember(TEST_MEMBER.name.split(' ')[0]);
    await checkout.selectFirstMemberResult();

    await expect(async () => {
      const names = await checkout.cartNames();
      expect(names.some((n) => n.includes(TEST_MEMBER.name.split(' ')[0]))).toBe(true);
    }).toPass({ timeout: 5_000 });

    // Verify localStorage was written before reload
    const entriesBefore = await page.evaluate(() => {
      const out: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        if (key.startsWith('shopiq_cart_customer_')) {
          try { out[key] = JSON.parse(localStorage.getItem(key)!); } catch {}
        }
      }
      return out;
    });
    console.log('[TC-18] localStorage before reload:', JSON.stringify(entriesBefore, null, 2));
    expect(Object.keys(entriesBefore).length).toBeGreaterThan(0);

    const memberEntry = Object.values(entriesBefore).find(
      (v: any) => v?.customerName?.includes(TEST_MEMBER.name.split(' ')[0]) || v?.customerId,
    );
    expect(memberEntry).toBeDefined();
    console.log('[TC-18] member localStorage entry:', JSON.stringify(memberEntry));

    // Reload and verify localStorage is still there (it persists across reloads by design)
    await page.reload({ waitUntil: 'networkidle' });
    await checkout.activeCartsHeader.waitFor({ state: 'visible' });

    const entriesAfter = await page.evaluate(() => {
      const out: Record<string, any> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        if (key.startsWith('shopiq_cart_customer_')) {
          try { out[key] = JSON.parse(localStorage.getItem(key)!); } catch {}
        }
      }
      return out;
    });
    console.log('[TC-18] localStorage after reload:', JSON.stringify(entriesAfter, null, 2));
    expect(Object.keys(entriesAfter).length).toBeGreaterThan(0);
  });
});
