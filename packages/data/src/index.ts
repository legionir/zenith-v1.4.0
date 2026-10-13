// packages/data/src/index.ts
//
// نقطه‌ی ورود عمومی پکیج `@zenith/data`.
//
// استفاده در runtime:
//   import { processFetch, type FetchState } from '@zenith/data';

export {
  processFetch,
  processFetchWithCache,
  getCachedData,
  setCachedData,
  clearFetchCache,
} from './fetcher';
export type { FetchState } from './fetcher';

export {
  createMutation,
  type MutationOptions,
  type LegacyMutationCallbacks,
  type MutationController,
} from './mutation';

export {
  createInfiniteQuery,
  type InfiniteQueryOptions,
  type LegacyInfiniteQueryRest,
  type InfiniteQueryController,
} from './infinite-query';
