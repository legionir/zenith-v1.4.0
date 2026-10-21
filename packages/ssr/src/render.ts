// packages/ssr/src/render.ts
//
// SSR (Server-Side Rendering) — Stabilized (Phase 6).
//
// FEATURE (v1.0.0): Thread Safety با AsyncLocalStorage.
// هر درخواست SSR DOM مستقل خود را دارد. globalThis دیگر mutate نمی‌شود —
// به‌جای آن، getters روی globalThis نصب شده‌اند که از AsyncLocalStorage
// (به‌ازای هر async context) می‌خوانند. این کار از race condition در SSR
// concurrent (مثلاً ۱۰۰ درخواست همزمان) جلوگیری می‌کند.
//
// Route Safety: از runWithRoute() استفاده می‌کند تا routeSignal در هر
// درخواست SSR ایزوله باشد. این از race condition بین درخواست‌های concurrent
// جلوگیری می‌کند (قبلاً route صفحه‌ی B می‌توانست روی صفحه‌ی A overwrite شود).
//
// Hydration: export `renderToStream` برای streaming + `hydrate` واقعی.
//
// محدودیت: zen-fetch در SSR پشتیبانی نمی‌شود — داده باید از قبل آماده باشد.

export { createHead, renderHead, titleFromRoute } from '@zenith/head';
export type { HeadManager } from '@zenith/head';

export * from './render-serialize';
export type { SSRAppContext, RenderOptions } from './render-context';
export * from './render-head';
export { clearSSRTemplateCache, getSSRTemplateCacheStats } from './render-pool';
export { renderToString } from './render-ssr';
export * from './render-page';
export * from './render-stream';
export { renderToReadableStream } from './render-readable';
export * from './render-adapters';
