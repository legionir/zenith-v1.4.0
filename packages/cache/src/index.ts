// packages/cache/src/index.ts
//
// #144 — @zenith/cache: پیاده‌سازی مشترک cache (SPEC §۲.۴) — L0.
//
// قوانین لایه (گیت: test/layering.test.ts):
//   • وابستگی فقط errors + shared (L0). هیچ import از state (L1): signal از
//     طریق setSignalAdapter در زمان اجرا وصل می‌شود (DEC-021/#141).
//   • import در سطح ماژول هیچ وابستگی DOM/timer ندارد (env-import؛
//     انقضا lazy طبق SPEC §۲.۴).
//   • بودجه ≤ ۳KB gzip (size-budget + .size-limit.json).
export type {
  Cache,
  CacheOptions,
  CacheStats,
  CachePolicy,
  CachePredicate,
  EntryOptions,
  EntryTtl,
  EvictReason,
  SignalAdapter,
} from './types';

export { createCache } from './cache';
export { parseCacheAttr } from './attr';
export { registerCache, unregisterCache, listCaches, setSignalAdapter } from './registry';
