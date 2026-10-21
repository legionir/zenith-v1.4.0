// packages/service-worker/src/strategy-cache-first.ts
//
// استراتژی cache-first — استخراج مکانیکی از strategies.ts،
// بدون تغییر رفتار (#40).

import { deprecate } from '@zenith/errors';
import { resolveStrategyOptions, legacyStrategyOptions, type CacheStrategyOptions } from './strategy-options';
import { getCaches, offlineResponse } from './strategy-types';


/**
 * FEATURE (v0.4.0): استراتژی Cache-First.
 *
 * ۱) cache را بررسی کن. اگر موجود بود، همان را برگردان.
 * ۲) اگر نبود، از شبکه بگیر.
 * ۳) response شبکه را در cache ذخیره کن (برای دفعه بعد).
 * ۴) اگر شبکه هم ناموفق بود و cache هم خالی بود، یک 503 برگردان.
 *
 * بهترین برای: assets استاتیک با hash (JS/CSS/Images/Fonts).
 *
 * @param request   درخواست.
 * @param cacheName نام cache.
 * @returns Promise<Response>.
 */
/** @public */
export function cacheFirst(request: Request, options: CacheStrategyOptions): Promise<Response>;
/** @public @deprecated Use cacheFirst(request, { cacheName }). */
export function cacheFirst(request: Request, cacheName: string): Promise<Response>;
export async function cacheFirst(request: Request, options: CacheStrategyOptions | string): Promise<Response> {
  if (typeof options === 'string') deprecate('ZEN-DEPR-079', 'cacheFirst(request, cacheName)', 'cacheFirst(request, { cacheName })');
  const { cacheName } = resolveStrategyOptions(typeof options === 'string' ? legacyStrategyOptions({ cacheName: options }) : options);
  // SECURITY (v0.5.0): POST guard — جلوگیری از تطبیقِ cache GET با درخواست POST.
  // `cache.match(request)` می‌تواند یک response مربوط به GET را برای POST هم match
  // کند که خطرناک است. mutationها مستقیماً به شبکه می‌روند (networkOnly fallback).
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return fetch(request);
  }

  const cacheStore = getCaches();
  if (!cacheStore) {
    // محیط بدون Cache API — مستقیم fetch کن.
    return fetch(request);
  }

  const cache = await cacheStore.open(cacheName);
  const cached = await cache.match(request);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(request);
    // فقط responseهای موفق و از نوع GET را کش کن (best practice).
    if (response.ok && request.method === 'GET') {
      void cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    return offlineResponse(request, 'Network unavailable (cacheFirst).');
  }
}
