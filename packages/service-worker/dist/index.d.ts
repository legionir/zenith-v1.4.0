import type { CacheStrategyName } from './strategies.js';
interface ZenithPluginStructural {
    name: string;
    install: (zen: any, options?: any) => void;
}
/**
 * FEATURE (v0.4.0): پیکربندی یک route در main-thread API.
 *
 * این ساختار معادل RouteMatcher در SW است، اما بدون استراتژی اینجا — فقط
 * برای ارسال به SW از طریق تنظیمات (که خود SW آن‌ها را از فایل sw.js می‌خواند).
 */
export interface RouteConfig {
    /** الگوی URL. regex یا string. */
    urlPattern: RegExp | string;
    /** متد HTTP برای تطبیق. */
    method?: string;
    /** استراتژی کش. */
    strategy: CacheStrategyName;
    /** نام cache. */
    cacheName?: string;
    /** timeout برای networkFirst. */
    timeout?: number;
}
/**
 * FEATURE (v0.4.0): پیکربندی Service Worker از دید main thread.
 *
 * این شیء به `ZenithSWPlugin` داده می‌شود و توسط `registerSW` برای ثبت SW
 * استفاده می‌شود. علاوه بر این، فایل SW باید با همان routes تنظیم شود.
 *
 * نمونه:
 *   const config: SWConfig = {
 *     swUrl: '/sw.js',
 *     precache: ['/', '/index.html', '/app.js'],
 *     routes: [
 *       { urlPattern: '/api/users', strategy: 'networkFirst', cacheName: 'users' },
 *       { urlPattern: /\/assets\//,  strategy: 'cacheFirst',  cacheName: 'assets' },
 *     ],
 *     defaultStrategy: 'networkOnly',
 *   };
 */
export interface SWConfig {
    /** URL فایل SW. پیش‌فرض: '/sw.js'. */
    swUrl?: string;
    /** scope ثبت SW. پیش‌فرض: '/' . */
    scope?: string;
    /** لیست routes. */
    routes: RouteConfig[];
    /** لیست URLهایی که باید pre-cache شوند. */
    precache: string[];
    /** استراتژی پیش‌فرض برای requestهای unmatched. پیش‌فرض: 'networkOnly'. */
    defaultStrategy?: CacheStrategyName;
    /** آیا به‌محض آپدیت، skipWaiting کنیم؟ پیش‌فرض: false. */
    skipWaiting?: boolean;
    /** آیا clients.claim در activate کنیم؟ پیش‌فرض: false. */
    clientsClaim?: boolean;
}
/**
 * FEATURE (v0.4.0): Controller — شیء برگشتی از registerSW.
 *
 * به کاربر اجازه می‌دهد update/unregister را صدا بزند و listenerها را پاک کند.
 */
export interface SWController {
    /** نمونه‌ی ServiceWorkerRegistration (در صورت موفقیت). */
    registration: ServiceWorkerRegistration | null;
    /** بررسی برای آپدیت. */
    update: () => Promise<boolean>;
    /** لغو ثبت SW. */
    unregister: () => Promise<boolean>;
    /** فرمان skipWaiting به SW در انتظار. */
    skipWaiting: () => void;
    /** پاک کردن listenerها (در teardown). */
    destroy: () => void;
    /** آیا SW پشتیبانی می‌شود؟ */
    supported: boolean;
}
/**
 * FEATURE (v0.4.0): Options برای registerSW.
 */
export interface RegisterSWOptions {
    /** scope ثبت. */
    scope?: string;
    /** Callback وقتی آپدیت SW پیدا شد. */
    onUpdateFound?: (registration: ServiceWorkerRegistration) => void;
    /** Callback وقتی SW جدید کنترل صفحه را به‌دست گرفت (بعد از reload). */
    onControllerChange?: (controller: ServiceWorker | null) => void;
    /** Callback وقتی خطای ثبت رخ داد. */
    onError?: (err: Error) => void;
}
/**
 * FEATURE (v0.4.0): ثبت Service Worker.
 *
 * این تابع `navigator.serviceWorker.register` را با guard می‌پوشاند.
 * اگر SW پشتیبانی نمی‌شود (مثل SSR یا محیط غیر مرورگری)، یک controller با
 * `supported: false` برمی‌گرداند و هیچ‌کاری نمی‌کند.
 *
 * @param swUrl   URL فایل SW (مثل '/sw.js').
 * @param options گزینه‌های ثبت.
 * @returns Controller برای کنترل SW.
 */
export declare function registerSW(swUrl?: string, options?: RegisterSWOptions): SWController | void;
/**
 * FEATURE (v0.4.0): لغو ثبت SW — shortcut برای registerSW().unregister().
 *
 * اگر SW فعالی ثبت شده باشد، آن را لغو ثبت می‌کند. در غیر این‌صورت false.
 */
export declare function unregisterSW(): Promise<boolean>;
/**
 * FEATURE (v0.4.0): بررسی برای آپدیت SW.
 *
 * همه‌ی registrationهای فعال را می‌گیرد و `update()` را روی هرکدام صدا می‌زند.
 *
 * @returns true اگر حداقل یک registration بدون خطا update شد.
 */
export declare function updateSW(): Promise<boolean>;
/**
 * FEATURE (v0.4.0): پلاگین Zenith برای نصب SW.
 *
 * استفاده:
 *   import { Zen } from '@zenith/runtime';
 *   import { zenithSWPlugin } from '@zenith/service-worker';
 *   Zen.use(zenithSWPlugin, {
 *     swUrl: '/sw.js',
 *     precache: ['/'],
 *     routes: [ { urlPattern: '/api', strategy: 'networkFirst' } ],
 *   });
 *
 * `install` یک Controller برمی‌دارد و روی `Zen` به‌عنوان `Zen.sw` قرار می‌دهد.
 * علاوه بر این، در محیط‌های غیر مرورگری no-op است.
 */
export declare const zenithSWPlugin: ZenithPluginStructural;
export {};
//# sourceMappingURL=index.d.ts.map