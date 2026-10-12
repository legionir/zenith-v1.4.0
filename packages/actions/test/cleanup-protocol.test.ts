// @vitest-environment jsdom
//
// #116 — پروتکل یکسان cleanup برای ActionRegistry:
//   * dispose() idempotent است و middleware/actionها را پاک می‌کند (تست نشت).
//   * alias destroy() با deprecate ZEN-DEPR-019 به dispose delegate می‌کند.
//   * registerAction (module-level) یک Cleanup برمی‌گرداند؛ فراخوانی دوم بی‌اثر.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetDeprecationWarnings } from '@zenith/errors';
import { ActionRegistry, registerAction, getAction, clearActions } from '../src/index';

describe('#116 ActionRegistry dispose/cleanup', () => {
  beforeEach(() => resetDeprecationWarnings());
  afterEach(() => {
    resetDeprecationWarnings();
    delete (globalThis as any).__ZENITH_DEV__;
  });

  it('dispose() drains actions and middleware (leak check) and is idempotent', async () => {
    const r = new ActionRegistry();
    r.register('cart.save', () => {});
    let mwCount = 0;
    r.use((_name, _ctx, next) => {
      mwCount++;
      return next();
    });
    r.dispose();
    expect(r.list()).toHaveLength(0);
    await expect(r.execute('cart.save', {} as never)).rejects.toThrow();
    // dispose دوباره نباید خطا بدهد.
    expect(() => r.dispose()).not.toThrow();
    expect(() => r.dispose()).not.toThrow();
    expect(mwCount).toBe(0); // هیچ middleware اجرا نشده
  });

  it('destroy() is a deprecated alias warning once with ZEN-DEPR-019', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const r = new ActionRegistry();
      r.register('a.b', () => {});
      r.destroy();
      r.destroy(); // alias دوم: deprecate فقط یک‌بار هشدار می‌دهد
      const depr = warn.mock.calls.filter((c) => String(c[0]).includes('ZEN-DEPR-019'));
      expect(depr).toHaveLength(1);
      expect(depr[0]!.join(' ')).toContain('dispose');
      expect(r.list()).toHaveLength(0);
    } finally {
      warn.mockRestore();
    }
  });

  it('registerAction returns an idempotent Cleanup removing only its own fn', () => {
    const fnA = () => {};
    const cleanupA = registerAction('mod.a', fnA);
    expect(typeof cleanupA).toBe('function');
    cleanupA();
    cleanupA(); // دومی بی‌اثر
    expect(() => cleanupA()).not.toThrow();

    // بازنویسی: cleanup قدیمی نباید entry جدید را حذف کند.
    const fnOld = () => {};
    const fnNew = () => {};
    const cleanupOld = registerAction('mod.b', fnOld);
    registerAction('mod.b', fnNew);
    cleanupOld();
    expect(getAction('mod.b')).toBe(fnNew);
    clearActions(); // پاک‌سازی registry پیش‌فرض بین تست‌ها
  });
});
