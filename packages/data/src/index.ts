// packages/data/src/index.ts
//
// نقطه‌ی ورود عمومی پکیج `@zenith/data`.
//
// استفاده در runtime:
//   import { processFetch, type FetchState } from '@zenith/data';

/** @public */
export {
  processFetch,
  processFetchWithCache,
  getCachedData,
  setCachedData,
  clearFetchCache,
  invalidateFetchCache,
  invalidate,
  registerInvalidateHook,
} from './fetcher';
/** @public */
export type { FetchCacheReadOptions, FetchCacheWriteOptions, ProcessFetchWithCacheOptions, FetchState } from './fetcher';

/** @public */
export {
  createMutation,
  type MutationOptions,
  type LegacyMutationCallbacks,
  type MutationController,
} from './mutation';

/** @public */
export {
  createInfiniteQuery,
  type InfiniteQueryOptions,
  type LegacyInfiniteQueryRest,
  type InfiniteQueryController,
} from './infinite-query';

/**
 * #53: پیش‌فرض‌های منجمد برای `@zenith/data`.
 * @default { retryCount: 0, retryDelay: 1000, initialPage: 1, pageSize: 20 }
 * @unit ms (retryDelay)
 * @since 1.4.0
 * @public
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  retryCount: 0,
  retryDelay: 1_000,
  initialPage: 1,
  pageSize: 20,
});
