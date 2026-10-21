// packages/service-worker/src/strategy-cache-then-network.ts
//
// استراتژی cache-then-network — استخراج مکانیکی از strategies.ts،
// بدون تغییر رفتار (#40).

import { deprecate, ZenithError, ErrorCode } from '@zenith/errors';
import { resolveStrategyOptions, legacyStrategyOptions, type CacheStrategyOptions } from './strategy-options';
import { getCaches, offlineResponse } from './strategy-types';


/**
 * FEATURE (v0.5.0): استراتژی Cache-Then-Network.
 *
 * ۱) اگر cache موجود است، فوراً همان را برگردان (UI سریع).
 * ۲) در پس‌زمینه یک fetch انجام بده؛ اگر موفق و GET بود، cache را به‌روز کن و
 *    `onUpdate(fresh)` را صدا بزن تا main thread بتواند UI را refresh کند.
 * ۳) اگر cache خالی است، مستقیم fetch کن (و کش کن).
 * ۴) SECURITY (v0.5.0): POST guard در ابتدای تابع — mutationها مستقیم fetch می‌شوند.
 *
 * بهترین برای: داده‌هایی که UI سریع می‌خواهیم اما به‌روزرسانی هم مهم است
 * (مثل feed اخبار، dashboard، لیست نوتیف‌ها).
 *
 * نکته: `onUpdate` اختیاری است. اگر از طریق `applyStrategy` صدا زده شود، این
 * callback ست نمی‌شود (تنها cache در پس‌زمینه به‌روز می‌شود). برای دریافتِ
 * notification در main thread، این استراتژی را مستقیماً با callback صدا بزنید
 * یا از `clients.matchAll` + `postMessage` در callback استفاده کنید.
 *
 * @param request   درخواست.
 * @param cacheName نام cache.
 * @param onUpdate  callback اختیاری که با response تازه صدا زده می‌شود.
 * @returns Promise<Response>.
 */
/** @public */
export function cacheThenNetwork(request: Request, options: CacheStrategyOptions): Promise<Response>;
/** @public @deprecated Use cacheThenNetwork(request, { cacheName, onUpdate }). */
export function cacheThenNetwork(request: Request, cacheName: string, onUpdate?: (fresh: Response) => void): Promise<Response>;
export async function cacheThenNetwork(request: Request, options: CacheStrategyOptions | string, legacyUpdate?: (fresh: Response) => void): Promise<Response> {
  if (typeof options === 'string') deprecate('ZEN-DEPR-081', 'cacheThenNetwork(request, cacheName, onUpdate)', 'cacheThenNetwork(request, { cacheName, onUpdate })');
  const { cacheName, onUpdate } = resolveStrategyOptions(typeof options === 'string' ? legacyStrategyOptions({ cacheName: options, onUpdate: legacyUpdate }) : options);
  // SECURITY (v0.5.0): POST guard — mutationها نباید از cache بخوانند.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return fetch(request);
  }

  const cacheStore = getCaches();
  if (!cacheStore) {
    return fetch(request);
  }

  const cache = await cacheStore.open(cacheName);
  const cached = await cache.match(request);

  // FEATURE (v0.5.0): fetch در پس‌زمینه — cache را به‌روز می‌کند و onUpdate را صدا می‌زند.
  const freshPromise: Promise<Response> = fetch(request)
    .then((response) => {
      if (response.ok && request.method === 'GET') {
        // به‌روزرسانی cache (fire-and-forget).
        cache.put(request, response.clone()).catch(() => {
          /* ignore */
        });
        // notification به caller (برای refresh UI).
        if (typeof onUpdate === 'function') {
          try {
            onUpdate(response.clone());
          } catch (e) {
            // خطای callback نباید flow را بشکند.
          }
        }
      }
      return response;
    })
    .catch(() => {
      // خطای fetch پس‌زمینه نادیده گرفته می‌شود (cache همچنان معتبر است).
      throw new ZenithError({
        code: ErrorCode.RESOURCE_HTTP_ERROR,
        category: 'Network',
        message: 'background fetch failed',
        suggestion: 'اتصال شبکه را بررسی کنید؛ cache همچنان معتبر است.',
      });
    });

  if (cached) {
    // فوراً cache را برگردان؛ freshPromise در پس‌زمینه اجرا می‌شود.
    // خطای احتمالی freshPromise را swallow می‌کنیم تا unhandled rejection نباشد.
    freshPromise.catch(() => {
      /* ignore background update errors */
    });
    return cached;
  }

  // cache نبود — منتظر fetch می‌مانیم تا response واقعی برگردد.
  try {
    return await freshPromise;
  } catch (err) {
    return offlineResponse(request, 'Network failed and cache empty (cacheThenNetwork).');
  }
}
