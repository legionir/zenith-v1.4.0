/**
 * کلاس Signal: قلب تپنده‌ی سیستم Reactivity.
 *
 * هر Signal دو مسئولیت اصلی دارد:
 *   1) هنگام get(): اگر Effect فعالی وجود داشت، خودش را به عنوان وابستگی آن ثبت کند
 *      و یک Cleanup ثبت کند تا در re-tracking یا dispose، وابستگی قطع شود.
 *   2) هنگام set(): اگر مقدار واقعاً تغییر کرد، به تمام Effectهای وابسته اطلاع دهد.
 */
export declare class Signal<T> {
    private _value;
    private _subscribers;
    constructor(initialValue: T);
    /**
     * خواندن مقدار فعلی سیگنال.
     *
     * اگر در لحظه‌ی فراخوانی، یک Effect در حال اجرا باشد (activeEffect !== null):
     *   1) آن Effect به لیست subscribers این سیگنال اضافه می‌شود.
     *   2) یک Cleanup ثبت می‌شود تا در re-tracking یا dispose، Effect از subscribers حذف شود.
     * به این مکانیزم "Dependency Tracking" یا "ردیابی وابستگی" می‌گوییم.
     */
    get(): T;
    /**
     * مقداردهی جدید به سیگنال.
     *
     * - اگر مقدار جدید با مقدار قبلی برابر بود (با Object.is)، هیچ کاری انجام نمی‌شود.
     * - Effectهای وابسته به Scheduler سپرده می‌شوند تا در Microtask بعدی
     *   به‌صورت Batch اجرا شوند (فاز ۷).
     *
     * نکته‌ی مهم (فاز ۷):
     *   به‌جای اجرای مستقیم Effectها، آن‌ها را schedule می‌کنیم. این یعنی
     *   اگر در یک تابع چندین Signal را set کنید، Effectها فقط یک بار در
     *   پایان تیک اجرا می‌شوند — نه به ازای هر set.
     *
     *   برای اجرای اجباری و Synchronous، می‌توان از `flushSync()` استفاده کرد:
     *     import { flushSync } from '@zenith/scheduler';
     *     signal.set(1);
     *     flushSync();  // Effectها همین‌جا اجرا می‌شوند.
     */
    set(newValue: T): void;
    /**
     * حذف یک Effect از لیست subscribers (پاکسازی حافظه).
     *
     * این متد زمانی فراخوانی می‌شود که یک Effect از بین می‌رود یا
     * وابستگی‌هایش تغییر می‌کند و نیاز به re-tracking دارد.
     */
    removeSubscriber(effect: Function): void;
    /**
     * تعداد subscribers فعلی.
     *
     * @internal این getter فقط برای DevTools و تست‌های داخلی استفاده می‌شود.
     * کاربران عادی نباید به آن تکیه کنند چون ممکن است در نسخه‌های بعدی تغییر کند.
     * برای بازرسی State، از `@zenith/devtools` استفاده کنید.
     */
    get subscriberCount(): number;
}
/**
 * تابع کمکی برای ساخت سیگنال با API روان‌تر.
 *
 * استفاده:
 *   const count = signal(0);
 *   count.get();   // خواندن
 *   count.set(5);  // مقداردهی
 */
export declare function signal<T>(initialValue: T): Signal<T>;
export declare function setActiveEffect(effect: Function | null): void;
export declare function getActiveEffect(): Function | null;
type CleanupFn = () => void;
export declare function registerCleanup(cleanup: CleanupFn): void;
export declare function setActiveCleanupRegistration(register: ((cleanup: CleanupFn) => void) | null): void;
export {};
//# sourceMappingURL=signal.d.ts.map