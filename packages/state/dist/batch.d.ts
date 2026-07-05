export declare function batch(fn: () => void): void;
/**
 * آیا در حال حاضر در حالت batch هستیم؟
 *
 * ⚠️ در فاز ۷، همیشه false برمی‌گرداند چون Scheduler batching را مدیریت می‌کند.
 *
 * این تابع فقط برای backward compatibility نگه‌داشته شده است.
 */
export declare function isBatching(): boolean;
/**
 * افزودن یک Effect به صف batch.
 *
 * ⚠️ در فاز ۷، این تابع یک no-op است. Scheduler به‌طور خودکار Effectها را
 * در صف می‌گذارد.
 *
 * این تابع فقط برای backward compatibility نگه‌داشته شده است.
 */
export declare function addEffectToBatch(_effect: Function): void;
//# sourceMappingURL=batch.d.ts.map