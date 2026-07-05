import type { Priority } from '@zenith/scheduler';
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
export declare function setCurrentPriority(priority: Priority): Priority;
/**
 * دریافت اولویت پیش‌فرض فعلی.
 */
export declare function getCurrentPriority(): Priority;
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
export declare function effect(fn: () => void, priority?: Priority): () => void;
/**
 * دریافت priority یک Effect.
 *
 * این تابع توسط signal.set() استفاده می‌شود تا بداند با چه اولویتی
 * scheduleEffect را صدا بزند. اگر Effect اولویت مشخصی نداشته باشد،
 * 'normal' برمی‌گرداند.
 *
 * @internal این تابع فقط برای استفاده‌ی داخلی signal.ts است.
 */
export declare function getEffectPriority(effectFn: Function): Priority;
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
export declare function triggerEffects(effects: Set<Function>): void;
//# sourceMappingURL=effect.d.ts.map