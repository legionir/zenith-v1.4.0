// packages/state/src/computed.ts
//
// ماژول Computed: مقادیر محاسباتی (Derived State).
//
// Computed در واقع یک Signal "فقط‌خواندنی" است که مقدارش از روی
// Signalهای دیگر محاسبه می‌شود. تا وقتی وابستگی‌هایش تغییر نکرده‌اند،
// نباید دوباره محاسبه شود (Caching + Lazy Evaluation).
//
// استفاده:
//   const firstName = signal('Ali');
//   const lastName  = signal('Mohammadi');
//   const fullName  = computed(() => `${firstName.get()} ${lastName.get()}`);
//
//   fullName.get(); // 'Ali Mohammadi'
//   firstName.set('Reza');
//   fullName.get(); // 'Reza Mohammadi'  ← به صورت خودکار آپدیت شد.
import { signal } from './signal.js';
import { effect } from './effect.js';
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
export class Computed {
    computation;
    _value;
    _innerSignal;
    _cleanup = null;
    constructor(computation) {
        this.computation = computation;
        // ── محاسبه‌ی مقدار اولیه به‌صورت synchronous ──
        // این کار تضمین می‌کند که `get()` همیشه مقدار معتبر `T` برمی‌گرداند،
        // نه `undefined`. اگر computation خطا دهد، خطا propagate می‌شود
        // (بهتر از silent undefined).
        this._value = computation();
        // یک Signal داخلی با مقدار اولیه‌ی محاسبه‌شده می‌سازیم.
        this._innerSignal = signal(this._value);
        // یک Effect داخلی می‌سازیم که وابستگی‌های computed را ردیابی کند.
        // هر بار که یکی از Signalهای خوانده‌شده در computation تغییر کند،
        // این Effect دوباره اجرا می‌شود و مقدار جدید در innerSignal قرار می‌گیرد.
        this._cleanup = effect(() => {
            const newValue = this.computation();
            // اگر مقدار واقعاً تغییر کرده، innerSignal را update می‌کنیم.
            // در غیر این صورت، هیچ کاری نمی‌کنیم تا از re-render غیرضروری جلوگیری شود.
            if (!Object.is(newValue, this._value)) {
                this._value = newValue;
                this._innerSignal.set(newValue);
            }
        });
    }
    /**
     * خواندن مقدار Computed.
     *
     * - اگر افکت بیرونی این را بخواند، به innerSignal وابسته می‌شود.
     * - اگر خارج از Effect خوانده شود، فقط مقدار برگردانده می‌شود.
     *
     * نکته: مقدار برگشتی همیشه `T` است (نه `T | undefined`) چون مقدار اولیه
     * در constructor به‌صورت synchronous محاسبه می‌شود.
     */
    get() {
        return this._innerSignal.get();
    }
    /**
     * آزادسازی منابع (برای استفاده در آینده در Component lifecycle).
     */
    dispose() {
        if (this._cleanup) {
            this._cleanup();
            this._cleanup = null;
        }
    }
}
/**
 * تابع کمکی برای ساخت Computed.
 *
 * @param computation تابع محاسبه‌کننده‌ی مقدار.
 * @returns یک Computed قابل استفاده.
 */
export function computed(computation) {
    return new Computed(computation);
}
//# sourceMappingURL=computed.js.map