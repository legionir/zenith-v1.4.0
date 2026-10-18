import { test, expect, mountApp, expectNoA11yViolations, expectNoConsoleErrors, unmountApp, setSignal } from '../packages/testing-e2e/src/index';

test('real UI dialog traps the keyboard, passes axe, returns focus and releases scroll', async ({ page }) => {
  await mountApp(page, {
    baseURL: '/e2e/app-harness.html', plugins: [{ module: '/e2e/ui-test-plugin.mjs' }],
    html: '<h1>UI dialog</h1><button zen-fixture-ui-dialog aria-controls="confirmation">Open dialog</button><section id="confirmation"><h2 zen-dialog-title>Confirm action</h2><p zen-dialog-description>Review your change</p><button>First</button><button zen-dialog-close>Cancel</button></section>',
  });
  const opener = page.getByRole('button', { name: 'Open dialog' }); await opener.click(); const dialog = page.getByRole('dialog', { name: 'Confirm action' }); await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'First', exact: true })).toBeFocused(); await page.keyboard.press('Shift+Tab'); await expect(page.getByRole('button', { name: 'Cancel', exact: true })).toBeFocused(); await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'First', exact: true })).toBeFocused();
  await expectNoA11yViolations(page); await page.keyboard.press('Escape'); await expect(dialog).toBeHidden(); await expect(opener).toBeFocused();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden'); await unmountApp(page); expectNoConsoleErrors(page);
});

test('real tabs implement RTL automatic activation while skipping disabled buttons', async ({ page }) => {
  await mountApp(page, {
    baseURL: '/e2e/app-harness.html', plugins: [{ module: '/e2e/ui-test-plugin.mjs' }],
    html: '<h1>UI tabs</h1><section zen-tabs><div zen-tablist dir="rtl" aria-label="Sections"><button zen-tab>One</button><button zen-tab disabled>Unavailable</button><button zen-tab>Three</button></div><div zen-tabpanel>Panel one</div><div zen-tabpanel>Panel two</div><div zen-tabpanel>Panel three</div></section>',
  });
  await page.getByRole('tab', { name: 'One', exact: true }).focus(); await page.keyboard.press('ArrowLeft'); await expect(page.getByRole('tab', { name: 'Three', exact: true })).toBeFocused(); await expect(page.getByRole('tab', { name: 'Three', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveText('Panel three'); await expectNoA11yViolations(page); await unmountApp(page); expectNoConsoleErrors(page);
});

test('tooltip keeps independent focus/hover intent and stays dismissed after Escape', async ({ page }) => {
  await mountApp(page, {
    baseURL: '/e2e/app-harness.html', plugins: [{ module: '/e2e/ui-test-plugin.mjs' }],
    html: '<h1>Tooltip</h1><button id="help">Help</button><div zen-tooltip zen-tooltip-trigger="#help" zen-tooltip-delay="0" zen-tooltip-hide-delay="0">Additional help</div><button id="away" style="margin-top:100px">Away</button>',
  });
  const trigger = page.getByRole('button', { name: 'Help', exact: true }), tooltip = page.getByRole('tooltip');
  await trigger.focus(); await trigger.hover(); await expect(tooltip).toBeVisible();
  await page.getByRole('button', { name: 'Away', exact: true }).hover(); await expect(tooltip).toBeVisible();
  await page.keyboard.press('Escape'); await expect(tooltip).toBeHidden();
  // Focus remains on the trigger: entering hover again is not a new session.
  await trigger.hover(); await expect(tooltip).toBeHidden();
  await page.getByRole('button', { name: 'Away', exact: true }).focus(); await page.getByRole('button', { name: 'Away', exact: true }).hover();
  await trigger.focus(); await expect(tooltip).toBeVisible();
  await expectNoA11yViolations(page); await unmountApp(page); expectNoConsoleErrors(page);
});

test('accordion disclosures expose APG state and keyboard navigation in a real browser', async ({ page }) => {
  await mountApp(page, {
    baseURL: '/e2e/app-harness.html', plugins: [{ module: '/e2e/ui-test-plugin.mjs' }],
    html: '<h1>Frequently asked questions</h1><div zen-accordion zen-accordion-collapsible="false"><section zen-accordion-item><h2><button zen-accordion-trigger>First question</button></h2><div zen-accordion-panel>First answer</div></section><section zen-accordion-item><h2><button zen-accordion-trigger>Second question</button></h2><div zen-accordion-panel>Second answer</div></section></div>',
  });
  const first = page.getByRole('button', { name: 'First question' }), second = page.getByRole('button', { name: 'Second question' });
  await expect(first).toHaveAttribute('aria-expanded', 'true'); await first.focus(); await page.keyboard.press('ArrowDown'); await expect(second).toBeFocused(); await page.keyboard.press('Enter'); await expect(second).toHaveAttribute('aria-expanded', 'true'); await expect(first).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Enter'); await expect(second).toHaveAttribute('aria-expanded', 'true'); await expectNoA11yViolations(page); await unmountApp(page); expectNoConsoleErrors(page);
});

test('combobox maps declarative options, preserves textbox focus and selects with Arrow/Enter', async ({ page }) => {
  await mountApp(page, {
    baseURL: '/e2e/app-harness.html', plugins: [{ module: '/e2e/ui-test-plugin.mjs' }],
    html: '<h1>Destination</h1><div zen-combobox zen-combobox-options="[{code: \'a\', title: \'Athens\'}, {code: \'b\', title: \'Berlin\'}]" zen-combobox-option-label="title" zen-combobox-option-value="code" zen-combobox-filter="startsWith" zen-combobox-debounce="0"><label for="destination">City</label><input id="destination"><div zen-combobox-list aria-label="Cities"></div></div>',
  });
  const input = page.getByRole('combobox', { name: 'City' }); await input.fill('Be'); await expect(page.getByRole('option', { name: 'Berlin' })).toBeVisible(); await expect(input).toBeFocused(); await page.keyboard.press('ArrowDown'); await expect(input).toHaveAttribute('aria-activedescendant', /option-0$/); await page.keyboard.press('Enter'); await expect(input).toHaveValue('Berlin'); await expect(input).toHaveAttribute('aria-expanded', 'false');
  await expectNoA11yViolations(page); await unmountApp(page); expectNoConsoleErrors(page);
});

test('floating leave motion is inert immediately and reacts to reduced-motion changes', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await mountApp(page, {
    baseURL: '/e2e/app-harness.html', plugins: [{ module: '/e2e/ui-test-plugin.mjs' }],
    html: '<style>.fade.zen-enter-active,.fade.zen-leave-active{transition:opacity 10s}.fade.zen-enter-from,.fade.zen-leave-to{opacity:0}</style><h1>Animated surface</h1><button id="motion-trigger">Toggle help</button><section id="motion-surface" role="dialog" aria-label="Help" zen-popover zen-popover-trigger="#motion-trigger" zen-popover-transition="fade" zen-popover-transition-duration="10000"><button>Inside</button></section>',
  });
  const trigger = page.getByRole('button', { name: 'Toggle help' }), surface = page.locator('#motion-surface'); await trigger.click(); await expect(surface).toHaveAttribute('data-state', 'open'); await trigger.click(); await expect(surface).toHaveAttribute('data-state', 'closed'); await expect(surface).toHaveAttribute('inert', ''); await expect(surface).toHaveAttribute('aria-hidden', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' }); await expect(surface).toBeHidden(); await trigger.click(); await expect(surface).toBeVisible(); expect(await surface.evaluate(el => el.classList.contains('zen-enter-active'))).toBe(false);
  await expectNoA11yViolations(page); await unmountApp(page); expectNoConsoleErrors(page);
});


test('tooltip text projection preserves reactive decorative arrows and remains accessible', async ({ page }) => {
  await mountApp(page, {
    baseURL: '/e2e/app-harness.html', plugins: [{ module: '/e2e/ui-test-plugin.mjs' }], state: { text: 'First help', arrow: '#browser-tip-arrow-a' },
    html: '<h1>Tooltip content</h1><button id="browser-tip-trigger">Help</button><div zen-tooltip="$text" zen-tooltip-trigger="#browser-tip-trigger" zen-tooltip-delay="0" zen-tooltip-arrow=":$arrow"><em>Fallback</em><svg id="browser-tip-arrow-a" width="8" height="8"><path d="M0 0L8 0L4 8Z"></path></svg><svg id="browser-tip-arrow-b" width="8" height="8"><path d="M0 0L8 0L4 8Z"></path></svg></div>',
  });
  await page.getByRole('button', { name: 'Help' }).focus(); const tooltip = page.getByRole('tooltip'); await expect(tooltip).toBeVisible(); await expect(tooltip).toHaveText('First help'); await expect(page.locator('#browser-tip-arrow-a')).toBeVisible(); await expect(page.locator('#browser-tip-arrow-b')).toBeHidden();
  await setSignal(page, 'text', '<script>literal text</script>'); await setSignal(page, 'arrow', '#browser-tip-arrow-b'); await expect(tooltip).toHaveText('<script>literal text</script>'); expect(await tooltip.locator('script').count()).toBe(0); await expect(page.locator('#browser-tip-arrow-a')).toBeHidden(); await expect(page.locator('#browser-tip-arrow-b')).toBeVisible(); await expect(page.locator('#browser-tip-arrow-b')).toHaveAttribute('aria-hidden', 'true');
  await expectNoA11yViolations(page); await page.keyboard.press('Escape'); await expect(tooltip).toBeHidden(); await unmountApp(page); expectNoConsoleErrors(page);
});

test('date picker authorizes its shadow stylesheet before insertion under a real CSP header', async ({ page }) => {
  await page.route('**/e2e/app-harness.html', async route => {
    const response = await route.fetch();
    await route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'nonce-owner-nonce' 'nonce-next-nonce'" } });
  });
  await mountApp(page, {
    baseURL: '/e2e/app-harness.html', plugins: [{ module: '/e2e/ui-test-plugin.mjs' }],
    html: '<h1>CSP date picker</h1><form><zen-date-picker nonce="owner-nonce" calendar="gregorian" locale="en-US" format="YYYY-MM-DD" value="2024-02-10" name="date"></zen-date-picker><button type="reset">Reset date</button></form>',
  });
  const picker = page.locator('zen-date-picker'), grid = picker.locator('[role="grid"]');
  await expect(grid).toHaveCSS('display', 'grid'); await expect(picker.locator('style')).toHaveCount(1);
  await picker.locator('[data-day="15"]').click(); await expect(picker).toHaveAttribute('value', '2024-02-15');
  expect(await page.locator('form').evaluate(form => new FormData(form as HTMLFormElement).get('date'))).toBe('2024-02-15');
  await picker.evaluate(el => el.setAttribute('nonce', 'next-nonce')); await expect(grid).toHaveCSS('display', 'grid'); await expect(picker.locator('style')).toHaveCount(1);
  expect(await picker.locator('style').evaluate(style => (style as HTMLStyleElement).nonce)).toBe('next-nonce');
  await page.getByRole('button', { name: 'Reset date' }).click(); await expect(picker).toHaveAttribute('value', '2024-02-10');
  await expectNoA11yViolations(page); await unmountApp(page); expectNoConsoleErrors(page);
});
