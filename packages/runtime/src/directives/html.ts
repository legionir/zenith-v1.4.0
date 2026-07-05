// packages/runtime/src/directives/html.ts
//
// دایرکتیو zen-html: رندر HTML واقعی (با Sanitizer).
//
// کاربرد:
//   <div zen-html="$userComment"></div>
//   <span zen-html="$richText"></span>
//
// ── تفاوت با zen-text ──
//   - zen-text: مقدار را به‌صورت متن ساده (textContent) رندر می‌کند. ایمن.
//   - zen-html: مقدار را به‌صورت HTML (innerHTML) رندر می‌کند. نیاز به Sanitizer دارد.
//
// ── امنیت ──
//   zen-html **همیشه** قبل از تزریق به DOM، مقدار را از Sanitizer عبور می‌دهد.
//   این کار از حملات XSS جلوگیری می‌کند. حتی اگر داده‌ی ورودی از دیتابیس
//   آمده باشد (و احتمالاً قبلاً sanitize شده باشد)، دوباره sanitize می‌شود
//   (Defense in Depth).
//
// ── چرا همیشه sanitize؟ ──
//   ممکن است داده از منابع مختلفی آمده باشد:
//     - ورودی کاربر (که ممکن است هکر باشد)
//     - API خارجی (که ممکن است آلوده باشد)
//     - دیتابیس (که ممکن است قبلاً آلوده شده باشد)
//   همیشه sanitize کردن، اطمینان می‌دهد که حتی اگر یکی از این منابع آلوده
//   باشد، DOM شما در امان است.
//
// ── Memory Leak Prevention ──
//   این تابع یک Dispose برمی‌گرداند تا walker بتواند آن را در unmount
//   (مثلاً در zen-if=false) فراخوانی کند. این کار از Memory Leak جلوگیری می‌کند.

import { effect } from '@zenith/state';
// FEATURE (v1.0.0): compileExpression — compile-once برای Hot Path.
import { compileExpression } from '@zenith/expressions';
import { sanitizeHTML } from '@zenith/security';
import { reportError } from '@zenith/error-boundary';

/**
 * پردازش دایرکتیو zen-html روی یک عنصر.
 *
 * این تابع:
 *   1) Expression را در context ارزیابی می‌کند.
 *   2) مقدار را به رشته تبدیل می‌کند.
 *   3) رشته را با Sanitizer پاکسازی می‌کند.
 *   4) HTML پاکسازی‌شده را در innerHTML عنصر قرار می‌دهد.
 *
 * هر بار که مقدار Expression تغییر کند، این فرآیند دوباره انجام می‌شود.
 *
 * @param el      عنصر HTML.
 * @param expr    رشته‌ی Expression.
 * @param context آبجکت Context (برای Expression Engine).
 * @returns تابع Dispose برای پاکسازی Effect.
 */
export function processHtml(
  el: HTMLElement,
  expr: string,
  context: Record<string, any>,
): () => void {
  // FEATURE (v1.0.0): compile-once — expr فقط یک‌بار parse می‌شود.
  const evalFn = compileExpression(expr);
  // FEATURE (v1.0.0): Property Diffing — اگر مقدار با قبلی برابر است، skip کن.
  // این کار از sanitizeHTML و innerHTML غیرضروری جلوگیری می‌کند.
  let prevValue: any = undefined;
  let isFirstRun = true;

  const dispose = effect(() => {
    let value: any;
    try { value = evalFn(context); } catch (err) { reportError(err as Error, 'expression', { expression: expr, element: el }); return; }

    // FEATURE (v1.0.0): Property Diffing
    if (!isFirstRun && prevValue === value) return;
    prevValue = value;
    isFirstRun = false;

    // null و undefined به رشته‌ی خالی تبدیل می‌شوند.
    if (value === null || value === undefined) {
      el.innerHTML = '';
      return;
    }

    // تبدیل به رشته.
    const dirtyHtml = String(value);

    // ── پاکسازی توسط Security Layer ──
    const cleanHtml = sanitizeHTML(dirtyHtml);

    // ── تزریق ایمن به DOM ──
    el.innerHTML = cleanHtml;
  });

  return dispose;
}
