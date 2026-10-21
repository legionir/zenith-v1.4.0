import { createOwner, disposeOwner, getOwner, setOwner, signal, type Signal } from '@zenith/state';
import { developerError } from '@zenith/errors';
/** Private live ownership lease, never a fabricated public Form instance. @internal */
export interface FormScope {
  readonly disposed: boolean;
  readonly version: number;
  invalidate(): void;
  run<T>(fn: () => T): T;
  onDispose(fn: () => void): () => void;
  dispose(): void;
}
/** Child ownership follows the caller, while later field views use this lease. @internal */
export function createFormScope(): FormScope {
  const owner = createOwner(getOwner());
  let version = 0;
  return {
    get disposed() { return owner.disposed; },
    get version() { return version; },
    invalidate() { version++; },
    run<T>(fn: () => T): T {
      if (owner.disposed) throw developerError('Cannot enter a disposed form scope');
      const previous = getOwner(); setOwner(owner);
      try { return fn(); } finally { setOwner(previous); }
    },
    onDispose(fn) {
      if (owner.disposed) { fn(); return () => {}; }
      owner.cleanup.add(fn); let removed = false;
      return () => { if (removed) return; removed = true; owner.cleanup.delete(fn); };
    },
    dispose() { if (owner.disposed) return; version++; disposeOwner(owner); },
  };
}

/** Register each concrete signal as soon as construction succeeds. @internal */
export function createFormSignal<T>(scope: FormScope, initial: T): Signal<T> {
  if (scope.disposed) throw developerError('Cannot create state in a disposed form scope');
  const state = signal(initial);
  scope.onDispose(() => state.dispose());
  return state;
}
