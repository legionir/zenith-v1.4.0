// packages/devtools-core/src/index.ts
//
// #147 — @zenith/devtools-core (SPEC §۲.۷، لایهٔ L1):
//   • اتصال به @zenith/state از طریق تنها نقطهٔ hook (`setSignalObserver`).
//   • رجیستری واحد Signal با شناسهٔ رشته‌ای (`sig-1`, `sig-2`, ...) و WeakRef + FinalizationRegistry.
//   • Timeline، اشتراک تغییرات (`onStateChange`)، فیلتر redact، sampleRate و captureValues.
//   • Time-travel: `snapshot()`, `restore(snap)`, `replay(from, to, { speed })`.
//   • گراف زمان اجرا: `RuntimeGraph` (با alias سازگار `DependencyGraph`).
//   • رجیستری پنل: `registerCache`, `registerStore`, `registerApp`.
//   • Hook نسخه‌دار روی `globalThis.__ZENITH_DEVTOOLS_HOOK__` با `{ version, emit, on }` و خطاهای ZEN-2401 / ZEN-2402.

import { createReservedError } from '@zenith/errors';
import { s, defineOptions } from '@zenith/schema';
import type { Cleanup, Disposable } from '@zenith/shared';
import { setSignalObserver, type Signal } from '@zenith/state';

export {
  RuntimeGraph,
  DependencyGraph,
  runtimeGraph,
  graph,
  getRuntimeGraph,
  clearRuntimeGraph,
  getDependencyGraph,
  clearDependencyGraph,
  recordRead,
  recordWrite,
  recordDomUpdate,
  type GraphNode,
  type GraphEdge,
  type GraphSnapshot,
  type GraphNodeType,
  type GraphEdgeType,
} from './graph';

export const DEVTOOLS_HOOK_VERSION = '1.5.0';

const DEFAULT_REDACT_KEYS = ['token', 'password', 'authorization', 'secret', 'cookie'] as const;

export interface DevtoolsCoreOptions {
  /** فعال بودن ردیابی؛ پیش‌فرض: `__ZENITH_DEV__ !== false`. */
  enabled?: boolean;
  /** حداکثر تعداد رخدادهای Timeline؛ پیش‌فرض: `1000`. */
  maxTimelineEntries?: number;
  /** کلیدهایی که در مقادیر آبجکت پوشیده می‌شوند. */
  redact?: string[];
  /** نرخ نمونه‌برداری تغییرات (۰..۱)؛ پیش‌فرض: `1`. */
  sampleRate?: number;
  /** آیا مقدار کامل ذخیره شود (`true`) یا خلاصهٔ نوع/اندازه (`false`)؟ */
  captureValues?: boolean;
}

export const devtoolsCoreOptions = defineOptions<Required<DevtoolsCoreOptions>>(
  'DevtoolsCoreOptions',
  s.object({
    enabled: s.default(s.boolean(), true),
    maxTimelineEntries: s.default(s.number({ int: true, min: 1 }), 1000),
    redact: s.default(s.array(s.string({ min: 1 })), [...DEFAULT_REDACT_KEYS]),
    sampleRate: s.default(s.number({ min: 0, max: 1 }), 1),
    captureValues: s.default(s.boolean(), true),
  }),
);

export const DEVTOOLS_CORE_DEFAULTS = devtoolsCoreOptions.DEFAULTS;
export const devtoolsCoreOptionsSchema = devtoolsCoreOptions.schema;
export const resolveDevtoolsCoreOptions = (opts?: unknown): Required<DevtoolsCoreOptions> =>
  devtoolsCoreOptions.resolve(opts);

export interface SignalInfo {
  /** شناسهٔ رشته‌ای یکتا (مثلاً `'sig-1'`). */
  id: string;
  /** نام اختیاری سیگنال. */
  name?: string;
  /** مقدار فعلی (یا خلاصه در حالت `captureValues: false`). */
  value: unknown;
  /** تعداد subscriberهای فعال. */
  subscriberCount: number;
  /** آیا computed است؟ */
  computed: boolean;
  /** زمان ساخت (ms). */
  createdAt: number;
  /** مرجع ضعیف به نمونهٔ Signal برای جلوگیری از نشت حافظه. */
  signalRef: WeakRef<Signal<any>>;
}

export interface StateChange {
  /** شناسهٔ یکتای رخداد تغییر. */
  id: string;
  /** شناسهٔ رشته‌ای سیگنال. */
  signalId: string;
  /** نام سیگنال (در صورت وجود). */
  signalName?: string;
  /** مقدار قبلی. */
  oldValue: unknown;
  /** مقدار جدید. */
  newValue: unknown;
  /** زمان تغییر (ms). */
  timestamp: number;
}

export interface SnapshotSignalEntry {
  name?: string;
  value: unknown;
}

export interface Snapshot {
  version: string;
  timestamp: number;
  signals: Record<string, SnapshotSignalEntry>;
  timelineLength: number;
}

export interface DevtoolsHookEventMap {
  'signal:create': SignalInfo;
  'signal:change': StateChange;
  'signal:dispose': { id: string };
  'signal:name': { id: string; name: string };
  'snapshot:restore': Snapshot;
  [event: string]: unknown;
}

export interface ZenithDevtoolsCoreHook {
  readonly version: string;
  emit<K extends keyof DevtoolsHookEventMap>(event: K, payload: DevtoolsHookEventMap[K]): void;
  on<K extends keyof DevtoolsHookEventMap>(
    event: K,
    handler: (payload: DevtoolsHookEventMap[K]) => void,
  ): Cleanup;
}

// ── وضعیت داخلی ──

let currentConfig: Required<DevtoolsCoreOptions> = {
  ...DEVTOOLS_CORE_DEFAULTS,
  redact: [...DEVTOOLS_CORE_DEFAULTS.redact],
};

let signalToId = new WeakMap<Signal<any>, string>();
const idToInfo = new Map<string, SignalInfo>();
let nextSignalSeq = 1;
let nextChangeSeq = 1;
const timeline: StateChange[] = [];
const stateChangeListeners = new Set<(change: StateChange) => void>();
let isRestoring = false;

const registeredCaches = new Map<string, unknown>();
const registeredStores = new Map<string, unknown>();
const registeredApps = new Map<string, unknown>();

const finalizationRegistry: FinalizationRegistry<string> | null =
  typeof FinalizationRegistry !== 'undefined'
    ? new FinalizationRegistry<string>((id: string) => {
        idToInfo.delete(id);
      })
    : null;

function isSSRContext(): boolean {
  const g = globalThis as Record<string, unknown>;
  if (g.__ZENITH_SSR__ === true) return true;
  if (
    typeof document !== 'undefined' &&
    (document as unknown as Record<string, unknown>).__zenithSSR__ === true
  ) {
    return true;
  }
  return false;
}

function isTrackingEnabled(): boolean {
  if (isSSRContext()) return false;
  const g = globalThis as Record<string, unknown>;
  if (g.__ZENITH_DEVTOOLS__ === false) return false;
  if (g.__ZENITH_DEV__ === false && g.__ZENITH_DEVTOOLS__ !== true && !currentConfig.enabled) {
    return false;
  }
  return currentConfig.enabled;
}

function formatCapturedValue(val: unknown): unknown {
  if (!currentConfig.captureValues) {
    if (val === null) return '[null]';
    if (Array.isArray(val)) return `[Array(${val.length})]`;
    if (typeof val === 'object') return `[Object(${Object.keys(val as object).length})]`;
    if (typeof val === 'string') return `[string(${val.length})]`;
    return `[${typeof val}]`;
  }
  if (val === null || typeof val !== 'object' || Array.isArray(val)) {
    return val;
  }
  const redactSet = new Set(currentConfig.redact.map((k) => k.toLowerCase()));
  if (redactSet.size === 0) return val;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
    out[k] = redactSet.has(k.toLowerCase()) ? '[REDACTED]' : v;
  }
  return out;
}

function cleanupDeadSignals(): void {
  for (const [id, info] of idToInfo) {
    if (info.signalRef.deref() === undefined) {
      idToInfo.delete(id);
    }
  }
}

// ── Versioned Hook (`window.__ZENITH_DEVTOOLS_HOOK__`) ──

const hookListeners = new Map<string, Set<(payload: any) => void>>();

export const hook: ZenithDevtoolsCoreHook = {
  version: DEVTOOLS_HOOK_VERSION,
  emit(event, payload) {
    const set = hookListeners.get(String(event));
    if (!set) return;
    for (const fn of set) {
      try {
        fn(payload);
      } catch {
        // خطای listener خارجی نباید جریان برنامه را بشکند
      }
    }
  },
  on(event, handler) {
    const key = String(event);
    let set = hookListeners.get(key);
    if (!set) {
      set = new Set();
      hookListeners.set(key, set);
    }
    set.add(handler);
    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      set?.delete(handler);
    };
  },
};

/**
 * بررسی سازگاری نسخهٔ hook؛ در صورت عدم تطابق، خطای `ZEN-2401` پرتاب می‌کند.
 */
export function assertHookVersion(
  version: unknown,
  expected: string = DEVTOOLS_HOOK_VERSION,
): void {
  if (typeof version !== 'string' || version !== expected) {
    throw createReservedError('ZEN-2401', {
      details: { expected, received: version },
    });
  }
}

// ── Signal Registry & Timeline API ──

/**
 * ثبت یک سیگنال و بازگرداندن شناسهٔ رشته‌ای یکتا (`sig-N`).
 */
export function registerSignal(sig: Signal<any>, name?: string): string {
  if (!isTrackingEnabled()) return '';

  const existing = signalToId.get(sig);
  if (existing !== undefined) {
    if (name !== undefined) {
      const info = idToInfo.get(existing);
      if (info) info.name = name;
    }
    return existing;
  }

  const id = `sig-${nextSignalSeq++}`;
  const rawVal = typeof sig.peek === 'function' ? sig.peek() : sig.get();
  const info: SignalInfo = {
    id,
    name,
    value: formatCapturedValue(rawVal),
    subscriberCount: sig.subscriberCount ?? 0,
    computed: Boolean((sig as unknown as { _computed?: boolean })._computed),
    createdAt: Date.now(),
    signalRef: new WeakRef(sig),
  };

  signalToId.set(sig, id);
  idToInfo.set(id, info);
  finalizationRegistry?.register(sig, id);
  hook.emit('signal:create', info);
  return id;
}

/**
 * نام‌گذاری یا تغییر نام یک سیگنال ثبت‌شده.
 */
export function nameSignal(sig: Signal<any>, name: string): void {
  if (!isTrackingEnabled()) return;
  let id = signalToId.get(sig);
  if (id === undefined) {
    id = registerSignal(sig, name);
  } else {
    const info = idToInfo.get(id);
    if (info) info.name = name;
  }
  if (id) {
    hook.emit('signal:name', { id, name });
  }
}

/**
 * ثبت یک تغییر مقدار سیگنال در Timeline.
 */
export function recordStateChange(
  sig: Signal<any>,
  oldValue: unknown,
  newValue: unknown,
): StateChange | undefined {
  if (!isTrackingEnabled() || isRestoring) return undefined;

  if (currentConfig.sampleRate < 1) {
    // NON-SECURITY: probabilistic devtools telemetry sampling (#64)
    // eslint-disable-next-line no-restricted-syntax
    if (currentConfig.sampleRate <= 0 || Math.random() > currentConfig.sampleRate) {
      return undefined;
    }
  }

  let id = signalToId.get(sig);
  if (id === undefined) {
    id = registerSignal(sig);
  }
  if (!id) return undefined;

  const info = idToInfo.get(id);
  const capturedOld = formatCapturedValue(oldValue);
  const capturedNew = formatCapturedValue(newValue);

  if (info) {
    info.value = capturedNew;
    info.subscriberCount = sig.subscriberCount ?? 0;
  }

  const change: StateChange = {
    id: `chg-${nextChangeSeq++}`,
    signalId: id,
    signalName: info?.name,
    oldValue: capturedOld,
    newValue: capturedNew,
    timestamp: Date.now(),
  };

  timeline.push(change);
  while (timeline.length > currentConfig.maxTimelineEntries) {
    timeline.shift();
  }

  for (const listener of stateChangeListeners) {
    try {
      listener(change);
    } catch {
      // ignore listener errors
    }
  }
  hook.emit('signal:change', change);
  return change;
}

export function getAllSignals(): SignalInfo[] {
  if (!isTrackingEnabled()) return [];
  cleanupDeadSignals();
  return Array.from(idToInfo.values());
}

export function getSignalInfo(id: string): SignalInfo | undefined {
  if (!isTrackingEnabled()) return undefined;
  const info = idToInfo.get(id);
  if (info && info.signalRef.deref() === undefined) {
    idToInfo.delete(id);
    return undefined;
  }
  return info;
}

export function getTimeline(limit?: number): StateChange[] {
  if (!isTrackingEnabled()) return [];
  if (limit === undefined) return timeline.slice();
  if (limit <= 0) return [];
  return timeline.slice(-limit);
}

export const getStateTimeline = getTimeline;

export function onStateChange(cb: (change: StateChange) => void): Cleanup {
  stateChangeListeners.add(cb);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    stateChangeListeners.delete(cb);
  };
}

export function clearRegistry(): void {
  signalToId = new WeakMap<Signal<any>, string>();
  idToInfo.clear();
  timeline.length = 0;
  stateChangeListeners.clear();
}

export const clearDevtoolsRegistry = clearRegistry;

// ── Time-Travel: snapshot / restore / replay ──

/**
 * گرفتن اسنپ‌شات از وضعیت فعلی همهٔ سیگنال‌های زنده.
 */
export function snapshot(): Snapshot {
  cleanupDeadSignals();
  const signals: Record<string, SnapshotSignalEntry> = {};
  for (const [id, info] of idToInfo) {
    const sig = info.signalRef.deref();
    if (!sig) continue;
    const raw = typeof sig.peek === 'function' ? sig.peek() : sig.get();
    signals[id] = {
      name: info.name,
      value: structuredClone(raw),
    };
  }
  return {
    version: DEVTOOLS_HOOK_VERSION,
    timestamp: Date.now(),
    signals,
    timelineLength: timeline.length,
  };
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * بازگردانی وضعیت سیگنال‌ها از روی یک `Snapshot`.
 * ساختار نامعتبر ⇒ `ZEN-2402`؛ نسخهٔ ناسازگار ⇒ `ZEN-2401`.
 */
export function restore(snap: unknown): void {
  if (
    !isPlainObject(snap) ||
    typeof snap.timestamp !== 'number' ||
    !Number.isFinite(snap.timestamp) ||
    !isPlainObject(snap.signals)
  ) {
    throw createReservedError('ZEN-2402', {
      details: { snapshot: snap },
    });
  }

  if (typeof snap.version !== 'string') {
    throw createReservedError('ZEN-2402', {
      details: { snapshot: snap, reason: 'missing version' },
    });
  }

  assertHookVersion(snap.version);

  const signalsMap = snap.signals as Record<string, unknown>;
  for (const [id, entry] of Object.entries(signalsMap)) {
    if (!isPlainObject(entry) || !('value' in entry)) {
      throw createReservedError('ZEN-2402', {
        details: { id, entry },
      });
    }
  }

  isRestoring = true;
  try {
    for (const [id, entry] of Object.entries(signalsMap) as Array<[string, SnapshotSignalEntry]>) {
      const info = idToInfo.get(id);
      const sig = info?.signalRef.deref();
      if (!sig || !info) continue;
      try {
        sig.set(structuredClone(entry.value));
        info.value = formatCapturedValue(entry.value);
      } catch {
        // سیگنال readonly را نادیده بگیر
      }
    }
  } finally {
    isRestoring = false;
  }

  hook.emit('snapshot:restore', snap as unknown as Snapshot);
}

/**
 * بازپخش گام‌به‌گام بازه‌ای از Timeline بر اساس اندیس (`from` تا `to`).
 */
export async function replay(from: number, to: number, opts?: { speed?: number }): Promise<void> {
  const speed = opts?.speed ?? 1;
  if (typeof speed !== 'number' || !Number.isFinite(speed) || speed <= 0) {
    throw createReservedError('ZEN-1004', {
      details: { path: 'speed', expected: '> 0', received: speed },
    });
  }
  if (timeline.length === 0) return;

  const clamp = (idx: number) => Math.max(0, Math.min(timeline.length - 1, Math.trunc(idx)));
  const start = clamp(from);
  const end = clamp(to);
  const step = start <= end ? 1 : -1;

  isRestoring = true;
  try {
    for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
      const entry = timeline[i];
      if (!entry) continue;
      const info = idToInfo.get(entry.signalId);
      const sig = info?.signalRef.deref();
      if (sig && info) {
        const targetVal = step > 0 ? entry.newValue : entry.oldValue;
        try {
          sig.set(targetVal);
          info.value = formatCapturedValue(targetVal);
        } catch {
          // ignore readonly signal
        }
      }
      if (i !== end && speed < 100) {
        const delayMs = Math.min(20, Math.max(0, Math.round(5 / speed)));
        if (delayMs > 0) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    }
  } finally {
    isRestoring = false;
  }
}

// ── Panel Registries (`registerCache`, `registerStore`, `registerApp`) ──

export function registerCache(name: string, cache: unknown): Cleanup {
  registeredCaches.set(name, cache);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    if (registeredCaches.get(name) === cache) {
      registeredCaches.delete(name);
    }
  };
}

export function getRegisteredCaches(): ReadonlyMap<string, unknown> {
  return new Map(registeredCaches);
}

export function registerStore(name: string, store: unknown): Cleanup {
  registeredStores.set(name, store);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    if (registeredStores.get(name) === store) {
      registeredStores.delete(name);
    }
  };
}

export function getRegisteredStores(): ReadonlyMap<string, unknown> {
  return new Map(registeredStores);
}

export function registerApp(name: string, app: unknown): Cleanup {
  registeredApps.set(name, app);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    if (registeredApps.get(name) === app) {
      registeredApps.delete(name);
    }
  };
}

export function getRegisteredApps(): ReadonlyMap<string, unknown> {
  return new Map(registeredApps);
}

// ── installDevtoolsCore ──

/**
 * نصب هستهٔ DevTools و اتصال به `setSignalObserver` در `@zenith/state`.
 * در SSR به‌طور کامل no-op است.
 */
export function installDevtoolsCore(opts?: DevtoolsCoreOptions): Disposable {
  const resolved = devtoolsCoreOptions.resolve(opts);
  const g = globalThis as Record<string, unknown>;
  const defaultEnabled = g.__ZENITH_DEV__ !== false;
  const effectiveEnabled = opts?.enabled !== undefined ? resolved.enabled : defaultEnabled;

  currentConfig = {
    ...resolved,
    enabled: effectiveEnabled,
    redact: [...resolved.redact],
  };

  if (isSSRContext() || !effectiveEnabled) {
    return {
      dispose() {
        /* SSR / disabled no-op */
      },
    };
  }

  // بررسی سازگاری hook از پیش نصب‌شده روی globalThis / window
  const existingHook = g.__ZENITH_DEVTOOLS_HOOK__ as { version?: unknown } | undefined;
  if (existingHook && existingHook.version !== undefined) {
    assertHookVersion(existingHook.version);
  }
  g.__ZENITH_DEVTOOLS_HOOK__ = hook;

  const detachObserver = setSignalObserver({
    onCreate(sig, name) {
      registerSignal(sig, name);
    },
    onChange(sig, oldValue, newValue) {
      recordStateChange(sig, oldValue, newValue);
    },
    onDispose(sig) {
      const id = signalToId.get(sig);
      if (id !== undefined) {
        idToInfo.delete(id);
        hook.emit('signal:dispose', { id });
      }
    },
    onName(sig, name) {
      nameSignal(sig, name);
    },
  });

  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      detachObserver();
      if (g.__ZENITH_DEVTOOLS_HOOK__ === hook) {
        delete g.__ZENITH_DEVTOOLS_HOOK__;
      }
    },
  };
}
