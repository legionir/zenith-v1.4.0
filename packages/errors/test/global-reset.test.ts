// packages/errors/test/global-reset.test.ts
//
// #118 / DEC-032 — رجیستری ریست سراسری در `@zenith/errors`:
//   • `onGlobalReset` یک `Cleanup` برمی‌گرداند (پروتکل یکسان cleanup).
//   • `runGlobalResets` تعداد هوک‌های موفق را می‌شمارد و با هوک خطادار نمی‌شکند.
//   • dual-package hazard (#46/DEC-018): دو «نسخه» (دو نمونهٔ ماژول) باید همان
//     رجیستری را ببینند — کلید `Symbol.for` روی `globalThis`.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { onGlobalReset, runGlobalResets, type GlobalResetHook } from '../src/global-reset';

/** کلید مشترک رجیستری؛ همان Symbol.for که ماژول استفاده می‌کند. */
const REGISTRY_KEY = Symbol.for('zenith.globalReset');

/** دسترسی تایپ‌دار به اسلات globalThis (بدون any در API عمومی). */
function registryHost(): Record<symbol, Set<GlobalResetHook> | undefined> {
  return globalThis as unknown as Record<symbol, Set<GlobalResetHook> | undefined>;
}

/** پاک‌کردن کامل رجیستری بین تست‌ها (شبیه‌سازی فرایند تازه). */
function clearRegistry(): void {
  delete registryHost()[REGISTRY_KEY];
}

afterEach(() => {
  clearRegistry();
  vi.restoreAllMocks();
});

describe('#118 — global reset registry in @zenith/errors', () => {
  it('keeps the registry on globalThis under Symbol.for (dual-package safe)', () => {
    expect(registryHost()[REGISTRY_KEY]).toBeUndefined();
    const cleanup = onGlobalReset(() => {});
    const stored = registryHost()[REGISTRY_KEY];
    expect(stored).toBeInstanceOf(Set);
    expect(stored?.size).toBe(1);
    cleanup();
  });

  it('onGlobalReset returns an idempotent Cleanup that unregisters only its own hook', () => {
    const a = vi.fn();
    const b = vi.fn();
    const cleanupA = onGlobalReset(a);
    onGlobalReset(b);

    expect(runGlobalResets()).toBe(2);
    cleanupA();
    cleanupA(); // idempotent — نباید هوک دیگری را حذف کند
    expect(runGlobalResets()).toBe(1);
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(2);
  });

  it('runGlobalResets counts successes, survives a throwing hook and keeps the rest running', () => {
    const after = vi.fn();
    onGlobalReset(() => {
      throw new Error('hook broke');
    });
    onGlobalReset(after);

    expect(runGlobalResets()).toBe(1);
    expect(after).toHaveBeenCalledTimes(1);
    // هوک خطادار حذف نمی‌شود (idempotency وظیفهٔ خودِ هوک است).
    expect(registryHost()[REGISTRY_KEY]?.size).toBe(2);
  });

  it('two module instances (a second @zenith/errors copy) share one registry', async () => {
    const first = await import('../src/global-reset');
    const firstHook = vi.fn();
    first.onGlobalReset(firstHook);

    // vi.resetModules ⇒ نمونهٔ تازه از ماژول، دقیقاً مثل بارگذاری نسخهٔ دوم پکیج.
    vi.resetModules();
    const second = await import('../src/global-reset');
    expect(second).not.toBe(first);

    const secondHook = vi.fn();
    second.onGlobalReset(secondHook);

    // هر دو هوک در یک رجیستری‌اند: نسخهٔ دوم هر دو را اجرا می‌کند و برعکس.
    expect(registryHost()[REGISTRY_KEY]?.size).toBe(2);
    expect(second.runGlobalResets()).toBe(2);
    expect(firstHook).toHaveBeenCalledTimes(1);
    expect(secondHook).toHaveBeenCalledTimes(1);
    expect(first.runGlobalResets()).toBe(2);
    expect(registryHost()[REGISTRY_KEY]?.size).toBe(2); // تکرار نشده (dedupe با Set)
  });

  it('exports the hook type and both functions from the package entrypoint', async () => {
    const barrel = await import('../src/index');
    expect(typeof barrel.onGlobalReset).toBe('function');
    expect(typeof barrel.runGlobalResets).toBe('function');
    // نوع `GlobalResetHook` در سطح type export شده است (بدون any).
    const hook: import('../src/index').GlobalResetHook = () => {};
    const cleanup: () => void = barrel.onGlobalReset(hook);
    cleanup();
  });
});
