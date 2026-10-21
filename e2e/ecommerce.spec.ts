// #33 — ecommerce-demo real flows in a REAL browser: products load from the
// deterministic `/api/products` mock (scripts/e2e-server.mjs), cart
// add/remove runs through the UI, the out-of-stock block and the empty-cart
// checkout are negative controls (if inventory enforcement breaks, these go
// red), and persistence proves the localStorage hydrate. Needs built dists +
// the e2e server → validation phase.
import { test, expect } from '@playwright/test';
import { attachDiags } from './helpers';

async function productItems(page) {
  return page.locator('#products li');
}

test('products render from the mock API and add/remove flows work', async ({ page }) => {
  const diags = attachDiags(page);
  await page.goto('/ecommerce-demo/index.html');
  await expect(await productItems(page)).toHaveCount(4, { timeout: 10_000 });

  await page.locator('#products li').nth(0).getByRole('button', { name: 'افزودن' }).click();
  await expect(page.locator('#cart h2')).toContainText('1', { timeout: 10_000 });
  await expect(page.locator('#cart')).toContainText('کتاب TypeScript');

  await page.locator('#cart').getByRole('button', { name: 'حذف' }).click();
  await expect(page.locator('#cart h2')).toContainText('0', { timeout: 10_000 });
  expect(diags.pageErrors).toEqual([]);
  expect(diags.consoleErrors).toEqual([]);
});

test('out-of-stock product cannot be added (negative control)', async ({ page }) => {
  const diags = attachDiags(page);
  await page.goto('/ecommerce-demo/index.html');
  await expect(await productItems(page)).toHaveCount(4, { timeout: 10_000 });

  // Seed stock for id 3 is 0 — the store must refuse the add.
  await page.locator('#products li').nth(2).getByRole('button', { name: 'افزودن' }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('#cart h2')).toContainText('0');
  expect(diags.pageErrors).toEqual([]);
});

test('checkout empties the cart and reports success; empty checkout stays idle', async ({
  page,
}) => {
  const diags = attachDiags(page);
  await page.goto('/ecommerce-demo/index.html');
  await expect(await productItems(page)).toHaveCount(4, { timeout: 10_000 });

  // Empty cart: checkout must refuse and keep the idle status.
  await page.locator('#cart').getByRole('button', { name: 'ثبت سفارش' }).click();
  await page.waitForTimeout(500);
  await expect(page.locator('#cart')).toContainText('idle');

  await page.locator('#products li').nth(0).getByRole('button', { name: 'افزودن' }).click();
  await page.locator('#products li').nth(1).getByRole('button', { name: 'افزودن' }).click();
  await expect(page.locator('#cart h2')).toContainText('2', { timeout: 10_000 });
  await page.locator('#cart').getByRole('button', { name: 'ثبت سفارش' }).click();
  await expect(page.locator('#cart h2')).toContainText('0', { timeout: 10_000 });
  await expect(page.locator('#cart')).toContainText('success');
  expect(diags.pageErrors).toEqual([]);
  expect(diags.consoleErrors).toEqual([]);
});

test('cart persists across reload via localStorage hydrate', async ({ page }) => {
  const diags = attachDiags(page);
  await page.goto('/ecommerce-demo/index.html');
  await expect(await productItems(page)).toHaveCount(4, { timeout: 10_000 });

  await page.locator('#products li').nth(1).getByRole('button', { name: 'افزودن' }).click();
  await expect(page.locator('#cart h2')).toContainText('1', { timeout: 10_000 });
  // persistStore debounces writes (~300ms) — let the write land first.
  await page.waitForTimeout(800);
  await page.reload();
  await expect(await productItems(page)).toHaveCount(4, { timeout: 10_000 });
  await expect(page.locator('#cart h2')).toContainText('1', { timeout: 10_000 });
  await expect(page.locator('#cart')).toContainText('دوره آنلاین');
  expect(diags.pageErrors).toEqual([]);
});
