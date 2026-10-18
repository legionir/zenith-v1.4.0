import { test, expect, mountApp, setSignal, expectNoA11yViolations, expectNoConsoleErrors, unmountApp } from '../packages/testing-e2e/src/index';

test('reactive a11y directives control real keyboard focus, inertness and scroll leases', async ({ page }) => {
  await mountApp(page, {
    baseURL: '/e2e/app-harness.html', plugins: [{ module: '/e2e/accessibility-head-plugin.mjs' }], state: { active: false },
    html: '<h1>Accessibility ownership</h1><button id="before">Before</button><aside zen-inert="$active"><button>Background</button></aside><section aria-label="Focus region" zen-focus-trap="$active" zen-scroll-lock="$active"><button>First</button><button>Last</button></section>',
  });
  await page.getByRole('button', { name: 'Before', exact: true }).focus(); await setSignal(page, 'active', true); await expect(page.getByRole('button', { name: 'First', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(page.getByRole('button', { name: 'Last', exact: true })).toBeFocused(); await page.keyboard.press('Tab'); await expect(page.getByRole('button', { name: 'First', exact: true })).toBeFocused();
  await expect(page.locator('aside')).toHaveAttribute('inert', ''); expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden'); await expectNoA11yViolations(page);
  await setSignal(page, 'active', false); await expect(page.getByRole('button', { name: 'Before', exact: true })).toBeFocused(); await expect(page.locator('aside')).not.toHaveAttribute('inert'); expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden'); await unmountApp(page); expectNoConsoleErrors(page);
});

test('authored head content and reactive entries adopt the real title and restore it on App unmount', async ({ page }) => {
  await mountApp(page, {
    baseURL: '/e2e/app-harness.html', plugins: [{ module: '/e2e/accessibility-head-plugin.mjs' }], state: { title: 'Reactive title' },
    html: '<h1>Head ownership</h1><zen-head><title>Authored title</title><meta name="description" content="first" zen-head-key="description"><meta name="description" content="last" zen-head-key="description"></zen-head><span zen-head-title="$title"></span>',
  });
  await expect(page).toHaveTitle('Reactive title'); await expect(page.locator('head > title')).toHaveCount(1); await expect(page.locator('head > meta[name="description"]')).toHaveCount(1); await expect(page.locator('head > meta[name="description"]')).toHaveAttribute('content', 'last');
  await setSignal(page, 'title', '<script>Literal title</script>'); await expect(page).toHaveTitle('<script>Literal title</script>'); await expectNoA11yViolations(page); await unmountApp(page); await expect(page).toHaveTitle('Zenith App mounting harness'); await expect(page.locator('head > [data-zen-head]')).toHaveCount(0); expectNoConsoleErrors(page);
});

test('actual router navigation uses shared head titles, route announcements and main focus', async ({ page }) => {
  await mountApp(page, {
    baseURL: '/e2e/app-harness.html', plugins: [{ module: '/e2e/accessibility-head-plugin.mjs' }],
    html: '<h1>Route accessibility</h1><button zen-fixture-route-navigation>About route</button><section data-zen-main aria-label="Route content">About content</section><a href="/fixture-about">About</a>',
  });
  await page.getByRole('button', { name: 'About route' }).click(); await expect(page).toHaveTitle('About | Routes'); await expect(page.getByRole('status')).toHaveText('رفتید به About | Routes'); await expect(page.locator('[data-zen-main]')).toBeFocused(); await expect(page.locator('a')).toHaveAttribute('aria-current', 'page'); await expectNoA11yViolations(page);
  await unmountApp(page); await expect(page.getByRole('status')).toHaveCount(0); await expect(page).toHaveTitle('Zenith App mounting harness'); expectNoConsoleErrors(page);
});
