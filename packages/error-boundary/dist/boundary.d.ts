import { type Signal } from '@zenith/state';
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
export declare const errorSignal: Signal<ZenithError | null>;
/**
 * ثبت یک callback برای خطاها.
 *
 * @param callback تابعی که روی هر خطا فراخوانی شود.
 * @returns تابع unsubscribe.
 */
export declare function onError(callback: (error: ZenithError) => void): () => void;
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
export declare function reportError(error: Error, source: string, context?: {
    expression?: string;
    element?: HTMLElement;
}): void;
/**
 * پاکسازی خطای فعلی.
 *
 * این تابع errorSignal را null می‌کند.
 */
export declare function clearError(): void;
/**
 * پاکسازی کامل Error Boundary (برای تست‌ها).
 */
export declare function clearErrorBoundary(): void;
//# sourceMappingURL=boundary.d.ts.map