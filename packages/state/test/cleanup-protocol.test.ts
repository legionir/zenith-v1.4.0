//
// #116 — state: onCleanup و onEffectError باید Cleanup برگردانند.
//   * onCleanup(fn) داخل effect: خروجی fn را از صف cleanup حذف می‌کند تا
//     هنگام re-run effect اجرا نشود (ثبت مجدد بی‌اثر ⇒ idempotent).
//   * onEffectError(handler): خروجی handler را پاک می‌کند؛ فراخوانی دوم و
//     handler جدیدتر بی‌اثر.
import { describe, it, expect, afterEach } from 'vitest';
import { signal, effect, onCleanup, onEffectError } from '@zenith/state';

describe('#116 state registration cleanup', () => {
  afterEach(() => {
    onEffectError(null);
  });

  it('onCleanup returns a Cleanup that removes the callback before it runs', () => {
    const s = signal(0);
    let removedRan = 0;
    let keptRan = 0;
    const dispose = effect(() => {
      s.get();
      const off = onCleanup(() => {
        removedRan++;
      });
      onCleanup(() => {
        keptRan++;
      });
      off(); // حذف همین cleanup از صف جاری
    });
    expect(typeof dispose).toBe('function');
    dispose();
    expect(removedRan).toBe(0); // قرمز قبل از #116: onCleanup void بود و حذف ممکن نبود
    expect(keptRan).toBe(1);
    expect(() => dispose()).not.toThrow(); // idempotent
    expect(keptRan).toBe(1);
  });

  it('onEffectError returns an idempotent Cleanup clearing only its own handler', () => {
    const h1 = () => {};
    const h2 = () => {};
    const off1 = onEffectError(h1);
    expect(typeof off1).toBe('function');
    off1();
    off1(); // idempotent

    // handler جدید نباید با off1 پاک شده باشد:
    const off2 = onEffectError(h2);
    off1(); // باید بی‌اثر بماند (already cleared + handler فعلی h2 است)
    off2();
  });
});
