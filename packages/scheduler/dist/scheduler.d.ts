/**
 * سطح اولویت یک Effect.
 *
 * اعداد به‌صورت صعودی به معنای اولویت بالاتر هستند تا sort ساده کار کند.
 */
export type Priority = 'idle' | 'normal' | 'urgent';
/**
 * ثبت یک Effect در صف برای اجرا در microtask بعدی.
 *
 * این تابع:
 *   1) Effect را به صف اضافه می‌کند (Map از تکرار جلوگیری می‌کند).
 *   2) اگر هنوز microtask ثبت نشده، یکی ثبت می‌کند.
 *
 * اگر در حین flush (isFlushing=true) فراخوانی شود:
 *   - Effect به صف اضافه می‌شود.
 *   - microtask جدید ثبت نمی‌شود (چون flush فعلی آن را اجرا خواهد کرد).
 *
 * @param effectFn تابع Effect که باید اجرا شود.
 * @param priority اولویت Effect (پیش‌فرض: normal).
 *                 'urgent' = قبل از رندر بعدی (state حیاتی، navigation)
 *                 'normal' = آپدیت DOM معمولی
 *                 'idle'   = analytics، logging، pre-render
 */
export declare function scheduleEffect(effectFn: Function, priority?: Priority): void;
/**
 * اجرای اجباری و Synchronous صف.
 *
 * این تابع تمام Effectهای موجود در صف را بلافاصله (بدون انتظار برای microtask)
 * اجرا می‌کند.
 *
 * کاربردها:
 *   - در Event Handlers: برای اطمینان از آپدیت DOM قبل از اتمام رویداد
 *     (مهم برای Event Bubbling و prevented default).
 *   - در تست‌ها: برای sync کردن DOM بعد از state.set().
 *   - در SSR: برای اطمینان از رندر کامل قبل از serialize.
 *
 * نکته: اگر در حین flush فراخوانی شود، نادیده گرفته می‌شود (re-entrancy safe).
 */
export declare function flushSync(): void;
/**
 * بررسی اینکه آیا Effectهای در انتظار وجود دارد.
 *
 * مفید برای:
 *   - تست‌ها: بررسی اینکه آیا batching درست کار می‌کند.
 *   - Debug: نمایش وضعیت Scheduler.
 */
export declare function hasPendingEffects(): boolean;
/**
 * تعداد Effectهای در انتظار (فقط برای Debug).
 */
export declare function pendingEffectCount(): number;
/**
 * تعداد Effectهای در انتظار در یک اولویت مشخص (برای Debug و تست).
 */
export declare function pendingEffectsByPriority(priority: Priority): number;
/**
 * پاکسازی کامل Scheduler (فقط برای تست‌ها).
 *
 * ⚠️ در Production استفاده نکنید — این عملیات Effectهای معلق را دور می‌اندازد.
 */
export declare function clearScheduler(): void;
//# sourceMappingURL=scheduler.d.ts.map