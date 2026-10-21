// packages/service-worker/src/strategy-simple.ts
//
// استراتژی‌های network-only و cache-only — استخراج مکانیکی از
// strategies.ts، بدون تغییر رفتار (#40).

import { deprecate } from '@zenith/errors';
import { resolveStrategyOptions, legacyStrategyOptions, type CacheStrategyOptions } from './strategy-options';
import { getCaches, offlineResponse } from './strategy-types';


/**
 * FEATURE (v0.4.0): استراتژی Network-Only.
 *
 * مستقیم fetch بدون درگیر کردن cache. مفید برای درخواست‌های غیر cached مثل
 * mutationها (POST/PUT/DELETE) یا endpointهای حساس.
 *
 * @public
 * @param request درخواست.
 */
export async function networkOnly(request: Request): Promise<Response> {
  try {
    return await fetch(request);
  } catch (err) {
    return offlineResponse(request, 'Network unavailable (networkOnly).');
  }
}

/**
 * FEATURE (v0.4.0): استراتژی Cache-Only.
 *
 * فقط cache را بررسی می‌کند. اگر نبود، 503 برمی‌گرداند. هیچ‌وقت به شبکه نمی‌رود.
 *
 * بهترین برای: منابعی که فقط از cache خوانده می‌شوند (مثل pre-critical assets).
 *
 * @param request   درخواست.
 * @param cacheName نام cache.
 */
/** @public */
export function cacheOnly(request: Request, options: CacheStrategyOptions): Promise<Response>;
/** @public @deprecated Use cacheOnly(request, { cacheName }). */
export function cacheOnly(request: Request, cacheName: string): Promise<Response>;
export async function cacheOnly(request: Request, options: CacheStrategyOptions | string): Promise<Response> {
  if (typeof options === 'string') deprecate('ZEN-DEPR-084', 'cacheOnly(request, cacheName)', 'cacheOnly(request, { cacheName })');
  const { cacheName } = resolveStrategyOptions(typeof options === 'string' ? legacyStrategyOptions({ cacheName: options }) : options);
  const cacheStore = getCaches();
  if (!cacheStore) {
    return offlineResponse(request, 'Cache API unavailable (cacheOnly).');
  }

  const cache = await cacheStore.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  return offlineResponse(request, 'Cache miss (cacheOnly).');
}
