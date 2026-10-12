// @vitest-environment jsdom
//
// #116 — processDOM باید Cleanup idempotent برگرداند (بدون نیاز به
// root.__zenithDisposes)؛ آرایهٔ __zenithDisposes هم برای سازگاری می‌ماند.
import { describe, it, expect } from 'vitest';
import { signal } from '@zenith/state';
import { processDOM } from '../src/walker';

describe('#116 processDOM cleanup', () => {
  it('returns an idempotent Cleanup and keeps __zenithDisposes (compat)', () => {
    const $count = signal(0);
    const root = document.createElement('div');
    root.innerHTML = '<span id="t" zen-text="$count"></span>';
    const cleanup = processDOM(root, { count: $count });
    expect(typeof cleanup).toBe('function');
    expect(root.innerHTML).toContain('</span>');
    expect(Array.isArray((root as any).__zenithDisposes)).toBe(true);

    cleanup();
    cleanup(); // idempotent — نباید throw کند
    // disposes drain شده (سازگاری: همان آرایهٔ خالی روی root)
    expect((root as any).__zenithDisposes).toHaveLength(0);
    // اثر dispose: text دیگر با تغییر signal آپدیت نمی‌شود
    const before = root.querySelector('#t')!.textContent;
    $count.set(42);
    expect(root.querySelector('#t')!.textContent).toBe(before);
  });
});
