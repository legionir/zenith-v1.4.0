// packages/data/src/index.ts
//
// نقطه‌ی ورود عمومی پکیج `@zenith/data`.
//
// استفاده در runtime:
//   import { processFetch, type FetchState } from '@zenith/data';

export { processFetch, processFetchWithCache, getCachedData, setCachedData, clearFetchCache } from './fetcher';
export type { FetchState } from './fetcher';
