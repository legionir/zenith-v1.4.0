/**
 * پشتیبانی از transition در enter (mount).
 *
 * این تابع باید بعد از اضافه شدن عنصر به DOM فراخوانی شود.
 *
 * @param el       عنصری که به DOM اضافه شده.
 * @param name     نام transition (مثل 'fade'). به‌عنوان کلاس CSS اضافه می‌شود.
 * @param duration مدت زمان transition به میلی‌ثانیه (پیش‌فرض: 300).
 * @param onComplete callback که بعد از پایان transition فراخوانی می‌شود.
 */
export declare function enterTransition(el: HTMLElement, name: string, duration?: number, onComplete?: () => void): void;
/**
 * پشتیبانی از transition در leave (unmount).
 *
 * این تابع قبل از حذف عنصر از DOM فراخوانی می‌شود. عنصر بعد از پایان
 * transition حذف می‌شود.
 *
 * @param el       عنصری که قرار است از DOM حذف شود.
 * @param name     نام transition.
 * @param duration مدت زمان transition به میلی‌ثانیه.
 * @param onComplete callback که بعد از پایان transition فراخوانی می‌شود
 *                   (معمولاً عنصر را از DOM حذف می‌کند).
 */
export declare function leaveTransition(el: HTMLElement, name: string, duration?: number, onComplete?: () => void): void;
/**
 * بررسی اینکه آیا عنصر در حال حاضر در حال transition است.
 *
 * @param el عنصر.
 * @returns true اگر در حال transition است.
 */
export declare function isTransitioning(el: HTMLElement): boolean;
/**
 * لغو transition فعلی (اگر در حال انجام است).
 *
 * @param el عنصر.
 */
export declare function cancelTransition(el: HTMLElement): void;
/**
 * نام‌های پیش‌فرض transition که کاربر می‌تواند استفاده کند.
 * این‌ها فقط برای مستندسازی هستند — کاربر باید CSS مربوطه را تعریف کند.
 */
export declare const TRANSITION_NAMES: {
    readonly fade: "fade";
    readonly slide: "slide";
    readonly scale: "scale";
    readonly slideFade: "slide-fade";
};
//# sourceMappingURL=transition.d.ts.map