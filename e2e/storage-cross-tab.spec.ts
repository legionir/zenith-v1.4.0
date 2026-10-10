// #145 — browser e2e: «داده در یک تب در تب دیگر بازتاب می‌یابد»
// (معیار پذیرش SPEC §۲.۵). دو صفحۀ واقعی Chromium روی یک origin؛ نوشتن از
// طریق `@zenith/storage` (record wrapper + storage event) باید در subscribe
// صفحۀ دیگر بنشیند. این همان مسیر مرورگری است که jsdom فقط شبیه‌سازی می‌کند.
import { test, expect } from '@playwright/test';

test('storage writes in one tab are reflected in another tab (cross-tab sync)', async ({
  page,
  context,
}) => {
  const errors: string[] = [];
  const attach = (p: typeof page) => {
    p.on('pageerror', (err) => errors.push(String(err)));
    p.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
  };
  attach(page);

  await page.goto('/e2e/storage-fixture.html');
  await page.waitForFunction(() => window.__ZENITH_E2E_READY__ === true);

  // تب دوم (همان origin ⇒ همان localStorage)
  const tabB = await context.newPage();
  attach(tabB);
  await tabB.goto('/e2e/storage-fixture.html');
  await tabB.waitForFunction(() => window.__ZENITH_E2E_READY__ === true);

  // نوشتن در تب B ⇒ بازتاب در تب A
  await tabB.locator('#field').fill('shiraz');
  await expect(page.locator('#reflected')).toHaveText('shiraz', { timeout: 5_000 });

  // و در جهت معکوس
  await page.locator('#field').fill('tabriz');
  await expect(tabB.locator('#reflected')).toHaveText('tabriz', { timeout: 5_000 });

  // داده واقعاً در localStorage زیر رکورد {v,t,e,d} نشسته است (نه خام)
  const rec = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('zen:e2i.extra') ?? 'null'),
  );
  expect(rec).toEqual(expect.objectContaining({ v: 1, d: 'tabriz' }));

  expect(errors).toEqual([]);
});
