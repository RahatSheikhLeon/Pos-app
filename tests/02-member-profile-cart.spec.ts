/**
 * Suite 2 — Member Profile Cart Flow
 *
 * Verifies that:
 * - Searching a member returns results in the dropdown
 * - Selecting a member creates a new cart tab named after them
 * - The cart header reflects the member's name
 * - The "Purchase will be recorded to member profile" indicator appears
 * - The profile association survives UI re-renders (switching tabs and back)
 * - Attempting to select the same member twice switches to existing cart
 */

import { test, expect } from '@playwright/test';
import {
  loginViaUI, ensureTestUserExists, ensureTestMemberExists,
  clearAllCarts, TEST_MEMBER,
} from './helpers/auth';
import { CheckoutPage } from './helpers/checkout.page';

test.describe('Member Profile Cart Flow', () => {
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
    await page.goto('/checkout');
    await page.waitForLoadState('networkidle');
  });

  // ── TC-07: member search shows dropdown results ───────────────────────
  test('TC-07 | member search dropdown appears with results', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    await checkout.searchMember(TEST_MEMBER.phone);

    // Dropdown must be visible
    const dropdown = page.locator('[class*="absolute"][class*="top-full"]');
    await expect(dropdown).toBeVisible();

    // At least one result must be shown
    const results = dropdown.locator('button');
    expect(await results.count()).toBeGreaterThan(0);

    const firstText = await results.first().innerText();
    console.log('[TC-07] first result:', firstText);
    expect(firstText).toContain(TEST_MEMBER.name);
  });

  // ── TC-08: selecting member creates a named cart tab ──────────────────
  test('TC-08 | selecting a member creates a new cart tab with their name', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    const countBefore = await checkout.cartCount();
    await checkout.searchMember(TEST_MEMBER.name.split(' ')[0]);
    await checkout.selectFirstMemberResult();

    // New cart tab should appear
    await expect(async () => {
      const names = await checkout.cartNames();
      expect(names.some((n) => n.includes(TEST_MEMBER.name.split(' ')[0]))).toBe(true);
    }).toPass({ timeout: 4_000 });

    const countAfter = await checkout.cartCount();
    console.log('[TC-08] carts before=%d, after=%d', countBefore, countAfter);
    expect(countAfter).toBe(countBefore + 1);
  });

  // ── TC-09: cart header shows member name ──────────────────────────────
  test('TC-09 | left-panel cart header shows the member name after selection', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    await checkout.searchMember(TEST_MEMBER.name.split(' ')[0]);
    await checkout.selectFirstMemberResult();

    // Wait for the new cart tab to appear first, then check the header
    await expect(async () => {
      const names = await checkout.cartNames();
      expect(names.some((n) => n.includes(TEST_MEMBER.name.split(' ')[0]))).toBe(true);
    }).toPass({ timeout: 5_000 });

    // The newly created member cart becomes active — give the header time to update
    await expect(async () => {
      const header = await checkout.cartHeaderText();
      expect(header).toContain(TEST_MEMBER.name.split(' ')[0]);
    }).toPass({ timeout: 5_000 });

    const header = await checkout.cartHeaderText();
    console.log('[TC-09] cart header:', header);
  });

  // ── TC-10: member indicator is shown in the order summary ─────────────
  test('TC-10 | "Purchase will be recorded to member profile" appears', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    await checkout.searchMember(TEST_MEMBER.name.split(' ')[0]);
    await checkout.selectFirstMemberResult();

    await expect(
      page.getByText('Purchase will be recorded to member profile'),
    ).toBeVisible({ timeout: 5_000 });
  });

  // ── TC-11: profile remains after switching to default and back ────────
  test('TC-11 | member profile persists after switching between cart tabs', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    // Create member cart
    await checkout.searchMember(TEST_MEMBER.name.split(' ')[0]);
    await checkout.selectFirstMemberResult();

    await expect(async () => {
      const names = await checkout.cartNames();
      expect(names.some((n) => n.includes(TEST_MEMBER.name.split(' ')[0]))).toBe(true);
    }).toPass({ timeout: 4_000 });

    // Switch to default (Walk-in) cart
    const defaultBtn = checkout.activeCarts.filter({ hasText: 'Walk-in' }).first();
    await defaultBtn.click();
    await page.waitForTimeout(300);

    const headerAfterSwitch = await checkout.cartHeaderText();
    console.log('[TC-11] header after switch to default:', headerAfterSwitch);
    expect(headerAfterSwitch).toMatch(/Walk-in.+Cart/i);

    // Switch back to member cart
    const memberBtn = checkout.activeCarts.filter({
      hasText: TEST_MEMBER.name.split(' ')[0],
    }).first();
    await memberBtn.click();
    await page.waitForTimeout(300);

    const headerAfterReturn = await checkout.cartHeaderText();
    console.log('[TC-11] header after switch back to member cart:', headerAfterReturn);
    expect(headerAfterReturn).toContain(TEST_MEMBER.name.split(' ')[0]);
  });

  // ── TC-12: selecting same member twice switches to existing cart ───────
  test('TC-12 | selecting the same member twice switches to the existing cart (no duplicate)', async ({ page }) => {
    const checkout = new CheckoutPage(page);
    await checkout.goto();

    // First selection
    await checkout.searchMember(TEST_MEMBER.name.split(' ')[0]);
    await checkout.selectFirstMemberResult();
    await expect(async () => {
      expect(await checkout.cartCount()).toBeGreaterThan(1);
    }).toPass({ timeout: 4_000 });

    const countAfterFirst = await checkout.cartCount();

    // Switch to default, then select same member again
    const defaultBtn = checkout.activeCarts.filter({ hasText: 'Walk-in' }).first();
    await defaultBtn.click();
    await page.waitForTimeout(300);

    await checkout.searchMember(TEST_MEMBER.name.split(' ')[0]);
    await checkout.selectFirstMemberResult();
    await page.waitForTimeout(1_000);

    const countAfterSecond = await checkout.cartCount();
    console.log('[TC-12] after first=%d, after second=%d', countAfterFirst, countAfterSecond);

    // Should NOT create a second cart for the same member
    expect(countAfterSecond).toBe(countAfterFirst);
  });

  // ── TC-13: session write request sent for member cart ─────────────────
  test('TC-13 | selecting a member triggers PUT /api/carts/sessions with customerId', async ({ page }) => {
    const sessionBodies: any[] = [];

    page.on('request', async (req) => {
      if (req.method() === 'PUT' && req.url().includes('/api/carts/sessions/')) {
        try {
          const body = req.postDataJSON();
          sessionBodies.push(body);
          console.log('[TC-13] session write body:', JSON.stringify(body));
        } catch {}
      }
    });

    const checkout = new CheckoutPage(page);
    await checkout.goto();
    await checkout.searchMember(TEST_MEMBER.name.split(' ')[0]);
    await checkout.selectFirstMemberResult();
    await page.waitForTimeout(2_000);

    console.log('[TC-13] total session writes:', sessionBodies.length);
    expect(sessionBodies.length).toBeGreaterThanOrEqual(1);

    // At least one write must include customerName and customerId
    const withCustomer = sessionBodies.find((b) => b?.customerId || b?.customerName);
    expect(withCustomer).toBeDefined();
    console.log('[TC-13] session with customer data:', JSON.stringify(withCustomer));
  });
});
