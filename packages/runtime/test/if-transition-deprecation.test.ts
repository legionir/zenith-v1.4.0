// @vitest-environment jsdom
//
// #47 — تثبیت یک API: مصرف‌کنندهٔ داخلی فریم‌ورک (دایرکتیو zen-if) باید روی
// API مبنا (createTransition) کار کند؛ اجرای transition در zen-if نباید هیچ
// هشدار ZEN-DEPR برای برنامهٔ کاربر تولید کند.
// قرمز قبل از رفع: if.ts از enterTransition/leaveTransition deprecated استفاده
// می‌کرد و همان فراخوانی هشدار می‌داد.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { resetDeprecationWarnings } from '@zenith/errors';
import { processIf } from '../src/directives/if';

describe('zen-if uses the base transition API without deprecation noise (#47)', () => {
  let warns: string[];
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warns = [];
    spy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      warns.push(args.map(String).join(' '));
    });
    resetDeprecationWarnings();
  });

  afterEach(() => {
    spy.mockRestore();
    resetDeprecationWarnings();
  });

  it('enter + leave through processIf emits no ZEN-DEPR warnings', async () => {
    document.body.innerHTML =
      '<div id="p"><div id="t" zen-if="$show" zen-transition="fade">hi</div></div>';
    const el = document.getElementById('t')!;
    // شروع با false: المان placeholder است؛ اولین toggle → enter (مسیر
    // transition) که در کد قدیمی حتماً ZEN-DEPR-002 را لاگ می‌کرد.
    const show = signal(false);
    const ctx: Record<string, any> = {};
    Object.defineProperty(ctx, '$show', { get: () => show.get(), enumerable: true });

    const dispose = processIf(el, '$show', ctx, () => []);

    show.set(true);
    flushSync(); // enter: کلاس‌ها ست می‌شوند
    expect(el.classList.contains('zen-enter-active')).toBe(true);
    show.set(false);
    flushSync(); // leave
    // پایان طبیعی leave (بدون انتظار برای rAF/transitionend): dispatch event
    el.dispatchEvent(new Event('transitionend'));

    const dep = warns.filter((w) => w.includes('ZEN-DEPR'));
    expect(dep).toHaveLength(0);

    dispose();
    // پاک‌سازی: هیچ لیسنر transition باقی نمی‌ماند؛ dispatch بعدی نباید throw کند
    el.dispatchEvent(new Event('transitionend'));
  });

  it('class lifecycle of zen-if transition still applies enter/leave classes', async () => {
    document.body.innerHTML =
      '<div id="p"><div id="t2" zen-if="$show" zen-transition="fade">hi</div></div>';
    const el = document.getElementById('t2')!;
    const show = signal(true);
    const ctx: Record<string, any> = {};
    Object.defineProperty(ctx, '$show', { get: () => show.get(), enumerable: true });

    const dispose = processIf(el, '$show', ctx, () => []);
    // در حالت mount، موتور enter باید کلاس‌ها را ست کرده باشد
    expect(el.classList.contains('zen-enter-active')).toBe(true);
    expect(warns.filter((w) => w.includes('ZEN-DEPR'))).toHaveLength(0);
    dispose();
  });
});
