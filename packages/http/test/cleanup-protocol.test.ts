//
// #116 — http: setHttpConfig باید Cleanup برگرداند (بازگرداندن config قبلی).
import { describe, it, expect } from 'vitest';
import { setHttpConfig, getHttpConfig } from '@zenith/http';

describe('#116 http setHttpConfig cleanup', () => {
  it('returns an idempotent Cleanup restoring the previous config', () => {
    const before = getHttpConfig();
    const restore = setHttpConfig({ timeout: 1234 });
    expect(typeof restore).toBe('function');
    expect(getHttpConfig().timeout).toBe(1234);

    restore();
    restore(); // idempotent
    expect(getHttpConfig().timeout).toBe(before.timeout);

    // config جدید کاربر نباید با restore قدیمی پاک شود.
    const restore2 = setHttpConfig({ timeout: 4321 });
    restore(); // دیگر بی‌اثر است (cleaned)
    expect(getHttpConfig().timeout).toBe(4321);
    restore2();
    expect(getHttpConfig().timeout).toBe(before.timeout);
  });
});
