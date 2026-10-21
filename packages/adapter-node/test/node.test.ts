import { createApp } from '@zenith/runtime-core';
import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, symlink, rm } from 'node:fs/promises';
import { connect } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createNodeServer, type NodeServer } from '../src';
const servers: NodeServer[] = []; const dirs: string[] = [];
afterEach(async () => { await Promise.all(servers.splice(0).map(server => server.close())); await Promise.all(dirs.splice(0).map(dir => rm(dir, { recursive: true, force: true }))); });
async function server(extra: Partial<Parameters<typeof createNodeServer>[0]> = {}) { const app = createNodeServer({ template: '<main><!--zen-outlet-->hello</main>', app: () => createApp(), port: 0, host: '127.0.0.1', ...extra }); servers.push(app); const address = await app.listen(); return { app, base: `http://127.0.0.1:${address.port}` }; }
describe('Node adapter loopback integration', () => {
  it('serves bounded streamed assets, HEAD and conditional ETag', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'zenith-assets-')); dirs.push(dir); await writeFile(join(dir, 'app.js'), 'export const ok = true;');
    const { base } = await server({ static: { root: dir, maxAge: 60 } }); const response = await fetch(`${base}/app.js`); expect(await response.text()).toBe('export const ok = true;'); expect(response.headers.get('cache-control')).toContain('max-age=60');
    const conditional = await fetch(`${base}/app.js`, { headers: { 'if-none-match': response.headers.get('etag')! } }); expect(conditional.status).toBe(304);
    const head = await fetch(`${base}/app.js`, { method: 'HEAD' }); expect(head.status).toBe(200); expect(await head.text()).toBe('');
  });
  it('rejects static symlink escapes and hidden files', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'zenith-paths-')); dirs.push(dir); const outside = await mkdtemp(join(tmpdir(), 'zenith-outside-')); dirs.push(outside);
    await writeFile(join(outside, 'secret.txt'), 'secret'); await writeFile(join(dir, '.env'), 'secret'); await symlink(join(outside, 'secret.txt'), join(dir, 'escape.txt'));
    const { base } = await server({ static: { root: dir } }); expect((await fetch(`${base}/escape.txt`)).status).toBe(403); expect((await fetch(`${base}/.env`)).status).toBe(403);
  });
  it('bounds slow state loaders by the entire request deadline and redacts errors', async () => {
    const { base } = await server({ timeout: 20, state: () => new Promise(() => {}) }); const response = await fetch(base); expect(response.status).toBe(503); expect(await response.text()).toBe('Render timeout');
    const failing = await server({ state: () => { throw new Error('private-token-secret'); } }); const error = await fetch(failing.base); expect(error.status).toBe(500); expect(await error.text()).not.toContain('private-token-secret');
  });
  it('uses a unique response nonce consistently for JSON-LD and hydration', async () => {
    const { base } = await server({ csp: { nonce: true }, head: { jsonLd: { '@type': 'WebSite' } } });
    const results = await Promise.all(Array.from({ length: 10 }, () => fetch(base))); const nonces: string[] = [];
    for (const response of results) { const nonce = response.headers.get('content-security-policy')!.match(/nonce-([^']+)/)![1]!; const html = await response.text(); expect(html.match(new RegExp(`nonce="${nonce.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"`, 'g'))).toHaveLength(2); nonces.push(nonce); }
    expect(new Set(nonces).size).toBe(10);
  });
  it('drains an active render and closes idempotently without implicit signal handlers', async () => {
    let release!: (value: Record<string, unknown>) => void; let markStarted!: () => void; const started = new Promise<void>(resolve => { markStarted = resolve; });
    const { base, app } = await server({ state: () => new Promise(resolve => { release = resolve; markStarted(); }), shutdownTimeout: 1000 });
    const pending = fetch(base);
    await started; const closing = app.close(); release({}); expect((await pending).status).toBe(200); await closing; await app.close(); expect(app.server.listening).toBe(false);
  });
});
it('exposes the shared handler and both listen signatures with the canonical shutdown deadline', async () => {
  const app = createNodeServer({ template: '<main><!--zen-outlet-->canonical</main>', app: () => createApp(), gracefulShutdownTimeout: 100 }); servers.push(app);
  expect(typeof app.handler).toBe('function'); expect(await app.listen(0, '127.0.0.1')).toBeUndefined();
  const address = app.server.address(); expect(address && typeof address !== 'string').toBe(true);
  await app.close(); await expect(app.listen()).rejects.toThrow();
});
it('waits for an in-progress listen before closing rather than leaking a late server', async () => {
  const app = createNodeServer({ template: '<main><!--zen-outlet-->hello</main>', app: () => createApp(), port: 0, host: '127.0.0.1', gracefulShutdownTimeout: 100 }); servers.push(app);
  const listening = app.listen(); const closing = app.close(); await listening; await closing; expect(app.server.listening).toBe(false);
});
it('serves the canonical staticDir with etag disabled and passes clean route misses to middleware', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'zenith-canonical-static-')); dirs.push(dir); await writeFile(join(dir, 'app.js'), 'export const ok = true;');
  const { base } = await server({ staticDir: dir, etag: false, compression: false, routes: ['/allowed'] });
  const response = await fetch(`${base}/app.js`, { headers: { 'if-none-match': '*' } }); expect(response.status).toBe(200); expect(response.headers.get('etag')).toBeNull();
  expect((await fetch(`${base}/missing`)).status).toBe(404); expect((await fetch(`${base}/healthz`)).status).toBe(200);
});
it('reports SSR errors to onError once and permits a custom completed response', async () => {
  let calls = 0;
  const { base } = await server({ state: () => { throw new Error('private detail'); }, onError(_error, _req, res) { calls++; res.statusCode = 502; res.end('Custom failure'); } });
  const response = await fetch(base); expect(response.status).toBe(502); expect(await response.text()).toBe('Custom failure'); expect(calls).toBe(1);
});
it('defaults to a fresh CSP nonce rather than disabling CSP when csp is omitted', async () => {
  const { base } = await server(); const first = await fetch(base), second = await fetch(base);
  const a = first.headers.get('content-security-policy'), b = second.headers.get('content-security-policy'); expect(a).toContain('nonce-'); expect(a).not.toBe(b); await first.text(); await second.text();
});
it('applies the slow-client socket budget by default and validates overrides (#156)', () => {
  const app = createNodeServer({ template: '<main><!--zen-outlet-->budget</main>', app: () => createApp(), headersTimeout: 5000, requestTimeout: 15000 }); servers.push(app);
  expect(app.server.headersTimeout).toBe(5000); expect(app.server.requestTimeout).toBe(15000);
  const def = createNodeServer({ template: '<main><!--zen-outlet-->budget</main>', app: () => createApp() }); servers.push(def);
  expect(def.server.headersTimeout).toBe(10000); expect(def.server.requestTimeout).toBe(30000);
  const minimal = { template: '<main><!--zen-outlet-->x</main>', app: () => createApp() } as const;
  expect(() => createNodeServer({ ...minimal, headersTimeout: -1 })).toThrow();
  expect(() => createNodeServer({ ...minimal, headersTimeout: Number.NaN })).toThrow();
  expect(() => createNodeServer({ ...minimal, requestTimeout: Number.POSITIVE_INFINITY })).toThrow();
});
it('destroys connections that never finish sending headers (#156)', async () => {
  const { base } = await server({ headersTimeout: 100 });
  const port = Number(new URL(base).port);
  const received: Buffer[] = [];
  let closedByServer = false;
  await new Promise<void>((resolve) => {
    const socket = connect(port, '127.0.0.1', () => { socket.write('GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n'); });
    socket.on('data', (chunk: Buffer) => received.push(chunk));
    socket.on('close', () => { closedByServer = true; resolve(); });
    setTimeout(() => { socket.destroy(); resolve(); }, 3000);
  });
  expect(closedByServer).toBe(true);
  expect(Buffer.concat(received).toString()).not.toContain('HTTP/1.1 200');
});
