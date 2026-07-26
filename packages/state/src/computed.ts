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

import { Signal, signal } from './signal';
import { effect } from './effect';
import { createOwner, disposeOwner, getOwner } from './context';

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
export class Computed<T> {
  private _value: T | undefined;
  private _innerSignal: Signal<T | undefined>;
  private _cleanup: (() => void) | null = null;
  private _initialized = false;
  private _owner: ReturnType<typeof createOwner>;

  constructor(private computation: () => T) {
    // BUG-03 FIX + IMP-01 (v1.3.0): Lazy initialization — computation() is
    // deferred until the first get() call. This avoids double execution of the
    // computation function (previously it ran once in the constructor and once
    // inside the effect). For pure functions this was only a performance issue;
    // for impure functions (e.g. Math.random(), Date.now()) it could produce
    // different values leading to subtle bugs.
    //
    // innerSignal starts with undefined as a placeholder. When get() is called
    // for the first time, _initialize() runs computation(), creates the real
    // innerSignal, and sets up the tracking effect.
    this._owner = createOwner(getOwner());
    this._innerSignal = signal<T | undefined>(undefined);
  }

  /**
   * خواندن مقدار Computed.
   *
   * اولین فراخوانی get() باعث مقداردهی اولیه (lazy initialization) می‌شود.
   * این کار از اجرای بیهوده computation برای computedهایی که هرگز خوانده
   * نمی‌شوند جلوگیری می‌کند.
   *
   * - اگر افکت بیرونی این را بخواند، به innerSignal وابسته می‌شود.
   * - اگر خارج از Effect خوانده شود، فقط مقدار برگردانده می‌شود.
   */
  get(): T {
    if (!this._initialized) {
      this._initialize();
    }
    return this._innerSignal.get() as T;
  }

  /**
   * مقداردهی اولیه lazy: محاسبه مقدار اولیه، ساخت innerSignal و Effect.
   */
  private _initialize(): void {
    // BUG-03 FIX: computation() now runs only once for initialization.
    // The tracking effect re-runs computation() on dependency changes,
    // but the first run is the _only_ initialization run — no duplication.
    this._value = this.computation();
    this._innerSignal = signal<T>(this._value as T);

    this._cleanup = effect(() => {
      const newValue = this.computation();

      // اگر مقدار واقعاً تغییر کرده، innerSignal را update می‌کنیم.
      // در غیر این صورت، هیچ کاری نمی‌کنیم تا از re-render غیرضروری جلوگیری شود.
      if (!Object.is(newValue, this._value)) {
        this._value = newValue;
        this._innerSignal.set(newValue as T);
      }
    }, {
      owner: this._owner,
    });

    this._initialized = true;
  }

  /**
   * آزادسازی منابع (برای استفاده در آینده در Component lifecycle).
   */
  dispose(): void {
    if (this._cleanup) {
      this._cleanup();
      this._cleanup = null;
    }
    disposeOwner(this._owner);
    this._initialized = false;
  }
}

/**
 * تابع کمکی برای ساخت Computed.
 *
 * @param computation تابع محاسبه‌کننده‌ی مقدار.
 * @returns یک Computed قابل استفاده.
 */
export function computed<T>(computation: () => T): Computed<T> {
  return new Computed(computation);
}
