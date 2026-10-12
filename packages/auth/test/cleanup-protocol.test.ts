// @vitest-environment jsdom
//
// #116 — پروتکل یکسان cleanup برای Auth:
//   * dispose() idempotent است و timer refresh + listenerها را پاک می‌کند
//     (تست نشت: بعد از dispose، setTimeout معلق نباید refresh بزند).
//   * alias destroy() با deprecate ZEN-DEPR-020 به dispose delegate می‌کند.
//   * registerAuth یک Cleanup برمی‌گرداند؛ getAuth بعد از آن undefined.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetDeprecationWarnings } from '@zenith/errors';
import { Auth, registerAuth, getAuth } from '../src/auth';

const baseConfig = { loginUrl: '/api/auth/login', tokenStorage: 'memory' as const };

describe('#116 Auth dispose/cleanup', () => {
  beforeEach(() => {
    resetDeprecationWarnings();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    resetDeprecationWarnings();
    delete (globalThis as any).__ZENITH_DEV__;
  });

  it('dispose() clears the refresh timer and listeners; repeat calls are no-ops', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);
    try {
      const auth = new Auth({ ...baseConfig, refreshUrl: '/api/auth/refresh' });
      // زمان‌بندی manual refresh timer (همان مسیری که login می‌رود) —
      // بدون network: مستقیم روی privateها.
      const expiry = Date.now() + 60_000;
      (auth as any)._scheduleRefresh(expiry);
      expect(vi.getTimerCount()).toBeGreaterThan(0); // timer فعال ساخته شد
      const fn = () => {};
      auth.on('login', fn);

      auth.dispose();
      // نشت timer: بعد از dispose هیچ timeout معلقی از refresh باقی نمی‌ماند.
      await vi.advanceTimersByTimeAsync(300_000);
      expect(fetchMock).not.toHaveBeenCalled(); // zombie refresh ندارد

      expect(() => auth.dispose()).not.toThrow();
      expect(() => auth.dispose()).not.toThrow();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('destroy() is a deprecated alias warning once with ZEN-DEPR-020', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const auth = new Auth(baseConfig);
      auth.destroy();
      auth.destroy();
      const depr = warn.mock.calls.filter((c) => String(c[0]).includes('ZEN-DEPR-020'));
      expect(depr).toHaveLength(1);
      expect(depr[0]!.join(' ')).toContain('dispose');
    } finally {
      warn.mockRestore();
    }
  });

  it('registerAuth returns an idempotent Cleanup (only removes its own instance)', () => {
    const a = new Auth(baseConfig);
    const b = new Auth(baseConfig);
    const cleanupA = registerAuth('t116a', a);
    const cleanupB = registerAuth('t116b', b);
    expect(typeof cleanupA).toBe('function');
    cleanupA();
    cleanupA();
    expect(getAuth('t116a')).toBeUndefined();
    expect(getAuth('t116b')).toBe(b);
    // جایگزینی: cleanup قدیمی instance جدید را حذف نکند.
    const c1 = new Auth(baseConfig);
    const c2 = new Auth(baseConfig);
    const cleanupC1 = registerAuth('t116c', c1);
    registerAuth('t116c', c2);
    cleanupC1();
    expect(getAuth('t116c')).toBe(c2);
    cleanupB();
    expect(getAuth('t116b')).toBeUndefined();
  });
});
