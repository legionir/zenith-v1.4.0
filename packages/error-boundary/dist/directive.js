// packages/error-boundary/src/directive.ts
//
// دایرکتیو zen-error — Error Boundary محلی.
//
// سینتکس:
//   <div zen-error>
//     <!-- محتوای اصلی که ممکن است خطا دهد -->
//     <span zen-text="$user.name"></span>
//     <template zen-fallback>
//       <p style="color: red;">خطا در نمایش محتوا</p>
//     </template>
//   </div>
//
// اگر Expression داخل این boundary خطا دهد:
//   1) خطا به global handler گزارش می‌شود.
//   2) fallback UI (محتوای داخل <template zen-fallback>) نمایش داده می‌دهد.
//   3) محتوای اصلی پنهان می‌شود.
//
// نکته: این دایرکتیو به‌صورت local boundary عمل می‌کند. برای global error
// handling، از onError() و errorSignal استفاده کنید.
import { clearError, onError } from './boundary.js';
/**
 * پردازش دایرکتیو zen-error.
 *
 * @param el              عنصری که zen-error روی آن است.
 * @param processChildren callback برای walk فرزندان.
 * @param disposes        آرایه‌ی dispose functions.
 */
export function processErrorBoundary(el, processChildren, disposes) {
    // ── ۱. پیدا کردن fallback template ──
    const fallbackTemplate = el.querySelector(':scope > template[zen-fallback]');
    let fallbackContent = '<div style="color: red; padding: 8px;">⚠️ خطایی رخ داد</div>';
    if (fallbackTemplate) {
        fallbackContent = fallbackTemplate.innerHTML;
        fallbackTemplate.remove();
    }
    // ذخیره fallback برای استفاده در showFallback.
    el.__zenithFallback__ = fallbackContent;
    // FIX (v1.2.7): Store original HTML (with fallback template already
    // removed) so recoverFromError can restore the boundary's content.
    el.__zenithOriginalHTML__ = el.innerHTML;
    // ── ۲. Process فرزندان ─ـ
    // فرزندان به‌صورت معمولی walk می‌شوند. اگر خطایی در Expressions رخ دهد،
    // به reportError گزارش می‌شود (توسط global error handler).
    const childDisposes = [];
    for (const child of Array.from(el.children)) {
        processChildren(child, childDisposes);
    }
    // FIX (v1.2.7): Install an onError listener scoped to this boundary.
    // When an error occurs whose element is within this boundary's subtree,
    // dispose the children and show the fallback UI. Without this, errors
    // reported by child directives (zen-text, zen-bind, zen-html, actions,
    // …) bubble up to the global error handler but the boundary never
    // actually swaps in its fallback — leaving the broken UI visible.
    const unsubscribe = onError((zenithError) => {
        const errEl = zenithError.element;
        if (errEl && el.contains(errEl)) {
            // Dispose children first so their effects/observers stop firing.
            for (const d of childDisposes) {
                try {
                    d();
                }
                catch (err) {
                    console.error('[Zenith Error Boundary] Error during dispose:', err);
                }
            }
            childDisposes.length = 0;
            // Swap in the fallback UI.
            showFallback(el, fallbackContent);
        }
    });
    // ─ـ ۳. ثبت dispose ─ـ
    disposes.push(() => {
        unsubscribe();
        for (const d of childDisposes) {
            try {
                d();
            }
            catch (err) {
                console.error('[Zenith Error Boundary] Error during dispose:', err);
            }
        }
        childDisposes.length = 0;
    });
}
/**
 * نمایش fallback UI در یک element.
 *
 * @param el       عنصر هدف.
 * @param fallback محتوای fallback (HTML).
 */
export function showFallback(el, fallback) {
    el.innerHTML = fallback;
}
/**
 * بازیابی محتوای اصلی (پنهان کردن fallback).
 *
 * @param _el عنصر هدف (در نسخه‌ی فعلی استفاده نمی‌شود).
 */
export function recoverFromError(el) {
    clearError();
    // FIX (v1.2.7): restore the original HTML so the caller can re-run
    // the walker over the recovered content.
    const originalHTML = el.__zenithOriginalHTML__;
    if (typeof originalHTML === 'string') {
        el.innerHTML = originalHTML;
    }
}
//# sourceMappingURL=directive.js.map