import type { Signal } from '@zenith/state';
import type { Cache } from '@zenith/cache';
import type { ResourceState, ResourceConfig, CrudResult } from './types';
/** Live private capabilities; never asserted to be a Resource instance. @internal */
export interface ResourceScope<T> {
  readonly owner: object;
  _signal: Signal<ResourceState<T>>;
  _config: Required<ResourceConfig>;
  _dedupeCache: Cache<Promise<CrudResult<unknown>>>;
  _refreshTimer: ReturnType<typeof setInterval> | null;
  _mutationQueue: Array<{ op: () => Promise<CrudResult<unknown>>; rollback?: () => void }>;
  _optimisticSnapshots: Map<number, T | null>;
  _optimisticVersion: number;
  _disposing: boolean;
  _domCleanups: Map<() => void, Set<symbol>>;
  _abortController: AbortController;
  _currentRequestController: AbortController | null;
  _requestGeneration: number;
  _lifecycleGeneration: number;
  _lastReadCacheKey: string | null;
  _destroyed: boolean;
  _destroyStack: string | null;
  _processing: boolean;
  setData(updater: (old: T | null) => T | null): void;
  stopAutoRefresh(): void;
}
