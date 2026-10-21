// @vitest-environment jsdom
//
// #116 — router: beforeEach و registerRouterCleanup باید Cleanup برگردانند.
//   * خروجی beforeEach یک تابع idempotent است و فقط guard خودش را حذف می‌کند.
//   * navigate بعد از remove دیگر آن guard را اجرا نمی‌کند.
import { describe, it, expect, beforeEach } from 'vitest';
import { beforeEach as zenBeforeEach, navigate, cleanupRouter } from '../src/router';

describe('#116 router registration cleanup', () => {
  beforeEach(() => {
    cleanupRouter();
  });

  it('beforeEach returns an idempotent Cleanup removing only its own guard', async () => {
    let callsA = 0;
    let callsB = 0;
    const removeA = zenBeforeEach(() => {
      callsA++;
      return true;
    });
    zenBeforeEach(() => {
      callsB++;
      return true;
    });
    expect(typeof removeA).toBe('function');

    await navigate('/page-1');
    expect(callsA).toBe(1);
    expect(callsB).toBe(1);

    removeA();
    removeA(); // idempotent — دوباره بی‌اثر
    await navigate('/page-2');
    expect(callsA).toBe(1); // دیگر اجرا نشده
    expect(callsB).toBe(2); // guard دوم دست‌نخورده
  });
});
