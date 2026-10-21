import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { once } from 'node:events';
import { WebSocketServer } from 'ws';
import { logger } from '@zenith/logger';
import { createRealtime, createSSE, validateRealtimeOptions, DEFAULTS } from '../src';
import type { RealtimeOptions } from '../src';
import { injectRealtimeMessage } from '../src/testing';
import { FakeEventSource, FakeSocket } from './fake-socket';

const clients: Array<{ dispose(): void }> = [];
beforeEach(() => { vi.spyOn(logger, 'error').mockImplementation(() => {}); });
afterEach(() => { clients.splice(0).forEach(c => c.dispose()); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
function setup(extra: Partial<RealtimeOptions> = {}) {
  const sockets: FakeSocket[] = [];
  const urls: string[] = [];
  const client = createRealtime({ url: 'wss://example.invalid/socket', autoConnect: false, webSocketFactory: url => { urls.push(url); const socket = new FakeSocket(); sockets.push(socket); return socket; }, ...extra });
  clients.push(client);
  return { client, sockets, urls };
}

describe('real transport state machine (#154)', () => {
  it('does not claim open until a socket has opened; then flushes the real send path', () => {
    const { client, sockets } = setup();
    client.send({ count: 1 }); client.open();
    expect(client.status.get()).toBe('connecting');
    expect(sockets[0]!.sent).toEqual([]);
    sockets[0]!.open();
    expect(client.status.get()).toBe('open');
    expect(sockets[0]!.sent).toEqual(['{"count":1}']);
    client.send({ count: 2 });
    expect(sockets[0]!.sent).toHaveLength(2);
  });
  it('bounds history, supports zero history, routes topics, and isolates unsubscribe leases', () => {
    const { client, sockets } = setup({ history: 2 });
    client.open(); sockets[0]!.open();
    const obsolete = client.subscribe('news', () => {}); obsolete();
    const callback = vi.fn(); client.subscribe('news', callback); obsolete();
    sockets[0]!.message('{"topic":"news","value":1}');
    sockets[0]!.message('{"topic":"news","value":2}');
    sockets[0]!.message('{"topic":"news","value":3}');
    expect(callback).toHaveBeenCalledTimes(3);
    expect(client.messages.get()).toHaveLength(2);
    const zero = setup({ history: 0 }); zero.client.open(); zero.sockets[0]!.open(); zero.sockets[0]!.message('42');
    expect(zero.client.lastMessage.get()).toBe(42);
    expect(zero.client.messages.get()).toEqual([]);
  });
  it('enforces bounded count, message size, and native buffered-byte backpressure', () => {
    const { client, sockets } = setup({ queue: { maxSize: 1 }, maxMessageSize: 16, maxBufferedAmount: 16 });
    client.send(1); expect(() => client.send(2)).toThrowError(expect.objectContaining({ code: 'ZEN-1704' }));
    expect(() => client.send('x'.repeat(17))).toThrowError(expect.objectContaining({ code: 'ZEN-1702' }));
    client.open(); sockets[0]!.open(); sockets[0]!.bufferedAmount = 16;
    expect(() => client.send(1)).toThrowError(expect.objectContaining({ code: 'ZEN-1704' }));
  });
  it('does not let explicit undefined erase safe queue defaults', () => {
    const { client } = setup({ queue: { maxSize: undefined } });
    for (let i = 0; i < 100; i++) client.send(i);
    expect(() => client.send(101)).toThrowError(expect.objectContaining({ code: 'ZEN-1704' }));
  });
  it('contains malformed/oversized messages without logging the payload', () => {
    const { client, sockets } = setup({ maxMessageSize: 24 }); client.open(); sockets[0]!.open();
    sockets[0]!.message('Bearer private-token not-json');
    expect(client.error.get()).toMatchObject({ code: 'ZEN-1702' });
    expect(JSON.stringify(vi.mocked(logger.error).mock.calls)).not.toContain('private-token');
    sockets[0]!.message('42'); expect(client.lastMessage.get()).toBe(42);
  });
  it('reconnects with injected deterministic time and never duplicates retry timers', () => {
    vi.useFakeTimers();
    const { client, sockets } = setup({ reconnect: { delay: 100, factor: 2, jitter: 0, retries: 2, maxDelay: 1000 } });
    client.open(); sockets[0]!.fail();
    vi.advanceTimersByTime(99); expect(sockets).toHaveLength(1);
    vi.advanceTimersByTime(1); expect(sockets).toHaveLength(2);
    sockets[1]!.fail(); vi.advanceTimersByTime(199); expect(sockets).toHaveLength(2);
    vi.advanceTimersByTime(1); expect(sockets).toHaveLength(3);
    sockets[2]!.fail(); vi.advanceTimersByTime(10_000); expect(sockets).toHaveLength(3);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('disposes during a retry, detaches every callback, and stops all timers', () => {
    vi.useFakeTimers(); const { client, sockets } = setup();
    client.open(); sockets[0]!.fail(); client.dispose(); client.dispose();
    vi.advanceTimersByTime(60_000);
    expect(sockets).toHaveLength(1); expect(vi.getTimerCount()).toBe(0);
    expect(sockets[0]!.onopen).toBeNull(); expect(sockets[0]!.onmessage).toBeNull();
    expect(client.status.get()).toBe('closed');
  });
  it('never creates a socket when disposed while asynchronous auth is pending', async () => {
    let resolve!: (token: string) => void;
    const { client, sockets } = setup({ auth: () => new Promise<string>(r => { resolve = r; }) });
    client.open(); client.dispose(); resolve('secret'); await Promise.resolve();
    expect(sockets).toEqual([]);
  });
  it('authenticates before draining frames and never puts the default token in the URL', async () => {
    const { client, sockets, urls } = setup({ auth: async () => 'private-token' });
    client.send('queued'); client.open(); await Promise.resolve(); sockets[0]!.open();
    expect(urls[0]).not.toContain('private-token');
    expect(sockets[0]!.sent).toEqual(['{"type":"auth","token":"private-token"}', '"queued"']);
  });
  it('reports a heartbeat timeout and reconnects without leaking ping timers', () => {
    vi.useFakeTimers();
    const { client, sockets } = setup({ heartbeat: { interval: 100, timeout: 50, message: 'ping' }, reconnect: false });
    client.open(); sockets[0]!.open(); vi.advanceTimersByTime(150);
    expect(client.error.get()).toMatchObject({ code: 'ZEN-1705' });
    expect(vi.getTimerCount()).toBe(0);
  });
  it('treats incoming traffic as heartbeat liveness and accepts idempotent close/dispose from handlers', () => {
    vi.useFakeTimers(); const { client, sockets } = setup({ heartbeat: { interval: 100, timeout: 50, message: 'ping' } });
    client.open(); sockets[0]!.open(); vi.advanceTimersByTime(120); sockets[0]!.message('42');
    vi.advanceTimersByTime(60); expect(client.status.get()).toBe('open');
    client.on('close', () => { client.close(); client.dispose(); }); client.close();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('is idle on SSR and pre-aborted signals never allocate a transport', () => {
    const factory = vi.fn(() => new FakeSocket());
    const client = createRealtime({ url: 'wss://example.invalid', webSocketFactory: factory }); clients.push(client);
    expect(client.status.get()).toBe('idle'); expect(factory).not.toHaveBeenCalled();
    const controller = new AbortController(); controller.abort();
    const stopped = setup({ signal: controller.signal }); stopped.client.open(); expect(stopped.sockets).toEqual([]);
  });
  it('rejects insecure remote URLs in production without disclosing credentials', () => {
    vi.stubGlobal('__ZENITH_DEV__', false);
    expect(() => setup({ url: 'ws://example.invalid' })).toThrowError(expect.objectContaining({ code: 'ZEN-1703' }));
    expect(() => setup({ url: 'wss://user:private@example.invalid' })).toThrowError(expect.objectContaining({ code: 'ZEN-1703' }));
    const { client } = setup({ url: 'ws://localhost/socket' }); client.dispose();
  });
  it('keeps test injection outside the primary API and does not fake network readiness', () => {
    const { client } = setup(); injectRealtimeMessage(client, 7);
    expect(client.lastMessage.get()).toBe(7); expect(client.status.get()).toBe('idle');
    client.dispose(); injectRealtimeMessage(client, 8); expect(client.lastMessage.get()).toBe(7);
  });
  it('supports EventSource events and closes native reconnect before scheduling its own retry', () => {
    vi.useFakeTimers(); const source = new FakeEventSource();
    const client = createSSE('https://example.invalid/events', { autoConnect: false, reconnect: { delay: 100, jitter: 0 }, eventSourceFactory: () => source }); clients.push(client);
    client.open(); source.open(); source.message('{"value":1}');
    expect(client.lastMessage.get()).toEqual({ value: 1 });
    expect(() => client.send({})).toThrow(); source.fail(); expect(source.closes).toBe(1);
    client.dispose(); expect(vi.getTimerCount()).toBe(0);
  });
  it('does not let a stale duplicate listener lease remove a current registration', () => {
    const { client, sockets } = setup(); const message = vi.fn(); const topic = vi.fn();
    const firstMessage = client.on('message', message); client.on('message', message);
    const firstTopic = client.subscribe('news', topic); client.subscribe('news', topic);
    firstMessage(); firstMessage(); firstTopic(); firstTopic();
    client.open(); sockets[0]!.open(); sockets[0]!.message('{"topic":"news"}');
    expect(message).toHaveBeenCalledOnce(); expect(topic).toHaveBeenCalledOnce();
  });
  it('decodes a bounded view using its byte offset, not its entire backing buffer', () => {
    const { client, sockets } = setup({ maxMessageSize: 2 }); client.open(); sockets[0]!.open();
    const backing = new Uint8Array([0, 52, 50, 0]);
    sockets[0]!.message(new DataView(backing.buffer, 1, 2));
    expect(client.lastMessage.get()).toBe(42);
    sockets[0]!.message(backing); expect(client.error.get()).toMatchObject({ code: 'ZEN-1702' });
  });
  it('keeps insecure URL factory failures classified as protocol errors', async () => {
    vi.stubGlobal('__ZENITH_DEV__', false);
    const { client, sockets } = setup({ url: () => 'ws://example.invalid/private', reconnect: false });
    client.open(); await Promise.resolve();
    expect(sockets).toEqual([]); expect(client.error.get()).toMatchObject({ code: 'ZEN-1703' });
  });
  it('validates nested options and freezes nested defaults', () => {
    expect(Object.isFrozen(DEFAULTS.queue)).toBe(true);
    for (const value of [{}, { history: -1 }, { heartbeat: {} }, { queue: 3 }, { reconnect: 3 }, { reconnect: { jitter: 2 } }, { maxMessageSize: 0 }]) expect(validateRealtimeOptions({ url: 'wss://example.invalid', ...value })).toBe(Object.keys(value).length === 0);
  });
});

it('sends and receives a frame through a real loopback WebSocket server', async () => {
  const server = new WebSocketServer({ host: '127.0.0.1', port: 0 });
  await once(server, 'listening');
  const address = server.address();
  if (typeof address === 'string' || !address) throw new Error('Expected TCP server');
  const client = createRealtime<{ echo: number }>({ url: `ws://127.0.0.1:${address.port}`, autoConnect: false, reconnect: false });
  clients.push(client);
  let deadline: ReturnType<typeof setTimeout> | undefined;
  const serverFrame = Promise.race([
    new Promise<string>(resolve => server.on('connection', socket => socket.on('message', data => { resolve(data.toString()); socket.send('{"echo":42}'); }))),
    new Promise<never>((_, reject) => { deadline = setTimeout(() => reject(new Error('No real WebSocket frame within 5s')), 5000); }),
  ]);
  try {
    client.open(); client.send({ value: 42 });
    expect(await serverFrame).toBe('{"value":42}');
    await vi.waitFor(() => expect(client.lastMessage.get()).toEqual({ echo: 42 }), { timeout: 5000 });
  } finally {
    clearTimeout(deadline); client.dispose(); for (const socket of server.clients) socket.terminate();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
}, 15_000);
