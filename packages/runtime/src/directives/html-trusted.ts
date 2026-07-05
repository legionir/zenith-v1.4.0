// packages/runtime/src/directives/html-trusted.ts
//
// FEATURE (v0.4.0): دایرکتیو zen-html-trusted — رندر HTML بدون Sanitizer.
//
// کاربرد:
//   <div zen-html-trusted="$serverRenderedHtml"></div>
//   <span zen-html-trusted="$cachedMarkup"></span>
//
// ── تفاوت با zen-html ──
//   - zen-html:         مقدار را همیشه از sanitizeHTML عبور می‌دهد (Defense in
//                       Depth) — حتی اگر داده از سرور خودتان آمده باشد.
//   - zen-html-trusted: مقدار را به‌صورت مستقیم در innerHTML قرار می‌دهد. هیچ
//                       پاکسازی‌ای انجام نمی‌شود. توسعه‌دهنده صراحتاً opt-in
//                       کرده که محتوا Trusted است.
//
// ── هشدار Dev ──
//   sanitizeHTMLTrusted در حالت Development یک `console.warn` پرسر و صدا چاپ
//   می‌کند. این عمدی است — visibility بالا برای audit ارزشمند است. در
//   Production، `globalThis.__ZENITH_DEV__ = false` قرار دهید تا هشدار خاموش
//   شود.

import { effect } from '@zenith/state';
// FEATURE (v1.0.0): compileExpression — compile-once برای Hot Path.
import { compileExpression } from '@zenith/expressions';
import { sanitizeHTMLTrusted } from '@zenith/security';
import { reportError } from '@zenith/error-boundary';

/**
 * پردازش دایرکتیو zen-html-trusted روی یک عنصر.
 *
 * @param el      عنصر HTML.
 * @param expr    رشته‌ی Expression.
 * @param context آبجکت Context (برای Expression Engine).
 * @returns تابع Dispose برای پاکسازی Effect.
 */
export function processHtmlTrusted(
  el: HTMLElement,
  expr: string,
  context: Record<string, any>,
): () => void {
  // FEATURE (v1.0.0): compile-once — expr فقط یک‌بار parse می‌شود.
  const evalFn = compileExpression(expr);
  // FEATURE (v1.0.0): Property Diffing — اگر مقدار با قبلی برابر است، skip کن.
  let prevValue: any = undefined;
  let isFirstRun = true;

  const dispose = effect(() => {
    let value: any;
    try {
      value = evalFn(context);
    } catch (err) {
      reportError(err as Error, 'expression', { expression: expr, element: el });
      return;
    }

    // FEATURE (v1.0.0): Property Diffing
    if (!isFirstRun && prevValue === value) return;
    prevValue = value;
    isFirstRun = false;

    if (value === null || value === undefined) {
      el.innerHTML = '';
      return;
    }
    const rawHtml = String(value);
    const trustedHtml = sanitizeHTMLTrusted(rawHtml);
    el.innerHTML = trustedHtml;
  });

  return dispose;
}
