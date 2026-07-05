// packages/runtime/src/directives/intersection.ts
//
// FEATURE (v0.5.0): zen-intersection — اجرای callback وقتی عنصر وارد viewport می‌شود.
//
// کاربرد:
//   <img zen-intersection="$loadImage" src="placeholder.jpg" />
//   <div zen-intersection="$logImpression">Ad content</div>
//   <section zen-intersection="$loadComments">Comments will load when you scroll here</section>
//
// این دایرکتیو از IntersectionObserver بومی browser استفاده می‌کند تا
// کارآمدترین راه ممکن برای lazy-loading و infinite scroll فراهم کند.
// browser خودش تشخیص می‌دهد چه زمانی عنصر وارد viewport می‌شود (بدون
// scroll event listener که performance بدی دارد).
//
// ── نحوه کار ──
//
//   1) یک IntersectionObserver با { threshold: 0.1 } می‌سازیم.
//      threshold: 0.1 یعنی 10% از عنصر باید visible شود تا callback صدا بخورد.
//   2) callbackExpr در context ارزیابی می‌شود. این expression باید به یک
//      تابع (در State) ارجاع دهد. مثلاً $loadImage که state.loadImage یک
//      تابع است.
//   3) وقتی IntersectionObserver صدا می‌زند، اگر عنصر isIntersecting باشد،
//      callback فراخوانی می‌شود. (نکته: callback فقط یک‌بار صدا می‌خورد —
//      برای جلوگیری از spam، observer.disconnect() می‌کنیم.)
//   4) observer.observe(el) را فراخوانی می‌کنیم.
//
// ── SSR Safety ──
//
//   اگر IntersectionObserver تعریف نشده باشد (مثلاً در SSR یا محیط‌های
//   قدیمی)، این دایرکتیو no-op می‌شود و یک warning چاپ می‌کند. این
//   تضمین می‌کند که کد در server-side rendering خراب نمی‌شود.
//
// ── Dispose ──
//
//   در teardown، observer.disconnect() را فراخوانی می‌کنیم تا تمام
//   observationها از بین بروند و memory آزاد شود.
import { compileExpression } from '@zenith/expressions';
import { reportError } from '@zenith/error-boundary';
/**
 * پردازش دایرکتیو zen-intersection روی یک عنصر.
 *
 * @param el           عنصر HTML (که باید zen-intersection داشته باشد).
 * @param callbackExpr Expression که به یک تابع در context ارجاع می‌دهد.
 *                     مثلاً "$loadImage" که context.$loadImage یک تابع است.
 * @param context      آبجکت Context.
 * @returns تابع Dispose برای پاکسازی.
 */
export function processIntersection(el, callbackExpr, context) {
    // FEATURE (v1.0.0): compile-once — callbackExpr فقط یک‌بار parse می‌شود.
    const evalFn = compileExpression(callbackExpr);
    // ── SSR Safety Guard ──
    // اگر IntersectionObserver وجود نداشت (SSR یا محیط قدیمی)، no-op.
    if (typeof IntersectionObserver === 'undefined') {
        if (typeof console !== 'undefined' && console.warn) {
            console.warn('[Zenith zen-intersection] IntersectionObserver is not available in this environment. ' +
                'The directive will be a no-op.');
        }
        return () => { }; // no-op dispose
    }
    // ── ساخت Observer ──
    // threshold: 0.1 یعنی 10% از عنصر باید visible شود.
    // نکته: callback فقط یک‌بار صدا می‌خورد (با disconnect) برای جلوگیری از
    // spam وقتی عنصر چندین بار وارد/خارج viewport می‌شود.
    let observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting) {
                // ارزیابی callbackExpr در context.
                let callback;
                try {
                    callback = evalFn(context);
                }
                catch (err) {
                    reportError(err, 'expression', { expression: callbackExpr, element: el });
                    // اگر ارزیابی خطا داد، observer را قطع می‌کنیم تا دوباره خطا ندهد.
                    if (observer) {
                        observer.disconnect();
                        observer = null;
                    }
                    return;
                }
                // اگر callback تابع بود، فراخوانی کن.
                if (typeof callback === 'function') {
                    try {
                        callback(el);
                    }
                    catch (err) {
                        reportError(err, 'directive', { expression: callbackExpr, element: el });
                    }
                }
                else if (typeof console !== 'undefined' && console.warn) {
                    console.warn(`[Zenith zen-intersection] Expression "${callbackExpr}" did not resolve to a function (got ${typeof callback}).`);
                }
                // فقط یک‌بار صدا بخور — observer را قطع کن.
                if (observer) {
                    observer.disconnect();
                    observer = null;
                }
                break; // فقط اولین entry مهم است.
            }
        }
    }, { threshold: 0.1 });
    // ── شروع observation ──
    observer.observe(el);
    // ── Dispose ──
    // observer.disconnect() تمام observationها را پاک می‌کند و memory آزاد می‌کند.
    return () => {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
    };
}
//# sourceMappingURL=intersection.js.map
