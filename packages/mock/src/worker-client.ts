import type { Cleanup } from '@zenith/shared';
import type { MockServer } from './index';
import { PASSTHROUGH, raceAbort } from './http';
/** @public */
export interface MockWorkerOptions {
  url?: string;
  scope?: string;
  serviceWorker?: ServiceWorkerContainer;
  /** Bounds each activation, client-claim and handshake wait. @default 5000 @unit ms */
  activationTimeout?: number;
  signal?: AbortSignal;
}
/** No page fetch patch, no unregister of a registration shared with another owner. @internal */
export async function installWorker(server: MockServer, options: MockWorkerOptions, register: (cleanup: Cleanup) => Cleanup): Promise<Cleanup> {
  const container = options.serviceWorker ?? (typeof navigator === 'undefined' ? undefined : navigator.serviceWorker);
  if (!container) throw new Error('Service Worker is unavailable.');
  const timeout = options.activationTimeout ?? 5000;
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 2_147_483_647) throw new TypeError('Invalid worker activation timeout.');
  const owner = globalThis.crypto.randomUUID();
  const abort = new AbortController(), releases = new Set<Cleanup>(), requests = new Set<Cleanup>();
  let active = true, started = false, worker: ServiceWorker | undefined, detach: Cleanup = () => {};
  const cleanup = () => {
    if (!active) return; active = false; abort.abort(); detach(); const errors: unknown[] = [];
    const attempt = (fn: Cleanup) => { try { fn(); } catch (error) { errors.push(error); } };
    for (const cancel of [...requests]) attempt(cancel); requests.clear();
    for (const release of [...releases]) attempt(release); releases.clear();
    if (started) attempt(() => worker?.postMessage({ type: 'ZENITH_MOCK_STOP', owner }));
    if (errors.length === 1) throw errors[0]; if (errors.length) throw new AggregateError(errors, 'Mock worker cleanup failed.');
  };
  const own = (release: Cleanup) => { if (active) releases.add(release); else release(); };
  const externalAbort = () => { cleanup(); };
  const check = () => { if (!active) throw new DOMException('Mock worker setup was cancelled.', 'AbortError'); };
  const wait = async <T>(work: PromiseLike<T>): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await raceAbort(Promise.race([Promise.resolve(work), new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Mock worker activation or handshake timed out.')), timeout);
      })]), abort.signal);
    } finally { clearTimeout(timer); }
  };
  // Server close owns setup even while registration/activation is unresolved.
  detach = register(cleanup);
  options.signal?.addEventListener('abort', externalAbort, { once: true });
  own(() => options.signal?.removeEventListener('abort', externalAbort));
  try {
    if (options.signal?.aborted) cleanup(); check();
    if (typeof window !== 'undefined') { window.addEventListener('pagehide', cleanup, { once: true }); own(() => window.removeEventListener('pagehide', cleanup)); }
    const registration = await wait(container.register(options.url ?? '/zenith-mock-sw.js', { type: 'module', scope: options.scope })); check();
    worker = registration.installing ?? registration.waiting ?? registration.active ?? undefined;
    if (!worker) throw new Error('Mock worker did not install.');
    const selected = worker;
    await wait(new Promise<void>((resolve, reject) => {
      const changed = () => { if (selected.state === 'activated') resolve(); else if (selected.state === 'redundant') reject(new Error('Mock worker became redundant.')); };
      selected.addEventListener('statechange', changed); own(() => selected.removeEventListener('statechange', changed)); changed();
    })); check();
    if (container.controller !== selected) await wait(new Promise<void>(resolve => {
      const changed = () => { if (container.controller === selected) resolve(); };
      container.addEventListener('controllerchange', changed); own(() => container.removeEventListener('controllerchange', changed)); changed();
    })); check();
    const message = (event: MessageEvent) => {
      if (!active || event.source !== selected || event.data?.type !== 'ZENITH_MOCK_REQUEST' || event.data?.owner !== owner || !event.ports[0]) return;
      const port = event.ports[0], controller = new AbortController(); let finished = false;
      const respond = (data: unknown, transfer: Transferable[] = []) => {
        if (finished) return; finished = true; requests.delete(cancel); port.onmessage = null;
        try { port.postMessage(data, transfer); } finally { port.close(); }
      };
      const cancel = () => { controller.abort(); respond({ error: true }); };
      requests.add(cancel); port.onmessage = next => { if (next.data?.abort) cancel(); };
      const data = event.data as { method: string; url: string; headers: Array<[string, string]>; body?: ArrayBuffer };
      void (async () => {
        try {
          const response = await server.dispatch(new Request(data.url, { method: data.method, headers: data.headers, body: data.body, signal: controller.signal }));
          if (response === PASSTHROUGH) respond({ bypass: true });
          else {
            const body = await raceAbort(response.arrayBuffer(), controller.signal), headers: Array<[string, string]> = [];
            response.headers.forEach((value, key) => headers.push([key, value])); respond({ status: response.status, statusText: response.statusText, headers, body }, [body]);
          }
        } catch { try { respond({ error: true }); } catch { /* disconnected client port */ } }
      })();
    };
    container.addEventListener('message', message); own(() => container.removeEventListener('message', message));
    const channel = new MessageChannel(); own(() => { channel.port1.onmessage = null; channel.port1.close(); channel.port2.close(); });
    await wait(new Promise<void>((resolve, reject) => {
      channel.port1.onmessage = event => { if (event.data?.ready === 2 && event.data?.owner === owner) resolve(); else reject(new Error('Incompatible mock worker.')); };
      started = true; selected.postMessage({ type: 'ZENITH_MOCK_START', owner }, [channel.port2]);
    })); check();
    channel.port1.onmessage = null; channel.port1.close();
    own(server.installSockets()); check(); return cleanup;
  } catch (error) { try { cleanup(); } catch {} throw error; }
}
