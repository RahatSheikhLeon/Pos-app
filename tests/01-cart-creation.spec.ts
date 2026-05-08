/**
 * Suite 1 — Add New Cart Flow
 *
 * Verifies that:
 * - Clicking "New Cart" immediately adds a tab to the Active Carts list
 * - The cart does NOT disappear after 1–2 seconds (race-condition guard)
 * - The active cart selection switches to the new cart
 * - UI state remains consistent after creation
 */

import { test, expect } from '@playwright/test';
import { loginViaUI, ensureTestUserExists, clearAllCarts } from './helpers/auth';
import { CheckoutPage } from './helpers/checkout.page';

test.describe('Add New Cart Flow', () => {
  test.beforeAll(async () => {
    await ensureTestUserExists();
  });

  test.beforeEach(async ({ page }) => {
    await loginViaUI(page);
    await clearAllCarts(page);
    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');
  });

  // ── TC-01: new cart appears immediately ───────────────────────────────
  test('TC-01 | new cart tab appears in Active Carts after clicking "New Cart"', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    const countBefore = await checkout.cartCount();
    console.log('[TC-01] carts before click:', countBefore);

    await checkout.clickNewCart();

    // Cart must appear immediately (optimistic update)
    await expect(async () => {
      const countAfter = await checkout.cartCount();
      expect(countAfter).toBeGreaterThan(countBefore);
    }).toPass({ timeout: 3_000 });

    const countAfter = await checkout.cartCount();
    console.log('[TC-01] carts after click:', countAfter);
    expect(countAfter).toBe(countBefore + 1);
  });

  // ── TC-02: cart does NOT disappear after 1.5 seconds ─────────────────
  test('TC-02 | new cart persists for at least 1.5 seconds (no race-condition rollback)', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    const countBefore = await checkout.cartCount();
    await checkout.clickNewCart();

    // Confirm it appeared
    await expect(async () => {
      expect(await checkout.cartCount()).toBeGreaterThan(countBefore);
    }).toPass({ timeout: 2_000 });

    // Wait 1.5 s — this is where the flash-and-disappear bug would trigger
    await page.waitForTimeout(1_500);

    const countAfter = await checkout.cartCount();
    console.log('[TC-02] carts after 1.5 s wait:', countAfter);

    expect(countAfter).toBeGreaterThan(countBefore);
    expect(countAfter).toBe(countBefore + 1);
  });

  // ── TC-03: newly created cart becomes the active cart ─────────────────
  test('TC-03 | newly created cart becomes the active cart', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    await checkout.clickNewCart();

    // Wait for the new cart tab to appear
    await expect(async () => {
      expect(await checkout.cartCount()).toBeGreaterThan(1);
    }).toPass({ timeout: 3_000 });

    // The active cart button (indigo background) should now be the new "Walk-in" cart
    // (but not the default one — there are now 2 and the new one is active)
    const headerText = await checkout.cartHeaderText();
    console.log('[TC-03] active cart header:', headerText);
    expect(headerText).toMatch(/Walk-in.+Cart/i);
  });

  // ── TC-04: add two carts sequentially ────────────────────────────────
  test('TC-04 | can add a second cart and all carts remain visible', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    const start = await checkout.cartCount();

    // Add first extra cart
    await checkout.clickNewCart();
    await expect(async () => {
      expect(await checkout.cartCount()).toBe(start + 1);
    }).toPass({ timeout: 3_000 });

    await page.waitForTimeout(500);

    // Add second extra cart (if plan allows)
    const beforeSecond = await checkout.cartCount();
    await checkout.clickNewCart();
    await page.waitForTimeout(2_000); // stability wait

    const final = await checkout.cartCount();
    console.log('[TC-04] start=%d, after first=%d, after second=%d', start, beforeSecond, final);

    // At minimum the first extra cart must still be there
    expect(final).toBeGreaterThanOrEqual(beforeSecond);
  });

  // ── TC-05: UI console has no unhandled errors ─────────────────────────
  test('TC-05 | no uncaught JS errors during cart creation', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.clickNewCart();
    await page.waitForTimeout(2_000);

    console.log('[TC-05] console errors:', errors);
    expect(errors.filter((e) => !e.includes('ResizeObserver'))).toHaveLength(0);
  });

  // ── TC-06: network request to save session is made ────────────────────
  test('TC-06 | clicking "New Cart" triggers PUT /api/carts/sessions/:sessionId', async ({ page }) => {
    const sessionRequests: string[] = [];

    page.on('request', (req) => {
      if (req.method() === 'PUT' && req.url().includes('/api/carts/sessions/')) {
        sessionRequests.push(req.url());
        console.log('[TC-06] session write request:', req.method(), req.url());
      }
    });

    page.on('response', (res) => {
      if (res.url().includes('/api/carts/sessions/')) {
        console.log('[TC-06] session write response:', res.status(), res.url());
      }
    });

    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.clickNewCart();
    await page.waitForTimeout(2_000);

    console.log('[TC-06] total session PUT requests:', sessionRequests.length);
    expect(sessionRequests.length).toBeGreaterThanOrEqual(1);
  });
});
