// @vitest-environment jsdom
//
// #24 — تایمر fallback باید بلافاصله (همزمان با شروع run) ساخته شود، نه بعد
// از دو rAF؛ در تب پس‌زمینه rAF متوقف است، پس finished هرگز resolve نمی‌شد
// و المان منتظر leave برای همیشه می‌ماند. تایمر باید در finish/cancel پاک
// شود (بدون نشت).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTransition } from '../src/transition';

function makeEl(): HTMLElement {
  const el = document.createElement('div');
  document.body.innerHTML = '';
  document.body.appendChild(el);
  return el;
}

describe('transition controller: immediate fallback timer (#24)', () => {
  const originalRaf = globalThis.requestAnimationFrame;
  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
  });

  it('completes within duration + margin even when rAF never runs (background tab)', async () => {
    globalThis.requestAnimationFrame = () => 0; // توقف rAF مثل تب پس‌زمینه
    const onAfterLeave = vi.fn();
    const ctl = createTransition('fade', { duration: 40, onAfterLeave });
    const el = makeEl();

    await vi.waitFor(
      async () => {
        await ctl.leave(el).finished;
      },
      { timeout: 2000 },
    );

    expect(onAfterLeave).toHaveBeenCalledTimes(1);
    expect(el.className).toBe(''); // کلاس‌های موقت پاک شده‌اند
    ctl.dispose();
  });

  it('cancel() clears the fallback timer — no late completion callbacks', async () => {
    globalThis.requestAnimationFrame = () => 0;
    const onComplete = vi.fn();
    const ctl = createTransition('fade', { duration: 30, onComplete });
    const el = makeEl();

    const run = ctl.enter(el);
    run.cancel();
    await run.finished; // با رفع #24: cancel فوری resolve می‌کند
    await new Promise((r) => setTimeout(r, 120)); // گذشته مهلت fallback
    expect(onComplete).not.toHaveBeenCalled(); // finish(false) callbackها را نمی‌زند
    expect(el.className).toBe('');
    ctl.dispose();
  });

  it('natural finish clears the timer (no double-complete after margin)', async () => {
    let completed = 0;
    const ctl = createTransition('fade', { duration: 1000, onComplete: () => completed++ });
    const el = makeEl();
    const run = ctl.enter(el);
    // تسویهٔ طبیعی: transitionend روی خود المان بعد از اعمال کلاس‌ها
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    el.dispatchEvent(new Event('transitionend'));
    await run.finished;
    expect(completed).toBe(1);
    await new Promise((r) => setTimeout(r, 1100)); // مهلت fallback (duration+50)
    expect(completed).toBe(1); // تایمر پاک شده بود
    ctl.dispose();
  });
});
