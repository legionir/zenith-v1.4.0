// #30 — XSS/mXSS corpus in a REAL browser: sanitized output is injected via
// innerHTML into live Chromium DOM and no known payload executes.
import { test, expect } from '@playwright/test';
import { attachDiags, waitReady } from './helpers';

type CorpusResults = { total: number; failures: string[]; controlFired: boolean };

test('no XSS/mXSS payload executes after sanitizeHTML + innerHTML', async ({ page }) => {
  const diags = attachDiags(page);

  await page.goto('/e2e/xss-fixture.html');
  await waitReady(page, '__ZENITH_XSS_READY__', diags);

  const results = await page.evaluate(async () =>
      (window as unknown as { runCorpus: () => Promise<CorpusResults> }).runCorpus(),
    );

  // Positive control باید کار کند، وگرنه harness شکسته و تست توخالی است
  expect(results.controlFired).toBe(true);
  expect(results.failures, `executed payloads: ${results.failures.join(', ')}`).toEqual([]);
  expect(results.total).toBeGreaterThanOrEqual(40);
  expect(diags.pageErrors).toEqual([]);
});
