// @vitest-environment jsdom
//
// #116 — process* باید همیشه Cleanup برگرداند (acceptance: «همهٔ process*
// نوع بازگشتی () => void دارند»):
//   * processErrorBoundary: unsubscribe از hub + dispose فرزندان، idempotent.
//   * processSuspense: در SSR (document تعریف‌نشده) هم Cleanup می‌دهد.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { clearErrorHistory } from '@zenith/errors';
import { flushSync } from '@zenith/scheduler';
import { processErrorBoundary, reportError } from '@zenith/error-boundary';
import { processSuspense, createSuspense } from '@zenith/suspense';

describe('#116 process* return Cleanup', () => {
  beforeEach(() => {
    clearErrorHistory();
  });

  it('createSuspense: dispose() clears pending minDelay timer — zero timer leak', () => {
    vi.useFakeTimers();
    try {
      const ctl = createSuspense({ minDelay: 50 });
      ctl.track(new Promise(() => {})); // همیشه pending ⇒ loadingTimer ساخته می‌شود
      flushSync(); // اجرای effect (batched)
      expect(vi.getTimerCount()).toBeGreaterThan(0);
      ctl.dispose();
      expect(vi.getTimerCount()).toBe(0); // acceptance: نشت تایمر صفر
      expect(() => ctl.dispose()).not.toThrow(); // idempotent
      ctl.track(new Promise(() => {})); // بعد از dispose بی‌اثر
      flushSync();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('processErrorBoundary returns an idempotent Cleanup that unsubscribes', () => {
    const el = document.createElement('div');
    const child = document.createElement('span');
    el.appendChild(child);
    let childDisposed = 0;

    const disposes: (() => void)[] = [];
    const cleanup = processErrorBoundary(
      el,
      (_node: HTMLElement, d: (() => void)[]) => {
        d.push(() => childDisposed++);
      },
      disposes,
    );

    expect(typeof cleanup).toBe('function');
    expect(disposes).toHaveLength(1); // سازگاری: آرایه هم پر می‌شود

    cleanup();
    cleanup(); // idempotent — فرزند یک‌بار dispose می‌شود
    expect(childDisposed).toBe(1);

    // unsubscribe: خطای جدید نباید fallback را عوض کند
    el.innerHTML = 'after';
    reportError('boom', 'directive', { element: document.createElement('i') });
    expect(el.innerHTML).toBe('after');
  });

  it('processSuspense returns no-op Cleanup under SSR (no document)', () => {
    const original = Object.getOwnPropertyDescriptor(globalThis, 'document');
    try {
      Object.defineProperty(globalThis, 'document', {
        value: undefined,
        configurable: true,
        writable: true,
      });
      const cleanup = processSuspense({} as HTMLElement, () => {}, {}, []);
      expect(typeof cleanup).toBe('function');
      expect(() => {
        cleanup();
        cleanup();
      }).not.toThrow();
    } finally {
      if (original) Object.defineProperty(globalThis, 'document', original);
    }
  });
});
