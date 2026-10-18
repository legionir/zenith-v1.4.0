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

import { createReservedError, deprecate } from '@zenith/errors';
import { s, defineOptions } from '@zenith/schema';
import type { Cleanup, Disposable } from '@zenith/shared';
import { setSignalObserver, untrack } from '@zenith/state';
import { isGlobalDiagnosticsAllowed } from './observation-policy';
import { resetRuntimeGraphInternal } from './graph';
import { onGlobalReset } from '@zenith/errors';
import { resolveInspectedWriter } from './signal-mutation';

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
  type GraphSignalOptions,
  type GraphDirectiveOptions,
  type GraphNode,
  type GraphEdge,
  type GraphSnapshot,
  type GraphNodeType,
  type GraphEdgeType,
} from './graph';

/** @public */
export const DEVTOOLS_HOOK_VERSION = '1.5.0';

const DEFAULT_REDACT_KEYS = ['token', 'password', 'authorization', 'secret', 'cookie'] as const;

/** @public */
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

/** Source integration helper; root bridge awaits public-only export migration. @internal */
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

/** @public */
export const DEVTOOLS_CORE_DEFAULTS = devtoolsCoreOptions.DEFAULTS;
/** @public */
export const devtoolsCoreOptionsSchema = devtoolsCoreOptions.schema;
/** @public */
export const resolveDevtoolsCoreOptions = (opts?: unknown): Required<DevtoolsCoreOptions> =>
  devtoolsCoreOptions.resolve(opts);

/** Read-only heterogeneous inspection view; it is not a writable Signal<unknown>. @public */
export interface UntypedSignal<T = unknown> {
  get(): T;
  peek?(): T;
  subscriberCount?: number;
}

/** @public */
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
  signalRef: WeakRef<UntypedSignal>;
}

/** @public */
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

/** @public */
export interface SnapshotSignalEntry {
  name?: string;
  value: unknown;
}

/** @public */
export interface Snapshot {
  version: string;
  timestamp: number;
  signals: Record<string, SnapshotSignalEntry>;
  timelineLength: number;
}

/** @public */
export interface DevtoolsHookEventMap {
  'signal:create': SignalInfo;
  'signal:change': StateChange;
  'signal:dispose': { id: string };
  'signal:name': { id: string; name: string };
  'snapshot:restore': Snapshot;
  [event: string]: unknown;
}

/** @public */
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

let signalToId = new WeakMap<UntypedSignal, string>();
const idToInfo = new Map<string, SignalInfo>();
let nextSignalSeq = 1;
let nextChangeSeq = 1;
const timeline: StateChange[] = [];
interface StateChangeListener { callback: ((change: StateChange) => void) | null; }
const stateChangeListeners = new Set<StateChangeListener>();
const pendingRegistrations = new WeakSet<UntypedSignal>();
let registryGeneration = 0;
const restoringOperations = new Set<object>();
// The shared State observer can have several live scoped installations. One
// older disposer must not unpublish the hook still used by another installation.
const activeInstallations = new Set<object>();

interface PanelRegistration { value: unknown; }
const registeredCaches = new Map<string, PanelRegistration>();
const registeredStores = new Map<string, PanelRegistration>();
const registeredApps = new Map<string, PanelRegistration>();
const noopCleanup: Cleanup = () => {};

const finalizationRegistry: FinalizationRegistry<string> | null =
  typeof FinalizationRegistry !== 'undefined'
    ? new FinalizationRegistry<string>((id: string) => {
        idToInfo.delete(id);
      })
    : null;

function isSSRContext(): boolean { return !isGlobalDiagnosticsAllowed(); }

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

const hookListeners = new Map<string, Set<(payload: unknown) => void>>();

/** @public */
export const hook: ZenithDevtoolsCoreHook = {
  version: DEVTOOLS_HOOK_VERSION,
  emit(event, payload) {
    if (isSSRContext()) return;
    const set = hookListeners.get(String(event));
    if (!set) return;
    for (const fn of Array.from(set)) {
      if (!set.has(fn)) continue;
      try {
        untrack(() => fn(payload));
      } catch {
        // خطای listener خارجی نباید جریان برنامه را بشکند
      }
    }
  },
  on(event, handler) {
    if (isSSRContext()) return noopCleanup;
    const key = String(event);
    let set = hookListeners.get(key);
    if (!set) {
      set = new Set();
      hookListeners.set(key, set);
    }
    const wrapped = (payload: unknown): void => { Reflect.apply(handler, undefined, [payload]); };
    set.add(wrapped);
    let removed = false;
    return () => {
      if (removed) return;
      removed = true;
      set?.delete(wrapped);
    };
  },
};

/**
 * بررسی سازگاری نسخهٔ hook؛ در صورت عدم تطابق، خطای `ZEN-2401` پرتاب می‌کند.
 */
/** @public */
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
 * @public
 */
export function registerSignal<T = unknown>(sig: UntypedSignal<T>, name?: string): string {
  if (!isTrackingEnabled()) return '';
  const untyped: UntypedSignal = sig;
  const existing = signalToId.get(untyped);
  if (existing !== undefined) {
    if (name !== undefined) {
      const info = idToInfo.get(existing); if (info) info.name = name;
    }
    return existing;
  }
  if (pendingRegistrations.has(untyped)) return '';
  const generation = registryGeneration;
  pendingRegistrations.add(untyped);
  try {
    // The declared capability is readable inspection, not a nominal writable
    // Signal. Keep the real object and do not track diagnostic getters.
    const inspected = untrack(() => ({
      value: formatCapturedValue(typeof sig.peek === 'function' ? sig.peek() : sig.get()),
      subscriberCount: sig.subscriberCount ?? 0,
      computed: Boolean(Reflect.get(sig, '_computed')),
    }));
    if (generation !== registryGeneration || !isTrackingEnabled()) return '';
    const id = `sig-${nextSignalSeq++}`;
    const info: SignalInfo = { id, name, ...inspected, createdAt: Date.now(), signalRef: new WeakRef(untyped) };
    signalToId.set(untyped, id); idToInfo.set(id, info); finalizationRegistry?.register(sig, id);
    hook.emit('signal:create', info);
    return id;
  } finally { pendingRegistrations.delete(untyped); }
}

/**
 * نام‌گذاری یا تغییر نام یک سیگنال ثبت‌شده.
 * @public
 */
export function nameSignal<T = unknown>(sig: UntypedSignal<T>, name: string): void {
  if (!isTrackingEnabled()) return;
  const generation = registryGeneration;
  const untyped: UntypedSignal = sig;
  let id = signalToId.get(untyped);
  if (id === undefined) {
    id = registerSignal(sig, name);
  } else {
    const info = idToInfo.get(id);
    if (info) info.name = name;
  }
  if (id && generation === registryGeneration && idToInfo.has(id) && isTrackingEnabled()) {
    hook.emit('signal:name', { id, name });
  }
}

/**
 * ثبت یک تغییر مقدار سیگنال در Timeline.
 * @public
 */
export function recordStateChange<T = unknown>(
  sig: UntypedSignal<T>,
  oldValue: unknown,
  newValue: unknown,
): StateChange | undefined {
  if (!isTrackingEnabled() || restoringOperations.size > 0) return undefined;

  if (currentConfig.sampleRate < 1) {
    // NON-SECURITY: probabilistic devtools telemetry sampling (#64)
    // eslint-disable-next-line no-restricted-syntax
    if (currentConfig.sampleRate <= 0 || Math.random() > currentConfig.sampleRate) {
      return undefined;
    }
  }

  const untyped: UntypedSignal = sig;
  let id = signalToId.get(untyped);
  if (id === undefined) {
    id = registerSignal(sig);
  }
  if (!id) return undefined;

  const info = idToInfo.get(id);
  if (!info) return undefined;
  const generation = registryGeneration;
  const { capturedOld, capturedNew, subscriberCount } = untrack(() => ({
    capturedOld: formatCapturedValue(oldValue), capturedNew: formatCapturedValue(newValue),
    subscriberCount: sig.subscriberCount ?? 0,
  }));
  if (generation !== registryGeneration || idToInfo.get(id) !== info || !isTrackingEnabled()) return undefined;
  info.value = capturedNew; info.subscriberCount = subscriberCount;

  const change: StateChange = {
    id: `chg-${nextChangeSeq++}`,
    signalId: id,
    signalName: info.name,
    oldValue: capturedOld,
    newValue: capturedNew,
    timestamp: Date.now(),
  };

  timeline.push(change);
  while (timeline.length > currentConfig.maxTimelineEntries) {
    timeline.shift();
  }

  for (const listener of Array.from(stateChangeListeners)) {
    if (generation !== registryGeneration) break;
    const callback = listener.callback; if (!callback) continue;
    try { untrack(() => callback(change)); } catch { /* isolate external listeners */ }
  }
  if (generation === registryGeneration) hook.emit('signal:change', change);
  return change;
}

/** @public */
export function getAllSignals(): SignalInfo[] {
  if (!isTrackingEnabled()) return [];
  cleanupDeadSignals();
  return Array.from(idToInfo.values());
}

/** @public */
export function getSignalInfo(id: string): SignalInfo | undefined {
  if (!isTrackingEnabled()) return undefined;
  const info = idToInfo.get(id);
  if (info && info.signalRef.deref() === undefined) {
    idToInfo.delete(id);
    return undefined;
  }
  return info;
}

/** @public */
export function getTimeline(limit?: number): StateChange[] {
  if (!isTrackingEnabled()) return [];
  if (limit === undefined) return timeline.slice();
  if (limit <= 0) return [];
  return timeline.slice(-limit);
}

/** @public */
export const getStateTimeline = getTimeline;

/** Subscribe to diagnostic events without adding reactive dependencies. @public */
export function onStateChange(cb: (change: StateChange) => void): Cleanup {
  if (isSSRContext()) return noopCleanup;
  const listener: StateChangeListener = { callback: cb };
  stateChangeListeners.add(listener);
  return () => { listener.callback = null; stateChangeListeners.delete(listener); };
}

/** @public @deprecated Use resetForTesting() for an explicit process reset (ZEN-DEPR-064). */
export function clearRegistry(): void {
  if (isSSRContext()) return;
  deprecate(
    'ZEN-DEPR-064',
    'clearRegistry (@zenith/devtools-core)',
    'resetForTesting() (@zenith/testing)',
  );
  clearDevtoolsRegistryInternal();
}

/**
 * #118: پاک‌سازی داخلی بدون هشدار (هوک ریست سراسری).
 * This explicit process reset is not a request-local diagnostic API.
 * @internal
 */
export function clearDevtoolsRegistryInternal(): void {
  registryGeneration++;
  resetRuntimeGraphInternal();
  restoringOperations.clear();
  signalToId = new WeakMap<UntypedSignal, string>();
  idToInfo.clear();
  timeline.length = 0;
  for (const listener of stateChangeListeners) listener.callback = null;
  stateChangeListeners.clear();
  // رجیستری‌های پنل (#119 نام‌گذاری صریح)
  for (const registry of [registeredCaches, registeredStores, registeredApps]) {
    for (const entry of registry.values()) entry.value = undefined;
    registry.clear();
  }
}

onGlobalReset(clearDevtoolsRegistryInternal);

/** @public @deprecated Use resetForTesting() for an explicit process reset (ZEN-DEPR-064). */
export const clearDevtoolsRegistry = clearRegistry;

// ── Time-Travel: snapshot / restore / replay ──

/** Capture actual readable values without attaching reactive dependencies. @public */
export function snapshot(): Snapshot {
  const generation = registryGeneration;
  const entries: Array<[string, SnapshotSignalEntry]> = [];
  if (isTrackingEnabled()) untrack(() => {
    cleanupDeadSignals();
    for (const [id, info] of Array.from(idToInfo)) {
      if (generation !== registryGeneration || !isTrackingEnabled()) break;
      const sig = info.signalRef.deref();
      if (!sig) continue;
      const value = structuredClone(typeof sig.peek === 'function' ? sig.peek() : sig.get());
      if (generation !== registryGeneration || idToInfo.get(id) !== info || !isTrackingEnabled()) continue;
      entries.push([id, { name: info.name, value }]);
    }
  });
  const current = generation === registryGeneration && isTrackingEnabled();
  return {
    version: DEVTOOLS_HOOK_VERSION, timestamp: Date.now(),
    signals: current ? Object.fromEntries(entries) : {}, timelineLength: current ? timeline.length : 0,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// A concrete decoder constructs a Snapshot. It neither casts unknown into an
// arbitrary T nor forwards an unvalidated object as a typed hook event.
function decodeSnapshot(input: unknown): Snapshot {
  const invalid = (reason: string): never => { throw createReservedError('ZEN-2402', { details: { reason } }); };
  if (!isPlainObject(input)) return invalid('snapshot must be an object');
  const timestamp = input.timestamp, version = input.version, signals = input.signals;
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) return invalid('invalid timestamp');
  if (typeof version !== 'string') return invalid('missing version');
  assertHookVersion(version);
  if (!isPlainObject(signals)) return invalid('signals must be an object');
  const rawLength = input.timelineLength;
  // Historical restore accepted snapshots without timeline metadata. Normalize
  // that legacy omission explicitly, rather than pretending it was validated.
  const timelineLength = rawLength === undefined ? 0 : rawLength;
  if (typeof timelineLength !== 'number' || !Number.isSafeInteger(timelineLength) || timelineLength < 0) return invalid('invalid timeline length');
  const entries: Array<[string, SnapshotSignalEntry]> = [];
  for (const [id, entry] of Object.entries(signals)) {
    if (!isPlainObject(entry) || !('value' in entry)) return invalid('invalid signal entry');
    const name = entry.name, value = entry.value;
    if (name !== undefined && typeof name !== 'string') return invalid('invalid signal name');
    entries.push([id, name === undefined ? { value } : { name, value }]);
  }
  return { timestamp, version, timelineLength, signals: Object.fromEntries(entries) };
}

/** Validate and restore a concrete Snapshot; readonly setters remain unsupported. @public */
export function restore(input: unknown): void {
  if (!isTrackingEnabled()) return;
  const generation = registryGeneration;
  const decoded = untrack(() => decodeSnapshot(input));
  if (generation !== registryGeneration || !isTrackingEnabled()) return;
  const operation = {}; restoringOperations.add(operation);
  try {
    for (const [id, entry] of Object.entries(decoded.signals)) {
      if (generation !== registryGeneration || !isTrackingEnabled()) break;
      const info = idToInfo.get(id), sig = untrack(() => info?.signalRef.deref());
      if (!sig || !info) continue;
      try {
        const value = untrack(() => structuredClone(entry.value));
        const write = untrack(() => resolveInspectedWriter(sig));
        if (generation !== registryGeneration || idToInfo.get(id) !== info || !isTrackingEnabled()) break;
        untrack(() => write(value));
        const captured = untrack(() => formatCapturedValue(value));
        if (generation === registryGeneration && idToInfo.get(id) === info) info.value = captured;
      } catch { /* reject unsupported clone/setter without fabricating writability */ }
    }
  } finally { restoringOperations.delete(operation); }
  if (generation === registryGeneration && isTrackingEnabled()) hook.emit('snapshot:restore', decoded);
}

/** Replay stable event data; reset invalidates sleeping work without reviving it. @public */
export async function replay(from: number, to: number, opts?: { speed?: number }): Promise<void> {
  if (!isTrackingEnabled()) return;
  const generation = registryGeneration;
  const speed = untrack(() => opts?.speed ?? 1);
  if (typeof speed !== 'number' || !Number.isFinite(speed) || speed <= 0 || !Number.isFinite(from) || !Number.isFinite(to)) {
    throw createReservedError('ZEN-1004', { details: { path: 'replay', expected: 'finite indexes and speed > 0' } });
  }
  if (generation !== registryGeneration || !isTrackingEnabled()) return;
  const steps = timeline.slice(); if (steps.length === 0) return;
  const clamp = (index: number) => Math.max(0, Math.min(steps.length - 1, Math.trunc(index)));
  const start = clamp(from), end = clamp(to), step = start <= end ? 1 : -1;
  const operation = {}; restoringOperations.add(operation);
  try {
    for (let index = start; step > 0 ? index <= end : index >= end; index += step) {
      if (generation !== registryGeneration || !isTrackingEnabled()) break;
      const entry = steps[index]; if (!entry) continue;
      const info = idToInfo.get(entry.signalId), sig = untrack(() => info?.signalRef.deref());
      if (sig && info) try {
        const target = untrack(() => step > 0 ? entry.newValue : entry.oldValue);
        const write = untrack(() => resolveInspectedWriter(sig));
        if (generation !== registryGeneration || idToInfo.get(entry.signalId) !== info || !isTrackingEnabled()) break;
        untrack(() => write(target));
        const captured = untrack(() => formatCapturedValue(target));
        if (generation === registryGeneration && idToInfo.get(entry.signalId) === info) info.value = captured;
      } catch { /* readonly setter */ }
      if (index !== end && speed < 100) {
        const delayMs = Math.min(20, Math.max(0, Math.round(5 / speed)));
        if (delayMs > 0) await new Promise<void>(resolve => setTimeout(resolve, delayMs));
      }
    }
  } finally { restoringOperations.delete(operation); }
}

// ── Panel Registries (`registerCache`, `registerStore`, `registerApp`) ──

// Replacement and reset release old payloads; equal values are not equal leases.
function registerPanel(registry: Map<string, PanelRegistration>, name: string, value: unknown): Cleanup {
  if (isSSRContext()) return noopCleanup;
  const old = registry.get(name); if (old) old.value = undefined;
  const entry: PanelRegistration = { value }; registry.set(name, entry);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    if (registry.get(name) === entry) registry.delete(name);
    entry.value = undefined;
  };
}
function readPanels(registry: Map<string, PanelRegistration>): ReadonlyMap<string, unknown> {
  const view = new Map<string, unknown>();
  if (!isSSRContext()) for (const [name, entry] of registry) view.set(name, entry.value);
  return view;
}

/** @public */
export function registerDevtoolsCache(name: string, cache: unknown): Cleanup {
  return registerPanel(registeredCaches, name, cache);
}
/** @public */
export function getRegisteredCaches(): ReadonlyMap<string, unknown> {
  return readPanels(registeredCaches);
}
/** @public */
export function registerDevtoolsStore(name: string, store: unknown): Cleanup {
  return registerPanel(registeredStores, name, store);
}
/** @public */
export function getRegisteredStores(): ReadonlyMap<string, unknown> {
  return readPanels(registeredStores);
}
/** @public */
export function registerApp(name: string, app: unknown): Cleanup {
  return registerPanel(registeredApps, name, app);
}
/** @public */
export function getRegisteredApps(): ReadonlyMap<string, unknown> {
  return readPanels(registeredApps);
}

// ── installDevtoolsCore ──

/**
 * نصب هستهٔ DevTools و اتصال به `setSignalObserver` در `@zenith/state`.
 * در SSR به‌طور کامل no-op است.
 */
/** @public */
export function installDevtoolsCore(opts?: DevtoolsCoreOptions): Disposable {
  return untrack(() => installCore(opts));
}
function installCore(opts?: DevtoolsCoreOptions): Disposable {
  if (isSSRContext()) return { dispose: noopCleanup };
  const resolved = devtoolsCoreOptions.resolve(opts);
  const g = globalThis as Record<string, unknown>;
  const defaultEnabled = g.__ZENITH_DEV__ !== false;
  const effectiveEnabled = opts?.enabled !== undefined ? resolved.enabled : defaultEnabled;

  const nextConfig = { ...resolved, enabled: effectiveEnabled, redact: [...resolved.redact] };
  if (!effectiveEnabled) { currentConfig = nextConfig; return { dispose: noopCleanup }; }

  // Read only a proven object capability; a failed installation must not apply
  // its new config to an already-live outside observer.
  const existingHook: unknown = g.__ZENITH_DEVTOOLS_HOOK__;
  if (existingHook !== null && (typeof existingHook === 'object' || typeof existingHook === 'function')) {
    const version: unknown = Reflect.get(existingHook, 'version');
    if (version !== undefined) assertHookVersion(version);
  }
  g.__ZENITH_DEVTOOLS_HOOK__ = hook;
  currentConfig = nextConfig;

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
        signalToId.delete(sig); idToInfo.delete(id);
        hook.emit('signal:dispose', { id });
      }
    },
    onName(sig, name) {
      nameSignal(sig, name);
    },
  });

  const installation = {};
  activeInstallations.add(installation);
  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      detachObserver();
      activeInstallations.delete(installation);
      untrack(() => {
        try {
          if (activeInstallations.size === 0 && g.__ZENITH_DEVTOOLS_HOOK__ === hook) {
            if (!Reflect.deleteProperty(g, '__ZENITH_DEVTOOLS_HOOK__') && g.__ZENITH_DEVTOOLS_HOOK__ === hook) Reflect.set(g, '__ZENITH_DEVTOOLS_HOOK__', undefined);
          }
        } catch { /* observer/token teardown must survive hostile global accessors */ }
      });
    },
  };
}

/**
 * @deprecated #119 — نام `registerCache` با `@zenith/cache.registerCache`
 * (رجیستری واقعی کش) هم‌نام و مبهم بود؛ این تابع رجیستری **پنل devtools** است.
 * از `registerDevtoolsCache` استفاده کنید (ZEN-DEPR-042؛ حذف در ۲.۰).
 */
/** @public */
export function registerCache(name: string, cache: unknown): Cleanup {
  deprecate('ZEN-DEPR-042', 'registerCache (@zenith/devtools-core)', 'registerDevtoolsCache');
  return registerDevtoolsCache(name, cache);
}

/**
 * @deprecated #119 — نام `registerStore` با `@zenith/store.registerStore`
 * (رجیستری واقعی storeها) هم‌نام و مبهم بود؛ این تابع رجیستری **پنل devtools**
 * است. از `registerDevtoolsStore` استفاده کنید (ZEN-DEPR-043؛ حذف در ۲.۰).
 */
/** @public */
export function registerStore(name: string, store: unknown): Cleanup {
  deprecate('ZEN-DEPR-043', 'registerStore (@zenith/devtools-core)', 'registerDevtoolsStore');
  return registerDevtoolsStore(name, store);
}
