import { _getMutableContext } from './context';
import { _getStateRuntime } from './runtime-state';
import type { InspectedSignal, SignalInfo, StateChange } from './registry-types';

export interface LegacyListener { callback: ((change: StateChange) => void) | null; }
/** A context-owned record set; Signal identity and sequence allocation stay shared. */
export interface LegacyRegistryRuntime {
  signalToId: WeakMap<InspectedSignal, number>;
  idToInfo: Map<number, SignalInfo>;
  timeline: StateChange[];
  listeners: Set<LegacyListener>;
  finalizer: FinalizationRegistry<number> | null;
  lastCleanupTime: number;
  generation: number;
  closed: boolean;
}

/** Clear one scope, never another request, and unlink all weak identity owners. */
export function _clearLegacyRegistry(registry: LegacyRegistryRuntime, close = false): void {
  registry.generation++;
  if (close) registry.closed = true;
  const runtime = _getStateRuntime();
  for (const info of registry.idToInfo.values()) {
    const signal = info.signalRef.deref();
    if (!signal) continue;
    const owners = runtime.registryOwners.get(signal);
    owners?.delete(registry);
    if (owners?.size === 0) runtime.registryOwners.delete(signal);
  }
  registry.signalToId = new WeakMap();
  registry.idToInfo.clear();
  registry.timeline.length = 0;
  for (const listener of registry.listeners) listener.callback = null;
  registry.listeners.clear();
  registry.lastCleanupTime = 0;
  // Never rewind the shared sequence: an old finalizer cannot delete a new ID.
}

export function _getLegacyRegistryRuntime(): LegacyRegistryRuntime {
  const context = _getMutableContext();
  const runtime = _getStateRuntime();
  let registry = runtime.registries.get(context);
  if (registry) return registry;
  registry = {
    signalToId: new WeakMap(), idToInfo: new Map(), timeline: [], listeners: new Set(),
    finalizer: null, lastCleanupTime: 0, generation: 0, closed: false,
  };
  const ownedRegistry = registry;
  if (typeof FinalizationRegistry !== 'undefined') {
    registry.finalizer = new FinalizationRegistry<number>(id => { ownedRegistry.idToInfo.delete(id); });
  }
  runtime.registries.set(context, registry);
  try {
    context.registerDisposal?.(() => _clearLegacyRegistry(ownedRegistry, true));
  } catch (error) {
    _clearLegacyRegistry(registry, true);
    throw error;
  }
  return registry;
}
