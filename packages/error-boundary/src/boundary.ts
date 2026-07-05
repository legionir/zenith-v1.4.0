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

import { signal, type Signal } from '@zenith/state';

/**
 * اطلاعات یک خطای رخ‌داده.
 */
export interface ZenithError {
  /** پیام خطا. */
  message: string;
  /** شیء خطای اصلی. */
  error: Error;
  /** محل خطا (مثلاً 'expression', 'effect', 'directive'). */
  source: string;
  /** Expression که خطا داده (اگر قابل تشخیص باشد). */
  expression?: string;
  /** عنصر مرتبط (اگر موجود باشد). */
  element?: HTMLElement;
  /** زمان خطا. */
  timestamp: number;
}

/**
 * Signal سراسری خطای فعلی (برای global error handler).
 *
 * اگر null باشد، خطایی وجود ندارد.
 * اگر یک ZenithError باشد، می‌توان در UI آن را نمایش داد.
 */
export const errorSignal: Signal<ZenithError | null> = signal<ZenithError | null>(null);

/**
 * لیست callback هایی که روی هر خطا فراخوانی می‌شوند.
 */
const errorListeners: Array<(error: ZenithError) => void> = [];

/**
 * ثبت یک callback برای خطاها.
 *
 * @param callback تابعی که روی هر خطا فراخوانی شود.
 * @returns تابع unsubscribe.
 */
export function onError(callback: (error: ZenithError) => void): () => void {
  errorListeners.push(callback);
  return () => {
    const idx = errorListeners.indexOf(callback);
    if (idx >= 0) errorListeners.splice(idx, 1);
  };
}

/**
 * BUG-EB-01: گزارش یک خطا به Error Boundary.
 *
 * این تابع:
 *   1) errorSignal را آپدیت می‌کند.
 *   2) تمام listeners را فراخوانی می‌کند.
 *   3) خطا را در console چاپ می‌کند (اگر در development mode باشد).
 *
 * BUG-EB-01: اکنون `unknown` می‌پذیرد و به طور خودکار به `ZenithError`
 * تبدیل می‌کند. این از crash در صورت دریافت مقدار غیر Error جلوگیری می‌کند.
 *
 * @param error   شیء خطا (هر نوعی).
 * @param source  محل خطا.
 * @param context اطلاعات اضافی.
 */
export function reportError(
  error: unknown,
  source: string,
  context?: { expression?: string; element?: HTMLElement },
): void {
  const zenithError: ZenithError = {
    message: error instanceof Error ? error.message : String(error),
    error: error instanceof Error ? error : new Error(String(error)),
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
    } catch (err) {
      // خطا در listener نباید کل سیستم را خراب کند.
      console.error('[Zenith Error Boundary] Error in error listener:', err);
    }
  }

  // در development mode، خطا را در console چاپ کن.
  if (typeof globalThis !== 'undefined' && (globalThis as any).__ZENITH_DEV__ !== false) {
    console.error(`[Zenith] Error in ${source}:`, error instanceof Error ? error.message : String(error), {
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
export function clearError(): void {
  errorSignal.set(null);
}

/**
 * پاکسازی کامل Error Boundary (برای تست‌ها).
 */
export function clearErrorBoundary(): void {
  errorSignal.set(null);
  errorListeners.length = 0;
}
