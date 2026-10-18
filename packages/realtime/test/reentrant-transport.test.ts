import { afterEach, expect, it, vi } from 'vitest';
import { logger } from '@zenith/logger';
import { createRealtime, createSSE, type Realtime } from '../src';
import { FakeEventSource, FakeSocket } from './fake-socket';
const owners: Array<{ dispose(): void }> = [];
afterEach(() => { owners.splice(0).reverse().forEach(owner => owner.dispose()); vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllGlobals(); });
function fixture(options: Parameters<typeof createRealtime>[0] = { url: 'wss://example.invalid' }) {
  const sockets: FakeSocket[] = [];
  const client = createRealtime({ autoConnect: false, reconnect: false, webSocketFactory: () => { const socket = new FakeSocket(); sockets.push(socket); return socket; }, ...options }); owners.push(client); return { client, sockets };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
it('closes a socket acquired after its own factory disposes the client', () => {
  const socket = new FakeSocket(); let client!: Realtime;
  client = createRealtime({ url: 'wss://example.invalid', autoConnect: false, webSocketFactory: () => { client.dispose(); return socket; } }); owners.push(client); client.open(); expect(socket.closes).toBe(1); expect(socket.onopen).toBeNull(); expect(client.status.get()).toBe('closed');
});
it('closes an EventSource acquired after its own factory releases the client', () => {
  const source = new FakeEventSource(); let client!: Realtime;
  client = createSSE('https://example.invalid', { autoConnect: false, eventSourceFactory: () => { client.dispose(); return source; } }); owners.push(client); client.open(); expect(source.closes).toBe(1); expect(source.onmessage).toBeNull();
});
it('does not deliver a parsed old-generation frame into a reopened connection', () => {
  let client!: Realtime; const received = vi.fn(); const f = fixture({ url: 'wss://example.invalid', parse: text => { client.close(); client.open(); return JSON.parse(text) as unknown; } }); client = f.client; client.on('message', received); client.open(); f.sockets[0]!.open(); f.sockets[0]!.message('42'); expect(received).not.toHaveBeenCalled(); expect(client.lastMessage.get()).toBeNull(); expect(f.sockets).toHaveLength(2);
});
it('does not retain or send a serialized frame after its serializer disposes the owner', () => {
  let client!: Realtime; const f = fixture({ url: 'wss://example.invalid', serialize: () => { client.dispose(); return 'stale'; } }); client = f.client; client.send('input'); client.open(); expect(f.sockets).toHaveLength(0); expect(client.status.get()).toBe('closed');
});
it('does not mark a transport open after a reentrant send disposes it', () => {
  const f = fixture(), opened = vi.fn(); f.client.on('open', opened); f.client.send(1); f.client.send(2); f.client.open(); const socket = f.sockets[0]!; socket.send = () => f.client.dispose(); socket.open(); expect(opened).not.toHaveBeenCalled(); expect(f.client.status.get()).toBe('closed');
});
it('preserves a new connection opened synchronously by the old transport close method', () => {
  const f = fixture(); f.client.open(); const old = f.sockets[0]!; old.open(); old.close = () => { f.client.open(); }; f.client.close(); expect(f.sockets).toHaveLength(2); expect(f.sockets[1]!.closes).toBe(0); f.sockets[1]!.open(); expect(f.client.status.get()).toBe('open');
});
it('does not schedule an old error retry after an observer reopens the client', () => {
  vi.useFakeTimers(); vi.spyOn(logger, 'error').mockImplementation(() => {}); const f = fixture({ url: 'wss://example.invalid', reconnect: { delay: 10, jitter: 0 } });
  f.client.on('error', () => { f.client.close(); f.client.open(); }); f.client.open(); f.sockets[0]!.fail(); expect(f.sockets).toHaveLength(2); expect(vi.getTimerCount()).toBe(0); vi.advanceTimersByTime(100); expect(f.sockets).toHaveLength(2);
});
it('stops old-generation message listeners after a topic subscriber closes the client', () => {
  const f = fixture(), topic = vi.fn(), message = vi.fn(); f.client.subscribe('news', () => f.client.close()); f.client.subscribe('news', topic); f.client.on('message', message); f.client.open(); f.sockets[0]!.open(); f.sockets[0]!.message('{"topic":"news"}'); expect(topic).not.toHaveBeenCalled(); expect(message).not.toHaveBeenCalled();
});
it('preserves wire order across asynchronous Blob decoding and later text frames', async () => {
  const read = deferred<string>(); class SlowBlob extends Blob { override text() { return read.promise; } }
  const f = fixture(), received: unknown[] = []; f.client.on('message', data => received.push(data)); f.client.open(); f.sockets[0]!.open(); f.sockets[0]!.message(new SlowBlob(['1'])); f.sockets[0]!.message('2'); expect(received).toEqual([]); read.resolve('1'); await vi.waitFor(() => expect(received).toEqual([1, 2]));
});
it('does not let an obsolete Blob decoder block or overwrite a new generation', async () => {
  const read = deferred<string>(); class SlowBlob extends Blob { override text() { return read.promise; } }
  const f = fixture(); f.client.open(); f.sockets[0]!.open(); f.sockets[0]!.message(new SlowBlob(['1'])); f.sockets[0]!.message('2'); f.client.close(); f.client.open(); f.sockets[1]!.open(); f.sockets[1]!.message('3'); read.resolve('1'); await read.promise; await Promise.resolve(); expect(f.client.messages.get()).toEqual([3]);
});
it('bounds pending decoder bytes and closes an overloaded generation without retaining frames', async () => {
  vi.spyOn(logger, 'error').mockImplementation(() => {}); const read = deferred<string>(); class SlowBlob extends Blob { override text() { return read.promise; } }
  const f = fixture({ url: 'wss://example.invalid', maxBufferedAmount: 2 }); f.client.open(); f.sockets[0]!.open(); f.sockets[0]!.message(new SlowBlob(['1'])); f.sockets[0]!.message('22'); f.sockets[0]!.message('3'); expect(f.client.error.get()).toMatchObject({ code: 'ZEN-1704' }); expect(f.sockets[0]!.closes).toBe(1); read.resolve('1'); await read.promise; expect(f.client.messages.get()).toEqual([]);
});
it('does not auto-connect in an ambient SSR document even when window exists', () => {
  vi.stubGlobal('window', {}); vi.stubGlobal('document', { __zenithSSR__: true }); const factory = vi.fn(() => new FakeSocket()); const client = createRealtime({ url: 'wss://example.invalid', webSocketFactory: factory }); owners.push(client); expect(factory).not.toHaveBeenCalled(); expect(client.status.get()).toBe('idle'); client.open(); expect(factory).toHaveBeenCalledOnce();
});
