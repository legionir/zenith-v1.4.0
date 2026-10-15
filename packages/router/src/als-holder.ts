// packages/router/src/als-holder.ts
//
// نگه‌دارندهٔ سبک AsyncLocalStorage مسیر (بدون هیچ imports — #39/#87).
//
// این ماژول عمداً لاغر است تا در زنجیرهٔ tree-shake ورودی‌های سبک
// (مثلا `navigate`) بدون کشیدن @zenith/logger (و زنجیرهٔ آن از
// errors/catalog) باقی بماند. مقداردهی ALS توسط ensureRouteAsyncContext در ssr-route.ts
// انجام می‌شود؛ emit هشدار fallback (Node قدیمی) هم همان‌جا از طریق
// logger مرکزی اتفاق می‌افتد.
//
// توجه: وضعیت routeSignal در غیاب ALS دقیقاً رفتار سابق (singleton مرورگری)
// است؛ ALS فقط زمانی معنا دارد که کسی runWithRoute* را صدا بزند — یعنی
// همان import از ssr-route — پس مقداردهی تنبل تغییر معناداری ایجاد نمی‌کند.

let routeAsyncLocalStorage: any = null;

/** وضعیت برگشتی ensureRouteAsyncContext. */
export type AlsInitResult = 'ok' | 'unavailable' | 'browser';

/**
 * مقداردهی sync ALS (idempotent). در محیط مرورگر فقط 'browser' برمی‌گرداند.
 * این مقداردهی باید sync باشد چون routeSignal.get/set و
 * runWithRouteSync هر دو API همزمان (sync) هستند.
 */
export function ensureRouteAsyncContext(): AlsInitResult {
  if (routeAsyncLocalStorage) return 'ok';
  try {
    const proc = (globalThis as any).process;
    // بررسی اینکه در Node.js هستیم (نه مرورگر)
    if (proc?.versions?.node) {
      if (typeof proc.getBuiltinModule === 'function') {
        const { AsyncLocalStorage } = proc.getBuiltinModule('node:async_hooks');
        routeAsyncLocalStorage = new AsyncLocalStorage();
        return 'ok';
      }
      return 'unavailable';
    }
    return 'browser';
  } catch {
    // در محیط‌هایی که node:async_hooks در دسترس نیست (مرورگر)،
    // fallback به singleton استفاده می‌شود.
    return 'browser';
  }
}

/** دسترسی به holder (ممکن است null باشد اگر ensureRouteAsyncContext هنوز صدا زده نشده). */
export function getRouteAsyncLocalStorage(): any {
  return routeAsyncLocalStorage;
}
