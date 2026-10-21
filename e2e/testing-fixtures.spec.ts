import { test, expect, mountApp, getSignal, setSignal, snapshotDevtools, waitForHydration, expectNoA11yViolations, expectNoConsoleErrors, unmountApp } from '../packages/testing-e2e/src/index';

test('the shared fixture drives a real built signal and observes actual app readiness', async ({ page }) => {
  await mountApp(page, { url: '/e2e/fixture.html' });
  expect(await getSignal(page, 'count')).toBe(0);
  await setSignal(page, 'count', 4);
  await expect(page.locator('#counter')).toHaveText('4');
  expect(await snapshotDevtools(page)).toEqual({ count: 4 });
  expectNoConsoleErrors(page);
});

test('a missing readiness bridge genuinely times out', async ({ page }) => {
  await page.goto('about:blank');
  await expect(waitForHydration(page, { hydrationTimeout: 100 })).rejects.toThrow();
});

test.describe('negative diagnostic acceptance fixtures', () => {
  // Disable automatic teardown failure ONLY here: the assertion below must prove
  // that the explicit validator rejects the intentionally generated error.
  test.use({ zenithOptions: { failOnConsoleError: false } });
  test('an intentional console.error is rejected by the shared validator', async ({ page }) => {
    await page.goto('about:blank');
    await page.evaluate(() => console.error('intentional testing-e2e negative fixture'));
    expect(() => expectNoConsoleErrors(page)).toThrow();
  });
  test('an intentional serious a11y violation is rejected by actual axe', async ({ page }) => {
    await page.setContent('<html lang="en"><title>Negative fixture</title><body><button></button></body></html>');
    await expect(expectNoA11yViolations(page)).rejects.toThrow();
  });
});


test('HTML/state mounting renders a real App, reacts to interaction and passes axe', async ({ page }) => {
  await mountApp(page, {
    baseURL: '/e2e/app-harness.html',
    html: '<h1>Counter demo</h1><label>Count<input aria-label="Count" zen-model="count" /></label><p id="value" zen-text="count"></p>',
    state: { count: 'one' },
  });
  await expect(page.locator('#value')).toHaveText('one');
  await page.getByRole('textbox', { name: 'Count' }).fill('two');
  await expect(page.locator('#value')).toHaveText('two');
  expect(await getSignal(page, 'count')).toBe('two');
  await expectNoA11yViolations(page);
  await unmountApp(page);
  await expect(page.locator('[data-zen-test-app]')).toHaveCount(0);
});

test('a real notification dialog consumes plugin mounting and shared a11y diagnostics', async ({ page }) => {
  await mountApp(page, {
    baseURL: '/e2e/app-harness.html',
    html: '<h1>Dialog component</h1><button zen-fixture-dialog>Open confirmation</button>',
    plugins: [{ module: '/e2e/notification-test-plugin.mjs' }],
  });
  await page.getByRole('button', { name: 'Open confirmation' }).click();
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expectNoA11yViolations(page);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await unmountApp(page);
  expectNoConsoleErrors(page);
});
