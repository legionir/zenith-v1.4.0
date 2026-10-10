// @vitest-environment jsdom
//
// #23 — پایان transition باید بر اساس طولانی‌ترین transition/animation واقعی
// باشد، نه اولین transitionend. رویدادهای bubbleشده از فرزندان نادیده گرفته
// می‌شوند؛ property زودرس (opacity در ۰٫۱s وقتی transform تا ۰٫۵s انیمیت
// می‌شود) نباید المان را زود حذف کند.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTransition } from '../src/transition';

describe('transition controller: longest-duration completion (#23)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function twoPropElement(): HTMLElement {
    const el = document.createElement('div');
    el.style.transitionProperty = 'opacity, transform';
    el.style.transitionDuration = '0.1s, 0.5s';
    el.style.transitionDelay = '0s, 0s';
    const child = document.createElement('span');
    el.appendChild(child);
    document.body.innerHTML = '';
    document.body.appendChild(el);
    return el;
  }

  it('a bubbled transitionend from a child does not finish the run', async () => {
    vi.useFakeTimers();
    const onAfterLeave = vi.fn();
    const ctl = createTransition('fade', { duration: 100, onAfterLeave });
    const el = twoPropElement();
    const child = el.firstElementChild as HTMLElement;

    const run = ctl.leave(el);
    await vi.advanceTimersByTimeAsync(50); // اجرای دو rAF (fake, هر ۱۶ms)
    child.dispatchEvent(new Event('transitionend', { bubbles: true }));
    expect(onAfterLeave).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1000); // fallback deadline: max(۱۰۰, ۵۰۰)+۵۰
    await run.finished;
    expect(onAfterLeave).toHaveBeenCalledTimes(1);
    ctl.dispose();
  });

  it('a first transitionend on the element does not finish before the longest deadline', async () => {
    vi.useFakeTimers();
    const onAfterLeave = vi.fn();
    const ctl = createTransition('fade', { duration: 100, onAfterLeave });
    const el = twoPropElement();

    const run = ctl.leave(el);
    await vi.advanceTimersByTimeAsync(50); // rAFها؛ مدت واقعی = ۵۰۰ms (transform)

    // opacity (property اول) زود تمام شده؛ event با target=self
    const early = new Event('transitionend');
    Object.defineProperty(early, 'target', { value: el });
    el.dispatchEvent(early);
    expect(onAfterLeave).not.toHaveBeenCalled(); // قرمز قبل از رفع: اولین event فوری finish می‌کرد

    await vi.advanceTimersByTimeAsync(600); // گذشت deadline طولانی‌ترین property
    await run.finished;
    expect(onAfterLeave).toHaveBeenCalledTimes(1);
    expect(el.className).toBe(''); // کلاس‌های موقت حذف شده‌اند
    ctl.dispose();
  });

  it('measures animation duration × iteration-count', async () => {
    vi.useFakeTimers();
    const onComplete = vi.fn();
    const ctl = createTransition('fade', { duration: 50, onComplete });
    const el = document.createElement('div');
    el.style.animationName = 'spin';
    el.style.animationDuration = '0.2s';
    el.style.animationIterationCount = '3';
    document.body.innerHTML = '';
    document.body.appendChild(el);

    const run = ctl.enter(el);
    await vi.advanceTimersByTimeAsync(50); // rAFها؛ مدت واقعی = ۶۰۰ms
    const end = new Event('animationend');
    Object.defineProperty(end, 'target', { value: el });
    el.dispatchEvent(end);
    expect(onComplete).not.toHaveBeenCalled(); // زودتر از ۳×۰٫۲s

    await vi.advanceTimersByTimeAsync(700);
    await run.finished;
    expect(onComplete).toHaveBeenCalledTimes(1);
    ctl.dispose();
  });

  it('zero-duration CSS finishes promptly via the configured-duration fallback', async () => {
    vi.useFakeTimers();
    const onAfterEnter = vi.fn();
    const ctl = createTransition('fade', { duration: 100, onAfterEnter });
    const el = document.createElement('div');
    document.body.innerHTML = '';
    document.body.appendChild(el);

    const run = ctl.enter(el);
    await vi.advanceTimersByTimeAsync(160); // ۱۰۰+۵۰ fallback
    await run.finished;
    expect(onAfterEnter).toHaveBeenCalledTimes(1);
    ctl.dispose();
  });
});
