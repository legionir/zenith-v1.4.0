// packages/error-boundary/src/boundary.ts
//
// #115 (DEC-031) — error-boundary دیگر سیستم خطای موازی نیست:
// listener/history/devMode همه در hub (`@zenith/errors`) زندگی می‌کنند و
// این فایل فقط دو چیز اضافه می‌کند:
//   1) `errorSignal` — signal سراسری «آخرین خطا» (وابسته به state؛ peer).
//   2) `reportError(error, source, context)` — enrich کردن خطا با
//      source/expression/element و feed کردنش به hub (بدون listener محلی).
//
// `ZenithError` محلی (interface قدیمی) حذف شد؛ نوع INFO = همان کلاس
// `ZenithError` از @zenith/errors با فیلدهای اختیاری source/expression/element
// که reportError ست می‌کند.

import { signal, type Signal } from '@zenith/state';
import {
  ZenithError,
  onError as onErrorFrom,
  reportError as hubReport,
  clearErrorHistory,
  getErrorHistory,
  errorHubGeneration,
} from '@zenith/errors';

/**
 * اطلاعات یک خطای رخ‌داده — مدل واحد (#115): همان کلاس `ZenithError` از
 * `@zenith/errors`. فیلدهای مسیر (source/expression/element) همان‌جا
 * تعریف شده‌اند (element به‌صورت `unknown` تا errors DOM-free بماند؛
 * مصرف‌کننده‌های DOM آن را به HTMLElement نگاشت می‌کنند).
 */
export type ZenithErrorInfo = ZenithError;

// #115: کلاس واحد از @zenith/errors re-export می‌شود (همان آبجکت؛ نه wrapper).
export { ZenithError };

/**
 * Signal سراسری خطای فعلی. اگر null باشد خطایی وجود ندارد.
 * listener داخلی روی hub پرش می‌کند — یعنی هر خطایی (directive، effect،
 * scheduler، emitError مستقیم) errorSignal را آپدیت می‌کند.
 */
export const errorSignal: Signal<ZenithErrorInfo | null> = signal<ZenithErrorInfo | null>(null);

// فید داخلی: هر خطای hub روی errorSignal منعکس می‌شود. lazy ثبت می‌شود
// (sideEffects:false — بدون effect در زمان import): اولین باری که از مسیر
// boundary (reportError/onError/clearErrorBoundary) عبور می‌کنیم فید ساخته
// می‌شود؛ اگر hub بین تست‌ها بازنشانی شود (clearErrorHandlers/
// resetErrorHubForTesting)، ضمانت نسل (generation) فید را دوباره ثبت می‌کند.
let hubUnsub: (() => void) | null = null;
let feedGeneration = -1;
function ensureSignalFeed(): void {
  const gen = errorHubGeneration();
  if (hubUnsub && feedGeneration === gen) return;
  // hub بازنشانی شده (تست‌ها) یا هنوز فید نگرفته‌ایم — دوباره ثبت می‌کنیم.
  hubUnsub?.();
  feedGeneration = gen;
  hubUnsub = onErrorFrom((err) => {
    errorSignal.set(err);
  });
}

/**
 * ثبت یک callback برای خطاها — wrapper روی hub (`onError` واحد #115) که
 * فید errorSignal را هم (lazy) فعال نگه می‌دارد.
 *
 * @returns تابع unsubscribe (Cleanup) — idempotent.
 */
export function onError(
  handler: Parameters<typeof onErrorFrom>[0],
): ReturnType<typeof onErrorFrom> {
  ensureSignalFeed();
  return onErrorFrom(handler);
}

/**
 * گزارش یک خطا (unknown) به hub با enrich کردن source/expression/element.
 *
 * #115: دیگر listener موازی ندارد؛ دقیقاً همان مسیری که directive/effect/
 * scheduler می‌روند: hub.reportError → emitError → همهٔ onError listenerها
 * + history + (به‌واسطهٔ فید داخلی) errorSignal. همان instance کلون نمی‌شود.
 */
export function reportError(
  error: unknown,
  source: string,
  context?: { expression?: string; element?: HTMLElement },
): void {
  // بازنشانی فید در صورتی که hub (مثلاً بین تست‌ها) پاک شده باشد.
  ensureSignalFeed();
  hubReport(error, source, context);
}

/**
 * پاکسازی خطای فعلی (signal). تاریخچهٔ hub دست‌نخورده می‌ماند
 * (رفتار قبلی هم همین بود — `clearError` فقط signal را null می‌کرد).
 */
export function clearError(): void {
  errorSignal.set(null);
}

/**
 * پاکسازی کامل Error Boundary (برای تست‌ها): history + listenerهای hub
 * + signal. مصرف‌کنندهٔ production نباید صدا بزند.
 */
export function clearErrorBoundary(): void {
  if (hubUnsub) {
    hubUnsub();
    hubUnsub = null;
    feedGeneration = -1;
  }
  clearErrorHistory();
  errorSignal.set(null);
  ensureSignalFeed();
}

// دسترسی‌های کمکی برای تست/ادیباگ (#115 شواهد).
export { getErrorHistory };
