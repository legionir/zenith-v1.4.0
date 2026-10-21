// #113 — dashboard RBAC in a REAL browser: allowed/forbidden roles see the
// right page, buttons and direct API outcomes; the mock API rejects
// unauthorized operations server-side (UI hiding is never the authorization).
// Needs built dists + the e2e server → validation phase.
import { test, expect, type Page } from '@playwright/test';
import { attachDiags } from './helpers';

async function login(page: Page, username: string, password: string) {
  await page.fill('#login-username', username);
  await page.fill('#login-password', password);
  await page.getByRole('button', { name: 'ورود', exact: true }).click();
  await page.waitForTimeout(1000);
}

test('admin sees users, stats and working delete buttons', async ({ page }) => {
  const diags = attachDiags(page);
  await page.goto('/dashboard/index.html');
  await login(page, 'admin', 'admin123');
  await expect(page.locator('tbody tr')).toHaveCount(3, { timeout: 10_000 });
  expect(await page.locator('button', { hasText: 'حذف' }).count()).toBeGreaterThan(0);
  await expect(page.locator('#stats')).toContainText('کاربران:');
  expect(diags.pageErrors).toEqual([]);
});

test('viewer sees no delete buttons and the API refuses with 403', async ({ page }) => {
  const diags = attachDiags(page);
  await page.goto('/dashboard/index.html');
  await login(page, 'viewer', 'viewer123');
  await expect(page.locator('tbody tr')).toHaveCount(3, { timeout: 10_000 });
  // zen-permission removes denied buttons from the DOM (not display:none).
  expect(await page.locator('button', { hasText: 'حذف' }).count()).toBe(0);
  // …and the mock API enforces the same denial server-side.
  const forbidden = await page.evaluate(async () => {
    const loginRes = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'viewer', password: 'viewer123' }),
    });
    const { token } = await loginRes.json();
    const del = await fetch('/api/users/2', {
      method: 'DELETE',
      headers: { authorization: `Bearer ${token}` },
    });
    const stats = await fetch('/api/admin/stats', {
      headers: { authorization: `Bearer ${token}` },
    });
    return { del: del.status, stats: stats.status };
  });
  expect(forbidden).toEqual({ del: 403, stats: 403 });
  expect(diags.pageErrors).toEqual([]);
});

test('wrong password shows an error and logged-out API calls are 401', async ({ page }) => {
  const diags = attachDiags(page);
  await page.goto('/dashboard/index.html');
  await login(page, 'admin', 'wrong');
  await expect(page.locator('#auth')).toContainText('اشتباه');
  const loggedOut = await page.evaluate(async () => {
    const users = await fetch('/api/users');
    const stats = await fetch('/api/admin/stats');
    return { users: users.status, stats: stats.status };
  });
  expect(loggedOut).toEqual({ users: 401, stats: 401 });
  expect(diags.pageErrors).toEqual([]);
});

test('logout returns to the login form', async ({ page }) => {
  const diags = attachDiags(page);
  await page.goto('/dashboard/index.html');
  await login(page, 'editor', 'editor123');
  await expect(page.locator('tbody tr')).toHaveCount(3, { timeout: 10_000 });
  await page.getByRole('button', { name: 'خروج' }).click();
  await expect(page.locator('#login-username')).toBeVisible({ timeout: 10_000 });
  expect(diags.pageErrors).toEqual([]);
});
