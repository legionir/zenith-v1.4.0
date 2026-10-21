// packages/service-worker/src/sw-state.ts
//
// state داخلی SW (کش‌ها، config، صف حافظه‌ای) — استخراج مکانیکی از sw.ts،
// بدون تغییر رفتار (#40).

import type { SWRuntimeConfig, QueuedMutation } from './sw-types';


/**
 * FEATURE (v0.5.0): نام‌گذاریِ ثابت برای IndexedDB.
 */
export const SYNC_DB_NAME = 'zenith-sw-sync';
export const SYNC_DB_VERSION = 1;
export const SYNC_STORE = 'mutations';

/**
 * BUG-SW-04 FIX (v1.3.0): Cache version prefix.
 *
 * با افزایش این عدد در هر نسخه از SW، cacheهای قدیمی به‌طور خودکار
 * در activate event حذف می‌شوند چون پیشوند cache تغییر می‌کند
 * و دیگر در keepNames قرار نمی‌گیرند.
 *
 * مثال: اگر CACHE_VERSION = 3، cacheهای قبلی 'zenith-v2-precache'
 * در keepNames جدید ('zenith-v3-precache') نیستند → حذف می‌شوند.
 */
export const CACHE_VERSION = 1;

/**
 * BUG-SW-04 FIX: تولید نام cache با version prefix.
 *
 * نام نهایی: {cachePrefix}v{CACHE_VERSION}-{baseName}
 * مثال: 'zenith-v1-precache', 'zenith-v1-api-cache'
 */
export function versionedCacheName(
  cachePrefix: string,
  baseName: string,
  version: number = _config?.cacheVersion ?? CACHE_VERSION,
): string {
  return `${cachePrefix}v${version}-${baseName}`;
}

/**
 * Internal state — در SW global scope نگه داشته می‌شود.
 *
 * FEATURE (v0.5.0): `_queue` اکنون فقط یک cache حافظه‌ای است که از IndexedDB
 * lazy لود می‌شود. منبعِ حقیقت IndexedDB است.
 */
export let _config: SWRuntimeConfig | null = null;
export let _queue: QueuedMutation[] = [];

/**
 * FEATURE (v0.4.0): دریافت اندازه‌ی فعلی صف mutations (برای تست و DevTools).
 *
 * FEATURE (v0.5.0): این تابع synchronous است و مقدار cache حافظه‌ای را برمی‌گرداند.
 * مقدار دقیق در IndexedDB است و ممکن است در لحظه کمی متفاوت باشد. برای مقدار دقیق
 * از `loadQueue()` استفاده کنید.
 */
export function getQueueSize(): number {
  return _queue.length;
}

/**
 * FEATURE (v0.4.0): دریافت پیکربندی فعلی (برای تست و DevTools).
 */
export function getConfig(): SWRuntimeConfig | null {
  return _config;
}

/** #40: بازنویسی config از setup (rebinding فقط در مالک state). */
export function setSWConfig(cfg: SWRuntimeConfig | null): void {
  _config = cfg;
}

/** #40: بازنویسی صف حافظه‌ای از setup (rebinding فقط در مالک state). */
export function setSWQueue(q: QueuedMutation[]): void {
  _queue = q;
}
