import { afterEach, expect, expectTypeOf, it, vi } from 'vitest';
import { createMockServer, DEFAULTS, mockOptions, ws, type MockServer, type MockOptions } from '../src';
import { matchURL } from '../src/http';
const owners: MockServer[] = [];
afterEach(() => { owners.splice(0).reverse().forEach(server => server.close()); vi.restoreAllMocks(); });
function own(server: MockServer) { owners.push(server); return server; }
it('publishes frozen defaults and validates opaque options without invoking callbacks', () => {
  const random = vi.fn(() => 0.5), warning = vi.fn(); expect(Object.isFrozen(DEFAULTS)).toBe(true); const options = mockOptions.resolve({ random, onWarning: warning, latency: [1, 2] }); expect(options).toMatchObject({ baseURL: 'http://localhost', maxCalls: 1000, record: false }); expect(Object.isFrozen(options)).toBe(true); expect(Object.isFrozen(options.latency)).toBe(true); expect(random).not.toHaveBeenCalled(); expect(warning).not.toHaveBeenCalled(); expectTypeOf(options).toExtend<Readonly<MockOptions>>();
});
it('rejects malformed configuration before installing a fetch or socket patch', () => {
  const original = globalThis.fetch;
  for (const options of [{ record: 'yes' }, { latency: [2, 1] }, { latency: Infinity }, { latency: 2_147_483_648 }, { random: 2 }, { clock: {} }, { baseURL: 'https://user:private@example.invalid' }, { maxCalls: 0 }, { onWarning: true }]) {
    expect(() => createMockServer([], options as MockOptions)).toThrow(); expect(globalThis.fetch).toBe(original);
  }
});
it('matches ws/wss origins and decoded params instead of treating an absolute socket URL as a path', () => {
  expect(matchURL('wss://example.invalid/news/:id', new URL('wss://example.invalid/news/a%20b'))).toEqual({ id: 'a b' }); expect(matchURL('ws://example.invalid/news/:id', new URL('wss://example.invalid/news/1'))).toBeUndefined(); expect(matchURL('wss://another.invalid/news/:id', new URL('wss://example.invalid/news/1'))).toBeUndefined();
});
it('keeps duplicate connection callbacks in independent leases', async () => {
  const link = ws.link('ws://localhost/events'), connected = vi.fn(); const first = link.on('connection', connected); link.on('connection', connected); first(); first(); own(createMockServer([link])).listen(); const socket = new WebSocket('ws://localhost/events'); await new Promise<void>(resolve => socket.addEventListener('open', () => resolve(), { once: true })); expect(connected).toHaveBeenCalledOnce(); socket.close();
});
it('does not invoke later connection callbacks after a prior callback closes the connection', async () => {
  const link = ws.link('ws://localhost/events'), later = vi.fn(); link.on('connection', ({ client }) => client.close(1011, 'fixture')); link.on('connection', later); own(createMockServer([link])).listen(); const socket = new WebSocket('ws://localhost/events'); const closed = new Promise<CloseEvent>(resolve => socket.addEventListener('close', resolve, { once: true })); expect((await closed).code).toBe(1011); expect(later).not.toHaveBeenCalled();
});
it('warns without leaking a socket URL or credentials before using the captured native transport', () => {
  const native = vi.fn(function () { return {}; }); const warning = vi.fn(); const target = { WebSocket: native } as unknown as typeof globalThis, server = own(createMockServer([], { onUnhandledRequest: 'warn', onWarning: warning })); const release = server.installSockets(target);
  try { new target.WebSocket('wss://example.invalid/events?token=private'); expect(warning).toHaveBeenCalledWith('Unhandled mock WebSocket.'); expect(JSON.stringify(warning.mock.calls)).not.toContain('private'); expect(native).toHaveBeenCalledOnce(); } finally { release(); }
});
it('applies browser protocol, close-code and UTF-8 reason validation to mocked sockets', async () => {
  own(createMockServer([ws.link('ws://localhost/events')])).listen(); expect(() => new WebSocket('ws://localhost/events', ['dup', 'dup'])).toThrow(); expect(() => new WebSocket('ws://localhost/events#fragment')).toThrow(); const socket = new WebSocket('ws://localhost/events'); await new Promise<void>(resolve => socket.addEventListener('open', () => resolve(), { once: true })); expect(() => socket.close(1011)).toThrow(); expect(() => socket.close(1000, '🙂'.repeat(31))).toThrow(); socket.close(3001, 'done');
});

it('restores the borrowed lastIndex of a global regexp on repeated matches', () => {
  const pattern = /example\.invalid/g; pattern.lastIndex = 3; expect(matchURL(pattern, new URL('https://example.invalid/a'))).toEqual({}); expect(pattern.lastIndex).toBe(3); expect(matchURL(pattern, new URL('https://example.invalid/a'))).toEqual({}); expect(pattern.lastIndex).toBe(3);
});
