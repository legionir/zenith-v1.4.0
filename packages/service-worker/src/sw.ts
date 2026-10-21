// packages/service-worker/src/sw.ts
//
// FEATURE (v0.4.0): Service Worker bootstrap — اجرا در context محدودِ SW.
//
// این فایل توسط مرورگر در context یک Service Worker اجرا می‌شود (نه main thread).
// بنابراین:
//   - نباید از `window` یا `document` استفاده کند.
//   - global scope اینجا `self` است (که در SW context همان `ServiceWorkerGlobalScope` است).
//   - از `self` با guard `typeof self !== 'undefined'` استفاده می‌کنیم تا در SSR/Node
//     بدون خطا import شود (مثلاً در تست‌ها یا bundler که کد را در حالت main-thread
//     parse می‌کند).
//
// شامل:
//   - setupSW(config)               — ثبت route config (در اسکریپت SW صدا زده می‌شود).
//   - install event handler         — pre-cache critical assets.
//   - activate event handler        — پاکسازی cacheهای قدیمی.
//   - fetch event handler           — route-matching → apply strategy.
//   - sync event handler            — background sync (retry queued mutations).
//   - message event handler         — کنترل از main thread (e.g. skipWaiting).
//
// FEATURE (v0.5.0): صفِ background sync اکنون در IndexedDB ماندگار است تا از از دست
// رفتنِ mutationها پس از restartِ SW جلوگیری شود. همچنین retry با exponential
// backoff و jitter انجام می‌شود تا سرور تحت فشار قرار نگیرد.

/** @public */
export type { RouteMatcher, SWRuntimeConfig } from './sw-types';
/** @public */
export { routeMatcherOptions, swRuntimeConfigOptions, SW_RUNTIME_CONFIG_DEFAULTS, swRuntimeConfigSchema, resolveSWRuntimeConfig } from './sw-options';
/** @public */
export { setupSW } from './sw-setup';
/** @public */
export { setupKillSwitchSW } from './sw-killswitch';
/** @public */
export { getQueueSize, getConfig } from './sw-state';
export { cleanupSWListeners } from './sw-listeners';
