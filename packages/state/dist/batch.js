// packages/state/src/batch.ts
//
// ماژول Batch — نسخه‌ی فاز ۷ (Compatibility Layer).
//
// ── تاریخچه ──
// در فاز ۱، این ماژول batching دستی را پیاده‌سازی می‌کرد: تمام set()های
// داخل fn در یک صف جمع می‌شدند و Effectها فقط یک‌بار در پایان اجرا می‌شدند.
//
// در فاز ۷، Scheduler (با استفاده از Microtask) این کار را به‌طور خودکار
// انجام می‌دهد. بنابراین `batch()` دیگر لازم نیست — اما برای حفظ Backward
// Compatibility با کدهای موجود، آن را به‌عنوان یک no-op نگه می‌داریم.
//
// رفتار فعلی:
//   - `batch(fn)` فقط fn را اجرا می‌کند.
//   - Effectها به‌طور خودکار در پایان تیک (توسط Scheduler) اجرا می‌شوند.
//   - اگر نیاز به اجرای Synchronous دارید، از `flushSync()` استفاده کنید:
//       import { flushSync } from '@zenith/scheduler';
//       batch(() => { signal.set(1); signal.set(2); });
//       flushSync();  // Effectها همین‌جا اجرا می‌شوند.
//
// توصیه:
//   در کد جدید، از `batch()` استفاده نکنید. Scheduler به‌طور خودکار
//   batching را انجام می‌دهد.
/**
 * اجرای یک تابع در حالت Batch.
 *
 * @deprecated از فاز ۷ به بعد، این تابع یک no-op است. Scheduler به‌طور خودکار
 * batching را از طریق Microtask انجام می‌دهد. استفاده از `batch()` دیگر لازم
 * نیست و می‌توانید آن را حذف کنید.
 *
 * برای backward compatibility نگه‌داشته شده است. کدهای قدیمی که از `batch()`
 * استفاده می‌کنند، بدون تغییر کار خواهند کرد — اما دیگر نیازی به آن نیست.
 *
 * در حالت Development، یک `console.warn` چاپ می‌شود تا به توسعه‌دهنده اطلاع
 * داده شود که استفاده از `batch()` غیرضروری است.
 *
 * @param fn تابعی که باید اجرا شود.
 */
let batchWarningShown = false;
export function batch(fn) {
    if (!batchWarningShown && typeof globalThis !== 'undefined' && globalThis.__ZENITH_DEV__ !== false) {
        console.warn('[Zenith] batch() is deprecated since Phase 7. ' +
            'Scheduler handles batching automatically. You can safely remove batch() calls.');
        batchWarningShown = true;
    }
    fn();
}
/**
 * آیا در حال حاضر در حالت batch هستیم؟
 *
 * ⚠️ در فاز ۷، همیشه false برمی‌گرداند چون Scheduler batching را مدیریت می‌کند.
 *
 * این تابع فقط برای backward compatibility نگه‌داشته شده است.
 */
export function isBatching() {
    // Scheduler همیشه batching را مدیریت می‌کند.
    // این تابع همیشه false برمی‌گرداند.
    return false;
}
/**
 * افزودن یک Effect به صف batch.
 *
 * ⚠️ در فاز ۷، این تابع یک no-op است. Scheduler به‌طور خودکار Effectها را
 * در صف می‌گذارد.
 *
 * این تابع فقط برای backward compatibility نگه‌داشته شده است.
 */
export function addEffectToBatch(_effect) {
    // No-op: Scheduler به‌طور خودکار Effectها را schedule می‌کند.
    // پارامتر `_effect` با underscore شروع می‌شود تا نشان دهیم عمداً استفاده نمی‌شود.
}
//# sourceMappingURL=batch.js.map