import { s, validate } from '@zenith/schema';
import { createCache } from '@zenith/cache';
import { deprecate } from '@zenith/errors';

interface CacheEntry {
  data: unknown;
  timestamp: number;
}

/** حداکثر تعداد entries در کش (eviction policy ساده). */
const _CACHE_MAX_SIZE = 100;

// ظرفیت و پاک‌سازی LRU به عهدهٔ @zenith/cache؛ TTL همچنان پارامتری است
// ( getCachedData(url, ttl) معنی قدیمی را حفظ می‌کند: entry از ttl
// گذشته باشد ⇒ null). entry در @zenith/cache با ttl='never' ذخیره می‌شود
// و اعتبارسنجی سن همین‌جا انجام می‌گیرد تا معیار دقیقاً مثل قبل بماند.
const _fetchCache = createCache<CacheEntry>({ ttl: 'never', maxSize: _CACHE_MAX_SIZE });

/**
 * دریافت داده از کش در صورت معتبر بودن (داخل TTL).
 *
 * @param url کلید کش (معمولاً URL کامل).
 * @param ttl  زمان اعتبار به میلی‌ثانیه.
 * @returns داده‌ی کش‌شده یا `null`.
 */
/** Cache age limit in milliseconds. @public */
export interface FetchCacheReadOptions { ttl: number; }
/** Cache invalidation tags; omitted tags derive from URL segments. @public */
export interface FetchCacheWriteOptions { tags?: string[]; }
const readSchema = s.object({ ttl: s.number({ min: 0 }) });
const writeSchema = s.object({ tags: s.optional(s.array(s.string())) });
/** Read an untyped cache value; narrow or decode at the consumer boundary. @public */
export function getCachedData(url: string, options: FetchCacheReadOptions): unknown | null;
/** @public @deprecated Use getCachedData(url, { ttl }). */
export function getCachedData(url: string, ttl: number): unknown | null;
export function getCachedData(url: string, options: FetchCacheReadOptions | number): unknown | null {
  if (typeof options === 'number') deprecate('ZEN-DEPR-072', 'getCachedData(url, ttl)', 'getCachedData(url, { ttl })');
  const ttl = typeof options === 'number' ? options : validate<FetchCacheReadOptions>(readSchema, options, { name: 'FetchCacheReadOptions', mode: 'throw', strict: true, coerce: false }).ttl;
  return readFetchCache(url, ttl);
}
/** Raw age-based lookup for existing engine configuration, without legacy warnings. @internal */
export function readFetchCache(url: string, ttl: number): unknown | null {
  // peek: بدون تغییر ترتگی؛ انقضای پارامتری اینجاست (entry خودش never است)
  const entry = _fetchCache.peek(url);
  if (entry && Date.now() - entry.timestamp < ttl) {
    return entry.data;
  }
  return null;
}

/**
 * ذخیره‌سازی داده در کش.
 * اگر کش از حداکثر ظرفیت بیشتر شود، @zenith/cache قدیمی‌ترین را حذف می‌کند.
 *
 * @param url  کلید کش.
 * @param data داده‌ای که کش می‌شود.
 */
/** @public */
export function setCachedData(url: string, data: unknown, options?: FetchCacheWriteOptions): void;
/** @public @deprecated Use setCachedData(url, data, { tags }). */
export function setCachedData(url: string, data: unknown, tags?: string[]): void;
export function setCachedData(url: string, data: unknown, options: FetchCacheWriteOptions | string[] = {}): void {
  if (Array.isArray(options)) deprecate('ZEN-DEPR-073', 'setCachedData(url, data, tags)', 'setCachedData(url, data, { tags })');
  const tags = Array.isArray(options) ? options : validate<FetchCacheWriteOptions>(writeSchema, options, { name: 'FetchCacheWriteOptions', mode: 'throw', strict: true, coerce: false }).tags;
  const autoTags = tags ?? url.split('/').filter(Boolean);
  _fetchCache.set(url, { data, timestamp: Date.now() }, { tags: autoTags });
}

/**
 * پاک کردن کامل کش.
 */
export function clearFetchCache(): void {
  _fetchCache.clear();
}

const _invalidateHooks = new Set<(tags: string[]) => void>();

/**
 * #130: ثبت یک قلاب باطل‌سازی سراسری برای هماهنگ‌سازی کش‌های `data`، `resource` و `http`.
 */
export function registerInvalidateHook(fn: (tags: string[]) => void): () => void {
  _invalidateHooks.add(fn);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    _invalidateHooks.delete(fn);
  };
}

/**
 * #130: باطل‌سازی سراسری کش بر اساس تگ‌ها (`invalidate(tags)`).
 */
export function invalidateFetchCache(tags?: string | string[]): void {
  if (!tags) {
    _fetchCache.clear();
    for (const hook of _invalidateHooks) hook([]);
    return;
  }
  const tagList = Array.isArray(tags) ? tags : [tags];
  _fetchCache.invalidate(tagList);
  for (const key of _fetchCache.keys()) {
    if (tagList.some((t) => key.includes(t))) {
      _fetchCache.delete(key);
    }
  }
  for (const hook of _invalidateHooks) hook(tagList);
}

/**
 * تابع کمکی برای fetch با کش (مشابه SWR).
 *
 * اگر در TTL داده موجود باشد، بلافاصله Promise.resolve برمی‌گرداند و هم‌زمان
 * یک درخواست مجدد در پس‌زمینه انجام می‌دهد (stale-while-revalidate).
 *
 * @param url URL درخواست.
 * @param ttl زمان اعتبار کش به میلی‌ثانیه (پیش‌فرض: ۳۰ ثانیه).
 * @returns Promise داده.
 */
export interface ProcessFetchWithCacheOptions {
  /** زمان اعتبار کش به میلی‌ثانیه. @default 30000 */
  ttl?: number;
}

export function processFetchWithCache(
  url: string,
  options?: ProcessFetchWithCacheOptions,
): Promise<unknown>;
/** @deprecated #55 — امضای positional؛ از `processFetchWithCache(url, { ttl })` استفاده کنید (ZEN-DEPR-066). */
export function processFetchWithCache(url: string, ttl?: number): Promise<unknown>;
export function processFetchWithCache(
  url: string,
  ttlOrOptions: number | ProcessFetchWithCacheOptions = {},
): Promise<unknown> {
  if (typeof ttlOrOptions === 'number') {
    deprecate(
      'ZEN-DEPR-066',
      'processFetchWithCache(url, ttl)',
      'processFetchWithCache(url, { ttl })',
    );
  }
  const ttl = typeof ttlOrOptions === 'number' ? ttlOrOptions : (ttlOrOptions.ttl ?? 30000);
  const cached = readFetchCache(url, ttl);
  if (cached !== null) {
    // بازگشت فوری داده + به‌روزرسانی در پس‌زمینه
    fetch(url)
      .then((res) => res.json())
      .then((data) => setCachedData(url, data))
      .catch(() => {
        /* سکوت — داده قدیمی هنوز موجود است */
      });
    return Promise.resolve(cached);
  }
  return fetch(url).then(async (res) => {
    const data = await res.json();
    setCachedData(url, data);
    return data;
  });
}

