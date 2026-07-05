/**
 * نوع استراتژی کش.
 */
export type CacheStrategyName = 'cacheFirst' | 'networkFirst' | 'staleWhileRevalidate' | 'networkOnly' | 'cacheOnly' | 'cacheThenNetwork';
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
export declare function cacheFirst(request: Request, cacheName: string): Promise<Response>;
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
export declare function networkFirst(request: Request, cacheName: string, timeout?: number): Promise<Response>;
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
export declare function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response>;
/**
 * FEATURE (v0.4.0): استراتژی Network-Only.
 *
 * مستقیم fetch بدون درگیر کردن cache. مفید برای درخواست‌های غیر cached مثل
 * mutationها (POST/PUT/DELETE) یا endpointهای حساس.
 *
 * @param request درخواست.
 */
export declare function networkOnly(request: Request): Promise<Response>;
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
export declare function cacheOnly(request: Request, cacheName: string): Promise<Response>;
/**
 * FEATURE (v0.5.0): استراتژی Cache-Then-Network.
 *
 * ۱) اگر cache موجود است، فوراً همان را برگردان (UI سریع).
 * ۲) در پس‌زمینه یک fetch انجام بده؛ اگر موفق و GET بود، cache را به‌روز کن و
 *    `onUpdate(fresh)` را صدا بزن تا main thread بتواند UI را refresh کند.
 * ۳) اگر cache خالی است، مستقیم fetch کن (و کش کن).
 * ۴) SECURITY (v0.5.0): POST guard در ابتدای تابع — mutationها مستقیم fetch می‌شوند.
 *
 * @param request   درخواست.
 * @param cacheName نام cache.
 * @param onUpdate  callback اختیاری که با response تازه صدا زده می‌شود.
 */
export declare function cacheThenNetwork(request: Request, cacheName: string, onUpdate?: (fresh: Response) => void): Promise<Response>;
/**
 * FEATURE (v0.4.0): Dispatch به استراتژی با نام.
 *
 * تابعی کمکی برای route-matching: نام استراتژی را می‌گیرد و تابع مناسب را صدا می‌زند.
 *
 * نکته: برای `cacheThenNetwork`، `onUpdate` در این مسیر ست نمی‌شود (تنها cache در
 * پس‌زمینه به‌روز می‌شود). برای callback، استراتژی را مستقیماً صدا بزنید.
 *
 * @param strategyName نام استراتژی.
 * @param request      درخواست.
 * @param cacheName    نام cache.
 * @param timeout      timeout برای networkFirst.
 */
export declare function applyStrategy(strategyName: CacheStrategyName, request: Request, cacheName: string, timeout?: number): Promise<Response>;
//# sourceMappingURL=strategies.d.ts.map