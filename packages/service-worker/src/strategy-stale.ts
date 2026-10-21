// packages/service-worker/src/strategy-stale.ts
//
// استراتژی stale-while-revalidate — استخراج مکانیکی از strategies.ts،
// بدون تغییر رفتار (#40).

import { deprecate } from '@zenith/errors';
import { resolveStrategyOptions, legacyStrategyOptions, type CacheStrategyOptions } from './strategy-options';
import { getCaches, offlineResponse } from './strategy-types';


/**
 * FEATURE (v0.4.0): استراتژی Stale-While-Revalidate.
 *
 * ۱) اگر cache موجود است، فوراً همان را برگردان.
 * ۲) در پس‌زمینه، یک fetch انجام بده و cache را به‌روزرسانی کن.
 * ۳) اگر cache نبود، مستقیم fetch کن (و کش کن).
 *
 * بهترین برای: منابعی که به‌روزرسانی فوری حیاتی نیست اما cache شدنشان مهم است.
 *
 * نکته: این تابع response را فوراً برمی‌گرداند؛ revalidation به‌صورت fire-and-forget
 * در پس‌زمینه انجام می‌شود و خطاهایش نادیده گرفته می‌شوند.
 *
 * @param request   درخواست.
 * @param cacheName نام cache.
 */
/** @public */
export function staleWhileRevalidate(request: Request, options: CacheStrategyOptions): Promise<Response>;
/** @public @deprecated Use staleWhileRevalidate(request, { cacheName }). */
export function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response>;
export async function staleWhileRevalidate(request: Request, options: CacheStrategyOptions | string): Promise<Response> {
  if (typeof options === 'string') deprecate('ZEN-DEPR-083', 'staleWhileRevalidate(request, cacheName)', 'staleWhileRevalidate(request, { cacheName })');
  const { cacheName } = resolveStrategyOptions(typeof options === 'string' ? legacyStrategyOptions({ cacheName: options }) : options);
  // SECURITY (v0.5.0): POST guard — جلوگیری از بازگشتِ cache GET برای درخواست POST.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return fetch(request);
  }

  const cacheStore = getCaches();
  if (!cacheStore) {
    return fetch(request);
  }

  const cache = await cacheStore.open(cacheName);
  const cached = await cache.match(request);

  // FEATURE (v0.4.0): revalidation در پس‌زمینه (fire-and-forget).
  // توجه: اگر cache موجود باشد، این Promise را نگاه نمی‌داریم و خطایش را نادیده
  // می‌گیریم (تا unhandled rejection نباشد). اگر cache نبود، await می‌کنیم.
  const revalidatePromise: Promise<Response> = fetch(request).then((response) => {
    if (response.ok && request.method === 'GET') {
      // NOTE: `cache.put` Promise برمی‌گرداند؛ به‌صورت fire-and-forget اجرا می‌شود.
      cache.put(request, response.clone()).catch(() => {
        /* ignore */
      });
    }
    return response;
  });

  if (cached) {
    // فوراً cache را برگردان؛ revalidation در پس‌زمینه در حال اجراست.
    // خطای احتمالی revalidate را swallow می‌کنیم تا unhandled rejection رخ ندهد.
    revalidatePromise.catch(() => {
      /* ignore background revalidation errors */
    });
    return cached;
  }

  // cache نبود — منتظر revalidate می‌مانیم تا response واقعی برگردد.
  try {
    return await revalidatePromise;
  } catch (err) {
    return offlineResponse(request, 'Network failed and cache empty (SWR).');
  }
}
