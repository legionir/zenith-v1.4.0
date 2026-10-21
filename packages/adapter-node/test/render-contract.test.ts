import { afterEach, describe, expect, it, vi } from 'vitest';
import { request } from 'node:http';
import { gunzipSync, brotliDecompressSync } from 'node:zlib';
import { createApp, type App } from '@zenith/runtime-core';
import { signal } from '@zenith/state';
import { createNodeServer, createNodeHandler, nodeHandlerOptions, type NodeServer, type NodeServerOptions } from '../src';
const running: NodeServer[] = [];
afterEach(async () => { await Promise.all(running.splice(0).map(server => server.close())); });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
const template = '<!DOCTYPE html><html lang="en"><head><title>Static</title><meta name="description" content="static"><style>body{color:black}</style></head><body class="static"><header>Before</header><main id="app"><!--zen-outlet--><h1 zen-text="title"></h1></main><footer>After</footer><script type="module" src="/entry.js"></script></body></html>';
async function serve(extra: Partial<NodeServerOptions> = {}) {
  const server = createNodeServer({ template, app: () => createApp(), state: { title: 'Rendered' }, port: 0, host: '127.0.0.1', ...extra });
  running.push(server); const { port } = await server.listen(); return { server, base: `http://127.0.0.1:${port}` };
}
function raw(url: string, headers: Record<string, string> = {}, method = 'GET'): Promise<{ body: Buffer; headers: import('node:http').IncomingHttpHeaders; status: number }> {
  return new Promise((resolve, reject) => { const req = request(url, { headers, method }, res => {
    const parts: Buffer[] = []; res.on('data', part => parts.push(Buffer.from(part))); res.once('error', reject); res.once('end', () => resolve({ body: Buffer.concat(parts), headers: res.headers, status: res.statusCode! }));
  }); req.once('error', reject); req.end(); });
}

describe('canonical Node render and transport contract', () => {
  it.each([true, false])('preserves the complete document and merges head/attrs with stream=%s', async stream => {
    const { base } = await serve({ stream, head: { title: 'Dynamic', meta: [{ name: 'description', content: 'dynamic' }], htmlAttrs: { lang: 'fa', dir: 'rtl' }, bodyAttrs: { 'data-request': 'own' } } });
    const response = await fetch(base), html = await response.text();
    expect(html).toContain('<header>Before</header>'); expect(html).toContain('<footer>After</footer>'); expect(html).toContain('src="/entry.js"'); expect(html).toContain('body{color:black}'); expect(html).toContain('Rendered');
    expect(html).not.toContain('zen-outlet'); expect(html).not.toContain('<title>Static</title>'); expect(html.match(/<title\b/g)).toHaveLength(1);
    expect(html).toContain('content="dynamic"'); expect(html).not.toContain('content="static"'); expect(html).toContain('lang="fa"'); expect(html).toContain('dir="rtl"'); expect(html).toContain('class="static"'); expect(html).toContain('data-request="own"');
    const nonce = response.headers.get('content-security-policy')!.match(/nonce-([^']+)/)![1]!;
    expect(html.match(/nonce="[^"]+"/g)).toEqual(Array(3).fill(`nonce="${nonce}"`));
  });
  it.each(['gzip', 'br'] as const)('compresses streamed HTML using %s with Vary and HEAD parity', async encoding => {
    const { base } = await serve(); const response = await raw(base, { 'accept-encoding': encoding });
    expect(response.status).toBe(200); expect(response.headers['content-encoding']).toBe(encoding); expect(response.headers.vary).toContain('Accept-Encoding');
    const html = (encoding === 'gzip' ? gunzipSync(response.body) : brotliDecompressSync(response.body)).toString(); expect(html).toContain('Rendered'); expect(html).toContain('/entry.js');
    const head = await raw(base, { 'accept-encoding': encoding }, 'HEAD'); expect(head.status).toBe(200); expect(head.body.length).toBe(0); expect(head.headers['content-encoding']).toBe(encoding);
  });
  it('respects identity and rejects an unacceptable representation', async () => {
    const { base } = await serve({ compression: false }); expect((await raw(base, { 'accept-encoding': 'identity;q=0, *;q=0' })).status).toBe(406);
    const identity = await raw(base, { 'accept-encoding': 'identity' }); expect(identity.headers['content-encoding']).toBeUndefined(); expect(identity.body.toString()).toContain('Rendered');
  });
  it('calls cacheControl once with the rendered result before headers are committed', async () => {
    const cache = vi.fn((_req, result) => { expect(result.html).toContain('Rendered'); expect(result.state).toContain('Rendered'); return 'private, max-age=30'; });
    const { base } = await serve({ cacheControl: cache }); const response = await fetch(base); expect(response.headers.get('cache-control')).toBe('private, max-age=30'); await response.text(); expect(cache).toHaveBeenCalledTimes(1);
  });
  it('does not attach compressed or cacheable headers to a callback failure', async () => {
    const error = vi.fn(); const { base } = await serve({ onError: error, cacheControl: () => { throw new Error('private data'); } });
    const response = await raw(base, { 'accept-encoding': 'br' }); expect(response.status).toBe(500); expect(response.headers['content-encoding']).toBeUndefined(); expect(response.headers['cache-control']).toBe('no-store'); expect(response.body.toString()).toBe('Internal Server Error'); expect(error).toHaveBeenCalledTimes(1);
  });
  it('uses async template/state/head/App loaders and snapshots shared signals for 100 requests', async () => {
    const source = signal('source'), disposals: ReturnType<typeof vi.fn>[] = [];
    const { base } = await serve({ template: async () => { await Promise.resolve(); return template; }, state: { title: source }, head: async (_url, context) => ({ title: context.url.searchParams.get('id') ?? '' }), app: async context => {
      await Promise.resolve(); const title = context.state.title as ReturnType<typeof signal<string>>; title.set(`request-${context.url.searchParams.get('id')}`);
      const app = createApp(); disposals.push(vi.spyOn(app, 'dispose')); return app;
    } });
    try {
      const results = await Promise.all(Array.from({ length: 100 }, (_, id) => fetch(`${base}/?id=${id}`).then(res => res.text())));
      results.forEach((html, id) => { expect(html).toContain(`>request-${id}</h1>`); expect(html).toContain(`>${id}</title>`); });
      expect(source.get()).toBe('source'); expect(disposals).toHaveLength(100); disposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1));
    } finally { source.dispose(); }
  });
  it('ignores spoofed forwarding headers unless explicitly enabled', async () => {
    const origins: string[] = []; const seen: string[] = [];
    const state: NodeServerOptions['state'] = (_url, context) => { origins.push(context.url.origin); seen.push(context.ip ?? ''); return { title: 'proxy' }; };
    const untrusted = await serve({ state }), trusted = await serve({ state, trustProxy: true });
    const headers = { 'x-forwarded-proto': 'https', 'x-forwarded-host': 'public.example:8443', 'x-forwarded-for': '203.0.113.7' };
    await (await fetch(untrusted.base, { headers })).text(); await (await fetch(trusted.base, { headers })).text();
    expect(origins).toEqual([untrusted.base, 'https://public.example:8443']); expect(seen[0]).not.toBe('203.0.113.7'); expect(seen[1]).toBe('203.0.113.7');
  });
  it('does not render malformed trusted proxy metadata', async () => {
    const factory = vi.fn(() => createApp()); const { base } = await serve({ app: factory, trustProxy: true });
    const response = await fetch(base, { headers: { 'x-forwarded-proto': 'javascript', 'x-forwarded-host': 'evil.example/path' } }); expect(response.status).toBe(400); await response.text(); expect(factory).not.toHaveBeenCalled();
  });
  it('closes loader acquisitions and promptly returns 503 for a stuck async template', async () => {
    const dispose = vi.fn(), error = vi.fn(); const { base } = await serve({ timeout: 20, onError: error, template: context => { context.onDispose(dispose); return new Promise(() => {}); } });
    const response = await fetch(base); expect(response.status).toBe(503); expect(await response.text()).toBe('Render timeout'); expect(dispose).toHaveBeenCalledTimes(1); expect(error).toHaveBeenCalledTimes(1);
  });
  it('disposes a late App after the HTTP response has timed out and never mounts it', async () => {
    const entered = deferred<void>(), release = deferred<App>(); let aborted: AbortSignal | undefined;
    const { base } = await serve({ timeout: 1000, app: async context => { aborted = context.signal; entered.resolve(); return release.promise; } });
    const pending = fetch(base); await entered.promise; const response = await pending; expect(response.status).toBe(503); await response.text(); expect(aborted?.aborted).toBe(true);
    const app = createApp(), dispose = vi.spyOn(app, 'dispose'), mount = vi.spyOn(app, 'mount'); release.resolve(app); await vi.waitFor(() => expect(dispose).toHaveBeenCalledTimes(1)); expect(mount).not.toHaveBeenCalled();
  });
  it('bypasses all loaders for health and terminal route misses', async () => {
    const factory = vi.fn(() => createApp()), loader = vi.fn(async () => template);
    const { base } = await serve({ app: factory, template: loader, routes: ['/allowed'] });
    expect((await fetch(`${base}/healthz`)).status).toBe(200); expect((await fetch(`${base}/nope`)).status).toBe(404); expect(factory).not.toHaveBeenCalled(); expect(loader).not.toHaveBeenCalled();
  });
  it('rejects missing markers/factories and malformed option types at construction', () => {
    expect(() => createNodeHandler({ template: '<main></main>', app: () => createApp() })).toThrow();
    expect(() => nodeHandlerOptions.resolve({ template, app: createApp(), stream: 'yes' })).toThrow();
    expect(() => nodeHandlerOptions.resolve({ template, app: () => createApp(), timeout: Infinity })).toThrow();
    expect(() => nodeHandlerOptions.resolve({ template, app: () => createApp(), accidentalOption: true })).toThrow();
  });
});

it('propagates a client disconnect once, cleans loaders, and disposes a late factory App', async () => {
  const entered = deferred<void>(), cancelled = deferred<void>(), release = deferred<App>();
  const cleanup = vi.fn(), abort = vi.fn();
  const { base } = await serve({ onAbort: abort, state: (_url, context) => { context.onDispose(cleanup); return { title: 'abort' }; }, app: async context => {
    context.signal.addEventListener('abort', () => cancelled.resolve(), { once: true }); entered.resolve(); return release.promise;
  } });
  const client = request(base); client.on('error', () => {}); client.end();
  await entered.promise; client.destroy(); await cancelled.promise;
  await vi.waitFor(() => { expect(cleanup).toHaveBeenCalledTimes(1); expect(abort).toHaveBeenCalledTimes(1); });
  const app = createApp(), dispose = vi.spyOn(app, 'dispose'), mount = vi.spyOn(app, 'mount'); release.resolve(app);
  await vi.waitFor(() => expect(dispose).toHaveBeenCalledTimes(1)); expect(mount).not.toHaveBeenCalled();
});

it('uses stream.pipeline backpressure rather than writing past a false write result', async () => {
  let blocked = false, violations = 0, pauses = 0, writes = 0;
  const { base, server } = await serve({ compression: false, state: { title: 'x'.repeat(1024 * 1024) } });
  server.server.on('request', (_req, res) => {
    const original = res.write;
    res.on('drain', () => { blocked = false; });
    vi.spyOn(res, 'write').mockImplementation((...args) => {
      if (blocked) violations++; writes++;
      const ready = Reflect.apply(original, res, args) as boolean;
      if (!ready) { blocked = true; pauses++; }
      return ready;
    });
  });
  const response = await raw(base, { 'accept-encoding': 'identity' });
  expect(response.status).toBe(200); expect(response.body.length).toBeGreaterThan(1024 * 1024);
  expect(writes).toBeGreaterThan(1); expect(pauses).toBeGreaterThan(0); expect(violations).toBe(0);
});

it('isolates resources acquired by async state loaders before the App factory starts', async () => {
  const { createResource, getResource } = await import('@zenith/resource');
  const disposals: ReturnType<typeof vi.fn>[] = [];
  const { base } = await serve({ state: async (url) => {
    const resource = createResource('loader-private', { url: `/data${url}` }); disposals.push(vi.spyOn(resource, 'dispose'));
    await Promise.resolve(); await Promise.resolve(); expect(getResource('loader-private')).toBe(resource);
    return { title: url };
  } });
  const responses = await Promise.all(Array.from({ length: 20 }, (_, id) => fetch(`${base}/?id=${id}`).then(res => res.text())));
  responses.forEach((html, id) => expect(html).toContain(`/?id=${id}`));
  await vi.waitFor(() => { expect(disposals).toHaveLength(20); disposals.forEach(dispose => expect(dispose).toHaveBeenCalledTimes(1)); });
  expect(getResource('loader-private')).toBeUndefined();
});

it('streams the rendered DOM without requesting a full rendered outerHTML string', async () => {
  const { base } = await serve({ cacheControl: 'no-store', app: context => {
    Object.defineProperty(context.document.querySelector('main')!, 'outerHTML', { get() { throw new Error('unexpected rendered HTML buffer'); } }); return createApp();
  } }); const result = await raw(base); expect(result.status).toBe(200); expect(result.body.toString()).toContain('Rendered'); expect(result.body.toString()).toContain('<footer>After</footer>');
});
it('awaits retained SSR cleanup before disposing parent loader acquisitions on HEAD', async () => {
  const order: string[] = [];
  const { base } = await serve({ state: (_url, context) => { context.onDispose(() => { order.push('loader'); }); return { title: 'HEAD' }; }, app: () => {
    const app = createApp(), original = app.dispose.bind(app); vi.spyOn(app, 'dispose').mockImplementation(() => { order.push('app'); original(); }); return app;
  } }); const result = await raw(base, {}, 'HEAD'); expect(result.status).toBe(200); await vi.waitFor(() => expect(order).toEqual(['app', 'loader']));
});
