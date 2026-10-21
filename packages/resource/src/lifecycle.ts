import { signal } from '@zenith/state';
import { createDisposer } from '@zenith/shared';
import type { ResourceState } from './types';
import type { ResourceScope } from './scope';
import { resourceRegistrations } from './registry-state';

/** Private lifecycle implementation. @internal */
export function resetResource<T>(scope: ResourceScope<T>): void {
    // A teardown callback cannot resurrect state while its old owner is releasing it.
    if (scope._disposing) return;
    const wasDisposed = scope._destroyed; scope._lifecycleGeneration++;
    scope._requestGeneration++; scope._lastReadCacheKey = null;
    scope._abortController.abort(); scope._currentRequestController?.abort();
    if (scope._refreshTimer) {
      clearInterval(scope._refreshTimer);
      scope._refreshTimer = null;
    }
    scope._mutationQueue.length = 0; scope._processing = false; scope._optimisticSnapshots.clear();
    scope._dedupeCache.clear(); // #144
    // FEATURE (v1.0.0): ساخت AbortController تازه — تا reset() بتواند
    // Resource را از حالت destroyed خارج کند و درخواست‌های جدید دوباره کار کنند.
    scope._abortController = new AbortController();
    // IMP-RES-02 (v1.3.0): Reset per-request controller too.
    scope._currentRequestController = null;
    // FEATURE (v1.0.0): ریست فلگ destroyed — reset باید Resource را دوباره usable کند.
    scope._destroyed = false;
    const state: ResourceState<T> = {
      data: null,
      loading: false,
      error: null,
      lastUpdated: null,
      isStale: false,
    };
    if (wasDisposed) scope._signal = signal(state); else scope._signal.set(state);
  }

/** Private lifecycle implementation. @internal */
export function disposeResource<T>(scope: ResourceScope<T>): void {
    // #116: idempotent — dispose دوباره بی‌اثر است (reset() فلگ را پاک می‌کند).
    if (scope._destroyed) return;
    scope._disposing = true;
    try {
      scope._destroyed = true; scope._lifecycleGeneration++; scope._requestGeneration++; scope._lastReadCacheKey = null;
      // FEATURE (v1.0.0): ذخیره‌ی stack trace هنگام dispose() برای پیام‌های خطای بعدی.
      scope._destroyStack = new Error().stack || '(stack unavailable)';
      const callbacks = [...scope._domCleanups.keys()]; scope._domCleanups.clear();
      const registrations = [...(resourceRegistrations.get(scope.owner) ?? [])]; resourceRegistrations.delete(scope.owner);
      // LIFO ownership: every release runs even if a DOM callback, signal observer
      // or registry subscriber throws. Independent registrations share no token.
      const released = createDisposer();
      released.add(() => scope._signal.dispose());
      for (const release of registrations) released.add(release);
      released.add(() => scope._signal.set({ data: null, loading: false, error: null, lastUpdated: null, isStale: false }));
      released.add(() => { scope._mutationQueue.length = 0; scope._processing = false; scope._optimisticSnapshots.clear(); });
      released.add(() => scope._dedupeCache.clear());
      released.add(() => { const request = scope._currentRequestController; scope._currentRequestController = null; request?.abort(); });
      released.add(() => scope._abortController.abort());
      released.add(() => scope.stopAutoRefresh());
      for (const callback of callbacks.reverse()) released.add(callback);
      released.dispose();
    } finally { scope._disposing = false; }
  }

/** Private DOM registration ownership helper. @internal */
export function registerDOMCleanup<T>(scope: ResourceScope<T>, cb: () => void): () => void {
    if (scope._destroyed) { cb(); return () => {}; }
    let registrations = scope._domCleanups.get(cb);
    if (!registrations) { registrations = new Set(); scope._domCleanups.set(cb, registrations); }
    const entries = registrations; const token = Symbol(); entries.add(token); let active = true;
    return () => {
      if (!active) return; active = false; entries.delete(token);
      if (!entries.size && scope._domCleanups.get(cb) === entries) scope._domCleanups.delete(cb);
    };
  }

/** Private DOM registration ownership helper. @internal */
export function unregisterDOMCleanup<T>(scope: ResourceScope<T>, cb: () => void): void {
    scope._domCleanups.delete(cb);
  }
