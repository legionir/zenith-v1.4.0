// #117 — یک نام برای schedule/scheduleEffect: `scheduleEffect` مبنا و
// `schedule` alias منسوخ‌شونده (ZEN-DEPR-025؛ هشدار یک‌بار؛ حذف در 2.0 — DEC-026).
// رفتار یکسان: همان تابع را به همان queue ثبت می‌کند.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resetDeprecationWarnings } from '@zenith/errors';
import {
  schedule,
  scheduleEffect,
  flushSync,
  pendingEffectCount,
  clearScheduler,
  Priority,
} from '../src/scheduler';

describe('#117 schedule → scheduleEffect unification', () => {
  beforeEach(() => {
    resetDeprecationWarnings();
    clearScheduler();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    clearScheduler();
  });

  it('schedule() registers the same effect and warns once with ZEN-DEPR-025', () => {
    let ran = 0;
    const fn = () => ran++;
    schedule(fn);
    schedule(fn); // یک‌بار هشدار به‌ازای کد
    expect(
      (console.warn as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
        String(c[0]).includes('ZEN-DEPR-025'),
      ),
    ).toHaveLength(1);
    flushSync();
    expect(ran).toBe(1);
  });

  it('scheduleEffect() is silent (canonical name)', () => {
    scheduleEffect(() => {});
    flushSync();
    expect(
      (console.warn as ReturnType<typeof vi.fn>).mock.calls.filter((c) =>
        String(c[0]).includes('ZEN-DEPR'),
      ),
    ).toHaveLength(0);
  });

  it('schedule(fn, Priority.idle) delegates priority + disposed args identically', () => {
    let ran = 0;
    const fn = () => ran++;
    schedule(fn, Priority.idle, () => true); // disposed=true ⇒ اجرا نمی‌شود
    expect(pendingEffectCount()).toBe(1);
    flushSync();
    expect(ran).toBe(0);
  });
});
