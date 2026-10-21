// Deprecated registry bridge. Its records belong to the selected EffectContext;
// native signal updates fan out to the scopes that explicitly registered them.
import { deprecate } from '@zenith/errors';
import { logger } from '@zenith/logger';
import { isDevtoolsEnabled } from './devtools';
import { untrack } from './signal';
import { notifySignalName, _setLegacyRegistryHooks } from './observer';
import { _getMutableContext, _bindToEffectContext } from './context';
import { _getStateRuntime } from './runtime-state';
import { _getLegacyRegistryRuntime, _clearLegacyRegistry, type LegacyRegistryRuntime, type LegacyListener } from './registry-runtime';
import type { InspectedSignal, SignalInfo, StateChange } from './registry-types';
export type { InspectedSignal, SignalInfo, StateChange } from './registry-types';

const MAX_TIMELINE_SIZE = 1000;
const CLEANUP_INTERVAL_MS = 60_000;

function cleanupDisposedSignals(registry: LegacyRegistryRuntime): void {
  for (const [id, info] of registry.idToInfo) {
    if (info.signalRef.deref() === undefined) registry.idToInfo.delete(id);
  }
}
function maybeCleanupDisposedSignals(registry: LegacyRegistryRuntime): void {
  if (registry.finalizer !== null) return;
  const now = Date.now();
  if (now - registry.lastCleanupTime > CLEANUP_INTERVAL_MS) {
    registry.lastCleanupTime = now; cleanupDisposedSignals(registry);
  }
}

/** Constructor hook, without a deprecation diagnostic or dependency tracking. */
export function _registerSignalInternal(sig: InspectedSignal, name?: string): number {
  if (!isDevtoolsEnabled()) return -1;
  const registry = _getLegacyRegistryRuntime();
  if (registry.closed) return -1;
  maybeCleanupDisposedSignals(registry);
  const existing = registry.signalToId.get(sig);
  if (existing !== undefined) {
    const info = registry.idToInfo.get(existing);
    if (info && name !== undefined) info.name = name;
    return existing;
  }
  const runtime = _getStateRuntime();
  // Subclasses/proxies may reenter registration, reset or close the host scope.
  if (runtime.pendingRegistrations.has(sig)) return -1;
  const generation = registry.generation;
  runtime.pendingRegistrations.add(sig);
  try {
    const { value, subscriberCount } = untrack(() => ({ value: sig.peek(), subscriberCount: sig.subscriberCount }));
    if (registry.closed || registry.generation !== generation || !isDevtoolsEnabled()) return -1;
    const id = runtime.nextLegacySignalId++;
    const info: SignalInfo = { id, name, value, subscriberCount, createdAt: Date.now(), signalRef: new WeakRef(sig) };
    registry.signalToId.set(sig, id); registry.idToInfo.set(id, info);
    let owners = runtime.registryOwners.get(sig);
    if (!owners) { owners = new Set(); runtime.registryOwners.set(sig, owners); }
    owners.add(registry); registry.finalizer?.register(sig, id);
    return id;
  } finally { runtime.pendingRegistrations.delete(sig); }
}

/** @public @deprecated #147 — Use @zenith/devtools-core registerSignal / installDevtoolsCore (ZEN-DEPR-027; removal in 2.0). */
export function registerSignal(sig: InspectedSignal, name?: string): number {
  deprecate('ZEN-DEPR-027', 'registerSignal (@zenith/state)', '@zenith/devtools-core registerSignal / installDevtoolsCore');
  if (name !== undefined) notifySignalName(sig, name);
  return _registerSignalInternal(sig, name);
}

function recordInRegistry(registry: LegacyRegistryRuntime, sig: InspectedSignal, oldValue: unknown, newValue: unknown): void {
  if (registry.closed) return;
  const id = registry.signalToId.get(sig);
  if (id === undefined) return;
  const info = registry.idToInfo.get(id);
  if (!info) return;
  const generation = registry.generation;
  const subscriberCount = untrack(() => sig.subscriberCount);
  if (registry.closed || generation !== registry.generation || !isDevtoolsEnabled()) return;
  const change: StateChange = { signalId: id, signalName: info.name, oldValue, newValue, timestamp: Date.now() };
  registry.timeline.push(change);
  if (registry.timeline.length > MAX_TIMELINE_SIZE) registry.timeline.shift();
  info.value = newValue; info.subscriberCount = subscriberCount;
  // A listener added during dispatch starts next time. Removal/reset takes
  // effect immediately, without skipping an unrelated listener by array splice.
  for (const listener of Array.from(registry.listeners)) {
    if (registry.closed || generation !== registry.generation) break;
    const callback = listener.callback;
    if (!callback) continue;
    try { callback(change); }
    catch (error) { logger.error(`[Zenith DevTools] Error in state change listener: ${error instanceof Error ? error.message : String(error)}`); }
  }
}

/** Native notification follows real Signal identity, not the writer's context. */
export function _recordStateChangeInternal(sig: InspectedSignal, oldValue: unknown, newValue: unknown): void {
  if (!isDevtoolsEnabled()) return;
  const owners = _getStateRuntime().registryOwners.get(sig);
  if (!owners) return;
  const scopes = Array.from(owners, registry => ({ registry, generation: registry.generation }));
  for (const { registry, generation } of scopes) {
    if (registry.closed || registry.generation !== generation) continue;
    maybeCleanupDisposedSignals(registry); recordInRegistry(registry, sig, oldValue, newValue);
  }
}

/** @public @deprecated #147 — Use @zenith/devtools-core recordStateChange (ZEN-DEPR-028; removal in 2.0). */
export function recordStateChange(sig: InspectedSignal, oldValue: unknown, newValue: unknown): void {
  deprecate('ZEN-DEPR-028', 'recordStateChange (@zenith/state)', '@zenith/devtools-core recordStateChange');
  if (isDevtoolsEnabled()) recordInRegistry(_getLegacyRegistryRuntime(), sig, oldValue, newValue);
}

/** @public @deprecated #147 — Use @zenith/devtools-core getAllSignals (ZEN-DEPR-029; removal in 2.0). */
export function getAllSignals(): SignalInfo[] {
  deprecate('ZEN-DEPR-029', 'getAllSignals (@zenith/state)', '@zenith/devtools-core getAllSignals');
  if (!isDevtoolsEnabled()) return [];
  const registry = _getLegacyRegistryRuntime(); cleanupDisposedSignals(registry);
  return Array.from(registry.idToInfo.values());
}

/** @public @deprecated #147 — Use @zenith/devtools-core getSignalInfo (ZEN-DEPR-030; removal in 2.0). */
export function getSignalInfo(id: number): SignalInfo | undefined {
  deprecate('ZEN-DEPR-030', 'getSignalInfo (@zenith/state)', '@zenith/devtools-core getSignalInfo');
  return isDevtoolsEnabled() ? _getLegacyRegistryRuntime().idToInfo.get(id) : undefined;
}

/** @public @deprecated #147 — Use @zenith/devtools-core getTimeline (ZEN-DEPR-031; removal in 2.0). */
export function getStateTimeline(limit: number = 100): StateChange[] {
  deprecate('ZEN-DEPR-031', 'getStateTimeline (@zenith/state)', '@zenith/devtools-core getTimeline');
  return isDevtoolsEnabled() ? _getLegacyRegistryRuntime().timeline.slice(-limit) : [];
}

/** @public @deprecated #147 — Use @zenith/devtools-core onStateChange (ZEN-DEPR-032; removal in 2.0). */
export function onStateChange(callback: (change: StateChange) => void): () => void {
  deprecate('ZEN-DEPR-032', 'onStateChange (@zenith/state)', '@zenith/devtools-core onStateChange');
  if (!isDevtoolsEnabled()) return () => {};
  const registry = _getLegacyRegistryRuntime();
  if (registry.closed) return () => {};
  const generation = registry.generation;
  const listener: LegacyListener = { callback: _bindToEffectContext(_getMutableContext(), (change: StateChange) => untrack(() => callback(change))) };
  if (registry.closed || registry.generation !== generation) { listener.callback = null; return () => {}; }
  registry.listeners.add(listener);
  return () => { listener.callback = null; registry.listeners.delete(listener); };
}

/** @public @deprecated #147 — Use @zenith/devtools-core clearRegistry (ZEN-DEPR-034; removal in 2.0). */
export function clearRegistry(): void {
  deprecate('ZEN-DEPR-034', 'clearRegistry (@zenith/state)', '@zenith/devtools-core clearRegistry');
  _clearLegacyRegistry(_getLegacyRegistryRuntime());
}

/** @public @deprecated #147 — Use @zenith/devtools-core nameSignal (ZEN-DEPR-033; removal in 2.0). */
export function nameSignal(sig: InspectedSignal, name: string): void {
  deprecate('ZEN-DEPR-033', 'nameSignal (@zenith/state)', '@zenith/devtools-core nameSignal');
  notifySignalName(sig, name);
  if (isDevtoolsEnabled()) _registerSignalInternal(sig, name);
}

const _legacyHooksInstalled = _setLegacyRegistryHooks(_registerSignalInternal, _recordStateChangeInternal);
void _legacyHooksInstalled;
