// packages/runtime/src/directives/ref.ts
//
// FEATURE (v0.5.0): zen-ref — bind کردن یک عنصر DOM به یک Signal در State.
//
// کاربرد:
//   <button zen-ref="myButton">Click me</button>
//   <input zen-ref="$emailInput" type="email" />
//   <canvas zen-ref="chartCanvas"></canvas>
//
//   const state = {
//     myButton: signal<HTMLButtonElement | null>(null),
//     emailInput: signal<HTMLInputElement | null>(null),
//     chartCanvas: signal<HTMLCanvasElement | null>(null),
//   };
//   Zen.start(document.getElementById('app'), state);
//
//   // حالا state.myButton.get() عنصر <button> را برمی‌گرداند.
//   state.myButton.get()?.focus();
//
// ── نحوه کار ──
//
//   1) refName از attribute خوانده می‌شود. می‌تواند با $ شروع شود یا نکند.
//      مثلاً "myButton" و "$myButton" هر دو به key "myButton" تبدیل می‌شوند.
//   2) leading $ را strip می‌کنیم تا key نهایی به‌دست بیاید.
//   3) در context (که می‌تواند state یا context wrapper باشد)، به دنبال
//      یک Signal با آن key می‌گردیم. ما هم context[key] و context['$' + key]
//      را چک می‌کنیم تا با هر دو حالت (state با key بدون $ یا context با
//      key با $) سازگار باشیم.
//   4) اگر مقدار پیدا شده دارای متد .set باشد (یعنی یک Signal است)،
//      signal.set(el) را صدا می‌زنیم تا عنصر در Signal ذخیره شود.
//   5) در dispose، signal.set(null) را صدا می‌زنیم تا Signal پاک شود
//      و reference به عنصر از بین برود (برای جلوگیری از memory leak).
//
// ── چرا Signal؟ ──
//
//   استفاده از Signal به‌جای یک plain reference دو مزیت دارد:
//     1) Reactive: Effectهایی که به این Signal دسترسی دارند، وقتی عنصر
//        mount/unmount می‌شود، دوباره اجرا می‌شوند.
//     2) Consistent API: Signal با بقیه‌ی فریم‌ورک یکپارچه است (می‌توان
//        computed بر اساس آن ساخت، در devtools دید، و غیره).
//
// ── Memory Leak Prevention ──
//
//   وقتی عنصر از DOM حذف می‌شود (مثلاً zen-if=false)، walker تابع dispose
//   را صدا می‌زند و signal.set(null) اجرا می‌شود. اگر این کار را نکنیم،
//   Signal همچنان به عنصر detach شده اشاره می‌کند و garbage collector
//   نمی‌تواند آن را پاک کند.
//
// ── تفاوت با zen-bind ──
//
//   zen-bind:value داده‌ی عنصر را به Signal وصل می‌کند.
//   zen-ref خودِ عنصر DOM را به Signal وصل می‌کند (نه داده‌اش را).
/**
 * پردازش دایرکتیو zen-ref روی یک عنصر.
 *
 * @param el      عنصر HTML (که باید zen-ref داشته باشد).
 * @param refName نام ref. می‌تواند با $ شروع شود یا نکند.
 *                مثلاً "myButton" یا "$myButton" — هر دو به key "myButton" تبدیل می‌شوند.
 * @param context آبجکت Context یا State که Signal در آن lookup می‌شود.
 *                این تابع هم context[key] و هم context['$' + key] را چک می‌کند.
 * @returns تابع Dispose برای پاکسازی (signal.set(null)).
 */
export function processRef(el, refName, context = {}) {
    // FEATURE (v0.5.0): zen-ref — bind DOM element to a state Signal.
    // ── ۱. strip leading $ ──
    let key = refName;
    if (key.startsWith('$')) {
        key = key.slice(1);
    }
    if (!key) {
        return () => { }; // no-op dispose if key is empty
    }
    // ─ـ ۲. lookup Signal در context ──
    // context می‌تواند state (با key بدون $) یا context wrapper (با key با $) باشد.
    // ما هر دو را چک می‌کنیم تا با هر دو حالت کار کند.
    // نکته: اگر context[key] یک getter باشد که Signal.get() را برمی‌گرداند،
    // آن مقدار خودش Signal نیست. اما در state واقعی، state[key] خود Signal است.
    let signal = context[key];
    if (signal == null) {
        // fallback: امتحان با $ prefix
        signal = context['$' + key];
    }
    // ── ۳. اگر Signal بود، set(el) ──
    if (signal != null && typeof signal.set === 'function') {
        try {
            signal.set(el);
        }
        catch (err) {
            if (typeof console !== 'undefined' && console.error) {
                console.error('[Zenith zen-ref] Failed to set ref:', err);
            }
        }
        // ─ـ ۴. dispose: signal.set(null) ──
        // برای جلوگیری از memory leak (reference به عنصر detach شده).
        return () => {
            try {
                signal.set(null);
            }
            catch (err) {
                if (typeof console !== 'undefined' && console.error) {
                    console.error('[Zenith zen-ref] Failed to clear ref:', err);
                }
            }
        };
    }
    // اگر Signal پیدا نشد، no-op dispose.
    if (typeof console !== 'undefined' && console.warn) {
        console.warn(`[Zenith zen-ref] No Signal found for ref "${refName}". ` +
            `Make sure state has a Signal at key "${key}" (with a .set method).`);
    }
    return () => { };
}
//# sourceMappingURL=ref.js.map
