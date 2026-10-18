import { test, expect, mountApp, expectNoA11yViolations, expectNoConsoleErrors, unmountApp } from '../packages/testing-e2e/src/index';

test('date picker uses native form association, required/reset/disabled behavior and the Gregorian keyboard', async ({ page }) => {
  await mountApp(page, {
    baseURL: '/e2e/app-harness.html', plugins: [{ module: '/e2e/ui-test-plugin.mjs' }],
    html: '<h1>Booking date</h1><form id="booking"><zen-date-picker name="arrival" calendar="gregorian" locale="en-US" format="YYYY-MM-DD" value="2024-02-28" required></zen-date-picker><button type="reset">Reset</button></form>',
  });
  const picker = page.locator('zen-date-picker'), day = picker.locator('[data-day="28"]');
  await day.focus(); await page.keyboard.press('ArrowRight'); await expect(picker.locator('[data-day="29"]')).toBeFocused(); await page.keyboard.press('Enter');
  await expect(picker).toHaveAttribute('value', '2024-02-29');
  expect(await page.locator('form').evaluate(form => new FormData(form as HTMLFormElement).getAll('arrival'))).toEqual(['2024-02-29']);
  await picker.evaluate(el => el.setAttribute('value', '')); expect(await page.locator('form').evaluate(form => (form as HTMLFormElement).checkValidity())).toBe(false);
  await page.getByRole('button', { name: 'Reset', exact: true }).click(); await expect(picker).toHaveAttribute('value', '2024-02-28');
  await picker.evaluate(el => el.setAttribute('disabled', '')); expect(await page.locator('form').evaluate(form => new FormData(form as HTMLFormElement).has('arrival'))).toBe(false);
  await picker.evaluate(el => el.removeAttribute('disabled')); await expectNoA11yViolations(page); await unmountApp(page); expectNoConsoleErrors(page);
});

test('range picker serializes only complete ranges, honors readonly and preserves the shared event contract', async ({ page }) => {
  await mountApp(page, {
    baseURL: '/e2e/app-harness.html', plugins: [{ module: '/e2e/ui-test-plugin.mjs' }],
    html: '<h1>Stay dates</h1><form><zen-date-picker name="stay" calendar="gregorian" locale="en" format="YYYY-MM-DD" value="2024-02-01..2024-02-02" range></zen-date-picker></form>',
  });
  const picker = page.locator('zen-date-picker'); await picker.locator('[data-day="20"]').click(); await expect(picker).toHaveAttribute('value', '2024-02-20..');
  expect(await page.locator('form').evaluate(form => new FormData(form as HTMLFormElement).has('stay'))).toBe(false);
  await picker.locator('[data-day="10"]').click(); await expect(picker).toHaveAttribute('value', '2024-02-10..2024-02-20');
  expect(await page.locator('form').evaluate(form => new FormData(form as HTMLFormElement).get('stay'))).toBe('2024-02-10..2024-02-20');
  await picker.evaluate(el => el.setAttribute('readonly', '')); await picker.locator('[data-day="15"]').click(); await expect(picker).toHaveAttribute('value', '2024-02-10..2024-02-20');
  await expectNoA11yViolations(page); await unmountApp(page); expectNoConsoleErrors(page);
});
