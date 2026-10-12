// packages/cache/src/types.ts
//
// #144 — انواع @zenith/cache (SPEC §۲.۴). صفر runtime.
//
// قوانین لایه (گیت test/layering.test.ts):
//   • هیچ یالی به state/scheduler ندارد؛ `signal` از طریق adapter تزریق می‌شود
//     (DEC-021 — الگوی #141: publish-edge ساختاری حتی type-only ممنوع).
//   • آمار دقیقاً شکل `expressions.getCacheStats` است + فیلدهای اختیاری جدید.
import type { Cleanup, Disposable, Readable } from '@zenith/shared';

/** دلیل خروج یک entry از کش (SPEC §۲.۴ onEvict). */
export type EvictReason = 'ttl' | 'size' | 'manual';

/** ttl داخلی entry: عدد ms؛ `null` یعنی بدون انقضا ('never'/0). */
export type EntryTtl = number | null;

/** چکان value برای آداپتور/invalidation (key, value). */
export type CachePredicate<V = unknown, K = string> = (key: K, value: V | undefined) => boolean;

/**
 * شکل بازگشتی `parseCacheAttr` (SPEC §۲.۴ + گرامر §۰.۳).
 * `ttl`/`staleWhileRevalidate` بر حسب ms؛ `'never'` یعنی بدون انقضا؛
 * `NaN` یعنی ورودی نامعتبر (directive مسئول گزارش UI است).
 */
export interface CachePolicy {
  /** در حالت `disabled` کلید `ttl` وجود ندارد (parseCacheAttr('false')). */
  ttl?: number | 'never';
  staleWhileRevalidate?: number;
  tags?: string[];
  disabled?: boolean;
}

/** گزینه‌های `createCache` (SPEC §۲.۴). */
export interface CacheOptions<V = unknown, K = string> {
  /** ttl پیش‌فرض entryها (ms) یا `'never'`؛ `0` یعنی بدون انقضا (کاتالوگ ZEN-1201). @default 'never' */
  ttl?: number | 'never';
  /** پنجرهٔ stale-while-revalidate پس از ttl (ms). @default 0 @unit ms */
  staleWhileRevalidate?: number;
  /** حداکثر تعداد entry. @default 500 */
  maxSize?: number;
  /** بودجهٔ بایتی (نیازمند `sizeOf`). */
  maxBytes?: number;
  /** اندازه‌گیر value برای `maxBytes`. */
  sizeOf?: (value: V) => number;
  /** سیاست خروج. @default 'lru' */
  policy?: 'lru' | 'fifo';
  /** ساعت تزریقی (برای تست/SSR قطعی). @default Date.now */
  clock?: () => number;
  /** نام برای رجیستری devtools (auto-register). */
  name?: string;
  /** callback خروج (SPEC §۲.۴). */
  onEvict?: (key: K, value: V | undefined, reason: EvictReason) => void;
}

/** گزینه‌های per-entry هنگام `set`/`getOrLoad`. */
export interface EntryOptions {
  ttl?: number | 'never';
  tags?: string[];
}

/** آمار سازگار با `expressions.getCacheStats` (+ فیلدهای اختیاری جدید). */
export interface CacheStats {
  size: number;
  maxSize: number;
  hits: number;
  misses: number;
  staleHits: number;
  evictions: number;
  hitRatio: number;
  /** فقط وقتی `sizeOf` داده شده باشد. */
  bytes?: number;
  /** تعداد loaderهای در جریان (تست نشت). */
  pending: number;
  /** تعداد سطل‌های tag فعال (تست نشت). */
  tagKeys: number;
}

/**
 * آداپتور سیگنال: L1+ (مثل state) تابع ساخت `Readable` را در زمان اجرا تزریق
 * می‌کند؛ خودِ cache هرگز state را import نمی‌کند (DEC-021/#141).
 */
export type SignalAdapter<V = unknown, K = string> = (
  key: K,
  cache: Cache<V, K>,
) => Readable<V | undefined>;

/** قرارداد SPEC §۲.۴ — `Cache` یک `Disposable` است. */
export interface Cache<V = unknown, K = string> extends Disposable {
  readonly size: number;
  readonly name?: string;

  /** مقدار fresh؛ در پنجرهٔ SWR مقدار stale را برمی‌گرداند و staleHit می‌شمارد. */
  get(key: K): V | undefined;
  /** بدون touch recency و بدون شمارش آمار. */
  peek(key: K): V | undefined;
  set(key: K, value: V, opts?: EntryOptions): V;
  has(key: K): boolean;
  delete(key: K): boolean;
  clear(): void;
  /** مقدار جدید را روی entry موجود (حتی stale) می‌نشیند و ttl را reset؛ روی کلید ناموجود `false`. */
  revalidate(key: K, value: V): boolean;
  /** آیا entry در پنجرهٔ stale است؟ (بدون تغییر آمار). */
  isStale(key: K): boolean;

  invalidate(tagsOrPredicate: string | string[] | CachePredicate<V, K>): K[];
  getOrLoad(key: K, loader: () => V | Promise<V>, opts?: EntryOptions): Promise<V>;

  keys(): K[];
  stats(): CacheStats;
  onEvict(cb: (key: K, value: V | undefined, reason: EvictReason) => void): Cleanup;
  signal(key: K): Readable<V | undefined>;
}
