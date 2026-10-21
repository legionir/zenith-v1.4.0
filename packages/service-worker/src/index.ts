// packages/service-worker/src/index.ts
//
// FEATURE (v0.4.0): Main-thread API برای Service Worker.
//
// این ماژول در main thread اجرا می‌شود (نه در SW context). بنابراین:
//   - از `navigator.serviceWorker` با guard استفاده می‌کند.
//   - از `window`/`document` مستقیماً استفاده نمی‌کند (در عوض `globalThis` یا
//     `navigator` را guard می‌کند).
//
// شامل:
//   - registerSW(swUrl, options) — ثبت SW و بازگرداندن controller.
//   - unregisterSW()              — لغو ثبت SW.
//   - updateSW()                  — بررسی برای آپدیت.
//   - SWConfig                    — اینترفیس پیکربندی.
//   - ZenithSWPlugin              — پلاگین Zenith برای نصب با Zen.use.


/** @public */
export { CACHE_STRATEGIES, type RouteConfig, type SWConfig, type SWController, type RegisterSWOptions } from './sw-types';
export * from './sw-options';
export * from './sw-register';
export * from './sw-lifecycle';
export * from './sw-plugin';
