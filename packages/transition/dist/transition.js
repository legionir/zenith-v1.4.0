// packages/transition/src/transition.ts
//
// Transition/Animation — قابلیت غایب فاز ۹ (فاز ۱۱).
//
// این ماژول enter/leave animations را برای zen-if و zen-for فراهم می‌کند.
//
// ── سینتکس ──
//   <div zen-if="$show" zen-transition="fade">
//     محتوا
//   </div>
//
// ── نحوه کار ─ـ
// وقتی zen-if=true (enter):
//   1) عنصر به DOM اضافه می‌شود.
//   2) کلاس `zen-enter-from` اضافه می‌شود.
//   3) در فریم بعدی، `zen-enter-from` حذف و `zen-enter-to` اضافه می‌شود.
//   4) بعد از پایان transition، `zen-enter-to` حذف می‌شود.
//
// وقتی zen-if=false (leave):
//   1) کلاس `zen-leave-from` اضافه می‌شود.
//   2) در فریم بعدی، `zen-leave-from` حذف و `zen-leave-to` اضافه می‌شود.
//   3) بعد از پایان transition، عنصر از DOM حذف می‌شود.
//
// ── CSS ──
// کاربر باید CSS های زیر را تعریف کند:
//   .fade.zen-enter-from { opacity: 0; }
//   .fade.zen-enter-to { opacity: 1; transition: opacity 0.3s; }
//   .fade.zen-leave-from { opacity: 1; }
//   .fade.zen-leave-to { opacity: 0; transition: opacity 0.3s; }
/**
 * نام کلاس‌های transition.
 */
const ENTER_FROM = 'zen-enter-from';
const ENTER_TO = 'zen-enter-to';
const LEAVE_FROM = 'zen-leave-from';
const LEAVE_TO = 'zen-leave-to';
const ENTER_ACTIVE = 'zen-enter-active';
const LEAVE_ACTIVE = 'zen-leave-active';
/**
 * پشتیبانی از transition در enter (mount).
 *
 * BUG FIX (BUG-01/05): تابع حالا یک cancel function برمی‌گرداند تا
 * راف‌ها/تایمر/transitionend listener در حین toggle سریع یا Zen.stop
 * نشت نکنند.
 *
 * @param el       عنصری که به DOM اضافه شده.
 * @param name     نام transition (مثل 'fade'). به‌عنوان کلاس CSS اضافه می‌شود.
 * @param duration مدت زمان transition به میلی‌ثانیه (پیش‌فرض: 300).
 * @param onComplete callback که بعد از پایان transition فراخوانی می‌شود.
 * @returns تابع cancel.
 */
export function enterTransition(el, name, duration = 300, onComplete) {
    // اضافه کردن کلاس‌های اولیه (idempotent — ممکن است قبلاً ست شده باشند).
    el.classList.add(name);
    el.classList.add(ENTER_FROM);
    el.classList.add(ENTER_ACTIVE);
    // State برای cancel tracking.
    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;
    let timer = null;
    let onEnd = null;
    // BUG FIX (v7.0): double rAF + force reflow + transitionend.
    raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
            if (cancelled)
                return;
            // Force reflow تا حالت "from" قطعاً paint شده باشد.
            void el.getBoundingClientRect();
            el.classList.remove(ENTER_FROM);
            el.classList.add(ENTER_TO);
            // تشخیص پایان با transitionend + setTimeout fallback.
            let done = false;
            const finish = () => {
                if (done || cancelled)
                    return;
                done = true;
                if (onEnd)
                    el.removeEventListener('transitionend', onEnd);
                if (timer)
                    clearTimeout(timer);
                timer = null;
                el.classList.remove(ENTER_TO);
                el.classList.remove(ENTER_ACTIVE);
                if (!cancelled && onComplete)
                    onComplete();
            };
            onEnd = (e) => {
                if (e.target === el)
                    finish();
            };
            el.addEventListener('transitionend', onEnd);
            timer = setTimeout(finish, duration + 50);
        });
    });
    // برگرداندن تابع cancel.
    return () => {
        cancelled = true;
        if (raf1)
            cancelAnimationFrame(raf1);
        if (raf2)
            cancelAnimationFrame(raf2);
        raf1 = 0;
        raf2 = 0;
        if (timer)
            clearTimeout(timer);
        timer = null;
        if (onEnd)
            el.removeEventListener('transitionend', onEnd);
        el.classList.remove(name, ENTER_FROM, ENTER_TO, ENTER_ACTIVE);
    };
}
/**
 * پشتیبانی از transition در leave (unmount).
 *
 * BUG FIX (BUG-01/05): تابع حالا یک cancel function برمی‌گرداند.
 *
 * @param el       عنصری که قرار است از DOM حذف شود.
 * @param name     نام transition.
 * @param duration مدت زمان transition به میلی‌ثانیه.
 * @param onComplete callback که بعد از پایان transition فراخوانی می‌شود
 *                   (معمولاً عنصر را از DOM حذف می‌کند).
 * @returns تابع cancel.
 */
export function leaveTransition(el, name, duration = 300, onComplete) {
    // اضافه کردن کلاس‌های اولیه.
    el.classList.add(name);
    el.classList.add(LEAVE_FROM);
    el.classList.add(LEAVE_ACTIVE);
    // State برای cancel tracking.
    let cancelled = false;
    let raf1 = 0;
    let raf2 = 0;
    let timer = null;
    let onEnd = null;
    // BUG FIX (v7.0): double rAF + force reflow + transitionend.
    raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(() => {
            if (cancelled)
                return;
            void el.getBoundingClientRect();
            el.classList.remove(LEAVE_FROM);
            el.classList.add(LEAVE_TO);
            let done = false;
            const finish = () => {
                if (done || cancelled)
                    return;
                done = true;
                if (onEnd)
                    el.removeEventListener('transitionend', onEnd);
                if (timer)
                    clearTimeout(timer);
                timer = null;
                el.classList.remove(LEAVE_TO);
                el.classList.remove(LEAVE_ACTIVE);
                if (!cancelled && onComplete)
                    onComplete();
            };
            onEnd = (e) => {
                if (e.target === el)
                    finish();
            };
            el.addEventListener('transitionend', onEnd);
            timer = setTimeout(finish, duration + 50);
        });
    });
    // برگرداندن تابع cancel.
    return () => {
        cancelled = true;
        if (raf1)
            cancelAnimationFrame(raf1);
        if (raf2)
            cancelAnimationFrame(raf2);
        raf1 = 0;
        raf2 = 0;
        if (timer)
            clearTimeout(timer);
        timer = null;
        if (onEnd)
            el.removeEventListener('transitionend', onEnd);
        el.classList.remove(name, LEAVE_FROM, LEAVE_TO, LEAVE_ACTIVE);
    };
}
/**
 * بررسی اینکه آیا عنصر در حال حاضر در حال transition است.
 *
 * @param el عنصر.
 * @returns true اگر در حال transition است.
 */
export function isTransitioning(el) {
    return (el.classList.contains(ENTER_ACTIVE) ||
        el.classList.contains(LEAVE_ACTIVE));
}
/**
 * لغو transition فعلی (اگر در حال انجام است).
 *
 * @param el عنصر.
 */
export function cancelTransition(el) {
    el.classList.remove(ENTER_FROM, ENTER_TO, ENTER_ACTIVE);
    el.classList.remove(LEAVE_FROM, LEAVE_TO, LEAVE_ACTIVE);
}
/**
 * نام‌های پیش‌فرض transition که کاربر می‌تواند استفاده کند.
 * این‌ها فقط برای مستندسازی هستند — کاربر باید CSS مربوطه را تعریف کند.
 */
export const TRANSITION_NAMES = {
    fade: 'fade',
    slide: 'slide',
    scale: 'scale',
    slideFade: 'slide-fade',
};
//# sourceMappingURL=transition.js.map
