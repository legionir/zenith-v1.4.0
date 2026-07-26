/**
 * Zenith DevTools Internal API
 *
 * Provides standardized access to framework internals for debugging tools.
 *
 * IMPORTANT: This entire system is ZERO-COST when DevTools is not attached.
 * No tracking, no storage, no overhead unless explicitly enabled.
 */

import type { Signal } from '@zenith/state';
import { getErrorHistory } from '@zenith/state';

export interface SignalInfo {
  id: string;
  name?: string;
  value: any;
  subscriberCount: number;
  computed: boolean;
  createdAt: number;
}

export interface EffectInfo {
  id: string;
  active: boolean;
  disposed: boolean;
  priority: number;
  dependencies: string[];
  createdAt: number;
  lastRunAt?: number;
}

export interface ComponentInfo {
  id: string;
  name: string;
  parentId?: string;
  children: string[];
  mounted: boolean;
  createdAt: number;
}

export interface StateChange {
  id: string;
  signalId: string;
  signalName?: string;
  oldValue: any;
  newValue: any;
  timestamp: number;
  stack?: string;
}

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

// --- Internal state (only allocated when enabled) ---

let enabled = false;
const signals = new Map<string, { ref: Signal<any>; info: SignalInfo }>();
const effects = new Map<string, EffectInfo>();
const components = new Map<string, ComponentInfo>();
let stateTimeline: StateChange[] = [];
const MAX_TIMELINE = 500;

const signalSubscribers = new Set<(signals: SignalInfo[]) => void>();
const stateChangeSubscribers = new Set<(change: StateChange) => void>();

let nextId = 1;
const generateId = (prefix: string) => `${prefix}_${nextId++}_${Date.now().toString(36)}`;

// --- Registration hooks (called by core only when enabled) ---

export function registerSignal(signal: Signal<any>, name?: string): void {
  if (!enabled) return;

  const id = generateId('sig');
  const info: SignalInfo = {
    id,
    name,
    value: signal.get(),
    subscriberCount: 0,
    computed: !!(signal as any)._computed,
    createdAt: Date.now()
  };

  signals.set(id, { ref: signal, info });
  notifySignalSubscribers();
}

export function registerEffect(priority: number): string {
  if (!enabled) return '';

  const id = generateId('eff');
  effects.set(id, {
    id,
    active: false,
    disposed: false,
    priority,
    dependencies: [],
    createdAt: Date.now()
  });
  return id;
}

export function markEffectActive(id: string, dependencies: string[]): void {
  if (!enabled || !id) return;
  const effect = effects.get(id);
  if (effect) {
    effect.active = true;
    effect.dependencies = dependencies;
    effect.lastRunAt = Date.now();
  }
}

export function markEffectDisposed(id: string): void {
  if (!enabled || !id) return;
  const effect = effects.get(id);
  if (effect) {
    effect.active = false;
    effect.disposed = true;
  }
}

export function recordStateChange(signalId: string, oldValue: any, newValue: any, signalName?: string): void {
  if (!enabled) return;

  const change: StateChange = {
    id: generateId('chg'),
    signalId,
    signalName,
    oldValue,
    newValue,
    timestamp: Date.now(),
    stack: new Error().stack
  };

  stateTimeline.push(change);
  if (stateTimeline.length > MAX_TIMELINE) {
    stateTimeline.shift();
  }

  // Update signal info
  const sig = signals.get(signalId);
  if (sig) {
    sig.info.value = newValue;
  }

  for (const cb of stateChangeSubscribers) {
    try { cb(change); } catch { /* ignore */ }
  }
  notifySignalSubscribers();
}

function notifySignalSubscribers(): void {
  const list = Array.from(signals.values()).map(s => s.info);
  for (const cb of signalSubscribers) {
    try { cb(list); } catch { /* ignore */ }
  }
}

// --- Public API exposed on window ---

export const devtoolsAPI: DevToolsAPI = {
  version: '1.4.0',
  get enabled() { return enabled; },

  enable() {
    if (enabled) return;
    enabled = true;
    // All future registrations will now be tracked
    console.log('[Zenith DevTools] API enabled — tracking framework internals');
  },

  disable() {
    if (!enabled) return;
    enabled = false;
    signals.clear();
    effects.clear();
    components.clear();
    stateTimeline = [];
    signalSubscribers.clear();
    stateChangeSubscribers.clear();
    console.log('[Zenith DevTools] API disabled — all tracking cleared');
  },

  getSignals() {
    return Array.from(signals.values()).map(s => s.info);
  },

  getSignal(id) {
    return signals.get(id)?.info;
  },

  subscribeToSignals(callback) {
    signalSubscribers.add(callback);
    return () => signalSubscribers.delete(callback);
  },

  getEffects() {
    return Array.from(effects.values());
  },

  getEffect(id) {
    return effects.get(id);
  },

  getComponentTree() {
    return Array.from(components.values());
  },

  getComponent(id) {
    return components.get(id);
  },

  getStateTimeline(limit = 100) {
    return stateTimeline.slice(-limit);
  },

  clearStateTimeline() {
    stateTimeline = [];
  },

  subscribeToStateChanges(callback) {
    stateChangeSubscribers.add(callback);
    return () => stateChangeSubscribers.delete(callback);
  },

  getErrors() {
    return getErrorHistory();
  },

  getStats() {
    return {
      totalSignals: signals.size,
      activeEffects: Array.from(effects.values()).filter(e => e.active && !e.disposed).length,
      disposedEffects: Array.from(effects.values()).filter(e => e.disposed).length,
      totalComponents: components.size,
      timelineEntries: stateTimeline.length
    };
  }
};

/**
 * Expose API on window (only creates the global object, no tracking until enable())
 */
export function exposeDevToolsAPI(): void {
  if (typeof window === 'undefined') return;
  if ((window as any).__ZENITH__) return;

  (window as any).__ZENITH__ = devtoolsAPI;
}
