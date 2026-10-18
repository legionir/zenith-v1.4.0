import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMockServer, rest, respond, passthrough, delay, installFetchMock, ws, type MockServer } from '../src';
import { http } from '@zenith/http';
import { Resource } from '@zenith/resource';
const servers: MockServer[] = []; const own = (server: MockServer) => { servers.push(server); return server; };
afterEach(() => { for (const server of servers.splice(0)) server.close(); vi.useRealTimers(); vi.restoreAllMocks(); });
describe('owned fetch/network mock engine', () => {
  it('matches methods and decoded route params and serializes JSON responses', async () => {
    const server = own(createMockServer([rest.get('/users/:id', ({ params, respond }) => respond({ json: { id: params.id } })), rest.post('/users', () => respond({ status: 201, json: { ok: true } }))], { record: true }));
    server.listen(); expect(await (await fetch('http://localhost/users/a%20b?token=secret')).json()).toEqual({ id: 'a b' }); expect((await fetch('http://localhost/users', { method: 'POST' })).status).toBe(201); expect(JSON.stringify(server.calls)).not.toContain('secret'); expect(JSON.stringify(server.calls)).not.toContain('a%20b');
  });
  it('integrates with the actual HTTP client without replacing its transport API', async () => {
    const server = own(createMockServer([rest.get('http://api.test/items', () => respond({ json: [{ id: 1 }] }))])); server.listen();
    const result = await http.get<Array<{ id: number }>>('http://api.test/items'); expect(result.status).toBe(200); expect(result.data).toEqual([{ id: 1 }]);
    const resource = new Resource<Array<{ id: number }>>({ url: 'http://api.test/items', retryCount: 0 });
    try { const list = await resource.list(); expect(list.success).toBe(true); expect(list.data).toEqual([{ id: 1 }]); } finally { resource.dispose(); }
  });
  it('restores exact original fetch identity after out-of-order closes', () => {
    const original = globalThis.fetch; const first = own(createMockServer()), second = own(createMockServer()); first.listen(); second.listen(); first.close(); expect(globalThis.fetch).not.toBe(original); second.close(); expect(globalThis.fetch).toBe(original);
  });
  it('preserves unrelated patches made after installation', () => {
    const original = globalThis.fetch; const server = own(createMockServer()); const release = installFetchMock(server); const foreign = vi.fn<typeof fetch>(); globalThis.fetch = foreign; release(); expect(globalThis.fetch).toBe(foreign); globalThis.fetch = original;
  });
  it('fails unhandled requests and double callback responses with reserved errors', async () => {
    const server = own(createMockServer([rest.get('/twice', ({ respond }) => { respond({ text: 'one' }); return respond({ text: 'two' }); })]));
    await expect(server.handle(new Request('http://localhost/missing'))).rejects.toMatchObject({ code: 'ZEN-2530' }); await expect(server.handle(new Request('http://localhost/twice'))).rejects.toMatchObject({ code: 'ZEN-2531' });
  });
  it('supports bypass/warn without recording request secrets', async () => {
    const warning = vi.fn(); const fallback = vi.fn<typeof fetch>(async () => respond({ text: 'original' })); const server = own(createMockServer([], { onUnhandledRequest: 'warn', onWarning: warning, record: true }));
    expect(await (await server.handle(new Request('http://localhost/private?token=secret'), fallback)).text()).toBe('original'); expect(warning).toHaveBeenCalledTimes(1); expect(JSON.stringify(server.calls)).toBe('[{"method":"GET","route":"[unhandled]"}]');
  });
  it('resets override handlers and bounds recorded calls', async () => {
    const server = own(createMockServer([rest.get('/a', () => respond({ text: 'base' }))], { record: true, maxCalls: 2 })); server.use(rest.get('/a', () => respond({ text: 'override' })));
    const request = () => server.handle(new Request('http://localhost/a')); expect(await (await request()).text()).toBe('override'); await request(); await request(); expect(server.calls).toHaveLength(2); server.reset(); expect(server.calls).toHaveLength(0); expect(await (await request()).text()).toBe('base');
  });
  it('uses injected randomness/clock for ranged latency and aborts pending delays', async () => {
    vi.useFakeTimers(); const server = own(createMockServer([rest.get('/a', () => respond())], { latency: [10, 30], random: () => 0.5 })); const result = server.handle(new Request('http://localhost/a')); let done = false; void result.then(() => { done = true; }); await vi.advanceTimersByTimeAsync(19); expect(done).toBe(false); await vi.advanceTimersByTimeAsync(1); await result; expect(done).toBe(true);
    const controller = new AbortController(); const pending = delay(100, { signal: controller.signal }); const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' }); controller.abort(); await assertion;
  });
  it('aborts non-cooperative async resolvers without orphaned rejections', async () => {
    const controller = new AbortController(); let reject!: (error: Error) => void; const server = own(createMockServer([rest.get('/a', () => new Promise((_resolve, fail) => { reject = fail; }))]));
    const pending = server.handle(new Request('http://localhost/a', { signal: controller.signal })); const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' }); controller.abort(); await assertion; reject(new Error('late')); await Promise.resolve();
  });
  it('exposes explicit passthrough without accidentally invoking recursive global fetch', async () => { const server = own(createMockServer([rest.get('/a', () => passthrough())])); const original = vi.fn<typeof fetch>(async () => respond({ text: 'network' })); expect(await (await server.handle(new Request('http://localhost/a'), original)).text()).toBe('network'); expect(original).toHaveBeenCalledTimes(1); });
  it('owns WebSocket message/close events and restores the original constructor', async () => {
    const original = globalThis.WebSocket; const link = ws.link('ws://localhost/socket'); link.on('connection', ({ client }) => { client.addEventListener('message', event => client.send(`echo:${event.data}`)); });
    const server = own(createMockServer([link])); server.listen(); const socket = new WebSocket('ws://localhost/socket'); await new Promise<void>(resolve => socket.addEventListener('open', () => resolve(), { once: true }));
    const message = new Promise<MessageEvent>(resolve => socket.addEventListener('message', resolve, { once: true })); socket.send('hello'); expect((await message).data).toBe('echo:hello'); const closed = new Promise<void>(resolve => socket.addEventListener('close', () => resolve(), { once: true })); server.close(); await closed; expect(globalThis.WebSocket).toBe(original);
  });
});

it('closing an owner cancels its pending mock work, not just its global patches', async () => {
  const server = own(createMockServer([rest.get('/pending', () => new Promise(() => {}))]));
  const pending = server.handle(new Request('http://localhost/pending')); const assertion = expect(pending).rejects.toMatchObject({ name: 'AbortError' }); server.close(); await assertion;
});
