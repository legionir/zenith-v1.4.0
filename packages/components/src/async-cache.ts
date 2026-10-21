// packages/components/src/async-cache.ts
//
// کش‌ها و پیکربندی loader ناهمگام کامپوننت — استخراج مکانیکی از
// async-loader.ts بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { createCache, type Cache } from '@zenith/cache';


/**
 * Cache entry for a loaded component.
 */
export interface CacheEntry {
  /** The fetched HTML source. */
  html: string;
  /** Parsed template element (extracted from the HTML). */
  template: HTMLTemplateElement;
  /** Timestamp (ms) when the entry was stored. */
  storedAt: number;
}

/**
 * Cache configuration. Override via `configureComponentCache`.
 */
export interface ComponentCacheConfig {
  /** Time-to-live in ms. Entries older than this are evicted on read. */
  ttl: number;
  /** Maximum number of entries. LRU eviction when exceeded. */
  maxSize: number;
  /** #15: Fetch timeout in ms (default: 10000). Set <= 0 to disable. */
  timeout: number;
}

export interface LoadComponentOptions {
  signal?: AbortSignal;
  timeout?: number;
}

export let cacheConfig: ComponentCacheConfig = {
  ttl: 5 * 60 * 1000, // 5 minutes
  maxSize: 64,
  timeout: 10_000,
};

// #144: ttl/maxSize/LRU به @zenith/cache سپرده شده؛ storedAt صرفاً برای
// سازگاری شکل CacheEntry (export عمومی) در entry می‌ماند.
export let templateCache: Cache<CacheEntry> = createCache<CacheEntry>({
  ttl: cacheConfig.ttl,
  maxSize: cacheConfig.maxSize,
});
// رجیستری dedupe (در-flight promise؛ settle ⇒ delete — مثل قبل).
export const inflightCache = createCache<Promise<HTMLTemplateElement>>({ ttl: 'never', maxSize: 64 });

// FIX (v1.2.8): P2-5 — errorCache for recently-failed URLs.
//
// Previously, when a URL failed (404, network error, malformed HTML, etc.),
// the failure was not cached. Every subsequent render of the same
// <zen-async-component src="..."> would re-fetch the URL and re-fail —
// producing a thundering-herd of pointless requests for a known-bad URL
// (e.g. a missing component during a deploy storm). Worse, in a list of
// 100 items all pointing to the same broken component, 100 concurrent
// fetches would fire even though the first one already failed.
//
// The errorCache stores the failure for 30 seconds. While an entry exists,
// loadComponent throws immediately without re-fetching. After 30s the
// entry expires and the URL is retried (in case the failure was transient
// — e.g. a server restart). The 30s window is short enough that a real
// fix (redeploy) takes effect quickly, but long enough to break
// thundering herds.
export const ERROR_CACHE_TTL_MS = 30_000;
// #144: ttl خود entry (=۳۰s) + انقضای lazy ⇒ delete دستی لازم نیست.
interface ErrorCacheEntry {
  error: Error;
  storedAt: number;
}
export const errorCache = createCache<ErrorCacheEntry>({ ttl: ERROR_CACHE_TTL_MS, maxSize: 64 });

/**
 * Configure the component cache (TTL + maxSize).
 *
 * @example
 *   configureComponentCache({ ttl: 60_000, maxSize: 128 });
 */
export function configureComponentCache(opts: Partial<ComponentCacheConfig>): void {
  const prev = { ...cacheConfig, ...opts };
  const ttlOrSizeChanged = prev.ttl !== cacheConfig.ttl || prev.maxSize !== cacheConfig.maxSize;
  cacheConfig = prev;
  if (ttlOrSizeChanged) {
    // ttl/maxSize در @zenith_cache زمان ساخت خوانده می‌شوند ⇒ نمونهٔ تازه با
    // انتقال entryهای زنده (peek ⇒ بدون تغییر آمار/ترتگی). trim داخلی
    // همان «evict anything that no longer fits» قدیمی است.
    const old = templateCache;
    templateCache = createCache<CacheEntry>({ ttl: prev.ttl, maxSize: prev.maxSize });
    for (const key of old.keys()) {
      const entry = old.peek(key);
      if (entry !== undefined) templateCache.set(key, entry);
    }
    old.dispose();
  }
}

/**
 * Clear the entire component cache. Useful in tests and HMR.
 */
export function clearComponentCache(): void {
  templateCache.clear();
  inflightCache.clear();
  // FIX (v1.2.8): P2-5 — also clear the errorCache.
  errorCache.clear();
}