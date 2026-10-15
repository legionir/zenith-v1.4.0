// packages/router/src/ssr-route.ts
//
// runWithRoute/runWithRouteSync — نقطهٔ ورود SSR برای isolation per-request.
//
// #39 + #87: این توابع (به‌همراه مقداردهی ALS و هشدار logger.center برای
// Nodeهای قدیمی) از router.ts به اینجا منتقل شدند تا زنجیرهٔ @zenith/logger
// فقط برای مصرف‌کنندگان SSR (کسانی که runWithRoute را import می‌کنند) وارد
// bundle شود و ورودی سبک `navigate` همچنان بودجهٔ ≤4KB gzip خود را حفظ کند
// (sideEffects جعستهٔ روتر: فقط dist/index.js).
//
// رفتار معناداری حفظ شده است: تابع ensureRouteAsyncContext در اولین import این ماژول
// (module top-level) اجرا می‌شود، پس هر مصرف‌کنندهٔ SSR که runWithRoute را
// import کند، ALS را آماده می‌بیند — دقیقاً مثل رفتار قبلی در Node.

import { signal } from '@zenith/state';
import { logger } from '@zenith/logger';
import { ensureRouteAsyncContext, getRouteAsyncLocalStorage } from './als-holder';
import { browserRouteSignal, type RouteState } from './router';

const st = ensureRouteAsyncContext();
if (st === 'unavailable') {
  // Node < 18.19 / < 20.6: بدون getBuiltinModule نمی‌توان sync به
  // async_hooks رسید. اجرا ادامه می‌یابد اما رندرهای همزمان SSR
  // یک routeSignal مشترک خواهند داشت.
  logger.warn(
    '[@zenith/router] process.getBuiltinModule is unavailable (Node < 18.19). ' +
      'Falling back to a shared route signal — concurrent SSR renders will not be isolated. ' +
      'Upgrade to Node 18.19+ or 20.6+ for per-request isolation.',
  );
}

/**
 * اجرای یک تابع در context یک route مشخص (برای SSR).
 *
 * هر درخواست SSR باید این تابع را با route خود صدا بزند. داخل callback،
 * routeSignal به یک Signal مستقل اشاره می‌کند که فقط در این context قابل
 * دسترسی است. این از race condition بین درخواست‌های concurrent جلوگیری می‌کند.
 *
 * استفاده:
 *   const html = await runWithRoute('/users/123', async () => {
 *     return await renderToString(template, state);
 *   });
 *
 * @param initialPath مسیر اولیه برای این context.
 * @param fn تابع که در context اجرا می‌شود.
 * @returns نتیجه‌ی fn.
 */
export async function runWithRoute<T>(initialPath: string, fn: () => Promise<T> | T): Promise<T> {
  const als = getRouteAsyncLocalStorage();
  if (!als) {
    // در مرورگر یا Node بدون AsyncLocalStorage، fallback به browserRouteSignal.
    // این فقط در تست‌های بدون Node environment رخ می‌دهد.
    const oldPath = browserRouteSignal.get().path;
    browserRouteSignal.set({ path: initialPath, params: {} });
    try {
      return await fn();
    } finally {
      browserRouteSignal.set({ path: oldPath, params: {} });
    }
  }

  // ساخت یک Signal مستقل برای این context.
  const contextSignal = signal<RouteState>({
    path: initialPath,
    params: {},
  });

  return als.run({ signal: contextSignal }, fn);
}

/**
 * نسخه‌ی sync از runWithRoute برای مواردی که callback sync است.
 *
 * استفاده:
 *   const result = runWithRouteSync('/users/123', () => {
 *     // کد sync
 *   });
 */
export function runWithRouteSync<T>(initialPath: string, fn: () => T): T {
  const als = getRouteAsyncLocalStorage();
  if (!als) {
    const oldPath = browserRouteSignal.get().path;
    browserRouteSignal.set({ path: initialPath, params: {} });
    try {
      return fn();
    } finally {
      browserRouteSignal.set({ path: oldPath, params: {} });
    }
  }

  const contextSignal = signal<RouteState>({
    path: initialPath,
    params: {},
  });
  return als.run({ signal: contextSignal }, fn);
}
