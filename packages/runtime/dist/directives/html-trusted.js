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
// ── چرا این دایرکتیو اضافه شد؟ ──
//   مرور معماری v0.2.0 اشاره کرد که zen-html یک XSS bug داشت و باید «همیشه
//   مشکوک» فرض شود. راه‌حل:
//     - zen-html       = همیشه sanitize می‌شود (مسیر پیش‌فرض و ایمن).
//     - zen-html-trusted = escape hatch صریح و قابل‌حسابرسی برای محتوای Trusted.
//   این جداسازی به تیم‌های امنیتی اجازه می‌دهد با grep کردن `zen-html-trusted`
//   تمام escape hatch ها را در codebase پیدا کنند — به‌جای اینکه توسعه‌دهنده
//   بتواند با `el.innerHTML = v` خام خود را مخفی کند.
//
// ── هشدار Dev ──
//   sanitizeHTMLTrusted در حالت Development یک `console.warn` پرسر و صدا چاپ
//   می‌کند. این عمدی است — visibility بالا برای audit ارزشمند است. در
//   Production، `globalThis.__ZENITH_DEV__ = false` قرار دهید تا هشدار خاموش
//   شود.
//
// ── Memory Leak Prevention ──
//   این تابع یک Dispose برمی‌گرداند تا walker بتواند آن را در unmount
//   (مثلاً در zen-if=false) فراخوانی کند. این کار از Memory Leak جلوگیری
//   می‌کند — مشابه processHtml.
import { effect } from '@zenith/state';
// FEATURE (v1.0.0): compileExpression — compile-once برای Hot Path.
import { compileExpression } from '@zenith/expressions';
import { sanitizeHTMLTrusted } from '@zenith/security';
import { reportError } from '@zenith/error-boundary';
/**
 * پردازش دایرکتیو zen-html-trusted روی یک عنصر.
 *
 * این تابع:
 *   1) Expression را در context ارزیابی می‌کند.
 *   2) مقدار را به رشته تبدیل می‌کند.
 *   3) رشته را به‌صورت مستقیم (بدون پاکسازی) در innerHTML قرار می‌دهد.
 *      — فقط از طریق sanitizeHTMLTrusted عبور می‌کند که یک Identity Function
 *      است و در Dev یک console.warn چاپ می‌کند.
 *
 * هر بار که مقدار Expression تغییر کند، این فرآیند دوباره انجام می‌شود.
 *
 * @param el      عنصر HTML.
 * @param expr    رشته‌ی Expression.
 * @param context آبجکت Context (برای Expression Engine).
 * @returns تابع Dispose برای پاکسازی Effect.
 */
export function processHtmlTrusted(el, expr, context) {
    // FEATURE (v1.0.0): compile-once — expr فقط یک‌بار parse می‌شود.
    const evalFn = compileExpression(expr);
    // FEATURE (v1.0.0): Property Diffing — اگر مقدار با قبلی برابر است، skip کن.
    let prevValue = undefined;
    let isFirstRun = true;
    const dispose = effect(() => {
        let value;
        try {
            value = evalFn(context);
        }
        catch (err) {
            reportError(err, 'expression', { expression: expr, element: el });
            return;
        }
        // FEATURE (v1.0.0): Property Diffing
        if (!isFirstRun && prevValue === value)
            return;
        prevValue = value;
        isFirstRun = false;
        // null و undefined به رشته‌ی خالی تبدیل می‌شوند.
        if (value === null || value === undefined) {
            el.innerHTML = '';
            return;
        }
        // تبدیل به رشته.
        const rawHtml = String(value);
        // ── نشانه‌گذاری صریح محتوای Trusted ──
        const trustedHtml = sanitizeHTMLTrusted(rawHtml);
        // ── تزریق مستقیم به DOM ──
        el.innerHTML = trustedHtml;
    });
    return dispose;
}
//# sourceMappingURL=html-trusted.js.map
