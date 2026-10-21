// packages/devtools-core/src/core-registry.ts
//
// رجیستری سیگنال، تایم‌لاین و hook نسخه‌دار — استخراج مکانیکی از index.ts
// بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { createReservedError, deprecate, onGlobalReset } from '@zenith/errors';
import { untrack } from '@zenith/state';
import { resetRuntimeGraphInternal } from './graph';
import { DEVTOOLS_HOOK_VERSION } from './core-options';
import {
  allocChangeSeq,
  allocSignalSeq,
  bumpRegistryGeneration,
  cleanupDeadSignals,
  currentConfig,
  finalizationRegistry,
  formatCapturedValue,
  idToInfo,
  isSSRContext,
  isTrackingEnabled,
  noopCleanup,
  pendingRegistrations,
  registeredApps,
  registeredCaches,
  registeredStores,
  registryGeneration,
  resetSignalIds,
  restoringOperations,
  signalToId,
  stateChangeListeners,
  timeline,
} from './core-state';
import type {
  Cleanup,
  SignalInfo,
  StateChange,
  UntypedSignal,
  ZenithDevtoolsCoreHook,
} from './core-types';


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
    const id = `sig-${allocSignalSeq()}`;
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
    id: `chg-${allocChangeSeq()}`,
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
  bumpRegistryGeneration();
  resetRuntimeGraphInternal();
  restoringOperations.clear();
  resetSignalIds();
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