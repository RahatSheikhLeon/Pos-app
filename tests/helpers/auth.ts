import { Page } from '@playwright/test';

const API_URL = 'http://localhost:3001/api';

export const TEST_USER = {
  email:    process.env.TEST_EMAIL    ?? 'playwright@shopiq.test',
  password: process.env.TEST_PASSWORD ?? 'playwright123',
  name:     'Playwright Tester',
};

// Fixed phone so the same member is reused across all runs
export const TEST_MEMBER = {
  name:  'Alice Playwright',
  phone: '+15550001234',
  email: 'alice.playwright@test.com',
  get membershipId() { return 'MEM-001234'; },
};

/** Log in via the UI form and wait until the app is ready. */
export async function loginViaUI(page: Page): Promise<void> {
  await page.goto('/login');
  await page.waitForURL('**/login');
  await page.getByPlaceholder('you@example.com').fill(TEST_USER.email);
  await page.getByPlaceholder('••••••••').fill(TEST_USER.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL((url) => !url.pathname.includes('/login'), { timeout: 12_000 });
}

/** Register the test user (idempotent — ignores 409 Conflict). */
export async function ensureTestUserExists(): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_USER),
    });
    const status = res.status;
    if (!res.ok && status !== 409) {
      console.warn('[setup] Register returned', status, await res.text());
    } else {
      console.log('[setup] Test user ready (status', status, ')');
    }
  } catch (e) {
    console.warn('[setup] Could not reach API — tests will fail at login:', e);
  }
}

/**
 * Ensure the fixed test member exists.
 * Uses `page.request` so the browser's auth cookies are included.
 * Returns the member's DB id.
 */
export async function ensureTestMemberExists(page: Page): Promise<string> {
  // Try to find by fixed phone first
  const search = await page.request.get(
    `${API_URL}/members/search?q=${encodeURIComponent(TEST_MEMBER.phone)}`,
  );
  if (search.ok()) {
    const members = await search.json();
    if (Array.isArray(members) && members.length > 0) {
      console.log('[setup] Test member already exists:', members[0].id);
      return members[0].id as string;
    }
  }

  // Create fresh
  const res = await page.request.post(`${API_URL}/members`, {
    data: {
      name:         TEST_MEMBER.name,
      phone:        TEST_MEMBER.phone,
      email:        TEST_MEMBER.email,
      membershipId: TEST_MEMBER.membershipId,
    },
  });

  if (res.ok()) {
    const body = await res.json();
    console.log('[setup] Test member created:', body.id);
    return body.id as string;
  }

  // 409 duplicate — search again
  const retry = await page.request.get(
    `${API_URL}/members/search?q=${encodeURIComponent(TEST_MEMBER.phone)}`,
  );
  if (retry.ok()) {
    const members = await retry.json();
    if (Array.isArray(members) && members.length > 0) return members[0].id as string;
  }

  throw new Error(`[helpers] Could not create or find test member: ${TEST_MEMBER.phone}`);
}

/**
 * Delete ALL active carts for the current user via the API.
 * Handles both the new { items, sessions } response shape and the old flat array.
 */
export async function clearAllCarts(page: Page): Promise<void> {
  const res = await page.request.get(`${API_URL}/carts`);
  if (!res.ok()) return;

  let body: any;
  try { body = await res.json(); } catch { return; }

  const sessionIds = new Set<string>();

  if (Array.isArray(body)) {
    // Old flat format — collect unique sessionIds from items
    for (const item of body as Array<{ sessionId: string }>) {
      if (item.sessionId) sessionIds.add(item.sessionId);
    }
  } else {
    // New { items, sessions } format
    for (const s of (body.sessions ?? []) as Array<{ id: string }>) {
      sessionIds.add(s.id);
    }
    for (const i of (body.items ?? []) as Array<{ sessionId: string }>) {
      sessionIds.add(i.sessionId);
    }
  }

  console.log('[clearAllCarts] deleting sessions:', [...sessionIds]);
  const deletes = [...sessionIds].map((id) =>
    page.request.delete(`${API_URL}/carts/sessions/${id}`).catch(() => {}),
  );
  await Promise.all(deletes);
}
