// @vitest-environment jsdom
//
// #116 acceptance: «تست نشت (listener/timer) بعد از disposecreate* صفر باشد»
// — createTransition: dispose باید listenerهای transitionend/animationend را
// بردارد و run بعد از dispose بی‌اثر باشد (بدون listener/timer تازه).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTransition } from '../src/transition';

describe('#116 createTransition — listener/timer leak', () => {
  const originalRaf = globalThis.requestAnimationFrame;
  afterEach(() => {
    globalThis.requestAnimationFrame = originalRaf;
  });

  it('dispose() removes transitionend/animationend listeners; idempotent', () => {
    globalThis.requestAnimationFrame = () => 0; // مثل تب پس‌زمینه: run فقط با تایمر تمام می‌شود
    const el = document.createElement('div');
    document.body.appendChild(el);

    const removeSpy = vi.spyOn(el, 'removeEventListener');
    const ctl = createTransition('fade', { duration: 30 });
    void ctl.enter(el); // listenerها همزمان با enter ساخته می‌شوند
    ctl.dispose();

    const removedTypes = removeSpy.mock.calls.map((c) => String(c[0]));
    expect(removedTypes).toEqual(
      expect.arrayContaining([
        'transitionend',
        'transitioncancel',
        'animationend',
        'animationcancel',
      ]),
    );
    expect(() => ctl.dispose()).not.toThrow(); // idempotent
  });

  it('after dispose(), run() is inert: no listeners added, no timers left pending', () => {
    vi.useFakeTimers();
    try {
      globalThis.requestAnimationFrame = () => 0;
      const el = document.createElement('div');
      const addSpy = vi.spyOn(el, 'addEventListener');
      const ctl = createTransition('fade', { duration: 100 });
      ctl.dispose();
      const run = ctl.enter(el); // مسیر disposed ⇒ createCompletedRun
      expect(addSpy).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0); // بدون تایمر معلّق
      void run.finished;
    } finally {
      vi.useRealTimers();
    }
  });
});
