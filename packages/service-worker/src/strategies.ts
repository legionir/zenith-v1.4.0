// packages/service-worker/src/strategies.ts
//
// FEATURE (v0.4.0): استراتژی‌های کشِ Service Worker (بدون وابستگی).
//
// این ماژول پیاده‌سازیِ سبکِ Workbox-style از استراتژی‌های رایج کش را فراهم
// می‌کند. هدف: راه‌حلِ offline-first با صفر وابستگی خارجی.
//
// استراتژی‌ها:
//   1. cacheFirst      — اول cache، اگر نبود network (و cache شود).
//   2. networkFirst    — اول network (با timeout)، اگر شکست خورد cache.
//   3. staleWhileRevalidate — cache را فوراً برمی‌گرداند و در پس‌زمینه revalidate می‌کند.
//   4. networkOnly     — مستقیم fetch.
//   5. cacheOnly       — مستقیم cache.
//   6. cacheThenNetwork (v0.5.0) — cache فوراً، fetch در پس‌زمینه با onUpdate callback.
//
// همه‌ی توابع در context محدودِ SW اجرا می‌شوند اما برای تست‌پذیری، از Cache API
// سراسری (`caches`) استفاده می‌کنند که در مرورگر نیز در دسترس است.
//
// SECURITY (v0.5.0): همه‌ی استراتژی‌های cache-aware یک POST guard در ابتدا دارند تا
// از تطبیقِ cache مربوط به GET با درخواست POST/PUT/DELETE به همان URL جلوگیری شود.
//
// نکته: این کد نباید از `window` یا `document` استفاده کند — از `self` استفاده
// می‌کنیم که در SW context به‌عنوان global scope در دسترس است.


export { cacheStrategyOptionsSchema, type CacheStrategyOptions } from './strategy-options';

/** @public */
export { type CacheStrategyName } from './strategy-types';
export * from './strategy-cache-first';
export * from './strategy-network-first';
export * from './strategy-stale';
export * from './strategy-simple';
export * from './strategy-cache-then-network';
export * from './strategy-apply';
