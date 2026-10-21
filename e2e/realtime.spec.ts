import { test, expect, expectNoConsoleErrors, mountApp } from '../packages/testing-e2e/src/index';

test('native EventSource receives data over a real same-origin SSE response', async ({ page }) => {
  const stream = page.waitForResponse(response => response.url().endsWith('/e2e/realtime-events'));
  await page.goto('/e2e/realtime-fixture.html');
  expect((await stream).status()).toBe(200);
  await expect(page.locator('#message')).toHaveText('42');
  expectNoConsoleErrors(page);
});

test('zen-ws mounted through the shared App fixture sends a real browser WebSocket frame', async ({ page }) => {
  await page.goto('/e2e/app-harness.html');
  await page.evaluate(() => {
    const received: unknown[] = [];
    (globalThis as unknown as { realtimeFrames: unknown[] }).realtimeFrames = received;
    document.addEventListener('zen-realtime-message', event => received.push((event as CustomEvent<unknown>).detail));
  });
  const address = new URL('/e2e/realtime-socket', page.url());
  address.protocol = address.protocol === 'https:' ? 'wss:' : 'ws:';
  await mountApp(page, {
    html: '<h1>Realtime demo</h1><section zen-ws="endpoint" zen-realtime-send="outgoing"><output id="received" zen-text="data.messages.length"></output></section>',
    state: { endpoint: address.href, outgoing: { value: 42 } },
    plugins: [{ module: '/e2e/realtime-test-plugin.mjs' }],
  });
  await expect(page.locator('#received')).toHaveText('1');
  expect(await page.evaluate(() => (globalThis as unknown as { realtimeFrames: unknown[] }).realtimeFrames)).toEqual([{ value: 42 }]);
  expectNoConsoleErrors(page);
});

test('zen-sse publishes a real HTTP stream into named reactive state', async ({ page }) => {
  await mountApp(page, {
    baseURL: '/e2e/app-harness.html',
    html: '<h1>SSE demo</h1><section zen-sse="endpoint" zen-state="feed"><output id="received" zen-text="feed.messages.length"></output></section>',
    state: { endpoint: new URL('/e2e/realtime-events', test.info().project.use.baseURL).href },
    plugins: [{ module: '/e2e/realtime-test-plugin.mjs' }],
  });
  await expect(page.locator('#received')).toHaveText('1');
  expectNoConsoleErrors(page);
});
