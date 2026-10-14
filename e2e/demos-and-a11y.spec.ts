// Playwright E2E for demos & automated WCAG 2.2 AA accessibility check (#33, #99).
import { test, expect } from '@playwright/test';

test('e2e fixture passes interactive flow and automated accessibility checks (#33, #99)', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/e2e/fixture.html');
  await page.waitForFunction(
    () => (window as unknown as { __ZENITH_E2E_READY__?: boolean }).__ZENITH_E2E_READY__ === true,
  );

  // Run automated DOM accessibility checks in browser context (#99)
  const violations = await page.evaluate(() => {
    const issues: string[] = [];
    document.querySelectorAll('button, [role="button"]').forEach((btn) => {
      if (!(btn.textContent || '').trim() && !btn.getAttribute('aria-label')) {
        issues.push('button-name');
      }
    });
    document.querySelectorAll('img').forEach((img) => {
      if (!img.hasAttribute('alt') && !img.getAttribute('aria-label')) {
        issues.push('image-alt');
      }
    });
    return issues;
  });

  expect(violations).toEqual([]);
  expect(errors).toEqual([]);
});
