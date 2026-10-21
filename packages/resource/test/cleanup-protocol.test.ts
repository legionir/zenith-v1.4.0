// @vitest-environment jsdom
//
// #116 — Resource: dispose idempotency + alias destroy ZEN-DEPR-023 +
// تست نشت interval/abort + cleanup در processResource (اگرچه directive
// برای DOM واقعی است؛ در jsdom با fetch mock بررسی می‌کنیم).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetDeprecationWarnings } from '@zenith/errors';
import { Resource, createResource, getResource, resetResourceRegistry } from '../src/resource';
import { processResource } from '../src/directive';

describe('#116 Resource dispose/cleanup', () => {
  beforeEach(() => {
    resetDeprecationWarnings();
    resetResourceRegistry();
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [],
        text: async () => '[]',
      }),
    );
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    resetDeprecationWarnings();
    resetResourceRegistry();
    delete (globalThis as any).__ZENITH_DEV__;
  });

  it('dispose() clears auto-refresh interval and aborts in-flight; idempotent', async () => {
    const res = new Resource({ url: '/api/items' });
    res.startAutoRefresh(1000);
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    const abort = (res as any)._abortController as AbortController;
    res.dispose();
    expect(vi.getTimerCount()).toBe(0); // interval پاک شد (نشت تایمر = صفر)
    expect(abort.signal.aborted).toBe(true);
    expect(() => res.dispose()).not.toThrow();
    await vi.advanceTimersByTimeAsync(5000);
    expect(vi.getTimerCount()).toBe(0); // تایمر جدید ساخته نشد
  });

  it('dispose() removes the instance from the global registry (leak check)', () => {
    const res = createResource('r116a', { url: '/api/a' });
    expect(getResource('r116a')).toBe(res);
    res.dispose();
    expect(getResource('r116a')).toBeUndefined();
  });

  it('destroy() warns once ZEN-DEPR-023 and delegates to dispose', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const res = new Resource({ url: '/api/x' });
      res.destroy();
      res.destroy();
      const depr = warn.mock.calls.filter((c) => String(c[0]).includes('ZEN-DEPR-023'));
      expect(depr).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });

  it('processResource returns an idempotent Cleanup; also populates disposes[]', async () => {
    const el = document.createElement('div');
    el.setAttribute('zen-state', 'items');
    const disposes: (() => void)[] = [];
    const cleanup = processResource(
      el,
      '"/api/items"',
      {},
      (_n: HTMLElement, _c: Record<string, any>, _d: (() => void)[]) => {},
      disposes,
    );
    expect(typeof cleanup).toBe('function');
    expect(disposes).toHaveLength(1);
    expect(() => {
      cleanup();
      cleanup();
    }).not.toThrow();
  });
});
