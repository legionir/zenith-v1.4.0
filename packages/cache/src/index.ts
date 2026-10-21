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
/** @public */
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

/** @public */
export { createCache } from './cache';
/** @public */
export { parseCacheAttr } from './attr';
/** @public */
export { registerCache, unregisterCache, listCaches, getCache, hasCache, setSignalAdapter } from './registry';
/** Test/host reset hook; canonical use is onGlobalReset/resetForTesting. @internal */
export { resetCachesInternal } from './registry';

/**
 * #53: پیش‌فرض‌های منجمد برای `@zenith/cache`.
 * @public
 * @default { maxEntries: 500, defaultTtl: 300000, policy: 'lru', staleWhileRevalidate: false }
 * @unit ms (defaultTtl)
 * @since 1.4.0
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  maxEntries: 500,
  defaultTtl: 300_000,
  policy: 'lru' as const,
  staleWhileRevalidate: false,
});
