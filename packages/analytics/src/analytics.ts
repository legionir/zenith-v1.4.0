import { createReservedError } from '@zenith/errors';
import { logger } from '@zenith/logger';
import { defineDefaults, secureId } from '@zenith/shared';
import { s } from '@zenith/schema';
import type { Analytics, AnalyticsEvent, AnalyticsOptions, AnalyticsProvider } from './types';

/** @public */
export const DEFAULTS = defineDefaults({ consent: { required: true, default: false }, respectDNT: true, autoPageViews: true, sampleRate: 1, batch: { size: 10, interval: 5000 }, redact: ['token', 'password', 'authorization', 'secret', 'cookie'], sessionTimeout: 1_800_000, maxQueueSize: 100, maxInFlight: 100 });

/** @public */
export function validateAnalyticsOptions(value: unknown): value is AnalyticsOptions {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const o = value as AnalyticsOptions;
  if (o.sampleRate !== undefined && (!Number.isFinite(o.sampleRate) || o.sampleRate < 0 || o.sampleRate > 1)) return false;
  for (const n of [o.sessionTimeout, o.batch?.interval]) if (n !== undefined && (!Number.isFinite(n) || n < 0)) return false;
  for (const n of [o.maxQueueSize, o.maxInFlight, o.batch?.size]) if (n !== undefined && (!Number.isInteger(n) || n <= 0)) return false;
  for (const key of ['respectDNT', 'autoPageViews'] as const) if (o[key] !== undefined && typeof o[key] !== 'boolean') return false;
  for (const key of ['now', 'random', 'sessionIdFactory'] as const) if (o[key] !== undefined && typeof o[key] !== 'function') return false;
  if (o.batch !== undefined && (!o.batch || typeof o.batch !== 'object' || Array.isArray(o.batch))) return false;
  if (o.consent !== undefined && (!o.consent || typeof o.consent !== 'object' || [o.consent.required, o.consent.default].some(v => v !== undefined && typeof v !== 'boolean'))) return false;
  if (o.providers !== undefined && (!Array.isArray(o.providers) || o.providers.some(p => !p || typeof p.name !== 'string' || typeof p.send !== 'function'))) return false;
  if (o.redact !== undefined && (!Array.isArray(o.redact) || o.redact.some(k => typeof k !== 'string'))) return false;
  return true;
}
/** @public */
export const analyticsOptionsSchema = s.custom<AnalyticsOptions>(validateAnalyticsOptions, 'AnalyticsOptions');

/** Live privacy preference; never cached across consent changes. @public */
export function doNotTrack() {
  const host = globalThis as { navigator?: { doNotTrack?: string | null; msDoNotTrack?: string }; doNotTrack?: string };
  return [host.navigator?.doNotTrack, host.navigator?.msDoNotTrack, host.doNotTrack].some(value => value === '1' || value === 'yes');
}
function reportFailure() {
  try { logger.error(createReservedError('ZEN-1901')); } catch { /* diagnostics are not the data path */ }
}

/** JSON-safe, bounded, immutable copy; getters/toJSON/custom prototypes cannot leak through later. */
function copyProps(props: Record<string, unknown> | undefined, keys: ReadonlySet<string>): Record<string, unknown> | undefined {
  const seen = new Set<object>();
  const copy = (value: unknown, depth: number): unknown => {
    if (typeof value === 'string') return value.slice(0, 8192);
    if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
    if (!value || typeof value !== 'object') return undefined;
    if (depth >= 12 || seen.has(value)) return '[Circular/depth]';
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null && !Array.isArray(value)) return '[Unsupported]';
    seen.add(value);
    let result: unknown;
    if (Array.isArray(value)) result = Object.freeze(value.slice(0, 1000).map(item => copy(item, depth + 1)));
    else {
      const record: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
      for (const key of Object.keys(value).slice(0, 1000)) {
        const descriptor = Object.getOwnPropertyDescriptor(value, key);
        record[key] = keys.has(key.toLowerCase()) ? '***' : descriptor && 'value' in descriptor ? copy(descriptor.value, depth + 1) : '[Accessor]';
      }
      result = Object.freeze(record);
    }
    seen.delete(value);
    return result;
  };
  return props === undefined ? undefined : copy(props, 0) as Record<string, unknown>;
}

/** Consent/DNT is checked before allocating events/session IDs and before every send. @public */
export function createAnalytics(options: AnalyticsOptions = {}): Analytics {
  // The schema's custom predicate is also used here, without reflecting raw options into errors.
  if (!validateAnalyticsOptions(options)) throw createReservedError('ZEN-1001', { details: { expected: 'AnalyticsOptions' } });
  const providers = new Map<AnalyticsProvider, number>();
  for (const provider of options.providers ?? []) providers.set(provider, (providers.get(provider) ?? 0) + 1);
  const queue: AnalyticsEvent[] = [];
  const pending = new Set<Promise<void>>();
  const required = options.consent?.required ?? DEFAULTS.consent.required;
  const respectDNT = options.respectDNT ?? DEFAULTS.respectDNT;
  const batchSize = options.batch?.size ?? DEFAULTS.batch.size;
  const interval = options.batch?.interval ?? DEFAULTS.batch.interval;
  const maxQueue = options.maxQueueSize ?? DEFAULTS.maxQueueSize;
  const maxInFlight = options.maxInFlight ?? DEFAULTS.maxInFlight;
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const redacted = new Set((options.redact ?? DEFAULTS.redact).map(k => k.toLowerCase()));
  let granted = options.consent?.default ?? DEFAULTS.consent.default;
  let disposed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let session: string | undefined;
  let lastActivity = 0;
  const cancelTimer = () => { if (timer !== undefined) clearTimeout(timer); timer = undefined; };
  const clearPrivateState = () => { queue.length = 0; session = undefined; lastActivity = 0; cancelTimer(); };
  const allowed = () => !disposed && typeof window !== 'undefined' && (!required || granted) && !(respectDNT && doNotTrack());
  const send = (event: AnalyticsEvent) => {
    for (const provider of [...providers.keys()]) {
      if (!allowed()) { clearPrivateState(); break; }
      if (!providers.has(provider)) continue;
      if (pending.size >= maxInFlight) break;
      try {
        const result = provider.send(event);
        if (result && typeof result.then === 'function') {
          let tracked: Promise<void>;
          tracked = Promise.resolve(result).catch(reportFailure).then(() => { pending.delete(tracked); });
          pending.add(tracked);
        }
      } catch { reportFailure(); }
    }
  };
  const drain = () => {
    cancelTimer();
    if (!allowed()) { clearPrivateState(); return; }
    const events = queue.splice(0);
    for (const event of events) { if (!allowed()) break; send(event); }
  };
  const push = (type: AnalyticsEvent['type'], name: string, props?: Record<string, unknown>) => {
    if (!allowed()) { clearPrivateState(); return; }
    if (random() >= (options.sampleRate ?? DEFAULTS.sampleRate)) return;
    if (queue.length >= maxQueue || pending.size >= maxInFlight) return;
    try {
      const timestamp = now();
      if (!session || timestamp - lastActivity >= (options.sessionTimeout ?? DEFAULTS.sessionTimeout)) session = (options.sessionIdFactory ?? secureId)();
      lastActivity = timestamp;
      queue.push(Object.freeze({ type, name, props: copyProps(props, redacted), timestamp, sessionId: session }));
      if (queue.length >= batchSize || interval === 0) drain();
      else if (timer === undefined) timer = setTimeout(() => { timer = undefined; drain(); }, interval);
    } catch { reportFailure(); }
  };
  return {
    track: (name, props) => push('track', name, props),
    page: (path, props) => push('page', path ?? (typeof location !== 'undefined' ? location.pathname : '/'), props),
    identify: (id, traits) => push('identify', id, traits),
    setConsent(value) { if (disposed) return; granted = Boolean(value); if (!granted) clearPrivateState(); },
    hasConsent: () => !disposed && granted,
    async flush() { drain(); await Promise.all([...pending]); },
    use(provider) {
      if (disposed) return () => {};
      if (!provider || typeof provider.send !== 'function') throw createReservedError('ZEN-1001', { details: { expected: 'AnalyticsProvider' } });
      providers.set(provider, (providers.get(provider) ?? 0) + 1);
      let active = true;
      return () => { if (!active) return; active = false; const count = providers.get(provider) ?? 0; if (count <= 1) providers.delete(provider); else providers.set(provider, count - 1); };
    },
    dispose() { if (disposed) return; disposed = true; clearPrivateState(); providers.clear(); },
  };
}
