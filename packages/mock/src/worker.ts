/** Dedicated module Service Worker entry; not a page/runtime import. */
interface WorkerClient { id: string; postMessage(message: unknown, ports?: Transferable[]): void; }
interface WorkerMessage { data: { type?: string; owner?: string }; source: WorkerClient | null; ports: MessagePort[]; waitUntil?(work: Promise<unknown>): void; }
interface WorkerFetch { clientId: string; request: Request; respondWith(response: Promise<Response>): void; }
interface WorkerScope { clients: { get(id: string): Promise<WorkerClient | undefined>; claim(): Promise<void> }; skipWaiting(): Promise<void>; addEventListener(type: 'message', fn: (event: WorkerMessage) => void): void; addEventListener(type: 'fetch', fn: (event: WorkerFetch) => void): void; addEventListener(type: 'install' | 'activate', fn: (event: { waitUntil(promise: Promise<unknown>): void }) => void): void; }
const scope = globalThis as unknown as WorkerScope;
// An installation is a lease, not a client-wide on/off switch. Last owner wins.
const clients = new Map<string, string[]>();
scope.addEventListener('install', event => event.waitUntil(scope.skipWaiting()));
scope.addEventListener('activate', event => event.waitUntil(scope.clients.claim()));
scope.addEventListener('message', event => {
  if (!event.source || typeof event.data?.owner !== 'string' || !event.data.owner || event.data.owner.length > 128) return;
  const owner = event.data.owner, id = event.source.id;
  if (event.data.type === 'ZENITH_MOCK_START') {
    const leases = clients.get(id) ?? []; if (!leases.includes(owner)) leases.push(owner); clients.set(id, leases);
    event.ports[0]?.postMessage({ ready: 2, owner }); event.ports[0]?.close();
    const prune = Promise.all([...clients.keys()].map(async key => { if (!await scope.clients.get(key)) clients.delete(key); })).catch(() => { /* a transient clients API failure is retried at the next installation */ });
    event.waitUntil?.(prune);
  } else if (event.data.type === 'ZENITH_MOCK_STOP') {
    const leases = clients.get(id)?.filter(value => value !== owner) ?? [];
    if (leases.length) clients.set(id, leases); else clients.delete(id);
  }
});
scope.addEventListener('fetch', event => {
  const leases = clients.get(event.clientId), owner = leases?.[leases.length - 1]; if (!owner) return;
  event.respondWith((async () => {
    const client = await scope.clients.get(event.clientId); if (!client) { clients.delete(event.clientId); return fetch(event.request); }
    const headers: Array<[string, string]> = []; event.request.headers.forEach((value, key) => headers.push([key, value]));
    const request = event.request.clone(); const body = request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer();
    const channel = new MessageChannel();
    return new Promise<Response>(resolve => {
      let finished = false;
      const finish = (response: Response | Promise<Response>) => {
        if (finished) return; finished = true; clearTimeout(timer); event.request.signal.removeEventListener('abort', abort); channel.port1.onmessage = null; channel.port1.close(); channel.port2.close(); resolve(response);
      };
      const abort = () => { if (finished) return; try { channel.port1.postMessage({ abort: true }); } finally { finish(Response.error()); } };
      const timer = setTimeout(abort, 10000);
      event.request.signal.addEventListener('abort', abort, { once: true });
      channel.port1.onmessage = message => {
        const value = message.data as { bypass?: boolean; error?: boolean; status: number; statusText?: string; headers: HeadersInit; body: ArrayBuffer };
        if (value.bypass) { finish(fetch(event.request)); return; } if (value.error) { finish(Response.error()); return; }
        try { finish(new Response(request.method === 'HEAD' || [204, 205, 304].includes(value.status) ? null : value.body, { status: value.status, statusText: value.statusText, headers: value.headers })); }
        catch { finish(Response.error()); }
      };
      try { client.postMessage({ type: 'ZENITH_MOCK_REQUEST', owner, url: request.url, method: request.method, headers, body }, body ? [channel.port2, body] : [channel.port2]); }
      catch { finish(Response.error()); }
      if (event.request.signal.aborted) abort();
    });
  })());
});
export {};
