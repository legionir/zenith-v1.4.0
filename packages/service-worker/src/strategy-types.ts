// packages/service-worker/src/strategy-types.ts
//
// نام استراتژی و helperهای Cache API — استخراج مکانیکی از strategies.ts،
// بدون تغییر رفتار (#40).


/**
 * نوع استراتژی کش.
 */
export type CacheStrategyName =
  | 'cacheFirst'
  | 'networkFirst'
  | 'staleWhileRevalidate'
  | 'networkOnly'
  | 'cacheOnly'
  | 'cacheThenNetwork';

/**
 * کمکی: دریافت Cache API با guard (ممکن است در SSR/Node در دسترس نباشد).
 */
export function getCaches(): CacheStorage | undefined {
  if (typeof caches === 'undefined') return undefined;
  return caches;
}

/**
 * کمکی: ساخت یک Response خطای شبیه‌سازی‌شده برای زمان‌هایی که fetch ناموفق است.
 */
export function offlineResponse(request: Request, message: string): Response {
  // FEATURE (v0.4.0): در حالت offline، یک Response با status 503 برمی‌گردانیم
  // تا کدهای consumer بتوانند آن را تشخیص دهند.
  const body = JSON.stringify({ error: message, url: request.url });
  return new Response(body, {
    status: 503,
    statusText: 'Service Unavailable',
    headers: { 'Content-Type': 'application/json' },
  });
}
