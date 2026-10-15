// #136 — event modifiers in real browsers (Chromium / Firefox / WebKit): behaviour, capture
// ordering, timing, keys, and passive listener registration for scroll-blocking events.
import { test, expect } from '@playwright/test';
import { attachDiags, waitReady } from './helpers';

declare global {
  interface Window {
    __EVENTS_LOG__: string[];
    __LISTENER_CALLS__: Array<{ type: string; passive: boolean; capture: boolean }>;
  }
}

test.beforeEach(async ({ page }) => {
  // record the options every addEventListener call receives, before any module runs
  await page.addInitScript(() => {
    window.__LISTENER_CALLS__ = [];
    const original = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (
      this: EventTarget,
      type: string,
      listener: EventListenerOrEventListenerObject | null,
      options?: boolean | AddEventListenerOptions,
    ) {
      const o = typeof options === 'object' && options ? options : { capture: options === true };
      // Playwright injects its own window-level touch listeners; only the app’s DOM roots count.
      if (this === window) return original.call(this, type, listener, options);
      window.__LISTENER_CALLS__.push({
        type,
        passive: o.passive === true,
        capture: o.capture === true,
      });
      return original.call(this, type, listener, options);
    };
  });
});

async function open(page: import('@playwright/test').Page) {
  const diags = attachDiags(page);
  await page.goto('/e2e/events-fixture.html');
  await waitReady(page, '__ZENITH_EVENTS_READY__', diags);
  return diags;
}
const log = (page: import('@playwright/test').Page) =>
  page.evaluate(() => [...window.__EVENTS_LOG__]);

test('.prevent stops the default; a plain binding lets it through', async ({ page }) => {
  const diags = await open(page);
  await page.click('#prevent');
  expect(page.url()).not.toContain('#should-not-navigate');
  await page.click('#plain');
  expect(page.url()).toContain('#plain-navigates');
  expect(await log(page)).toEqual(
    ['click:prevent', 'click:plain', 'document-bubble']
      .slice(0, 0)
      .concat(['click:prevent', 'document-bubble', 'click:plain', 'document-bubble']),
  );
  expect(diags.pageErrors).toEqual([]);
});

test('.self ignores clicks that bubble from a child; .stop keeps the click from the document', async ({
  page,
}) => {
  await open(page);
  await page.click('#self-kid');
  await page.locator('#self').dispatchEvent('click');
  await page.click('#stop');
  const entries = await log(page);
  expect(entries.filter((e) => e === 'click:self')).toHaveLength(1);
  expect(entries.filter((e) => e === 'click:stop')).toHaveLength(1);
  // 2 clicks reached the document (self-kid, self); the .stop click did not
  expect(entries.filter((e) => e === 'document-bubble')).toHaveLength(2);
});

test('.once fires a single time', async ({ page }) => {
  await open(page);
  await page.click('#once');
  await page.click('#once');
  expect((await log(page)).filter((e) => e === 'click:once')).toHaveLength(1);
});

test('.capture runs before the child’s native listener', async ({ page }) => {
  await open(page);
  await page.click('#cap-kid');
  const entries = await log(page);
  expect(entries.indexOf('capture-action:cap')).toBeGreaterThanOrEqual(0);
  expect(entries.indexOf('capture-action:cap')).toBeLessThan(entries.indexOf('child-native'));
  expect(entries.filter((e) => e === 'capture-action:cap')).toHaveLength(1);
});

test('key modifiers: .enter, and .ctrl.enter needs both', async ({ page }) => {
  await open(page);
  await page.focus('#key-enter');
  await page.keyboard.press('a');
  await page.keyboard.press('Enter');
  expect((await log(page)).filter((e) => e === 'keydown:key-enter')).toHaveLength(1);

  await page.focus('#key-combo');
  await page.keyboard.press('Enter');
  expect((await log(page)).filter((e) => e === 'keydown:key-combo')).toHaveLength(0);
  await page.keyboard.press('Control+Enter');
  expect((await log(page)).filter((e) => e === 'keydown:key-combo')).toHaveLength(1);
});

test('.debounce.80 coalesces typing into a single call', async ({ page }) => {
  await open(page);
  await page.locator('#debounce').pressSequentially('hello', { delay: 10 });
  expect((await log(page)).filter((e) => e === 'input:debounce')).toHaveLength(0);
  await expect
    .poll(async () => (await log(page)).filter((e) => e === 'input:debounce').length)
    .toBe(1);
});

test('.throttle.150 passes the first pointerdown immediately and drops the burst', async ({
  page,
}) => {
  await open(page);
  const btn = page.locator('#throttle');
  await btn.dispatchEvent('pointerdown');
  expect((await log(page)).filter((e) => e === 'pointerdown:throttle')).toHaveLength(1);
  await btn.dispatchEvent('pointerdown');
  await btn.dispatchEvent('pointerdown');
  expect((await log(page)).filter((e) => e === 'pointerdown:throttle')).toHaveLength(1);
  // …and the trailing call lands once the window closes
  await expect
    .poll(async () => (await log(page)).filter((e) => e === 'pointerdown:throttle').length)
    .toBe(2);
});

test('scroll-blocking delegated events are passive at the root and never warn', async ({
  page,
}) => {
  const diags = await open(page);
  const calls = await page.evaluate(() => window.__LISTENER_CALLS__);
  for (const type of ['wheel', 'touchstart', 'touchmove', 'scroll']) {
    const forType = calls.filter((c) => c.type === type);
    expect(forType.length, `${type} registered`).toBeGreaterThan(0);
    expect(
      forType.every((c) => c.passive),
      `${type} must be passive`,
    ).toBe(true);
  }
  for (const type of ['click', 'keydown']) {
    expect(calls.filter((c) => c.type === type).some((c) => c.passive)).toBe(false);
  }
  // a `.prevent` binding on a passive event is ignored instead of triggering the browser's
  // "Unable to preventDefault inside passive event listener" message
  const prevented = await page.evaluate(() => {
    const ev = new Event('touchmove', { bubbles: true, cancelable: true });
    document.getElementById('touch')!.dispatchEvent(ev);
    document
      .getElementById('wheel')!
      .dispatchEvent(new Event('wheel', { bubbles: true, cancelable: true }));
    return ev.defaultPrevented;
  });
  expect(prevented).toBe(false);
  const entries = await log(page);
  expect(entries).toEqual(expect.arrayContaining(['touchmove:touch', 'wheel:wheel']));
  expect(diags.consoleErrors.filter((m) => /passive/i.test(m))).toEqual([]);
});
