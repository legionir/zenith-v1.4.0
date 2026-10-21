import { createReservedError } from '@zenith/errors';
import { defineDefaults } from '@zenith/shared';
import { s } from '@zenith/schema';
import type { RealtimeOptions } from './types';

/** @public */
export const DEFAULTS = defineDefaults({
  transport: 'ws' as const, autoConnect: true, allowInsecure: false, history: 50,
  maxMessageSize: 1_048_576, maxBufferedAmount: 1_048_576,
  parse: 'json' as const, authMode: 'first-message' as const,
  queue: { maxSize: 100, whileDisconnected: 'buffer' as const },
  reconnect: { retries: Infinity, delay: 1000, factor: 2, jitter: 0.3, maxDelay: 30_000 },
});

/** Validate opaque callbacks without evaluating them or including credentials in errors. @public */
export function validateRealtimeOptions(value: unknown): value is RealtimeOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const o = value as RealtimeOptions;
  const finite = (v: number | undefined, min = 0) => v === undefined || (Number.isFinite(v) && v >= min);
  const integer = (v: number | undefined, min = 0) => finite(v, min) && (v === undefined || Number.isInteger(v));
  if (!(typeof o.url === 'string' && o.url.length > 0) && typeof o.url !== 'function') return false;
  if (o.transport !== undefined && !['ws', 'sse'].includes(o.transport)) return false;
  if (o.parse !== undefined && typeof o.parse !== 'function' && !['json', 'text'].includes(o.parse)) return false;
  if (o.authMode !== undefined && !['first-message', 'subprotocol', 'query'].includes(o.authMode)) return false;
  if (!integer(o.history) || !integer(o.maxMessageSize, 1) || !integer(o.maxBufferedAmount, 1)) return false;
  if (o.protocols !== undefined && (!Array.isArray(o.protocols) || o.protocols.some(p => typeof p !== 'string' || !/^[!#$%&'*+.^_`|~0-9a-z-]+$/i.test(p)))) return false;
  if (o.protocols && new Set(o.protocols).size !== o.protocols.length) return false;
  for (const key of ['autoConnect', 'allowInsecure', 'withCredentials'] as const) if (o[key] !== undefined && typeof o[key] !== 'boolean') return false;
  for (const key of ['auth', 'serialize', 'webSocketFactory', 'eventSourceFactory'] as const) if (o[key] !== undefined && typeof o[key] !== 'function') return false;
  if (o.queue !== undefined && (!o.queue || typeof o.queue !== 'object' || Array.isArray(o.queue) || !integer(o.queue.maxSize) || (o.queue.whileDisconnected !== undefined && !['buffer', 'drop'].includes(o.queue.whileDisconnected)))) return false;
  if (o.reconnect !== undefined && typeof o.reconnect !== 'boolean') {
    const r = o.reconnect;
    if (!r || typeof r !== 'object' || Array.isArray(r) || (r.retries !== Infinity && !integer(r.retries)) || !finite(r.delay, 1) || !finite(r.factor, 1) || !finite(r.maxDelay, 1) || !finite(r.jitter) || (r.jitter ?? 0) > 1) return false;
  }
  if (o.heartbeat !== undefined && o.heartbeat !== false && (!o.heartbeat || typeof o.heartbeat !== 'object' || !Number.isFinite(o.heartbeat.interval) || o.heartbeat.interval <= 0 || !Number.isFinite(o.heartbeat.timeout) || o.heartbeat.timeout <= 0)) return false;
  if (o.clock !== undefined && (!o.clock || typeof o.clock.setTimeout !== 'function' || typeof o.clock.clearTimeout !== 'function' || typeof o.clock.random !== 'function')) return false;
  if (o.signal !== undefined && (!o.signal || typeof o.signal.aborted !== 'boolean' || typeof o.signal.addEventListener !== 'function' || typeof o.signal.removeEventListener !== 'function')) return false;
  return true;
}

/** @public */
export const realtimeOptionsSchema = s.custom<RealtimeOptions>(validateRealtimeOptions, 'RealtimeOptions');

export function assertOptions(value: unknown): asserts value is RealtimeOptions {
  if (!validateRealtimeOptions(value)) throw createReservedError('ZEN-1001', { details: { path: 'realtime', expected: 'valid RealtimeOptions', received: typeof value } });
}
