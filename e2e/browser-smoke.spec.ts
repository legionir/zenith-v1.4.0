// Browser smoke e2e for the CI pipeline (#79).
// Loads the *built* packages/state ESM bundle in real Chromium and drives the
// reactive core through the DOM: signal → computed → effect rendering.
import { test, expect } from '@playwright/test';
import { attachDiags, waitReady } from './helpers';

test('built state bundle renders and reacts in a browser', async ({ page }) => {
  const diags = attachDiags(page);

  await page.goto('/e2e/fixture.html');
  await waitReady(page, '__ZENITH_E2E_READY__', diags);

  await expect(page.locator('#counter')).toHaveText('0');
  await expect(page.locator('#doubled')).toHaveText('0');

  await page.click('#inc');
  await expect(page.locator('#counter')).toHaveText('1');
  await expect(page.locator('#doubled')).toHaveText('2');

  await page.click('#inc');
  await page.click('#inc');
  await expect(page.locator('#counter')).toHaveText('3');
  await expect(page.locator('#doubled')).toHaveText('6');

  expect(diags.pageErrors).toEqual([]);
  expect(diags.consoleErrors).toEqual([]);
});
