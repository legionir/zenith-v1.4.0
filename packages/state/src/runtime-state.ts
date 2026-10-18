import type { Priority } from '@zenith/scheduler';
import type { EffectContext } from './context';
import type { EffectSubscriber } from './effect-subscriber';
import type { SignalObserver } from './observer';
import type { Signal } from './signal';
import type { InspectedSignal } from './registry-types';
import type { LegacyRegistryRuntime } from './registry-runtime';

/** Private installation token. Equal observer objects are still different leases. */
export interface ObserverLease {
  value: SignalObserver | null;
  previous: ObserverLease | null;
  next: ObserverLease | null;
  disposed: boolean;
}
export interface EffectErrorRegistration {
  handler: ((error: unknown, subscriber: EffectSubscriber) => void) | null;
}
interface LegacyHooks {
  create: <T>(signal: Signal<T>, name?: string) => void;
  change: <T>(signal: Signal<T>, previous: T, next: T) => void;
}
interface StateRuntime {
  observer: ObserverLease | null;
  legacyHooks: LegacyHooks | null;
  priorities: WeakMap<EffectSubscriber, Priority>;
  effectError: EffectErrorRegistration | null;
  registries: WeakMap<EffectContext, LegacyRegistryRuntime>;
  registryOwners: WeakMap<InspectedSignal, Set<LegacyRegistryRuntime>>;
  pendingRegistrations: WeakSet<InspectedSignal>;
  nextLegacySignalId: number;
}

const RUNTIME_SYMBOL = Symbol.for('zenith.state.runtime.v1');
/** Data only: no constructor substitution or second implementation facade. */
export function _getStateRuntime(): StateRuntime {
  const globals = globalThis as unknown as Record<symbol, StateRuntime | undefined>;
  let runtime = globals[RUNTIME_SYMBOL];
  if (!runtime) {
    runtime = {
      observer: null, legacyHooks: null, priorities: new WeakMap(), effectError: null,
      registries: new WeakMap(), registryOwners: new WeakMap(),
      pendingRegistrations: new WeakSet(), nextLegacySignalId: 1,
    };
    globals[RUNTIME_SYMBOL] = runtime;
  }
  return runtime;
}
