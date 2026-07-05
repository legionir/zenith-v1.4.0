// packages/runtime/src/directives/text.ts
//
// دایرکتیو zen-text: ساده‌ترین رندر DOM.
//
// کاربرد:
//   <span zen-text="$user.name"></span>
//   <h1 zen-text="'Welcome, ' + $user.name"></h1>
//
// وقتی مقدار Expression تغییر کند، textContent عنصر به‌روزرسانی می‌شود.
//
// نکته‌ی مهم: این تابع یک Dispose برمی‌گرداند تا walker بتواند
// آن را در unmount (مثلاً در zen-if=false) فراخوانی کند.
// این کار از Memory Leak جلوگیری می‌کند.
import { effect } from '@zenith/state';
// FEATURE (v1.0.0): compileExpression — AST یک‌بار parse می‌شود و در closure ذخیره
// می‌شود. در هر re-runِ Effect، فقط evaluate(ast, ctx) اجرا می‌شود (بدون cache.has/get/delete/set).
import { compileExpression } from '@zenith/expressions';
import { reportError } from '@zenith/error-boundary';
/**
 * پردازش دایرکتیو zen-text روی یک عنصر.
 *
 * @param el عنصر HTML.
 * @param expr رشته‌ی Expression.
 * @param context آبجکت Context (برای Expression Engine).
 * @returns تابع Dispose برای پاکسازی.
 */
export function processText(el, expr, context) {
    // FEATURE (v1.0.0): compile-once — expr فقط یک‌بار parse/validate می‌شود.
    // closure evalFn فقط evaluate(ast, context) را اجرا می‌کند که در Hot Path (Effect
    // re-runs) صفر Map operation دارد.
    const evalFn = compileExpression(expr);
    const dispose = effect(() => {
        try {
            const value = evalFn(context);
            el.textContent = value === null || value === undefined ? '' : String(value);
        }
        catch (err) {
            // Report to error boundary (IMPROVE 12).
            const available = Object.keys(context).filter(k => k.startsWith('$')).join(', ');
            reportError(new Error(`[zen-text] Expression "${expr}" failed\n  Element: <${el.tagName.toLowerCase()}>\n  Reason: ${err.message}\n  Available state: ${available || 'none'}`), 'expression', { expression: expr, element: el });
            el.textContent = '';
        }
    });
    return dispose;
}
//# sourceMappingURL=text.js.map