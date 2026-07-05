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
import { registerSignal, recordStateChange } from './registry';
// Bug Fix #2: برای خواندن priority ذخیره‌شده روی هر Effect.
import { getEffectPriority } from './effect';
// BUG-05 FIX (v1.3.0): Context functions از ماژول مجزای context.ts
// برای شکستن circular dependency با effect.ts.
import {
  _getMutableContext,
  getActiveEffect,
  setActiveEffect,
  registerCleanup,
} from './context';

/**
 * کلاس Signal: قلب تپنده‌ی سیستم Reactivity.
 *
 * هر Signal دو مسئولیت اصلی دارد:
 *   1) هنگام get(): اگر Effect فعالی وجود داشت، خودش را به عنوان وابستگی آن ثبت کند
 *      و یک Cleanup ثبت کند تا در re-tracking یا dispose، وابستگی قطع شود.
 *   2) هنگام set(): اگر مقدار واقعاً تغییر کرد، به تمام Effectهای وابسته اطلاع دهد.
 */
export class Signal<T> {
  private _value: T;
  private _subscribers: Set<Function> = new Set();

  constructor(initialValue: T) {
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
  get(): T {
    // BUG-22 FIX (v1.2.2): activeEffect از _getMutableContext() خوانده می‌شود
    // (per-context via provider) تا در SSR concurrent ایزوله باشد.
    const currentEffect = _getMutableContext().activeEffect;
    if (currentEffect) {
      // ⚡ کپی کردن Effect فعلی در یک متغیر محلی
      // تا اگر activeEffect بعد از این خط تغییر کرد، Cleanup همچنان
      // همان Effect اولیه را هدف قرار دهد.
      const subscribedEffect = currentEffect;

      this._subscribers.add(subscribedEffect);

      // ثبت Cleanup: وقتی Effect دوباره اجرا شد یا dispose شد،
      // این Signal خودش را از لیست subscribers آن Effect پاک می‌کند.
      // این کار از Memory Leak و Zombie Effectها جلوگیری می‌کند.
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
  set(newValue: T): void {
    // جلوگیری از آپدیت‌های غیرضروری (Reference Equality + NaN handling)
    if (Object.is(this._value, newValue)) return;

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
  removeSubscriber(effect: Function): void {
    this._subscribers.delete(effect);
  }

  /**
   * تعداد subscribers فعلی.
   *
   * @internal این getter فقط برای DevTools و تست‌های داخلی استفاده می‌شود.
   * کاربران عادی نباید به آن تکیه کنند چون ممکن است در نسخه‌های بعدی تغییر کند.
   * برای بازرسی State، از `@zenith/devtools` استفاده کنید.
   */
  get subscriberCount(): number {
    return this._subscribers.size;
  }

  // FEATURE (v1.3.0): signal.update() — mutate current value with a function.
  // Always notifies subscribers, even if the function returns the same reference
  // (useful for arrays/objects where the reference doesn't change on mutation).
  //
  // @example
  //   const items = signal<Item[]>([]);
  //   items.update(arr => [...arr, newItem]);        // ✓ immutable update
  //   items.update(arr => { arr.push(newItem); return arr; }); // ✓ in-place
  // BUG-01 FIX (v1.3.0): capture oldValue BEFORE assignment so that
  // recordStateChange receives the correct previous value (not the new one).
  // BUG-07 FIX (v1.3.0): Added Object.is guard to skip notifications when
  // the computed result is referentially equal to the current value.
  update(fn: (current: T) => T): void {
    const oldValue = this._value;
    const next = fn(oldValue);
    // BUG-07 FIX: skip notification if no real change occurred (Object.is).
    if (Object.is(oldValue, next)) return;
    this._value = next;
    // ── فاز ۱۰: ثبت تغییر در Registry (برای DevTools Timeline) ──
    // BUG-01 FIX: pass oldValue (captured before assignment) instead of this._value.
    recordStateChange(this, oldValue, next);
    // ── فاز ۷: Scheduler ──
    this._subscribers.forEach(effectFn => {
      const priority = getEffectPriority(effectFn);
      scheduleEffect(effectFn, priority);
    });
  }

  // FEATURE (v1.3.0): signal.peek() — read value without registering a dependency.
  // Useful inside effects when you want to read a signal's value without
  // subscribing to it (preventing infinite loops or unnecessary re-runs).
  //
  // @example
  //   effect(() => {
  //     const userId = user.get();      // ← tracks (re-runs if userId changes)
  //     const cache = items.peek();     // ← no track (doesn't re-run on items change)
  //     if (!cache[userId]) fetch(userId);
  //   });
  peek(): T {
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
export function signal<T>(initialValue: T): Signal<T> {
  return new Signal(initialValue);
}

// FEATURE (v1.3.0): untrack() — execute a function without tracking dependencies.
// All signal.get() calls inside fn() will NOT register subscriptions.
// Useful for reading signals inside effects without creating reactive dependencies.
//
// @example
//   effect(() => {
//     const userId = user.get();            // ← tracks
//     const cached = untrack(() => cache.get()); // ← no track
//   });
export function untrack<T>(fn: () => T): T {
  const prev = getActiveEffect();
  setActiveEffect(null);
  try {
    return fn();
  } finally {
    setActiveEffect(prev);
  }
}

// ─────────────────────────────────────────────────────────────
// Context Functions (Re-exports از context.ts)
// ─────────────────────────────────────────────────────────────
//
// BUG-05 FIX (v1.3.0): ALL context-related functions (EffectContext,
// setEffectContextStore, setActiveEffect, getActiveEffect,
// setActiveCleanupRegistration, registerCleanup, _getMutableContext)
// to ماژول مجزای context.ts منتقل شده‌اند تا circular dependency
// بین signal.ts و effect.ts شکسته شود.
//
// برای backward compatibility، اینجا re-export می‌کنیم.
export type { EffectContext } from './context';
export { setEffectContextStore } from './context';
