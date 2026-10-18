// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseHTML } from 'linkedom/worker';
import { createApp } from '@zenith/runtime-core';
import { headPlugin } from '@zenith/head';
import { logger } from '@zenith/logger';
import { createFetchHandler, createCloudflareHandler, createDenoHandler, type EdgeDOM } from '../src';
const template = '<main id="app"><h1 zen-text="name"></h1><div zen-html="markup"></div></main>';
const request = (path = '/', init?: RequestInit) => new Request(`https://edge.example${path}`, init);
const dom = (): EdgeDOM => ({ document: parseHTML(`<!DOCTYPE html><html><head></head><body>${template}</body></html>`).document as unknown as Document });
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
describe('explicit-document Edge request ownership', () => {
  it('isolates 100 interleaved request states/head/locale/nonces without ambient DOM', async () => {
    const before = Object.getOwnPropertyDescriptor(globalThis, 'document'); const apps: ReturnType<typeof createApp>[] = [];
    const handler = createFetchHandler({ template, csp: { nonce: true },
      state: async (route) => { await Promise.resolve(); return { name: route, markup: '<img src=x onerror="private()"><script>private()</script><b>safe</b>' }; },
      head: async route => ({ title: route, jsonLd: { name: route } }),
      i18n: route => ({ locale: route.endsWith('0') ? 'fa' : 'en' }),
      app(context) { const app = createApp({ state: context.state, plugins: [headPlugin({ document: context.document })] }); apps.push(app); return app; },
    });
    const results = await Promise.all(Array.from({ length: 100 }, async (_, index) => { const result = await handler(request(`/request-${index}`)); return { index, result, html: await result.text() }; }));
    const nonces = new Set<string>();
    for (const { index, result, html } of results) {
      expect(result.status).toBe(200); expect(html).toContain(`<h1 zen-text="name">/request-${index}</h1>`); expect(html).toContain(`<title data-zen-head="title">/request-${index}</title>`);
      const renderedDOM = parseHTML(html).document; expect(renderedDOM.querySelector('#app img')?.hasAttribute('onerror')).toBe(false); expect(renderedDOM.querySelector('#app script')).toBeNull(); expect(html).toContain('<b>safe</b>');
      expect(html).toContain(`lang="${index % 10 === 0 ? 'fa' : 'en'}"`);
      const nonce = /'nonce-([^']+)'/.exec(result.headers.get('Content-Security-Policy') ?? '')![1]!; expect(html).toContain(`nonce="${nonce}"`); nonces.add(nonce);
    }
    expect(nonces.size).toBe(100); for (const app of apps) expect(() => app.run(() => {})).toThrow();
    expect(Object.getOwnPropertyDescriptor(globalThis, 'document')).toEqual(before);
  });
  it('escapes hydration state and route script delimiters with a real DOM sanitizer', async () => {
    const html = await (await createFetchHandler({ template, state: { name: '</script><script>attack()</script>\u2028', markup: '<a href="javascript:attack()">x</a>' } })(request())).text();
    expect(html).toContain('\\u003c/script\\u003e'); expect(html).not.toContain('<script>attack()'); expect(html).not.toContain('href="javascript:');
  });
  it('handles HEAD/method/health/assets without mounting an App', async () => {
    const app = vi.fn(() => createApp()); const assets = vi.fn(async path => path === '/asset.txt' ? new Response('asset') : undefined);
    const handler = createFetchHandler({ template, app, assets });
    expect((await handler(request('/health'))).status).toBe(200); expect((await handler(request('/', { method: 'POST' }))).headers.get('Allow')).toBe('GET, HEAD');
    const head = await handler(request('/asset.txt', { method: 'HEAD' })); expect(await head.text()).toBe(''); expect(app).not.toHaveBeenCalled();
    expect(await (await handler(request('/asset.txt'))).text()).toBe('asset');
    expect((await handler(request('/%2e%2e%2fsecret'))).status).toBe(403);
  });
  it('does not mount after an aborted state loader and releases its owned DOM', async () => {
    const dispose = vi.fn(); const app = vi.fn(() => createApp()); let entered!: () => void; const started = new Promise<void>(resolve => { entered = resolve; });
    const handler = createFetchHandler({ template, createDOM: () => ({ ...dom(), dispose }), app, state: async () => { entered(); return new Promise<Record<string, unknown>>(() => {}); } });
    const controller = new AbortController(); const pending = handler(request('/', { signal: controller.signal })); await started; controller.abort();
    expect((await pending).status).toBe(499); await Promise.resolve(); expect(app).not.toHaveBeenCalled(); expect(dispose).toHaveBeenCalledOnce();
  });
  it('times out a stalled DOM factory and disposes a late allocation exactly once', async () => {
    vi.useFakeTimers(); let resolve!: (dom: EdgeDOM) => void; const dispose = vi.fn(); const app = vi.fn(() => createApp());
    const handler = createFetchHandler({ template, timeout: 10, app, createDOM: () => new Promise(r => { resolve = r; }) });
    const pending = handler(request()); await vi.advanceTimersByTimeAsync(11); expect((await pending).status).toBe(504);
    resolve({ ...dom(), dispose }); await vi.runAllTimersAsync(); expect(dispose).toHaveBeenCalledOnce(); expect(app).not.toHaveBeenCalled();
  });
  it('refuses to dispose another live request\'s shared DOM', async () => {
    const shared = { ...dom(), dispose: vi.fn() }; let unblock!: (state: Record<string, unknown>) => void; let entered!: () => void; const started = new Promise<void>(r => { entered = r; });
    const first = createFetchHandler({ template, createDOM: () => shared, state: () => { entered(); return new Promise(r => { unblock = r; }); } })(request('/first'));
    await started; vi.spyOn(logger, 'error').mockImplementation(() => {});
    const second = await createFetchHandler({ template, createDOM: () => shared })(request('/second')); expect(second.status).toBe(500); expect(shared.dispose).not.toHaveBeenCalled();
    unblock({ name: 'first', markup: '' }); expect((await first).status).toBe(200); expect(shared.dispose).toHaveBeenCalledOnce();
  });
  it('owns waitUntil cleanup and never rejects a Response for an async disposal failure', async () => {
    const tasks: Promise<unknown>[] = []; vi.spyOn(logger, 'error').mockImplementation(() => {});
    const handler = createFetchHandler({ template, createDOM: () => ({ ...dom(), dispose: async () => { throw new Error('private-secret'); } }), state: { name: 'x', markup: '' }, onResponse: () => {} });
    const response = await handler(request(), undefined, { waitUntil(task) { tasks.push(task); } }); expect(response.status).toBe(200); await Promise.all(tasks); expect(tasks.length).toBe(2);
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain('private-secret');
  });
  it('provides both deployment facade shapes and rejects unsupported configurations', async () => {
    expect(typeof createCloudflareHandler({ template }).fetch).toBe('function'); expect(typeof createDenoHandler({ template })).toBe('function');
    expect(() => createFetchHandler({ template, timeout: 0 })).toThrow(); expect(() => createFetchHandler({ template, domImpl: 'happy-dom' })).toThrow();
  });
});

it('copies nested static state instead of allowing one request factory to mutate the next', async () => {
  const original = { name: 'original', markup: '', nested: { request: 'original' } };
  const handler = createFetchHandler({ template, state: original, app(context) {
    const nested = context.state.nested as { request: string }; expect(nested.request).toBe('original'); nested.request = context.url.pathname; context.state.name = nested.request;
    return createApp({ state: context.state });
  } });
  const [first, second] = await Promise.all([handler(request('/first')), handler(request('/second'))]);
  expect(await first.text()).toContain('>\/first</h1>'); expect(await second.text()).toContain('>\/second</h1>'); expect(original.nested.request).toBe('original'); expect(original.name).toBe('original');
});
it('creates owned signal snapshots without disposing or mutating borrowed input signals', async () => {
  const { signal } = await import('@zenith/state'); const count = signal(1);
  const handler = createFetchHandler({ template, state: { name: count, markup: '' }, app(context) { const local = context.state.name as typeof count; expect(local).not.toBe(count); local.set(7); return createApp({ state: context.state }); } });
  expect(await (await handler(request())).text()).toContain('>7</h1>'); expect(count.get()).toBe(1); count.set(2); expect(count.get()).toBe(2); count.dispose();
});
