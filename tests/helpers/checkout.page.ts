import { Page, Locator } from '@playwright/test';

/**
 * Page-object model for /checkout.
 * All selectors are derived from the actual Checkout.tsx source.
 */
export class CheckoutPage {
  readonly page: Page;

  readonly tabSearchProfile: Locator;
  readonly memberSearchInput: Locator;
  readonly activeCartsHeader: Locator;
  readonly activeCarts: Locator;
  readonly cartHeader: Locator;

  constructor(page: Page) {
    this.page = page;

    this.tabSearchProfile = page.getByRole('button', { name: /Search Profile/i });

    this.memberSearchInput = page.getByPlaceholder('Type name or phone to search...');

    this.activeCartsHeader = page.locator('p', { hasText: /Active Carts/ });

    this.activeCarts = page
      .locator('.card')
      .filter({ has: page.locator('p', { hasText: /Active Carts/ }) })
      .locator('button');

    this.cartHeader = page.locator('span.text-sm.font-semibold', { hasText: /Cart$/ });
  }

  async goto() {
    await this.page.goto('/checkout');
    await this.page.waitForLoadState('networkidle');
    await this.activeCartsHeader.waitFor({ state: 'visible' });
  }

  async cartCount(): Promise<number> {
    return this.activeCarts.count();
  }

  /**
   * Click the "New Cart" button.
   * When the free-plan limit is reached the button text changes to
   * "Upgrade for more" — this method handles both labels.
   */
  async clickNewCart() {
    // Try primary label first
    const newCartBtn = this.page.getByRole('button', { name: /New Cart/i });
    const upgradeBtn = this.page.getByRole('button', { name: /Upgrade for more/i });

    const isNewCartVisible = await newCartBtn.isVisible().catch(() => false);
    if (isNewCartVisible) {
      await newCartBtn.click();
    } else {
      // Plan limit reached — clicking the upgrade button shows an error toast, which is fine
      await upgradeBtn.click();
    }
  }

  /** Whether more carts can be added (button is "New Cart", not "Upgrade for more") */
  async canAddCart(): Promise<boolean> {
    return this.page.getByRole('button', { name: /New Cart/i }).isVisible();
  }

  async cartNames(): Promise<string[]> {
    const count = await this.activeCarts.count();
    const names: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = (await this.activeCarts.nth(i).innerText())
        .trim()
        .split('\n')[0]  // first line = customer name
        .trim();
      names.push(text);
    }
    return names;
  }

  async searchMember(query: string) {
    await this.tabSearchProfile.click();
    await this.memberSearchInput.fill(query);
    await this.page.waitForSelector('[class*="absolute"][class*="top-full"]', { timeout: 6_000 });
  }

  async selectFirstMemberResult() {
    const dropdown = this.page.locator('[class*="absolute"][class*="top-full"]');
    await dropdown.locator('button').first().click();
  }

  async waitForToast(text: string | RegExp, timeout = 6_000) {
    await this.page.getByText(text).first().waitFor({ state: 'visible', timeout });
  }

  async cartHeaderText(): Promise<string> {
    return (await this.cartHeader.first().innerText()).trim();
  }
}
