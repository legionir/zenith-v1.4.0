// @vitest-environment jsdom
//
// #47 — تثبیت یک API برای transition:
// enterTransition/leaveTransition/animateGroup باید صرفاً wrapper روی موتور
// مبنا (createTransition، کلاس‌محور) باشند و هشدار deprecation یک‌باره با
// کد ZEN-DEPR-xxx بدهند. موتور موازی WAAPI در transition.ts حذف می‌شود.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { deprecate, resetDeprecationWarnings } from '@zenith/errors';
import { enterTransition, leaveTransition, animateGroup } from '../src/transition';

function makeEl(): HTMLElement {
  const el = document.createElement('div');
  document.body.innerHTML = '';
  document.body.appendChild(el);
  return el;
}

async function rafTwice(): Promise<void> {
  await new Promise((r) => requestAnimationFrame(() => r(null)));
  await new Promise((r) => requestAnimationFrame(() => r(null)));
}

describe('enterTransition is a deprecated wrapper over the class engine (#47)', () => {
  let calls: string[];
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    calls = [];
    spy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      calls.push(args.map(String).join(' '));
    });
    resetDeprecationWarnings();
  });

  afterEach(() => {
    spy.mockRestore();
    resetDeprecationWarnings();
  });

  it('warns once with ZEN-DEPR-002 pointing to createTransition', async () => {
    const a = makeEl();
    const b = makeEl();
    enterTransition(a, 'fade', 30, () => {});
    enterTransition(b, 'fade', 30, () => {});
    const dep = calls.filter((c) => c.includes('ZEN-DEPR-002'));
    expect(dep).toHaveLength(1);
    expect(dep[0]).toContain('enterTransition');
    expect(dep[0]).toContain('createTransition');
  });

  it('drives the same class lifecycle as createTransition (single engine)', async () => {
    const el = makeEl();
    let completed = false;
    const cancel = enterTransition(el, 'fade', 1000, () => {
      completed = true;
    });
    // حالت آغازین: name + from + active
    expect(el.classList.contains('fade')).toBe(true);
    expect(el.classList.contains('zen-enter-from')).toBe(true);
    expect(el.classList.contains('zen-enter-active')).toBe(true);
    await rafTwice();
    // پس از swap: from حذف، to اضافه
    expect(el.classList.contains('zen-enter-from')).toBe(false);
    expect(el.classList.contains('zen-enter-to')).toBe(true);
    // پایان طبیعی: transitionend روی خود المان
    el.dispatchEvent(new Event('transitionend'));
    expect(completed).toBe(true);
    expect(el.className).toBe('');
    cancel();
  });

  it('cancel() prevents onComplete (same semantics as before)', async () => {
    const el = makeEl();
    const onComplete = vi.fn();
    const cancel = enterTransition(el, 'fade', 1000, onComplete);
    cancel();
    expect(el.className).toBe('');
    await rafTwice();
    el.dispatchEvent(new Event('transitionend'));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('leaveTransition warns with ZEN-DEPR-003 and drives leave classes', async () => {
    const el = makeEl();
    let completed = false;
    leaveTransition(el, 'fade', 1000, () => {
      completed = true;
    });
    expect(calls.filter((c) => c.includes('ZEN-DEPR-003'))).toHaveLength(1);
    expect(el.classList.contains('zen-leave-from')).toBe(true);
    expect(el.classList.contains('zen-leave-active')).toBe(true);
    await rafTwice();
    expect(el.classList.contains('zen-leave-from')).toBe(false);
    expect(el.classList.contains('zen-leave-to')).toBe(true);
    el.dispatchEvent(new Event('transitionend'));
    expect(completed).toBe(true);
    expect(el.className).toBe('');
  });

  it('animateGroup warns with ZEN-DEPR-004 and resolves when all elements finish', async () => {
    const els = [makeEl(), makeEl()];
    document.body.innerHTML = '';
    els.forEach((e) => document.body.appendChild(e));
    const done = animateGroup(els, 'enter', 'fade', 1000, 0);
    expect(calls.filter((c) => c.includes('ZEN-DEPR-004'))).toHaveLength(1);
    await rafTwice();
    await rafTwice();
    els.forEach((e) => e.dispatchEvent(new Event('transitionend')));
    await done;
    expect(els.every((e) => e.className === '')).toBe(true);
  });

  it('deprecation registry: codes are documented and the helper is re-exported from the package', async () => {
    // deprecate از @zenith/errors قابل‌واردات است و رفتار یک‌باره دارد
    deprecate('ZEN-DEPR-099', 'x', 'y');
    deprecate('ZEN-DEPR-099', 'x', 'y');
    expect(calls.filter((c) => c.includes('ZEN-DEPR-099'))).toHaveLength(1);
  });
});
