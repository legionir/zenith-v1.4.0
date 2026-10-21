// packages/service-worker/src/strategy-network-first.ts
//
// استراتژی network-first — استخراج مکانیکی از strategies.ts،
// بدون تغییر رفتار (#40).

import { deprecate } from '@zenith/errors';
import { resolveStrategyOptions, legacyStrategyOptions, type CacheStrategyOptions } from './strategy-options';
import { getCaches, offlineResponse } from './strategy-types';


/**
 * FEATURE (v0.4.0): استراتژی Network-First.
 *
 * ۱) شبکه را با timeout امتحان کن.
 * ۲) اگر timeout یا خطا، cache را برگردان.
 * ۳) اگر cache هم خالی بود، 503 برگردان.
 * ۴) در صورت موفقیت، response را در cache ذخیره کن.
 *
 * بهترین برای: APIهای دیتا که داده‌ی تازه مهم است (مثل /api/users).
 *
 * @param request   درخواست.
 * @param cacheName نام cache.
 * @param timeout   مدت timeout به میلی‌ثانیه (پیش‌فرض: 3000).
 */
/** @public */
export function networkFirst(request: Request, options: CacheStrategyOptions): Promise<Response>;
/** @public @deprecated Use networkFirst(request, { cacheName, timeout }). */
export function networkFirst(request: Request, cacheName: string, timeout?: number): Promise<Response>;
export async function networkFirst(request: Request, options: CacheStrategyOptions | string, legacyTimeout = 3000): Promise<Response> {
  if (typeof options === 'string') deprecate('ZEN-DEPR-080', 'networkFirst(request, cacheName, timeout)', 'networkFirst(request, { cacheName, timeout })');
  const { cacheName, timeout = 3000 } = resolveStrategyOptions(typeof options === 'string' ? legacyStrategyOptions({ cacheName: options, timeout: legacyTimeout }) : options);
  // SECURITY (v0.5.0): POST guard — جلوگیری از fallback به cache GET برای mutationها.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return fetch(request);
  }

  const cacheStore = getCaches();
  if (!cacheStore) {
    return fetch(request);
  }

  const cache = await cacheStore.open(cacheName);

  // FIX (v1.2.7): use AbortController instead of Promise.race so the
  // fetch is actually cancelled when the timeout fires. Previously the
  // fetch kept running in the background consuming bandwidth even after
  // we fell back to cache. We also `clearTimeout` on completion so the
  // timer does not leak.
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (response.ok && request.method === 'GET') {
      void cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    clearTimeout(timeoutId);
    // Fallback به cache. (AbortError از timeout نیز اینجا می‌رسد.)
    const cached = await cache.match(request);
    if (cached) return cached;
    return offlineResponse(request, 'Network failed and cache empty (networkFirst).');
  }
}
