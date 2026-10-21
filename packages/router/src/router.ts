// packages/router/src/router.ts
//
// مغز مسیریاب (Router) — فاز ۸.
//
// این ماژول مسیر فعلی را در یک Signal نگه می‌دارد، پارامترهای URL
// (مثل `:id`) را استخراج می‌کند، و قابلیت ناوبری (`navigate`) را فراهم
// می‌کند — بدون رفرش صفحه.
//
// نکته‌ی مهم: این ماژول فقط در محیط مرورگر کار می‌کند (نیاز به `window`,
// `history`, `location` دارد). در SSR یا تست‌های Node باید mock شود.
//
// ── Bug Fix: SSR Concurrency ──
//
// قبلاً routeSignal یک singleton ماژول-level بود. در SSR concurrent،
// دو درخواست همزمان به route های مختلف باعث می‌شد route صفحه‌ی B روی
// صفحه‌ی A overwrite شود.
//
// راه‌حل: استفاده از AsyncLocalStorage برای isolation per-request.
//   - در مرورگر: routeSignal همان singleton است (تعداد clients = 1).
//   - در SSR: هر درخواست context خود را دارد. routeSignal.get() و
//     routeSignal.set() به context فعلی اشاره می‌کنند.
//
// استفاده در SSR:
//   import { runWithRoute } from '@zenith/router';
//   await runWithRoute('/users/123', async () => {
//     // در این block، routeSignal به /users/123 اشاره می‌کند.
//     // navigate() و setRouteParams() فقط این context را تغییر می‌دهند.
//     const html = await renderToString(...);
//   });


export { browserRouteSignal, routeSignal, type RouteState } from './route-state';

export * from './router-types';
export * from './route-match';
export * from './router-navigate';
export * from './route-announce';
