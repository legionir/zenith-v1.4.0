import { createReservedError } from '@zenith/errors';
import { logger } from '@zenith/logger';
import { createDisposer, type Cleanup, type Disposable } from '@zenith/shared';
import { delay, PASSTHROUGH, matchURL, resolveRequest, raceAbort, type MockClock, type RestHandler } from './http';
import { patch } from './patch';
import { socketPatch, type SocketHandler } from './socket';
import { mockOptions } from './options';
export { DEFAULTS, mockOptions, mockOptionsSchema } from './options';
import { installWorker, type MockWorkerOptions } from './worker-client';
export type { MockWorkerOptions } from './worker-client';
export { rest, respond, passthrough, delay, PASSTHROUGH, type MockResolver, type MockRequestContext, type MockResponseOptions, type RestHandler, type MockClock } from './http';
export { ws, type SocketHandler, type MockSocketClient } from './socket';
/** @public */
export type MockHandler = RestHandler | SocketHandler;
/** @public */
export interface MockOptions { onUnhandledRequest?: 'error' | 'warn' | 'bypass'; baseURL?: string; latency?: number | readonly [number, number]; record?: boolean; maxCalls?: number; random?: () => number; clock?: MockClock; onWarning?: (message: string) => void; }
/** Request recording never contains headers, query strings, params, bodies or response payloads. @public */
export interface MockCall { readonly method: string; readonly route: string; readonly status?: number; }
/** @public */
export interface MockServer extends Disposable { readonly baseURL: string; listen(): Cleanup; close(): void; use(...handlers: MockHandler[]): void; reset(): void; readonly calls: readonly MockCall[]; dispatch(request: Request): Promise<Response | typeof PASSTHROUGH>; handle(request: Request, fallback?: typeof fetch): Promise<Response>; installSockets(target?: typeof globalThis): Cleanup; }
/** @public */
export function createMockServer(initial: readonly MockHandler[] = [], rawOptions: MockOptions = {}): MockServer {
  const options = mockOptions.resolve(rawOptions);
  const mode = options.onUnhandledRequest ?? 'error'; const baseURL = options.baseURL ?? 'http://localhost'; new URL(baseURL);
  if (!['error', 'warn', 'bypass'].includes(mode) || !Number.isInteger(options.maxCalls ?? 1000) || (options.maxCalls ?? 1000) < 1) throw new TypeError('Invalid mock options.');
  const latency = options.latency ?? 0; const range = typeof latency === 'number' ? [latency, latency] : latency;
  if (range.length !== 2 || range.some(value => !Number.isFinite(value) || value < 0) || range[1]! < range[0]!) throw new TypeError('Invalid mock latency.');
  let handlers = [...initial]; const records: MockCall[] = []; const sockets = new Set<() => void>(); const pending = new Set<AbortController>(); const leases = new Set<Cleanup>(); let listening: Cleanup | undefined; let closed = false; let epoch = 0;
  const record = (request: Request, handler: RestHandler | undefined, response?: Response) => { if (!options.record) return; records.push(Object.freeze({ method: request.method, route: typeof handler?.url === 'string' ? handler.url.replace(/\?.*$/, '').replace(/^(https?:\/\/)[^/]+/, '$1[origin]') : handler ? '[pattern]' : '[unhandled]', status: response?.status })); if (records.length > (options.maxCalls ?? 1000)) records.shift(); };
  const server: MockServer = {
    baseURL,
    listen() { if (listening) return listening; closed = false; const owner = createDisposer();
      try { owner.add(installFetchMock(server)); owner.add(server.installSockets()); } catch (error) { try { owner.dispose(); } catch {} throw error; }
      const cleanup = () => { if (listening !== cleanup) return; listening = undefined; try { owner.dispose(); } finally { server.close(); } }; listening = cleanup; return cleanup;
    },
    close() { closed = true; epoch++; for (const controller of pending) controller.abort(); const errors: unknown[] = []; for (const cleanup of [...leases]) { try { cleanup(); } catch (error) { errors.push(error); } } for (const close of [...sockets]) { try { close(); } catch (error) { errors.push(error); } } listening = undefined; if (errors.length) throw new AggregateError(errors, 'Mock cleanup failed.'); },
    dispose() { server.close(); }, use(...next) { handlers.unshift(...next); }, reset() { epoch++; for (const controller of pending) controller.abort(); handlers = [...initial]; records.length = 0; const errors: unknown[] = []; for (const close of [...sockets]) { try { close(); } catch (error) { errors.push(error); } } if (errors.length) throw new AggregateError(errors, 'Mock socket reset failed.'); }, get calls() { return Object.freeze([...records]); },
    async dispatch(request) {
      if (closed) throw new DOMException('Mock server is closed.', 'AbortError');
      const current = epoch; const controller = new AbortController(); const abort = () => controller.abort();
      request.signal.addEventListener('abort', abort, { once: true }); if (request.signal.aborted) abort(); pending.add(controller);
      try {
      if (controller.signal.aborted) { const error = new Error('Aborted'); error.name = 'AbortError'; throw error; }
      const url = new URL(request.url, baseURL); let found: RestHandler | undefined; let params: Record<string, string> | undefined;
      for (const handler of handlers) if (handler.kind === 'rest' && (handler.method === '*' || handler.method === request.method)) { const match = matchURL(handler.url, url); if (match !== undefined) { found = handler; params = match; break; } }
      if (!found) { record(request, undefined); if (mode === 'error') throw createReservedError('ZEN-2530'); if (mode === 'warn') { try { if (options.onWarning) options.onWarning('Unhandled mock request.'); else logger.warn('Unhandled mock request.'); } catch {} } return PASSTHROUGH; }
      const draw = range[0] === range[1] ? 0 : (options.random ?? Math.random)();
      const random = Number.isFinite(draw) ? Math.max(0, Math.min(1, draw)) : 0.5;
      const latency = range[0]! + random * (range[1]! - range[0]!);
      if (latency > 0) await delay(latency, { signal: controller.signal, clock: options.clock });
      const result = await resolveRequest(found, request, params!, controller.signal); if (controller.signal.aborted || current !== epoch) throw new DOMException('Mock request was cancelled.', 'AbortError'); record(request, found, result === PASSTHROUGH ? undefined : result); return result;
      } finally { request.signal.removeEventListener('abort', abort); pending.delete(controller); }
    },
    async handle(request, fallback) {
      if (closed) throw new DOMException('Mock server is closed.', 'AbortError');
      const controller = new AbortController(), current = epoch, abort = () => controller.abort();
      request.signal.addEventListener('abort', abort, { once: true }); if (request.signal.aborted) abort(); pending.add(controller);
      try {
        const forwarded = new Request(request, { signal: controller.signal });
        // A resolver may inspect a POST body before opting into passthrough.
        const response = await server.dispatch(forwarded.clone());
        if (controller.signal.aborted || current !== epoch) throw new DOMException('Mock request was cancelled.', 'AbortError');
        if (response !== PASSTHROUGH) return response;
        if (!fallback) throw new Error('Passthrough requires an original fetch.');
        return await raceAbort(Promise.resolve(fallback(forwarded)), controller.signal);
      } finally { request.signal.removeEventListener('abort', abort); pending.delete(controller); }
    },
    installSockets(target) { const release = socketPatch(() => handlers.filter((handler): handler is SocketHandler => handler.kind === 'ws'), sockets, () => mode, target, () => { if (options.onWarning) options.onWarning('Unhandled mock WebSocket.'); else logger.warn('Unhandled mock WebSocket.'); }); let active = true; const cleanup = () => { if (!active) return; active = false; leases.delete(cleanup); release(); }; if (closed) cleanup(); else leases.add(cleanup); return cleanup; },
  };
  // This private lease registration keeps manual installFetchMock calls owner-safe too.
  fetchOwners.set(server, cleanup => { if (closed) { cleanup(); return () => {}; } leases.add(cleanup); return () => { leases.delete(cleanup); }; });
  return server;
}
const fetchOwners = new WeakMap<MockServer, (cleanup: Cleanup) => Cleanup>();
/** Nested/out-of-order installations never clobber an unrelated global fetch. @public */
export interface FetchMockOptions { target?: typeof globalThis; onRequest?: (request: Request, input: RequestInfo | URL, init?: RequestInit) => void; }
/** @public */
export function installFetchMock(server: MockServer, options: FetchMockOptions = {}): Cleanup {
  const target = options.target ?? globalThis;
  const release = patch(target, 'fetch', original => {
    const fallback: typeof fetch = (input, init) => Reflect.apply(original as typeof fetch, target, [input, init]);
    return (input: RequestInfo | URL, init?: RequestInit) => { const request = new Request(typeof input === 'string' || input instanceof URL ? new URL(String(input), server.baseURL) : input, init); options.onRequest?.(request, input, init); return server.handle(request, fallback); };
  }); let active = true; let detach: Cleanup = () => {};
  const cleanup = () => { if (!active) return; active = false; detach(); release(); }; detach = fetchOwners.get(server)?.(cleanup) ?? detach; return cleanup;
}
/** Real module Service Worker transport; copy dist/worker.js to a same-origin public URL. @public */
export function setupWorker(server: MockServer, options: MockWorkerOptions = {}): Promise<Cleanup> {
  return installWorker(server, options, cleanup => fetchOwners.get(server)?.(cleanup) ?? (() => {}));
}
