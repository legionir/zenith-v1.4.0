/**
 * پردازش دایرکتیو zen-error.
 *
 * @param el              عنصری که zen-error روی آن است.
 * @param processChildren callback برای walk فرزندان.
 * @param disposes        آرایه‌ی dispose functions.
 */
export declare function processErrorBoundary(el: HTMLElement, processChildren: (node: HTMLElement, disposes: (() => void)[]) => void, disposes: (() => void)[]): void;
/**
 * نمایش fallback UI در یک element.
 *
 * @param el       عنصر هدف.
 * @param fallback محتوای fallback (HTML).
 */
export declare function showFallback(el: HTMLElement, fallback: string): void;
/**
 * بازیابی محتوای اصلی (پنهان کردن fallback).
 *
 * @param _el عنصر هدف (در نسخه‌ی فعلی استفاده نمی‌شود).
 */
export declare function recoverFromError(_el: HTMLElement): void;
//# sourceMappingURL=directive.d.ts.map