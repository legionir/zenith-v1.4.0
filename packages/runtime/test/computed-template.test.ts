// @vitest-environment jsdom
// #187 — acceptance: computed در zen-text با تغییر منبع زنده update می‌شود.
// این تست همان سناریوی README quickstart را در jsdom (بدون workaround signal+effect)
// ران می‌کند: Zen.start + Zen.action + computed مستقیم در state.
import { describe, it, expect } from 'vitest';
import { signal, computed } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';

describe('computed in zen-text end-to-end (#187)', () => {
  it('zen-text with a computed updates when the source signal changes', async () => {
    document.body.innerHTML =
      '<div id="app"><span id="c" zen-text="$count"></span><span id="d" zen-text="$double"></span>' +
      '<button id="inc" zen-action="inc"></button></div>';
    const { Zen } = await import('../src/index');

    const count = signal(0);
    const double = computed(() => count.get() * 2);

    Zen.action('inc', ({ state }: any) => state.count.set(state.count.get() + 1));
    Zen.start(document.getElementById('app') as HTMLElement, { count, double });
    flushSync();

    expect(document.getElementById('c')!.textContent).toBe('0');
    expect(document.getElementById('d')!.textContent).toBe('0');

    document
      .getElementById('inc')!
      .dispatchEvent(new (globalThis as any).MouseEvent('click', { bubbles: true }));
    flushSync();
    flushSync();

    expect(document.getElementById('c')!.textContent).toBe('1');
    // red قبل از #187 fix: $double اسنپ‌شات 0 می‌ماند
    expect(document.getElementById('d')!.textContent).toBe('2');

    document
      .getElementById('inc')!
      .dispatchEvent(new (globalThis as any).MouseEvent('click', { bubbles: true }));
    document
      .getElementById('inc')!
      .dispatchEvent(new (globalThis as any).MouseEvent('click', { bubbles: true }));
    flushSync();
    flushSync();

    expect(document.getElementById('c')!.textContent).toBe('3');
    expect(document.getElementById('d')!.textContent).toBe('6');
  });
});
