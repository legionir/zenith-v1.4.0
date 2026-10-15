// Playwright E2E for demos & automated WCAG 2.2 AA accessibility check (#33, #99).
import { test, expect } from '@playwright/test';
import { attachDiags, waitReady } from './helpers';

test('e2e fixture passes interactive flow and automated accessibility checks (#33, #99)', async ({
  page,
}) => {
  const diags = attachDiags(page);

  await page.goto('/e2e/fixture.html');
  await waitReady(page, '__ZENITH_E2E_READY__', diags);

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
  expect(diags.pageErrors).toEqual([]);
  expect(diags.consoleErrors).toEqual([]);
});
