// @vitest-environment jsdom
//
// #116 — FormStore: dispose idempotency + alias destroy ZEN-DEPR-022.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetDeprecationWarnings } from '@zenith/errors';
import { FormStore } from '../src/form';

describe('#116 FormStore dispose/cleanup', () => {
  beforeEach(() => {
    resetDeprecationWarnings();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    resetDeprecationWarnings();
    delete (globalThis as any).__ZENITH_DEV__;
  });

  it('dispose() clears pending async-validation timers and is idempotent', () => {
    const form = new FormStore({ email: { initial: '' } });
    // یک تایمر شبیه‌سازی‌شده روی private map.
    const t = setTimeout(() => {}, 1000);
    (form as any)._asyncValidationTimers.set('email', t);
    form.dispose();
    expect((form as any)._asyncValidationTimers.size).toBe(0);
    expect(() => form.dispose()).not.toThrow();
    expect(() => form.dispose()).not.toThrow();
  });

  it('destroy() is a deprecated alias warning once with ZEN-DEPR-022', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const form = new FormStore({ email: { initial: '' } });
      form.destroy();
      form.destroy();
      const depr = warn.mock.calls.filter((c) => String(c[0]).includes('ZEN-DEPR-022'));
      expect(depr).toHaveLength(1);
    } finally {
      warn.mockRestore();
    }
  });
});
