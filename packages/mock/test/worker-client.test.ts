import { afterEach, expect, it, vi } from 'vitest';
import { createMockServer, rest, setupWorker, type MockServer } from '../src';
const owners: MockServer[] = [], releases: Array<() => void> = [];
afterEach(() => { releases.splice(0).reverse().forEach(release => release()); owners.splice(0).reverse().forEach(server => server.close()); vi.useRealTimers(); vi.restoreAllMocks(); });
function own(server = createMockServer()) { owners.push(server); return server; }
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
class Worker extends EventTarget {
  state: ServiceWorkerState = 'activated';
  readonly starts: string[] = []; readonly stops: string[] = []; acknowledge = true;
  postMessage(data: { type: string; owner: string }, ports?: MessagePort[]) {
    if (data.type === 'ZENITH_MOCK_START') { this.starts.push(data.owner); if (this.acknowledge) { ports![0]!.postMessage({ ready: 2, owner: data.owner }); ports![0]!.close(); } }
    if (data.type === 'ZENITH_MOCK_STOP') this.stops.push(data.owner);
  }
}
class Container extends EventTarget {
  readonly worker = new Worker(); controller = this.worker;
  readonly registration = { active: this.worker, installing: null, waiting: null };
  readonly register = vi.fn(async () => this.registration);
  readonly listeners = new Set<EventListenerOrEventListenerObject>();
  override addEventListener(type: string, fn: EventListenerOrEventListenerObject | null, options?: boolean | AddEventListenerOptions) { if (fn) this.listeners.add(fn); super.addEventListener(type, fn, options); }
  override removeEventListener(type: string, fn: EventListenerOrEventListenerObject | null, options?: boolean | EventListenerOptions) { if (fn) this.listeners.delete(fn); super.removeEventListener(type, fn, options); }
  options() { return { serviceWorker: this as unknown as ServiceWorkerContainer }; }
  request(owner: string, port: MessagePort, source: unknown = this.worker, url = 'http://localhost/a') {
    const event = new Event('message'); Object.defineProperties(event, { source: { value: source }, ports: { value: [port] }, data: { value: { type: 'ZENITH_MOCK_REQUEST', owner, method: 'GET', url, headers: [] } } }); this.dispatchEvent(event);
  }
}
it('waits for this registration, not an unrelated container.ready registration', async () => {
  const container = new Container(); Object.defineProperty(container, 'ready', { get() { throw new Error('unrelated registration'); } });
  const release = await setupWorker(own(), container.options()); releases.push(release); expect(container.worker.starts).toHaveLength(1); release(); release(); expect(container.worker.stops).toEqual(container.worker.starts); expect(container.listeners.size).toBe(0);
});
it('releases only its own session when two servers install on the same worker', async () => {
  const container = new Container(), first = own(), second = own(); const a = await setupWorker(first, container.options()), b = await setupWorker(second, container.options()); releases.push(a, b); expect(new Set(container.worker.starts).size).toBe(2); first.close(); expect(container.worker.stops).toEqual([container.worker.starts[0]]); second.close(); expect(container.worker.stops).toEqual(container.worker.starts); expect(container.listeners.size).toBe(0);
});
it('server close cancels setup and prevents late registration from starting a worker', async () => {
  const container = new Container(), gate = deferred<typeof container.registration>(); container.register.mockImplementation(() => gate.promise); const server = own(); const pending = setupWorker(server, container.options()), rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' }); server.close(); await rejected; gate.resolve(container.registration); await gate.promise; expect(container.worker.starts).toEqual([]); expect(container.listeners.size).toBe(0);
});
it('clears activation waiters and timers on external cancellation', async () => {
  vi.useFakeTimers(); const container = new Container(), controller = new AbortController(); container.worker.state = 'installing'; const pending = setupWorker(own(), { ...container.options(), signal: controller.signal }), rejected = expect(pending).rejects.toMatchObject({ name: 'AbortError' }); await Promise.resolve(); controller.abort(); await rejected; expect(container.listeners.size).toBe(0); expect(vi.getTimerCount()).toBe(0); expect(container.worker.starts).toEqual([]);
});
it('unwinds a missing handshake and sends STOP for the session it started', async () => {
  vi.useFakeTimers(); const container = new Container(); container.worker.acknowledge = false; const pending = setupWorker(own(), { ...container.options(), activationTimeout: 25 }), rejected = expect(pending).rejects.toThrow(/timed out/); await vi.advanceTimersByTimeAsync(26); await rejected; expect(container.worker.stops).toEqual(container.worker.starts); expect(container.listeners.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
});
it('ignores foreign sources and sessions and cancels owned in-flight requests on cleanup', async () => {
  const container = new Container(), started = deferred<void>(); let signal: AbortSignal | undefined;
  const server = own(createMockServer([rest.get('/a', context => { signal = context.signal; started.resolve(); return new Promise(() => {}); })])); const release = await setupWorker(server, container.options()); releases.push(release);
  const channel = new MessageChannel(); releases.push(() => { channel.port1.close(); channel.port2.close(); }); const response = new Promise<unknown>(resolve => { channel.port1.onmessage = event => resolve(event.data); });
  container.request('foreign', channel.port2); container.request(container.worker.starts[0]!, channel.port2, {}); expect(signal).toBeUndefined();
  container.request(container.worker.starts[0]!, channel.port2); await started.promise; release(); expect(signal?.aborted).toBe(true); expect(await response).toEqual({ error: true }); expect(container.listeners.size).toBe(0);
});
it('returns serialized responses with status text and closes the request channel', async () => {
  const container = new Container(), server = own(createMockServer([rest.get('/a', () => new Response('Created', { status: 201, statusText: 'Fixture Created' }))])); releases.push(await setupWorker(server, container.options()));
  const channel = new MessageChannel(); releases.push(() => { channel.port1.close(); channel.port2.close(); }); const response = new Promise<{ status: number; statusText: string; body: ArrayBuffer }>(resolve => { channel.port1.onmessage = event => resolve(event.data); }); container.request(container.worker.starts[0]!, channel.port2); const value = await response; expect(value.status).toBe(201); expect(value.statusText).toBe('Fixture Created'); expect(new TextDecoder().decode(value.body)).toBe('Created');
});
it('rejects invalid timeout before allocating an owner or registering a worker', async () => {
  const container = new Container(); for (const timeout of [0, -1, NaN, Infinity, 2_147_483_648]) await expect(setupWorker(own(), { ...container.options(), activationTimeout: timeout })).rejects.toThrow(TypeError); expect(container.register).not.toHaveBeenCalled();
});
