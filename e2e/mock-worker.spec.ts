import { test, expect, expectNoConsoleErrors } from '../packages/testing-e2e/src/index';

test('a real module Service Worker intercepts native fetch without patching page fetch', async ({ page }) => {
  await page.goto('/e2e/app-harness.html');
  const result = await page.evaluate(async () => {
    const moduleURL = '/packages/mock/dist/index.js';
    const mock = await import(moduleURL) as typeof import('../packages/mock/src');
    const original = window.fetch;
    const server = mock.createMockServer([mock.rest.get('/e2e/mocked-users/:id', ({ params }) => mock.respond({ json: { id: params.id } }))]);
    const close = await mock.setupWorker(server, { url: '/e2e/zenith-mock-sw.js' });
    try { const response = await fetch('/e2e/mocked-users/42'); return { status: response.status, data: await response.json(), unchanged: window.fetch === original }; }
    finally { close(); server.close(); }
  });
  expect(result).toEqual({ status: 200, data: { id: '42' }, unchanged: true }); expectNoConsoleErrors(page);
});

test('nested worker leases preserve the remaining server and never patch native fetch', async ({ page }) => {
  await page.goto('/e2e/app-harness.html');
  const result = await page.evaluate(async () => {
    const moduleURL = '/packages/mock/dist/index.js', mock = await import(moduleURL) as typeof import('../packages/mock/src'), original = window.fetch;
    const first = mock.createMockServer([mock.rest.get('/e2e/lease', () => mock.respond({ text: 'first' }))]), second = mock.createMockServer([mock.rest.get('/e2e/lease', () => mock.respond({ text: 'second' }))]);
    const a = await mock.setupWorker(first, { url: '/e2e/zenith-mock-sw.js' }), b = await mock.setupWorker(second, { url: '/e2e/zenith-mock-sw.js' });
    try {
      const before = await (await fetch('/e2e/lease')).text(); a(); first.close(); const after = await (await fetch('/e2e/lease')).text(); return { before, after, native: window.fetch === original };
    } finally { a(); b(); first.close(); second.close(); }
  });
  expect(result).toEqual({ before: 'second', after: 'second', native: true }); expectNoConsoleErrors(page);
});

test('worker faithfully transports HEAD and null-body status responses', async ({ page }) => {
  await page.goto('/e2e/app-harness.html');
  const result = await page.evaluate(async () => {
    const moduleURL = '/packages/mock/dist/index.js', mock = await import(moduleURL) as typeof import('../packages/mock/src');
    const server = mock.createMockServer([mock.rest.head('/e2e/head', () => mock.respond({ headers: { 'x-fixture': 'head' } })), mock.rest.get('/e2e/empty', () => mock.respond({ status: 204 }))]);
    const release = await mock.setupWorker(server, { url: '/e2e/zenith-mock-sw.js' });
    try { const head = await fetch('/e2e/head', { method: 'HEAD' }), empty = await fetch('/e2e/empty'); return { head: head.status, header: head.headers.get('x-fixture'), headBody: await head.text(), empty: empty.status, emptyBody: await empty.text() }; }
    finally { release(); server.close(); }
  });
  expect(result).toEqual({ head: 200, header: 'head', headBody: '', empty: 204, emptyBody: '' }); expectNoConsoleErrors(page);
});

test('the real Resource demo backend serves both public HTTP and Resource consumers', async ({ page }) => {
  await page.goto('/e2e/app-harness.html');
  const result = await page.evaluate(async () => {
    const backendURL = '/demos/resource/mock-backend.mjs', httpURL = '/packages/http/dist/index.js', resourceURL = '/packages/resource/dist/index.js';
    const { installResourceBackend } = await import(backendURL) as { installResourceBackend(options: { latency: number }): { server: { calls: readonly unknown[] }; reset(): void; dispose(): void } };
    const { http } = await import(httpURL) as typeof import('../packages/http/src'), { Resource } = await import(resourceURL) as typeof import('../packages/resource/src');
    const original = window.fetch, backend = installResourceBackend({ latency: 0 }), resource = new Resource<Array<{ id: number; name: string; price: number }>>({ url: '/api/items', retryCount: 0 });
    try {
      const initial = await resource.list(), created = await http.post<{ id: number }>('/api/items', { name: 'Fixture item', price: 9 });
      const updated = await http.put<{ price: number }>(`/api/items/${created.data!.id}`, { price: 10 }); await http.delete(`/api/items/${created.data!.id}`); backend.reset();
      const reset = await resource.list(true); return { initial: initial.data?.length, created: created.status, price: updated.data?.price, reset: reset.data?.length };
    } finally { resource.dispose(); backend.dispose(); if (window.fetch !== original) throw new Error('Demo leaked its fetch lease.'); }
  });
  expect(result).toEqual({ initial: 3, created: 201, price: 10, reset: 3 }); expectNoConsoleErrors(page);
});
