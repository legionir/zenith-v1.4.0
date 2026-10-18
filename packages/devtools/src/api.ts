/**
 * Zenith DevTools Internal API
 *
 * Provides standardized access to framework internals for debugging tools.
 *
 * Disabled capture does not inspect or retain submitted values. Diagnostic
 * guards still execute; this is not a literal zero-instruction-cost promise.
 */

import type { Readable } from '@zenith/state';
import { getErrorHistory, untrack } from '@zenith/state';
import { canObserveHost } from './observation-policy';
import { logger } from '@zenith/logger';
import { deprecate, onGlobalReset } from '@zenith/errors';

/** @public */
export interface DevToolsSignalInfo {
  id: string;
  name?: string;
  value: unknown;
  subscriberCount: number;
  computed: boolean;
  createdAt: number;
}

/**
 * @deprecated از `SignalInfo` در `@zenith/devtools-core` یا `DevToolsSignalInfo` استفاده کنید (#50 / #147).
 */
/** @public */
export type SignalInfo = DevToolsSignalInfo;

/** @public */
export interface EffectInfo {
  id: string;
  active: boolean;
  disposed: boolean;
  priority: number;
  dependencies: string[];
  createdAt: number;
  lastRunAt?: number;
}

/** @public */
export interface ComponentInfo {
  id: string;
  name: string;
  parentId?: string;
  children: string[];
  mounted: boolean;
  createdAt: number;
}

/** @public */
export interface DevToolsStateChange {
  id: string;
  signalId: string;
  signalName?: string;
  oldValue: unknown;
  newValue: unknown;
  timestamp: number;
  stack?: string;
}

/**
 * @deprecated از `StateChange` در `@zenith/devtools-core` یا `DevToolsStateChange` استفاده کنید (#50 / #147).
 */
/** @public */
export type StateChange = DevToolsStateChange;

/** @public */
export interface DevToolsAPI {
  version: string;
  enabled: boolean;

  // Control
  enable: () => void;
  disable: () => void;

  // Signals
  getSignals: () => SignalInfo[];
  getSignal: (id: string) => SignalInfo | undefined;
  subscribeToSignals: (callback: (signals: SignalInfo[]) => void) => () => void;

  // Effects
  getEffects: () => EffectInfo[];
  getEffect: (id: string) => EffectInfo | undefined;

  // Components
  getComponentTree: () => ComponentInfo[];
  getComponent: (id: string) => ComponentInfo | undefined;

  // State timeline
  getStateTimeline: (limit?: number) => StateChange[];
  clearStateTimeline: () => void;
  subscribeToStateChanges: (callback: (change: StateChange) => void) => () => void;

  // Errors
  getErrors: () => ReturnType<typeof getErrorHistory>;

  // Performance
  getStats: () => {
    totalSignals: number;
    activeEffects: number;
    disposedEffects: number;
    totalComponents: number;
    timelineEntries: number;
  };
}

// --- Realm-global compatibility data; never selected inside a native SSR scope. ---
let enabled = false, generation = 0;
const signals = new Map<string, SignalInfo>();
const effects = new Map<string, EffectInfo>();
const components = new Map<string, ComponentInfo>();
let stateTimeline: StateChange[] = [];
const MAX_TIMELINE = 500, MAX_RECORDS = 1000;
interface Listener<T> { callback: ((value: T) => void) | null; }
const signalSubscribers = new Set<Listener<SignalInfo[]>>();
const stateChangeSubscribers = new Set<Listener<StateChange>>();
const pending = new WeakSet<Readable<unknown>>();
let signalDispatch: object | null = null, stateDispatch: object | null = null;
let nextId = 1;
const noop = () => {};
const generateId = (prefix: string) => `${prefix}_${nextId++}_${Date.now().toString(36)}`;
const capturing = () => enabled && canObserveHost() && untrack(() => Reflect.get(globalThis, '__ZENITH_DEVTOOLS__') !== false);
function boundRecords<T>(records: Map<string, T>): void {
  if (records.size > MAX_RECORDS) { const first = records.keys().next().value; if (first !== undefined) records.delete(first); }
}
function copySignal(info: SignalInfo): SignalInfo { return { ...info }; }
function copyEffect(info: EffectInfo): EffectInfo { return { ...info, dependencies: info.dependencies.slice() }; }
function copyComponent(info: ComponentInfo): ComponentInfo { return { ...info, children: info.children.slice() }; }
function subscribe<T>(listeners: Set<Listener<T>>, callback: (value: T) => void): () => void {
  if (!canObserveHost()) return noop;
  const record: Listener<T> = { callback }; listeners.add(record);
  return () => { record.callback = null; listeners.delete(record); };
}
function clearListeners<T>(listeners: Set<Listener<T>>): void {
  for (const record of listeners) record.callback = null;
  listeners.clear();
}
function resetPanelData(): void {
  generation++; signals.clear(); effects.clear(); components.clear(); stateTimeline = [];
  clearListeners(signalSubscribers); clearListeners(stateChangeSubscribers);
  signalDispatch = null; stateDispatch = null;
}
onGlobalReset(resetPanelData);

function notifySignalSubscribers(listeners = Array.from(signalSubscribers), epoch = generation): void {
  if (!capturing() || signalDispatch || epoch !== generation) return;
  const dispatch = {}; signalDispatch = dispatch;
  const list = Array.from(signals.values(), copySignal);
  try {
    for (const record of listeners) {
      if (epoch !== generation || !capturing()) break;
      const callback = record.callback; if (!callback) continue;
      try { untrack(() => callback(list.map(copySignal))); } catch { /* external diagnostics */ }
    }
  } finally { if (signalDispatch === dispatch) signalDispatch = null; }
}

/** Capture a real readable result, never a fabricated writable class. @public */
export function registerPanelSignal(source: Readable<unknown>, name?: string): void {
  if (!capturing() || pending.has(source)) return;
  const epoch = generation; pending.add(source);
  try {
    const inspected = untrack(() => ({ value: source.get(), computed: !!Reflect.get(source, '_computed') }));
    if (epoch !== generation || !capturing()) return;
    const id = generateId('sig');
    signals.set(id, { id, name, ...inspected, subscriberCount: 0, createdAt: Date.now() });
    boundRecords(signals); notifySignalSubscribers();
  } finally { pending.delete(source); }
}
/** @public */
export function registerEffect(priority: number): string {
  if (!capturing()) return '';
  const id = generateId('eff');
  effects.set(id, { id, active: false, disposed: false, priority, dependencies: [], createdAt: Date.now() });
  boundRecords(effects); return id;
}
/** @public */
export function markEffectActive(id: string, dependencies: string[]): void {
  if (!capturing()) return;
  const epoch = generation, record = effects.get(id); if (!record || record.disposed) return;
  const captured = untrack(() => dependencies.slice());
  if (epoch !== generation || effects.get(id) !== record || !capturing()) return;
  record.active = true; record.dependencies = captured; record.lastRunAt = Date.now();
}
/** @public */
export function markEffectDisposed(id: string): void {
  if (!capturing()) return;
  const record = effects.get(id);
  if (record) { record.active = false; record.disposed = true; record.dependencies = []; }
}

/** Diagnostic event operands, not a decoder for a Signal<T> payload domain. @public */
export interface PanelStateChangeOptions { oldValue: unknown; newValue: unknown; signalName?: string; }
/** @public */
export function recordPanelStateChange(signalId: string, options: PanelStateChangeOptions): void;
/** @public @deprecated Use recordPanelStateChange(id, { oldValue, newValue, signalName }) (ZEN-DEPR-103; removal in 2.0). */
export function recordPanelStateChange(signalId: string, oldValue: unknown, newValue: unknown, signalName?: string): void;
export function recordPanelStateChange(signalId: string, input: unknown, legacyNew?: unknown, legacyName?: string): void {
  if (!capturing()) return;
  const epoch = generation;
  // The call's arity, not a guessed property on an arbitrary oldValue, selects
  // the old payload protocol. Canonical input is concretely shape-checked.
  const options = untrack((): PanelStateChangeOptions => {
    if (arguments.length >= 3) {
      deprecate('ZEN-DEPR-103', 'recordPanelStateChange(id, old, next, name)', 'recordPanelStateChange(id, { oldValue, newValue, signalName })');
      return { oldValue: input, newValue: legacyNew, signalName: legacyName };
    }
    if (!input || typeof input !== 'object' || !('oldValue' in input) || !('newValue' in input)) throw new TypeError('Invalid panel change options');
    const name: unknown = Reflect.get(input, 'signalName');
    if (name !== undefined && typeof name !== 'string') throw new TypeError('Invalid panel signal name');
    return { oldValue: input.oldValue, newValue: input.newValue, signalName: name };
  });
  if (epoch !== generation || !capturing()) return;
  const change: StateChange = { id: generateId('chg'), signalId, ...options, timestamp: Date.now(), stack: new Error().stack };
  stateTimeline.push(change); if (stateTimeline.length > MAX_TIMELINE) stateTimeline.shift();
  const info = signals.get(signalId); if (info) info.value = options.newValue;
  const signalListeners = Array.from(signalSubscribers);
  if (!stateDispatch) {
    const dispatch = {}; stateDispatch = dispatch;
    try {
      for (const record of Array.from(stateChangeSubscribers)) {
        if (epoch !== generation || !capturing()) break;
        const callback = record.callback; if (!callback) continue;
        try { untrack(() => callback({ ...change })); } catch { /* external diagnostics */ }
      }
    } finally { if (stateDispatch === dispatch) stateDispatch = null; }
  }
  if (epoch === generation) notifySignalSubscribers(signalListeners, epoch);
}

/** @public */
export const devtoolsAPI: DevToolsAPI = {
  version: '1.4.0',
  get enabled() { return capturing(); },
  enable() {
    if (!canObserveHost() || enabled) return;
    generation++; enabled = true;
    try { logger.info('[Zenith DevTools] API enabled — tracking framework internals'); } catch {}
  },
  disable() {
    if (!canObserveHost()) return;
    const previous = enabled; enabled = false; resetPanelData();
    if (previous) try { logger.info('[Zenith DevTools] API disabled — all tracking cleared'); } catch {}
  },
  getSignals: () => capturing() ? Array.from(signals.values(), copySignal) : [],
  getSignal: id => { const info = capturing() ? signals.get(id) : undefined; return info ? copySignal(info) : undefined; },
  subscribeToSignals: callback => subscribe(signalSubscribers, callback),
  getEffects: () => capturing() ? Array.from(effects.values(), copyEffect) : [],
  getEffect: id => { const info = capturing() ? effects.get(id) : undefined; return info ? copyEffect(info) : undefined; },
  getComponentTree: () => capturing() ? Array.from(components.values(), copyComponent) : [],
  getComponent: id => { const info = capturing() ? components.get(id) : undefined; return info ? copyComponent(info) : undefined; },
  getStateTimeline: (limit = 100) => capturing() && limit > 0 ? stateTimeline.slice(-limit).map(entry => ({ ...entry })) : [],
  clearStateTimeline() { if (canObserveHost()) stateTimeline = []; },
  subscribeToStateChanges: callback => subscribe(stateChangeSubscribers, callback),
  getErrors: () => capturing() ? getErrorHistory() : [],
  getStats() {
    return capturing() ? { totalSignals: signals.size,
      activeEffects: Array.from(effects.values()).filter(record => record.active && !record.disposed).length,
      disposedEffects: Array.from(effects.values()).filter(record => record.disposed).length,
      totalComponents: components.size, timelineEntries: stateTimeline.length,
    } : { totalSignals: 0, activeEffects: 0, disposedEffects: 0, totalComponents: 0, timelineEntries: 0 };
  },
};

/** Publish the browser API without enabling capture or touching SSR host data. @public */
export function exposeDevToolsAPI(): void {
  if (!canObserveHost() || typeof window === 'undefined') return;
  if (!Reflect.get(window, '__ZENITH__')) Reflect.set(window, '__ZENITH__', devtoolsAPI);
}

/**
 * @deprecated #119 — نام `registerSignal` با `@zenith/devtools-core.registerSignal`
 * هم‌نام و مبهم بود؛ از `registerPanelSignal` استفاده کنید (ZEN-DEPR-044؛ حذف در ۲.۰).
 */
/** @public */
export function registerSignal(...args: Parameters<typeof registerPanelSignal>): void {
  deprecate('ZEN-DEPR-044', 'registerSignal (@zenith/devtools)', 'registerPanelSignal');
  registerPanelSignal(...args);
}

/**
 * @deprecated #119 — نام `recordStateChange` با `@zenith/devtools-core` هم‌نام بود؛
 * از `recordPanelStateChange` استفاده کنید (ZEN-DEPR-045؛ حذف در ۲.۰).
 */
/** @public */
export function recordStateChange(...args: Parameters<typeof recordPanelStateChange>): void {
  deprecate('ZEN-DEPR-045', 'recordStateChange (@zenith/devtools)', 'recordPanelStateChange');
  const [id, oldValue, newValue, signalName] = args;
  recordPanelStateChange(id, { oldValue, newValue, signalName });
}
