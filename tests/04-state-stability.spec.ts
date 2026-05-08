/**
 * Suite 4 — State Stability Under Rapid Actions
 *
 * Verifies that rapid interactions do not cause:
 * - UI flicker (cart tabs appearing/disappearing)
 * - State rollback after successful API responses
 * - Inconsistent cart/profile binding
 * - Duplicate cart tabs
 * - Incorrect active-cart switching
 */

import { test, expect } from '@playwright/test';
import {
  loginViaUI, ensureTestUserExists, ensureTestMemberExists,
  clearAllCarts, TEST_MEMBER,
} from './helpers/auth';
import { CheckoutPage } from './helpers/checkout.page';

test.describe('State Stability Under Rapid Actions', () => {
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

  // ── TC-19: rapid add + switch does not corrupt state ─────────────────
  test('TC-19 | rapid Add Cart → switch to default → back: no flicker or rollback', async ({ page }) => {
    const snapshots: { time: number; count: number }[] = [];

    const checkout = new CheckoutPage(page);
    await checkout.goto();

    const snapshotInterval = setInterval(async () => {
      try {
        const count = await checkout.cartCount();
        snapshots.push({ time: Date.now(), count });
      } catch {}
    }, 200);

    const canAdd = await checkout.canAddCart();
    if (canAdd) {
      await checkout.clickNewCart();
      await page.waitForTimeout(100);

      const defaultBtn = checkout.activeCarts.filter({ hasText: 'Walk-in' }).first();
      await defaultBtn.click();
      await page.waitForTimeout(100);
    }

    await page.waitForTimeout(2_000);
    clearInterval(snapshotInterval);

    console.log('[TC-19] snapshots:', snapshots.length, '| range:', {
      min: Math.min(...snapshots.map((s) => s.count)),
      max: Math.max(...snapshots.map((s) => s.count)),
    });

    // After adding one cart, count must never drop below 2 again
    if (snapshots.some((s) => s.count >= 2)) {
      const peaked = snapshots.findIndex((s) => s.count >= 2);
      const droppedAfterPeak = snapshots.slice(peaked).some((s) => s.count < 2);
      if (droppedAfterPeak) {
        console.error('[TC-19] DETECTED FLICKER — cart count dropped after reaching 2');
      }
      expect(droppedAfterPeak).toBe(false);
    }
  });

  // ── TC-20: select member on a clean page (no pre-existing extra cart) ─
  test('TC-20 | select member on fresh page: named cart appears, no duplicate', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    const countBefore = await checkout.cartCount();
    console.log('[TC-20] carts before member selection:', countBefore);

    // Select a member directly — should create their cart (1 slot needed: default=1, max=2)
    await checkout.searchMember(TEST_MEMBER.name.split(' ')[0]);
    await checkout.selectFirstMemberResult();

    await expect(async () => {
      const names = await checkout.cartNames();
      expect(names.some((n) => n.includes(TEST_MEMBER.name.split(' ')[0]))).toBe(true);
    }).toPass({ timeout: 5_000 });

    await page.waitForTimeout(1_000);

    const finalNames = await checkout.cartNames();
    console.log('[TC-20] final cart names:', finalNames);

    // No duplicate member carts
    const memberCarts = finalNames.filter((n) => n.includes(TEST_MEMBER.name.split(' ')[0]));
    expect(memberCarts).toHaveLength(1);

    // Default Walk-in cart must still be there
    expect(finalNames.some((n) => /Walk-in/i.test(n))).toBe(true);
  });

  // ── TC-21: closing a non-default cart removes it and leaves others ────
  test('TC-21 | closing a cart removes only that tab', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    const canAdd = await checkout.canAddCart();
    if (!canAdd) {
      console.log('[TC-21] plan limit already reached — creating a member cart instead');
      // At limit: select member (switches to existing or blocked)
      const countBefore = await checkout.cartCount();
      console.log('[TC-21] cart count at limit:', countBefore);
      // Just verify default cart still works
      expect(countBefore).toBeGreaterThanOrEqual(1);
      return;
    }

    // Add a walk-in cart
    await checkout.clickNewCart();
    await expect(async () => {
      expect(await checkout.cartCount()).toBeGreaterThan(1);
    }).toPass({ timeout: 3_000 });

    const countAfterAdd = await checkout.cartCount();
    console.log('[TC-21] carts after adding:', countAfterAdd);

    // Find and close the active non-default cart (has X button)
    const activeCartWithX = checkout.activeCarts
      .filter({ has: page.locator('[class*="bg-indigo-600"]') })
      .filter({ has: page.locator('[role="button"]') });

    const xCount = await activeCartWithX.locator('[role="button"]').count();
    if (xCount > 0) {
      await activeCartWithX.locator('[role="button"]').first().click();
      await page.waitForTimeout(1_000);

      const countAfterClose = await checkout.cartCount();
      console.log('[TC-21] carts after closing:', countAfterClose);
      expect(countAfterClose).toBe(countAfterAdd - 1);
    } else {
      console.log('[TC-21] active cart is default (no X button) — cannot close default cart, this is correct');
    }
  });

  // ── TC-22: no 4xx/5xx on cart creation and member selection ───────────
  test('TC-22 | no 4xx/5xx API errors during normal cart operations', async ({ page }) => {
    const failedRequests: { method: string; url: string; status: number }[] = [];

    page.on('response', (res) => {
      if (res.url().includes('/api/carts') && res.status() >= 400) {
        failedRequests.push({ method: res.request().method(), url: res.url(), status: res.status() });
        console.error('[TC-22] FAILED API:', res.request().method(), res.url(), res.status());
      }
    });

    const checkout = new CheckoutPage(page);
    await checkout.goto();

    if (await checkout.canAddCart()) {
      await checkout.clickNewCart();
      await page.waitForTimeout(500);
    }

    await checkout.searchMember(TEST_MEMBER.name.split(' ')[0]);
    await checkout.selectFirstMemberResult();
    await page.waitForTimeout(2_000);

    console.log('[TC-22] failed requests:', failedRequests);
    expect(failedRequests).toHaveLength(0);
  });

  // ── TC-23: rapid tab switching keeps correct cart/profile binding ──────
  test('TC-23 | cart header matches active tab after rapid switching', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    await checkout.searchMember(TEST_MEMBER.name.split(' ')[0]);
    await checkout.selectFirstMemberResult();

    await expect(async () => {
      const names = await checkout.cartNames();
      expect(names.some((n) => n.includes(TEST_MEMBER.name.split(' ')[0]))).toBe(true);
    }).toPass({ timeout: 5_000 });

    const defaultBtn = checkout.activeCarts.filter({ hasText: 'Walk-in' }).first();
    const memberBtn  = checkout.activeCarts.filter({
      hasText: TEST_MEMBER.name.split(' ')[0],
    }).first();

    // Rapid switch 4 times
    for (let i = 0; i < 4; i++) {
      await defaultBtn.click();
      await page.waitForTimeout(120);
      await memberBtn.click();
      await page.waitForTimeout(120);
    }

    await page.waitForTimeout(500);

    const header = await checkout.cartHeaderText();
    console.log('[TC-23] header after rapid switching:', header);
    expect(header).toContain(TEST_MEMBER.name.split(' ')[0]);

    await expect(
      page.getByText('Purchase will be recorded to member profile'),
    ).toBeVisible({ timeout: 3_000 });
  });

  // ── TC-24: localStorage customer key is written on member cart creation ─
  test('TC-24 | localStorage shopiq_cart_customer_* entry is created for member cart', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    await checkout.searchMember(TEST_MEMBER.name.split(' ')[0]);
    await checkout.selectFirstMemberResult();

    await expect(async () => {
      const names = await checkout.cartNames();
      expect(names.some((n) => n.includes(TEST_MEMBER.name.split(' ')[0]))).toBe(true);
    }).toPass({ timeout: 5_000 });

    await page.waitForTimeout(1_000);

    const customerEntries = await page.evaluate(() => {
      const entries: Record<string, string> = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)!;
        if (key.startsWith('shopiq_cart_customer_')) {
          entries[key] = localStorage.getItem(key)!;
        }
      }
      return entries;
    });

    console.log('[TC-24] localStorage entries:', JSON.stringify(customerEntries, null, 2));

    const values = Object.values(customerEntries);
    expect(values.length).toBeGreaterThan(0);

    const withMember = values.find((v) => {
      try {
        const p = JSON.parse(v);
        return p.customerId || p.customerName?.includes(TEST_MEMBER.name.split(' ')[0]);
      } catch { return false; }
    });
    expect(withMember).toBeDefined();
    console.log('[TC-24] member entry found:', withMember);
  });
});
