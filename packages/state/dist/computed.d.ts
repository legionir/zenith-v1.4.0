/**
 * کلاس Computed: یک Signal با مقدار مشتق‌شده.
 *
 * ساز و کار داخلی:
 *   - یک Signal داخلی (innerSignal) ساخته می‌شود تا تغییرات مقدار محاسبه‌شده
 *     را به Effectهای بیرونی اطلاع دهد.
 *   - یک Effect داخلی ساخته می‌شود که به Signalهای خوانده‌شده در computation وابسته است.
 *     وقتی هر کدام از آن‌ها تغییر کند، این Effect دوباره اجرا شده و مقدار جدید
 *     را در innerSignal قرار می‌دهد.
 *   - اگر مقدار محاسبه‌شده تغییر نکرده باشد (Object.is)، از Set کردن innerSignal
 *     صرف‌نظر می‌شود تا Effectهای بیرونی بی‌دلیل اجرا نشوند.
 */
export declare class Computed<T> {
    private computation;
    private _value;
    private _innerSignal;
    private _cleanup;
    constructor(computation: () => T);
    /**
     * خواندن مقدار Computed.
     *
     * - اگر افکت بیرونی این را بخواند، به innerSignal وابسته می‌شود.
     * - اگر خارج از Effect خوانده شود، فقط مقدار برگردانده می‌شود.
     *
     * نکته: مقدار برگشتی همیشه `T` است (نه `T | undefined`) چون مقدار اولیه
     * در constructor به‌صورت synchronous محاسبه می‌شود.
     */
    get(): T;
    /**
     * آزادسازی منابع (برای استفاده در آینده در Component lifecycle).
     */
    dispose(): void;
}
/**
 * تابع کمکی برای ساخت Computed.
 *
 * @param computation تابع محاسبه‌کننده‌ی مقدار.
 * @returns یک Computed قابل استفاده.
 */
export declare function computed<T>(computation: () => T): Computed<T>;
//# sourceMappingURL=computed.d.ts.map