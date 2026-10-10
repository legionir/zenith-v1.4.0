// #30 — XSS/mXSS corpus in a REAL browser: sanitized output is injected via
// innerHTML into live Chromium DOM and no known payload executes.
import { test, expect } from '@playwright/test';

test('no XSS/mXSS payload executes after sanitizeHTML + innerHTML', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', (err) => pageErrors.push(String(err)));

  await page.goto('/e2e/xss-fixture.html');
  await page.waitForFunction(() => window.__ZENITH_XSS_READY__ === true);

  const results = await page.evaluate(async () => await window.runCorpus());

  // Positive control باید کار کند، وگرنه harness شکسته و تست توخالی است
  expect(results.controlFired).toBe(true);
  expect(results.failures, `executed payloads: ${results.failures.join(', ')}`).toEqual([]);
  expect(results.total).toBeGreaterThanOrEqual(40);
  expect(pageErrors).toEqual([]);
});
