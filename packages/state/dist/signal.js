// packages/state/src/signal.ts
//
// هسته اصلی سیستم Reactivity در فریم‌ورک Zenith.
// این ماژول هیچ وابستگی به DOM ندارد و در هر محیطی (Node, Browser, Worker) کار می‌کند.
//
// مفاهیم کلیدی:
//   - Signal: یک ظرف (Container) برای نگهداری یک مقدار واکنش‌گرا.
//   - Dependency Tracking: وقتی در حین اجرای یک Effect، Signal.get() فراخوانی شود، آن Effect
//     به عنوان Subscriber ثبت می‌شود.
//   - Notification: وقتی Signal.set() فراخوانی شود، تمام Effectهای وابسته مطلع می‌شوند.
//
// ── فاز ۷: Scheduler ──
// در فاز ۷، Notification به‌جای اجرای مستقیم Effectها، آن‌ها را به
// Scheduler می‌سپارد. Scheduler با استفاده از Microtask، تمام Effectهای
// یک تیک را در یک flush اجرا می‌کند. این یعنی:
//   - اگر ۱۰ Signal را در یک تابع set کنید، Effectها فقط ۱ بار اجرا می‌شوند.
//   - DOM فقط ۱ بار آپدیت می‌شود (به‌جای ۱۰ بار).
//   - Performance به‌طور چشمگیری بهبود می‌یابد.
import { scheduleEffect } from '@zenith/scheduler';
import { registerSignal, recordStateChange } from './registry.js';
// Bug Fix #2: برای خواندن priority ذخیره‌شده روی هر Effect.
import { getEffectPriority } from './effect.js';
/**
 * کلاس Signal: قلب تپنده‌ی سیستم Reactivity.
 *
 * هر Signal دو مسئولیت اصلی دارد:
 *   1) هنگام get(): اگر Effect فعالی وجود داشت، خودش را به عنوان وابستگی آن ثبت کند
 *      و یک Cleanup ثبت کند تا در re-tracking یا dispose، وابستگی قطع شود.
 *   2) هنگام set(): اگر مقدار واقعاً تغییر کرد، به تمام Effectهای وابسته اطلاع دهد.
 */
export class Signal {
    _value;
    _subscribers = new Set();
    constructor(initialValue) {
        this._value = initialValue;
        // ── فاز ۱۰: ثبت در State Registry (برای DevTools) ──
        // این کار به DevTools اجازه می‌دهد این Signal را بازرسی کند.
        // اگر DevTools فعال نباشد، no-op است.
        registerSignal(this);
    }
    /**
     * خواندن مقدار فعلی سیگنال.
     *
     * اگر در لحظه‌ی فراخوانی، یک Effect در حال اجرا باشد (activeEffect !== null):
     *   1) آن Effect به لیست subscribers این سیگنال اضافه می‌شود.
     *   2) یک Cleanup ثبت می‌شود تا در re-tracking یا dispose، Effect از subscribers حذف شود.
     * به این مکانیزم "Dependency Tracking" یا "ردیابی وابستگی" می‌گوییم.
     */
    get() {
        // BUG-22 FIX (v1.2.2): activeEffect از _getMutableContext() خوانده می‌شود
        // (per-context via provider) تا در SSR concurrent ایزوله باشد.
        const currentEffect = _getMutableContext().activeEffect;
        if (currentEffect) {
            const subscribedEffect = currentEffect;
            this._subscribers.add(subscribedEffect);
            registerCleanup(() => {
                this._subscribers.delete(subscribedEffect);
            });
        }
        return this._value;
    }
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
    set(newValue) {
        // جلوگیری از آپدیت‌های غیرضروری (Reference Equality + NaN handling)
        if (Object.is(this._value, newValue))
            return;
        // ── فاز ۱۰: ثبت تغییر در Registry (برای DevTools Timeline) ──
        // oldValue را قبل از set نگه می‌داریم تا در Timeline ثبت شود.
        const oldValue = this._value;
        this._value = newValue;
        // ثبت تغییر در Registry (اگر DevTools فعال باشد).
        recordStateChange(this, oldValue, newValue);
        // ── فاز ۷: Scheduler ──
        // به‌جای اجرای مستقیم (triggerEffects)، Effectها را به Scheduler می‌سپاریم.
        // Scheduler با Microtask، آن‌ها را در پایان تیک اجرا می‌کند.
        // این کار باعث می‌شود چندین set در یک تابع، فقط یک بار Effectها را
        // اجرا کنند (Batching خودکار).
        //
        // ── Bug Fix #2: Priority Queue Integration ──
        // هر Effect را با priority ذخیره‌شده‌اش schedule می‌کنیم.
        // این اولویت توسط effect(fn, priority) تعیین می‌شود.
        // اگر Effect اولویتی نداشته باشد، 'normal' استفاده می‌شود.
        this._subscribers.forEach(effectFn => {
            const priority = getEffectPriority(effectFn);
            scheduleEffect(effectFn, priority);
        });
    }
    /**
     * حذف یک Effect از لیست subscribers (پاکسازی حافظه).
     *
     * این متد زمانی فراخوانی می‌شود که یک Effect از بین می‌رود یا
     * وابستگی‌هایش تغییر می‌کند و نیاز به re-tracking دارد.
     */
    removeSubscriber(effect) {
        this._subscribers.delete(effect);
    }
    /**
     * تعداد subscribers فعلی.
     *
     * @internal این getter فقط برای DevTools و تست‌های داخلی استفاده می‌شود.
     * کاربران عادی نباید به آن تکیه کنند چون ممکن است در نسخه‌های بعدی تغییر کند.
     * برای بازرسی State، از `@zenith/devtools` استفاده کنید.
     */
    get subscriberCount() {
        return this._subscribers.size;
    }
    // FEATURE (v1.3.0): signal.update() — always notifies subscribers.
    update(fn) {
        const next = fn(this._value);
        this._value = next;
        const oldValue = this._value;
        recordStateChange(this, oldValue, next);
        this._subscribers.forEach(effectFn => {
            const priority = getEffectPriority(effectFn);
            scheduleEffect(effectFn, priority);
        });
    }
    // FEATURE (v1.3.0): signal.peek() — read without tracking dependency.
    peek() {
        return this._value;
    }
}
/**
 * تابع کمکی برای ساخت سیگنال با API روان‌تر.
 *
 * استفاده:
 *   const count = signal(0);
 *   count.get();   // خواندن
 *   count.set(5);  // مقداردهی
 */
export function signal(initialValue) {
    return new Signal(initialValue);
}
// FEATURE (v1.3.0): untrack() — execute without tracking dependencies.
export function untrack(fn) {
    const prev = getActiveEffect();
    setActiveEffect(null);
    try {
        return fn();
    }
    finally {
        setActiveEffect(prev);
    }
}
// ─────────────────────────────────────────────────────────────
// Active Effect Tracking (ماژول سطحی)
// ─────────────────────────────────────────────────────────────
//
// BUG-22 FIX (v1.2.2): EffectContext اکنون per-context (via provider) است.
// این کار از race condition در SSR concurrent جلوگیری می‌کند.
let effectContextProvider = null;
/**
 * BUG-22 FIX (v1.2.2): تنظیم provider تابع برای EffectContext.
 * SSR باید این تابع را با یک callback فراخوانی کند که در هر call،
 * EffectContext مربوط به async context فعلی (via AsyncLocalStorage) را
 * برمی‌گرداند.
 */
export function setEffectContextStore(provider) {
    effectContextProvider = provider;
}
const moduleLevelContext = {
    activeEffect: null,
    activeCleanupRegistration: null,
};
/**
 * BUG-22 FIX (v1.2.2): دریافت EffectContext فعلی. اگر provider تنظیم شده
 * باشد و مقدار غیر-null برگرداند، از آن استفاده می‌کنیم. در غیر این صورت،
 * به fallback ماژول-level برمی‌گردیم.
 */
function _getMutableContext() {
    if (effectContextProvider) {
        const ctx = effectContextProvider();
        if (ctx) return ctx;
    }
    return moduleLevelContext;
}
export function setActiveEffect(effect) {
    _getMutableContext().activeEffect = effect;
}
export function getActiveEffect() {
    return _getMutableContext().activeEffect;
}
export function registerCleanup(cleanup) {
    const reg = _getMutableContext().activeCleanupRegistration;
    if (reg) {
        reg(cleanup);
    }
}
export function setActiveCleanupRegistration(register) {
    _getMutableContext().activeCleanupRegistration = register;
}
//# sourceMappingURL=signal.js.map