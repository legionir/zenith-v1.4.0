//
// #20 — createSuspense: track() باید guard چرخه (generation) داشته باشد.
//   * تسویهٔ پرامیس نسل قدیمی پس از reset() نباید onReady را فعال کند.
//   * rejection باید پرامیس را از loadingSet حذف کند تا pendingCount ساکن بماند.
//   * چند پرامیس هم‌زمان: onReady فقط پس از تسویهٔ همه (در همان چرخه).
import { describe, it, expect, vi } from 'vitest';
import { createSuspense } from '../src/suspense';

const settledP = () => Promise.resolve().then(() => undefined);

describe('suspense controller: generation guard (#20)', () => {
  it('an old-generation promise settling after reset() does not fire onReady', async () => {
    const api = createSuspense();
    let ready = 0;
    api.onReady(() => ready++);

    const deferred: { resolve?: (v: unknown) => void } = {};
    api.track(new Promise((resolve) => (deferred.resolve = resolve)));
    expect(ready).toBe(0);

    api.reset(); // چرخهٔ جدید؛ پرامیس بالا متعلق به نسل قبلی است

    deferred.resolve?.(undefined);
    await Promise.resolve();
    await Promise.resolve();
    expect(ready).toBe(0); // قرمز قبل از رفع: تسویهٔ نسل قدیمی onReady می‌زد
    api.dispose();
  });

  it('an old-generation resolve after reset() leaves a new tracked promise alone', async () => {
    const api = createSuspense();
    let ready = 0;
    api.onReady(() => ready++);

    const oldDeferred: { resolve?: (v: unknown) => void } = {};
    api.track(new Promise((resolve) => (oldDeferred.resolve = resolve)));

    api.reset();
    const newP = settledP();
    api.track(newP); // نسل جدید

    oldDeferred.resolve?.(undefined);
    await newP;
    await Promise.resolve();
    await Promise.resolve();
    // فقط نسل جدید باید شمرده شود؛ با guard نسل، ready==1 (پرامیس جدید تسویه شده)
    expect(ready).toBe(1);
    api.dispose();
  });

  it('a rejected tracked promise is removed from loading (pendingCount consistent)', async () => {
    const api = createSuspense();
    api.track(Promise.reject(new Error('boom')));
    expect(api.signal.get().pendingCount).toBe(1);

    const errs: Error[] = [];
    api.onError((e) => errs.push(e));
    await Promise.reject(new Error('flush')).catch(() => undefined);
    await Promise.resolve();
    await Promise.resolve();

    const state = api.signal.get();
    expect(state.loading).toBe(false);
    expect(state.pendingCount).toBe(0); // قرمز قبل از رفع: id ردشده در loadingSet می‌ماند
    expect(errs.length).toBe(1);
    api.dispose();
  });

  it('a rejection alongside another pending promise does not leave the boundary stuck', async () => {
    const api = createSuspense();
    const errs: Error[] = [];
    api.onError((e) => errs.push(e));

    const gate: Array<(v: unknown) => void> = [];
    api.track(new Promise((r) => gate.push(r))); // این هرگز reject نمی‌شود
    api.track(Promise.reject(new Error('boom'))); // id ردشده باید از loadingSet پاک شود

    await Promise.resolve();
    await Promise.resolve();
    expect(errs.length).toBe(1);

    gate[0]!(undefined);
    await Promise.resolve();
    await Promise.resolve();
    // اگر id ردشده نشت کرده باشد، pendingCount روی ۱ می‌ماند (boundary گیر کرده)
    expect(api.signal.get().loading).toBe(false);
    expect(api.signal.get().pendingCount).toBe(0);
    expect(api.signal.get().error).toBe('boom'); // خطای چرخه حفظ می‌شود
    api.dispose();
  });

  it('multiple concurrent promises fire onReady once, after all settle', async () => {
    const api = createSuspense();
    const ready = vi.fn();
    api.onReady(ready);

    const gates: Array<(v: unknown) => void> = [];
    api.track(new Promise((r) => gates.push(r)));
    api.track(new Promise((r) => gates.push(r)));
    api.track(settledP());
    await Promise.resolve();
    await Promise.resolve();
    expect(ready).toHaveBeenCalledTimes(0);

    gates[0]!(undefined);
    await Promise.resolve();
    await Promise.resolve();
    expect(ready).toHaveBeenCalledTimes(0);

    gates[1]!(undefined);
    await Promise.resolve();
    await Promise.resolve();
    expect(ready).toHaveBeenCalledTimes(1);
    api.dispose();
  });

  it('retry flow: reset then new pending promise keeps onReady silent until it settles', async () => {
    const api = createSuspense();
    const ready = vi.fn();
    api.onReady(ready);

    const first = settledP();
    api.track(first);
    await first;
    await Promise.resolve();
    await Promise.resolve();
    expect(ready).toHaveBeenCalledTimes(1);

    const secondDeferred: { resolve?: (v: unknown) => void } = {};
    api.track(new Promise((resolve) => (secondDeferred.resolve = resolve)));
    expect(ready).toHaveBeenCalledTimes(1);

    secondDeferred.resolve?.(undefined);
    await Promise.resolve();
    await Promise.resolve();
    expect(ready).toHaveBeenCalledTimes(2);
    api.dispose();
  });
});
