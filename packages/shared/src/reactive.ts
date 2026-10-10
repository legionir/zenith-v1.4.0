// packages/shared/src/reactive.ts
//
// #141 — Readable/MaybeReactive مصرف‌کننده‌ها (DEC-021): toValue و isReadable
// روی تایپ‌های **ساختاری** کار می‌کنند تا `shared ↔ state` چرخه نشود. برند
// runtime (Symbol.for('zenith.readable')، DEC-009) در `state` می‌ماند؛ اینجا
// فقط شکل «دارای get() تابعی» ملاک است — همان قراردادی که state نیز برای
// duck-type legacy می‌پذیرد.

import type { Cleanup, Disposable, MaybeReactive, Readable } from './types';

/** True اگر `value` یک `Readable` باشد (فقط آبجکت با `get` تابعی). */
export function isReadable(value: unknown): value is Readable<unknown> {
  return (
    value !== null &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as Readable<unknown>).get === 'function'
  );
}

/**
 * خواندن مقدار یک `MaybeReactive` — یا عینِ مقدار، یا `get()` ظرف.
 *
 * @example
 *   const delay = toValue(cfg.delay); // cfg.delay: MaybeReactive<number>
 */
export function toValue<T>(value: MaybeReactive<T>): T {
  return isReadable(value) ? (value as Readable<T>).get() : (value as T);
}

/** جمع‌کنندهٔ cleanup با ترتیب LIFO و dispose idempotent (SPEC §۰.۱). */
export type Disposer = Disposable & {
  /** یک cleanup یا Disposable ثبت می‌کند (بعد از dispose بی‌اثر است). */
  add(cleanup: Cleanup | Disposable): void;
  /** اجرای تمام cleanupهای ثبت‌شده به ترتیب LIFO و خالی‌کردن فهرست. */
  run(): void;
};

/**
 * سازندهٔ جمع‌کنندهٔ cleanup. `dispose()` همان `run()` است و idempotency را
 * تضمین می‌کند: بعد از بار اول، هیچ cleanup دیگری اجرا نمی‌شود و افزودن
 * تازه بی‌اثر است (نشت زودرس ندارد).
 */
export function createDisposer(): Disposer {
  const cleanups: Array<Cleanup | Disposable> = [];
  let disposed = false;

  function run(): void {
    if (disposed) return;
    disposed = true;
    // LIFO: آخرین ثبت‌شده اولین آزاد می‌شود؛ خطای یک cleanup بقیه را نکشد.
    const errors: unknown[] = [];
    for (let i = cleanups.length - 1; i >= 0; i--) {
      const entry = cleanups[i];
      if (!entry) continue;
      try {
        if (typeof entry === 'function') entry();
        else entry.dispose();
      } catch (err) {
        errors.push(err);
      }
    }
    cleanups.length = 0;
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, '[shared] خطا در dispose');
  }

  return {
    add(cleanup: Cleanup | Disposable): void {
      if (disposed || !cleanup) return;
      cleanups.push(cleanup);
    },
    run,
    dispose: run,
  };
}
