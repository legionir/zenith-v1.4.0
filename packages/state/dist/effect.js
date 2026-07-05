// packages/state/src/effect.ts
//
// ماژول Effect: مسئول ردیابی وابستگی‌ها و اجرای مجدد توابع واکنش‌گرا.
//
// یک Effect در واقع یک "تابع جانبی" (Side Effect) است که به Signalها وابسته است.
// هر زمان که یکی از Signalهای وابسته تغییر کند، این تابع دوباره اجرا می‌شود.
//
// مثال:
//   effect(() => {
//     console.log(count.get());  // هر بار که count تغییر کند، این خط دوباره اجرا می‌شود.
//   });
//
// نکته‌ی کلیدی:
// قبل از هر اجرا، باید وابستگی‌های قبلی پاک شوند تا از "Zombie Effects"
// (افکت‌هایی که به سیگنال‌های قدیمی چسبیده‌اند) جلوگیری شود.
// همچنین، صف پاکسازی هر Effect مستقل از سایر Effectها مدیریت می‌شود
// تا در حضور چندین Effect همزمان، تداخلی پیش نیاید.
//
// ── Bug Fix #2: Priority Queue Integration ──
//
// قبلاً effect() هیچ پارامتر priority نداشت و همیشه با 'normal' صف می‌شد.
// این یعنی Priority Queue یک API منزوی بود. حالا effect() یک پارامتر
// اختیاری priority می‌پذیرد که به scheduleEffect پاس داده می‌شود.
//
// برای اتصال خودکار به event handlers، effect() همچنین اولویت را در
// تابع runEffect ذخیره می‌کند تا signal.set() بداند با چه اولویتی
// schedule کند.
import { setActiveEffect, setActiveCleanupRegistration } from './signal.js';
/**
 * Metadata که به هر Effect function ضمیمه می‌شود.
 *
 * این metadata شامل priority است که توسط signal.set() خوانده می‌شود
 * تا بداند با چه اولویتی scheduleEffect را صدا بزند.
 */
const effectPriorityMap = new WeakMap();
/**
 * اولویت پیش‌فرض فعلی برای Effectهای جدید.
 *
 * این متغیر توسط setCurrentPriority() تنظیم می‌شود و به event handlers
 * اجازه می‌دهد اولویت urgent را به‌طور خودکار به همه‌ی Effectهایی که در
 * حین اجرای آن event ساخته می‌شوند، اعمال کنند.
 *
 * مثال:
 *   setCurrentPriority('urgent');
 *   // در این block، همه‌ی effect(fn) های جدید با urgent ساخته می‌شوند.
 *   // سپس اولویت به normal برگردانده می‌شود.
 *
 * این الگو مشابه Vue's setCurrentScope است.
 */
let currentDefaultPriority = 'normal';
/**
 * تنظیم اولویت پیش‌فرض برای Effectهای جدید.
 *
 * استفاده در event handlers:
 *   import { setCurrentPriority } from '@zenith/state';
 *   setCurrentPriority('urgent');
 *   try {
 *     // ... handle event ...
 *   } finally {
 *     setCurrentPriority('normal');
 *   }
 *
 * @param priority اولویت پیش‌فرض جدید.
 * @returns اولویت قبلی (برای restore کردن).
 */
export function setCurrentPriority(priority) {
    const old = currentDefaultPriority;
    currentDefaultPriority = priority;
    return old;
}
/**
 * دریافت اولویت پیش‌فرض فعلی.
 */
export function getCurrentPriority() {
    return currentDefaultPriority;
}
/**
 * ساخت یک Effect واکنش‌گرا.
 *
 * این تابع بلافاصله fn را اجرا می‌کند تا وابستگی‌های اولیه ثبت شوند،
 * و یک تابع Dispose برمی‌گرداند که برای از بین بردن Effect استفاده می‌شود.
 *
 * @param fn تابعی که باید واکنش‌گرا شود.
 * @param priority اولویت Effect (پیش‌فرض: 'normal').
 *                 'urgent' — قبل از رندر بعدی (state حیاتی، navigation)
 *                 'normal' — آپدیت DOM معمولی
 *                 'idle'   — analytics، logging، pre-render
 * @returns تابع Dispose برای پاکسازی کامل.
 */
export function effect(fn, priority) {
    // اگر priority صریحاً مشخص نشده، از currentDefaultPriority استفاده کن.
    // این به event handlers اجازه می‌دهد با setCurrentPriority('urgent')
    // اولویت urgent را به همه‌ی Effectهای جدید اعمال کنند.
    const actualPriority = priority ?? currentDefaultPriority;
    /**
     * صف پاکسازی اختصاصی این Effect.
     */
    let cleanupQueue = [];
    /**
     * تابع داخلی که اجرای واقعی Effect را بر عهده دارد.
     */
    const runEffect = () => {
        // ۱. پاکسازی وابستگی‌های قبلی
        cleanupQueue.forEach(cleanup => cleanup());
        cleanupQueue = [];
        // ۲. تنظیم Effect فعلی به عنوان activeEffect
        setActiveEffect(runEffect);
        // ۳. تنظیم مکانیزم ثبت Cleanup
        setActiveCleanupRegistration(cleanup => {
            cleanupQueue.push(cleanup);
        });
        try {
            fn();
        }
        catch (err) {
            // FIX (v1.2.4): If `fn()` throws partway through, run any cleanups that
            // were registered during the partial execution (e.g. via onCleanup
            // inside the effect body). Without this, those cleanups would leak —
            // they were pushed onto `cleanupQueue` but the next run would clear
            // the queue (running them) only if the effect re-ran, and a thrown
            // error typically takes the effect out of the reactive graph.
            cleanupQueue.forEach(cleanup => {
                try { cleanup(); } catch { /* ignore cleanup errors during error path */ }
            });
            cleanupQueue = [];
            throw err;
        }
        finally {
            setActiveEffect(null);
            setActiveCleanupRegistration(null);
        }
    };
    // ── Bug Fix #2: ذخیره‌ی priority روی runEffect ──
    // این metadata توسط signal.set() خوانده می‌شود تا scheduleEffect
    // را با اولویت درست صدا بزند.
    effectPriorityMap.set(runEffect, actualPriority);
    // ── اجرای اولیه برای ثبت وابستگی‌ها ──
    runEffect();
    /**
     * تابع Dispose.
     */
    return () => {
        cleanupQueue.forEach(cleanup => cleanup());
        cleanupQueue = [];
        effectPriorityMap.delete(runEffect);
    };
}
/**
 * دریافت priority یک Effect.
 *
 * این تابع توسط signal.set() استفاده می‌شود تا بداند با چه اولویتی
 * scheduleEffect را صدا بزند. اگر Effect اولویت مشخصی نداشته باشد،
 * 'normal' برمی‌گرداند.
 *
 * @internal این تابع فقط برای استفاده‌ی داخلی signal.ts است.
 */
export function getEffectPriority(effectFn) {
    return effectPriorityMap.get(effectFn) ?? 'normal';
}
/**
 * اجرای لیستی از Effectها.
 *
 * نکته: ابتدا یک کپی از Set می‌گیریم چون ممکن است در حین اجرای یک Effect،
 * Effectهای جدیدی به subscribers اضافه یا حذف شوند.
 *
 * @param effects لیست Effectهایی که باید اجرا شوند.
 * @deprecated این تابع فقط برای backward compatibility نگه داشته شده.
 *             در فاز ۷، signal.set() از scheduleEffect استفاده می‌کند.
 */
export function triggerEffects(effects) {
    const toRun = [...effects];
    toRun.forEach(effect => effect());
}
//# sourceMappingURL=effect.js.map