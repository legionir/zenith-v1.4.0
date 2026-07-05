import { type CacheStrategyName } from './strategies.js';
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
    /** آیا در install event skipWaiting کنیم؟ */
    skipWaiting?: boolean;
    /** آیا در activate event clients.claim کنیم؟ */
    clientsClaim?: boolean;
}
/**
 * FEATURE (v0.4.0): ثبت پیکربندی SW.
 *
 * این تابع در فایل sw.js توسط کاربر صدا زده می‌شود:
 *
 *   import { setupSW } from '@zenith/service-worker/sw';
 *   setupSW({
 *     precache: ['/index.html', '/app.js'],
 *     routes: [
 *       { urlPattern: '/api/users', strategy: 'networkFirst', cacheName: 'users' },
 *       { urlPattern: /\/assets\//,  strategy: 'cacheFirst',  cacheName: 'assets' },
 *     ],
 *     defaultStrategy: 'networkOnly',
 *   });
 *
 * بعد از این، event listenerهای install/activate/fetch/sync ثبت می‌شوند.
 */
export declare function setupSW(config: SWRuntimeConfig): void;
/**
 * FEATURE (v0.4.0): دریافت اندازه‌ی فعلی صف mutations (برای تست و DevTools).
 *
 * FEATURE (v0.5.0): این تابع synchronous است و مقدار cache حافظه‌ای را برمی‌گرداند.
 * مقدار دقیق در IndexedDB است. برای مقدار دقیق از تابع داخلی `loadQueue()` استفاده شود.
 */
export declare function getQueueSize(): number;
/**
 * FEATURE (v0.4.0): دریافت پیکربندی فعلی (برای تست و DevTools).
 */
export declare function getConfig(): SWRuntimeConfig | null;
//# sourceMappingURL=sw.d.ts.map