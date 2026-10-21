import { signal } from '@zenith/state';
import { createReservedError, type ZenithError } from '@zenith/errors';
import { logger } from '@zenith/logger';
import type { Readable } from '@zenith/shared';
import { DEFAULTS, assertOptions } from './options';
import { registerTestReceiver } from './test-receiver';
import type { Realtime, RealtimeClock, RealtimeEvent, RealtimeOptions, RealtimeStatus, SocketTransport, SseTransport } from './types';

const readonly = <T>(value: { get(): T }): Readable<T> => Object.freeze({ get: () => value.get() });
const clockDefault: RealtimeClock = {
  setTimeout: (fn, delay) => globalThis.setTimeout(fn, delay),
  clearTimeout: handle => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  random: () => Math.random(), // reconnect jitter, never authentication/IDs
};

function transportUrl(options: { url: string | (() => string); transport: 'ws' | 'sse'; allowInsecure?: boolean }): URL {
    let url: URL;
    try { url = new URL(typeof options.url === 'function' ? options.url() : options.url); } catch { throw createReservedError('ZEN-1703'); }
    if (url.username || url.password || (options.transport === 'ws' ? !['ws:', 'wss:'].includes(url.protocol) : !['http:', 'https:'].includes(url.protocol))) throw createReservedError('ZEN-1703');
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    const insecure = ['ws:', 'http:'].includes(url.protocol);
    if (insecure && !local && !options.allowInsecure && (globalThis.__ZENITH_DEV__ !== true || (typeof location !== 'undefined' && location.protocol === 'https:'))) throw createReservedError('ZEN-1703');
    return url;
}

/** Create an isolated network client. SSR imports/auto-connect never open a socket. @public */
export function createRealtime<T = unknown>(options: RealtimeOptions<T>): Realtime<T> {
  assertOptions(options);
  const clock = options.clock ?? clockDefault;
  const mode = options.transport ?? DEFAULTS.transport;
  // Reject static unsafe URLs before allocating signals, observers or sessions.
  if (typeof options.url === 'string') transportUrl({ url: options.url, transport: mode, allowInsecure: options.allowInsecure });
  const r = typeof options.reconnect === 'object' ? options.reconnect : {};
  const backoff = {
    retries: r.retries ?? DEFAULTS.reconnect.retries,
    delay: r.delay ?? DEFAULTS.reconnect.delay,
    factor: r.factor ?? DEFAULTS.reconnect.factor,
    jitter: r.jitter ?? DEFAULTS.reconnect.jitter,
    maxDelay: r.maxDelay ?? DEFAULTS.reconnect.maxDelay,
  };
  const retries = options.reconnect === false ? 0 : backoff.retries;
  const queue = { maxSize: options.queue?.maxSize ?? DEFAULTS.queue.maxSize, whileDisconnected: options.queue?.whileDisconnected ?? DEFAULTS.queue.whileDisconnected };
  const history = options.history ?? DEFAULTS.history;
  const maxSize = options.maxMessageSize ?? DEFAULTS.maxMessageSize;
  const maxBuffered = options.maxBufferedAmount ?? DEFAULTS.maxBufferedAmount;
  const status = signal<RealtimeStatus>('idle');
  const lastMessage = signal<T | null>(null);
  const messages = signal<readonly T[]>([]);
  const error = signal<unknown>(null);
  const events = new Map<RealtimeEvent, Set<(value: unknown) => void>>();
  const topics = new Map<string, Set<(value: T) => void>>();
  const sseHandlers = new Map<string, EventListener>();
  const timers = new Set<unknown>();
  const incoming: Array<{ raw: unknown; current: number; topic?: string }> = [];
  let decoding = false, incomingBytes = 0;
  const outbox: Array<string | ArrayBuffer> = [];
  const encoder = new TextEncoder();
  let ws: SocketTransport | undefined;
  let sse: SseTransport | undefined;
  let disposed = false, wanted = false, generation = 0, attempts = 0;
  let heartbeatTimer: unknown, heartbeatPending = false;
  let retryTimer: unknown;
  let removeTestReceiver = () => {};

  const currentConnection = (current: number) => !disposed && wanted && current === generation;
  const fail = (code: 'ZEN-1701' | 'ZEN-1702' | 'ZEN-1703' | 'ZEN-1704' | 'ZEN-1705'): ZenithError => createReservedError(code);
  const report = (failure: ZenithError, current = generation) => {
    if (disposed || current !== generation) return;
    error.set(failure);
    try { logger.error(failure); } catch { /* reporting cannot break transport cleanup */ }
    emit('error', failure, current);
  };
  const emit = (event: RealtimeEvent, data: unknown, current = generation) => {
    for (const callback of [...(events.get(event) ?? [])]) {
      if (disposed || current !== generation) break;
      try { callback(data); } catch { /* consumer event errors do not leak tokens/payload */ }
    }
  };
  const cancel = (timer: unknown) => { if (timers.delete(timer)) clock.clearTimeout(timer); };
  const schedule = (callback: () => void, delay: number) => {
    const timer = clock.setTimeout(() => { timers.delete(timer); callback(); }, delay);
    timers.add(timer);
    return timer;
  };
  const clearTimers = () => { for (const timer of timers) clock.clearTimeout(timer); timers.clear(); heartbeatPending = false; retryTimer = undefined; };
  const retire = (code?: number, reason?: string) => {
    incoming.length = 0; incomingBytes = 0; decoding = false;
    const oldWs = ws, oldSse = sse, oldHandlers = [...sseHandlers];
    ws = undefined; sse = undefined; sseHandlers.clear();
    if (oldWs) { oldWs.onopen = oldWs.onclose = oldWs.onmessage = oldWs.onerror = null; try { oldWs.close(code, reason); } catch { /* already closed */ } }
    if (oldSse) { for (const [topic, handler] of oldHandlers) { try { oldSse.removeEventListener(topic, handler); } catch {} } oldSse.onopen = oldSse.onmessage = oldSse.onerror = null; try { oldSse.close(); } catch { /* already closed */ } }
  };
  const validUrl = () => transportUrl({ url: options.url, transport: mode, allowInsecure: options.allowInsecure });
  const reconnect = () => {
    if (disposed || !wanted || retryTimer !== undefined || attempts >= retries) return;
    const current = generation;
    const base = Math.min(backoff.maxDelay, backoff.delay * backoff.factor ** attempts++);
    const draw = clock.random(), random = Number.isFinite(draw) ? Math.min(1, Math.max(0, draw)) : 0.5;
    if (!currentConnection(current)) return;
    const delay = Math.min(backoff.maxDelay, Math.max(0, base * (1 + backoff.jitter * (2 * random - 1))));
    retryTimer = schedule(() => { retryTimer = undefined; if (wanted && !disposed) void connect(); }, delay);
  };
  const disconnected = (code: 'ZEN-1701' | 'ZEN-1703' | 'ZEN-1704' | 'ZEN-1705') => {
    if (disposed || !wanted) return;
    const current = ++generation;
    clearTimers(); retire();
    if (!currentConnection(current)) return;
    status.set('error'); report(fail(code), current);
    if (current === generation) reconnect();
  };
  const serialize = (data: unknown): string | ArrayBuffer => {
    try {
      const value = options.serialize ? options.serialize(data) : JSON.stringify(data);
      if (typeof value !== 'string' && !(value instanceof ArrayBuffer)) throw fail('ZEN-1702');
      if ((typeof value === 'string' ? encoder.encode(value).byteLength : value.byteLength) > maxSize) throw fail('ZEN-1702');
      return value;
    } catch { throw fail('ZEN-1702'); }
  };
  const write = (frame: string | ArrayBuffer, current = generation): boolean => {
    if (!currentConnection(current)) return false;
    const socket = ws;
    if (!socket || socket.readyState !== 1 || socket.bufferedAmount + (typeof frame === 'string' ? encoder.encode(frame).length : frame.byteLength) > maxBuffered) throw fail('ZEN-1704');
    try { socket.send(frame); } catch { throw fail('ZEN-1701'); }
    return currentConnection(current) && ws === socket;
  };
  const pingLater = () => {
    if (!options.heartbeat || disposed || status.get() !== 'open') return;
    const heartbeat = options.heartbeat;
    cancel(heartbeatTimer);
    heartbeatTimer = schedule(() => {
      if (disposed || status.get() !== 'open') return;
      const current = generation;
      try { if (!write(serialize(heartbeat.message), current)) return; } catch { if (current === generation) disconnected('ZEN-1701'); return; }
      heartbeatPending = true;
      heartbeatTimer = schedule(() => disconnected('ZEN-1705'), heartbeat.timeout);
    }, heartbeat.interval);
  };
  const deliver = (data: T, topic: string, current = generation) => {
    if (disposed || current !== generation) return;
    lastMessage.set(data);
    messages.set(history === 0 ? [] : [...messages.get(), data].slice(-history));
    for (const callback of [...(topics.get(topic) ?? []), ...(topic === '*' ? [] : topics.get('*') ?? [])]) {
      if (disposed || current !== generation) break;
      try { callback(data); } catch { report(fail('ZEN-1702'), current); }
    }
    if (!disposed) emit('message', data, current);
  };
  const accept = (text: string, current: number, eventTopic?: string) => {
    if (!currentConnection(current)) return;
    if (encoder.encode(text).length > maxSize) throw fail('ZEN-1702');
    if (heartbeatPending) { heartbeatPending = false; cancel(heartbeatTimer); pingLater(); }
    const parser = options.parse ?? DEFAULTS.parse;
    const data: unknown = typeof parser === 'function' ? parser(text) : parser === 'text' ? text : JSON.parse(text);
    if (!currentConnection(current)) return;
    const topic = data && typeof data === 'object' && 'topic' in data && typeof data.topic === 'string' ? data.topic : eventTopic ?? '*';
    deliver(data as T, topic, current);
  };
  const frameSize = (raw: unknown) => typeof raw === 'string' ? encoder.encode(raw).length
    : raw instanceof ArrayBuffer || ArrayBuffer.isView(raw) ? raw.byteLength
    : typeof Blob !== 'undefined' && raw instanceof Blob ? raw.size : -1;
  const receive = (raw: unknown, current: number, eventTopic?: string): void => {
    if (!currentConnection(current)) return;
    if (decoding) {
      const size = frameSize(raw);
      if (size < 0 || size > maxSize) { report(fail('ZEN-1702'), current); return; }
      if (incoming.length >= DEFAULTS.queue.maxSize || incomingBytes + size > maxBuffered) { disconnected('ZEN-1704'); return; }
      incomingBytes += size; incoming.push({ raw, current, topic: eventTopic }); return;
    }
    try {
      if (typeof Blob !== 'undefined' && raw instanceof Blob) {
        if (raw.size > maxSize) throw fail('ZEN-1702');
        const reading = raw.text(); decoding = true;
        void reading.then(text => accept(text, current, eventTopic)).catch(() => report(fail('ZEN-1702'), current)).finally(() => {
          if (current !== generation) return;
          decoding = false;
          while (!decoding && incoming.length) { const next = incoming.shift()!; incomingBytes -= frameSize(next.raw); receive(next.raw, next.current, next.topic); }
        }).catch(() => { /* a custom observer cannot leave a decoder rejection unobserved */ });
      } else if (typeof raw === 'string') accept(raw, current, eventTopic);
      else if (raw instanceof ArrayBuffer || ArrayBuffer.isView(raw)) {
        if (raw.byteLength > maxSize) throw fail('ZEN-1702');
        const bytes = raw instanceof ArrayBuffer ? raw : new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
        accept(new TextDecoder().decode(bytes), current, eventTopic);
      } else throw fail('ZEN-1702');
    } catch { report(fail('ZEN-1702'), current); }
  };
  const bindSseTopics = (current: number) => {
    if (!sse) return;
    for (const topic of topics.keys()) {
      if (topic === '*' || topic === 'message' || sseHandlers.has(topic)) continue;
      const handler: EventListener = event => { void receive((event as MessageEvent<unknown>).data, current, topic); };
      sseHandlers.set(topic, handler);
      sse.addEventListener(topic, handler);
    }
  };
  const connected = (current: number, token?: string) => {
    if (disposed || !wanted || current !== generation) return;
    // Authentication precedes every buffered application frame. User serializers and
    // injected send methods may synchronously close/dispose/reopen the client.
    try {
      if (token && (options.authMode ?? 'first-message') === 'first-message' && !write(serialize({ type: 'auth', token }), current)) return;
      while (outbox.length && currentConnection(current)) {
        const frame = outbox.shift()!;
        try { if (!write(frame, current)) return; }
        catch (failure) { if (currentConnection(current)) outbox.unshift(frame); throw failure; }
      }
    } catch { if (currentConnection(current)) disconnected('ZEN-1701'); return; }
    if (!currentConnection(current)) return;
    attempts = 0; error.set(null); status.set('open'); emit('open', undefined, current);
    pingLater();
  };
  async function connect() {
    if (disposed || !wanted) return;
    const current = ++generation;
    retire(); if (!currentConnection(current)) return; status.set('connecting');
    try {
      let url: URL;
      try { url = validUrl(); }
      catch { if (!disposed && current === generation) disconnected('ZEN-1703'); return; }
      const token = options.auth ? await options.auth() : undefined;
      if (disposed || !wanted || current !== generation) return;
      if (options.auth && (typeof token !== 'string' || !token)) throw fail('ZEN-1701');
      if (token && options.authMode === 'query') url.searchParams.set('token', token);
      if (mode === 'ws') {
        const protocols = [...(options.protocols ?? [])];
        if (token && options.authMode === 'subprotocol') protocols.push(token);
        const acquired = options.webSocketFactory ? options.webSocketFactory(url.href, protocols) : new WebSocket(url.href, protocols);
        if (!currentConnection(current)) { try { acquired.close(); } catch {} return; }
        ws = acquired;
        ws.onopen = () => connected(current, token);
        ws.onmessage = event => { void receive(event.data, current); };
        ws.onerror = () => { if (current === generation) disconnected('ZEN-1701'); };
        ws.onclose = event => {
          if (disposed || current !== generation) return;
          const closed = ++generation; clearTimers(); retire(); if (!currentConnection(closed)) return; status.set('closed'); emit('close', { code: event.code, reason: event.reason }, closed); if (closed === generation) reconnect();
        };
      } else {
        if (options.heartbeat || (token && options.authMode !== 'query')) throw fail('ZEN-1701');
        const acquired = options.eventSourceFactory ? options.eventSourceFactory(url.href, { withCredentials: options.withCredentials }) : new EventSource(url.href, { withCredentials: options.withCredentials });
        if (!currentConnection(current)) { try { acquired.close(); } catch {} return; }
        sse = acquired;
        sse.onopen = () => connected(current);
        sse.onmessage = event => { void receive(event.data, current, 'message'); };
        bindSseTopics(current);
        sse.onerror = () => { if (current === generation) disconnected('ZEN-1701'); };
      }
    } catch { if (!disposed && current === generation) disconnected('ZEN-1701'); }
  }
  const send = (data: unknown) => {
    if (disposed) return;
    if (mode === 'sse') throw fail('ZEN-1701'); // EventSource is receive-only.
    const current = generation, frame = serialize(data);
    if (disposed || current !== generation) return;
    if (status.get() === 'open') { write(frame); return; }
    if (queue.whileDisconnected === 'drop') return;
    if (outbox.length >= queue.maxSize) throw fail('ZEN-1704');
    outbox.push(frame);
  };
  const close = (code = 1000, reason = '') => {
    if (disposed || (!wanted && status.get() === 'closed')) return;
    if (!(code === 1000 || (Number.isInteger(code) && code >= 3000 && code <= 4999)) || encoder.encode(reason).length > 123) throw fail('ZEN-1701');
    wanted = false; const current = ++generation; status.set('closing'); clearTimers();
    // Detach and snapshot before native close: an injected transport may reopen.
    retire(code, reason);
    if (disposed || current !== generation) return;
    status.set('closed'); emit('close', { code, reason }, current);
  };
  const dispose = () => {
    if (disposed) return;
    disposed = true; wanted = false; generation++;
    clearTimers(); retire(); outbox.length = 0; topics.clear(); events.clear();
    status.set('closed');
    options.signal?.removeEventListener('abort', dispose);
    removeTestReceiver();
    status.dispose(); lastMessage.dispose(); messages.dispose(); error.dispose();
  };
  const client: Realtime<T> = {
    status: readonly(status), lastMessage: readonly(lastMessage), messages: readonly(messages), error: readonly(error),
    open() {
      if (disposed || options.signal?.aborted || wanted) return;
      wanted = true; attempts = 0; clearTimers(); void connect();
    }, close, send, dispose,
    subscribe(topic, callback) {
      if (disposed) return () => {};
      let set = topics.get(topic);
      if (!set) { set = new Set(); topics.set(topic, set); }
      const listener = (value: T) => callback(value);
      set.add(listener); bindSseTopics(generation);
      let active = true;
      return () => {
        if (!active) return;
        active = false; set?.delete(listener);
        if (!set?.size && topics.get(topic) === set) {
          topics.delete(topic);
          const handler = sseHandlers.get(topic);
          if (handler) { sse?.removeEventListener(topic, handler); sseHandlers.delete(topic); }
        }
      };
    },
    on(event, callback) {
      if (disposed) return () => {};
      let set = events.get(event);
      if (!set) { set = new Set(); events.set(event, set); }
      const listener = (value: unknown) => callback(value);
      set.add(listener);
      let active = true;
      return () => { if (!active) return; active = false; set?.delete(listener); if (!set?.size && events.get(event) === set) events.delete(event); };
    },
  };
  removeTestReceiver = registerTestReceiver(client, (data, topic) => deliver(data as T, topic));
  if (options.signal?.aborted) dispose();
  else {
    options.signal?.addEventListener('abort', dispose, { once: true });
    const ssr = typeof document !== 'undefined' && (document as Document & { __zenithSSR__?: boolean }).__zenithSSR__ === true;
    if ((options.autoConnect ?? DEFAULTS.autoConnect) && !ssr && typeof window !== 'undefined') client.open();
  }
  return client;
}

/** @public */
export function createWebSocket<T = unknown>(url: string | (() => string), options: Omit<RealtimeOptions<T>, 'url' | 'transport'> = {}): Realtime<T> { return createRealtime({ ...options, url, transport: 'ws' }); }
/** @public */
export function createSSE<T = unknown>(url: string | (() => string), options: Omit<RealtimeOptions<T>, 'url' | 'transport'> = {}): Realtime<T> { return createRealtime({ ...options, url, transport: 'sse' }); }
