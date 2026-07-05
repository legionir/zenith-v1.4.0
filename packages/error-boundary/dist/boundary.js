// packages/error-boundary/src/boundary.ts
//
// Error Boundary — قابلیت غایب فاز ۹ (فاز ۱۱).
//
// این ماژول دو قابلیت فراهم می‌کند:
//   1) Global Error Handler: تمام خطاهای runtime در دایرکتیوها و Effectها
//      به یک handler سراسری گزارش می‌شوند.
//   2) zen-error Directive: یک boundary محلی که اگر Expression داخلش خطا دهد،
//      fallback UI نمایش می‌دهد.
//
// ── نحوه کار ──
//
// Error Boundary با wrap کردن `evaluateExpression` و `effect` کار می‌کند.
// وقتی خطایی رخ می‌دهد:
//   1) به global handler گزارش می‌شود (برای logging).
//   2) اگر در محدوده‌ی یک zen-error باشد، fallback UI نمایش داده می‌شود.
//   3) اگر نباشد، خطا به console.error می‌رسد (رفتار قبلی).
import { signal } from '@zenith/state';
/**
 * Signal سراسری خطای فعلی (برای global error handler).
 *
 * اگر null باشد، خطایی وجود ندارد.
 * اگر یک ZenithError باشد، می‌توان در UI آن را نمایش داد.
 */
export const errorSignal = signal(null);
/**
 * لیست callback هایی که روی هر خطا فراخوانی می‌شوند.
 */
const errorListeners = [];
/**
 * ثبت یک callback برای خطاها.
 *
 * @param callback تابعی که روی هر خطا فراخوانی شود.
 * @returns تابع unsubscribe.
 */
export function onError(callback) {
    errorListeners.push(callback);
    return () => {
        const idx = errorListeners.indexOf(callback);
        if (idx >= 0)
            errorListeners.splice(idx, 1);
    };
}
/**
 * گزارش یک خطا به Error Boundary.
 *
 * این تابع:
 *   1) errorSignal را آپدیت می‌کند.
 *   2) تمام listeners را فراخوانی می‌کند.
 *   3) خطا را در console چاپ می‌کند (اگر در development mode باشد).
 *
 * @param error   شیء خطا.
 * @param source  محل خطا.
 * @param context اطلاعات اضافی.
 */
export function reportError(error, source, context) {
    const zenithError = {
        message: error.message,
        error,
        source,
        expression: context?.expression,
        element: context?.element,
        timestamp: Date.now(),
    };
    // آپدیت signal سراسری.
    errorSignal.set(zenithError);
    // فراخوانی listeners.
    for (const listener of errorListeners) {
        try {
            listener(zenithError);
        }
        catch (err) {
            // خطا در listener نباید کل سیستم را خراب کند.
            console.error('[Zenith Error Boundary] Error in error listener:', err);
        }
    }
    // در development mode، خطا را در console چاپ کن.
    if (typeof globalThis !== 'undefined' && globalThis.__ZENITH_DEV__ !== false) {
        console.error(`[Zenith] Error in ${source}:`, error.message, {
            expression: context?.expression,
            element: context?.element,
        });
    }
}
/**
 * پاکسازی خطای فعلی.
 *
 * این تابع errorSignal را null می‌کند.
 */
export function clearError() {
    errorSignal.set(null);
}
/**
 * پاکسازی کامل Error Boundary (برای تست‌ها).
 */
export function clearErrorBoundary() {
    errorSignal.set(null);
    errorListeners.length = 0;
}
//# sourceMappingURL=boundary.js.map