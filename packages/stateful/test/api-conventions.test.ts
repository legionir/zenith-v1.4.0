// @vitest-environment jsdom
//
// #117 — یک مسیر نصب برای stateful: مسیر canonical `ZenithStatefulPlugin`
// (از طریق Zen.use یا install مستقیم) است و `installStatefulComponents()`
// alias منسوخ‌شونده (ZEN-DEPR-026؛ یک‌بار هشدار؛ Cleanup idempotent؛ حذف در
// ۲.۰ — DEC-026) روی همان پیاده‌سازی delegate می‌کند.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetDeprecationWarnings } from '@zenith/errors';
import { hasCustomDirective, clearCustomDirectives } from '@zenith/runtime';
import { ZenithStatefulPlugin, installStatefulComponents } from '../src/index';

const TAGS = ['zen-resource-view', 'zen-action-button', 'zen-auth-view'];

describe('#117 stateful single install path', () => {
  beforeEach(() => {
    resetDeprecationWarnings();
    clearCustomDirectives();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    clearCustomDirectives();
  });

  it('canonical plugin.install registers all three tags, no ZEN-DEPR warning', () => {
    ZenithStatefulPlugin.install({} as never, {});
    for (const tag of TAGS) expect(hasCustomDirective(tag)).toBe(true);
    expect(
      (console.warn as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
        String(c[0]).includes('ZEN-DEPR'),
      ),
    ).toHaveLength(0);
  });

  it('installStatefulComponents is a deprecated alias: warns once ZEN-DEPR-026', () => {
    const cleanup1 = installStatefulComponents();
    clearCustomDirectives();
    installStatefulComponents(); // بار دوم — هشدار تکراری ندارد
    const depr = (console.warn as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
      String(c[0]).includes('ZEN-DEPR-026'),
    );
    expect(depr).toHaveLength(1);
    expect(typeof cleanup1).toBe('function');
  });

  it('returned Cleanup unregisters and is idempotent', () => {
    const cleanup = installStatefulComponents();
    for (const tag of TAGS) expect(hasCustomDirective(tag)).toBe(true);
    cleanup();
    for (const tag of TAGS) expect(hasCustomDirective(tag)).toBe(false);
    expect(() => {
      cleanup();
      cleanup();
    }).not.toThrow();
  });
});
