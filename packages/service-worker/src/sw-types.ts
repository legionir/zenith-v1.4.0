// packages/service-worker/src/sw-types.ts
//
// تایپ‌های runtime اسکریپت SW — استخراج مکانیکی از sw.ts،
// بدون تغییر رفتار (#40).

import type { CacheStrategyName } from './strategies.js';


const SW_CACHE_STRATEGIES = [
  'cacheFirst',
  'networkFirst',
  'staleWhileRevalidate',
  'networkOnly',
  'cacheOnly',
  'cacheThenNetwork',
] as const satisfies readonly CacheStrategyName[];

/**
 * FEATURE (v0.4.0): RouteMatcher — تطبیق‌دهنده‌ی مسیر.
 *
 * یک route را می‌توان با:
 *   - URL pattern (regex یا string).
 *   - method (GET/POST/...).
 * تطبیق داد و به آن یک استراتژی اختصاص داد.
 *
 * اگر چند route match شوند، اولین match برنده است.
 */
export interface RouteMatcher {
  /**
   * الگوی URL. می‌تواند regex یا string باشد. در صورت string، با `includes` بررسی می‌شود.
   * مثال: /\/api\/users/ یا '/api/users'.
   */
  urlPattern: RegExp | string;
  /** متد HTTP برای تطبیق. اگر ست نشود، همه‌ی متدها match می‌شوند. */
  method?: string;
  /** استراتژی که باید اعمال شود. */
  strategy: CacheStrategyName;
  /** نام cache برای این route. اگر ست نشود، defaultCacheName استفاده می‌شود. */
  cacheName?: string;
  /** timeout برای networkFirst (میلی‌ثانیه). */
  timeout?: number;
}

/**
 * FEATURE (v0.4.0): پیکربندی SW.
 *
 * این شیء در main thread ساخته می‌شود و به `setupSW` در SW پاس داده می‌شود.
 * در عمل، کاربر این پیکربندی را inline در فایل sw.js (که import می‌کند `./sw.js`)
 * به `setupSW` می‌دهد.
 */
export interface SWRuntimeConfig {
  /** لیست URLهایی که در install event باید pre-cache شوند. */
  precache: string[];
  /** لیست route ها. */
  routes: RouteMatcher[];
  /** نام cache پیش‌فرض برای استراتژی‌ها. */
  defaultCacheName?: string;
  /** پیشوند برای نام cacheها (مثل 'zenith-'). */
  cachePrefix?: string;
  /** استراتژی پیش‌فرض برای requestهایی که هیچ route مچ نمی‌شوند. */
  defaultStrategy?: CacheStrategyName;
  /** نام cache برای queued mutations (background sync). */
  backgroundSyncQueueName?: string;
  /** #96: نسخهٔ کش (پیش‌فرض: 1). با افزایش این عدد، کش‌های نسخه‌های قدیمی در activate پاک می‌شوند. */
  cacheVersion?: number;
  /** آیا در install event skipWaiting کنیم؟ */
  skipWaiting?: boolean;
  /** آیا در activate event clients.claim کنیم؟ */
  clientsClaim?: boolean;
}

/**
 * FEATURE (v0.4.0): ساختار یک mutation در صف (background sync).
 *
 * FEATURE (v0.5.0): فیلد `id` برای کلیدِ autoIncrementِ IndexedDB اضافه شد تا
 * بتوانیم سطرها را به‌صورت تک‌تک حذف/به‌روز کنیم.
 */
interface QueuedMutation {
  /** کلیدِ autoIncrement در IndexedDB (بعد از ذخیره‌سازی ست می‌شود). */
  id?: number;
  url: string;
  method: string;
  headers?: Record<string, string>;
  body?: string;
  timestamp: number;
  retryCount: number;
}
