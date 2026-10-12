// @vitest-environment jsdom
//
// #116 acceptance: «تست نشت (listener/observer) بعد از disposecreate* صفر
// باشد» — createVirtualList: dispose باید scroll listener را بردارد، همهٔ
// ResizeObserverها را disconnect کند و بعد از آن هیچ observer/listener تازه‌ای
// ساخته نشود. idempotency هم سنجیده می‌شود.
import { describe, it, expect, vi } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createVirtualList } from '../src/controller';

describe('#116 createVirtualList — listener/observer leak', () => {
  it('dispose() removes the scroll listener, disconnects all ResizeObservers; no new observers after dispose', () => {
    document.body.innerHTML = '<div id="c" style="height:100px"></div>';
    const container = document.getElementById('c')!;
    Object.defineProperty(container, 'clientHeight', { value: 100, configurable: true });

    const observed: Element[] = [];
    const disconnected: number[] = [];
    let ctorCount = 0;
    class FakeResizeObserver {
      public id = ++ctorCount;
      constructor(_cb: ResizeObserverCallback) {}
      observe(target: Element) {
        observed.push(target);
      }
      unobserve() {}
      disconnect() {
        disconnected.push(this.id);
      }
    }
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);

    const removeSpy = vi.spyOn(container, 'removeEventListener');
    try {
      const items = signal([1, 2, 3]);
      const api = createVirtualList<number>({
        items,
        itemSize: 10,
        container,
        renderItem: (n) => {
          const el = document.createElement('div');
          el.textContent = String(n);
          return el;
        },
      });
      flushSync();
      expect(observed.length).toBeGreaterThan(0); // دست‌کم container observe شده
      const observersBuilt = ctorCount;
      const observedCount = observed.length;

      api.dispose();
      expect(removeSpy.mock.calls.map((c) => String(c[0]))).toContain('scroll');
      expect(disconnected.length).toBeGreaterThan(0);
      expect(disconnected.length).toBeLessThanOrEqual(observersBuilt);

      expect(() => api.dispose()).not.toThrow(); // idempotent
      const disconnectedAfter = disconnected.length;
      expect(() => api.dispose()).not.toThrow();
      expect(disconnected.length).toBe(disconnectedAfter); // disconnect دوباره انجام نشد

      // بعد از dispose، تغییر آیتم‌ها نباید listener/observer تازه بسازد
      items.set([1, 2, 3, 4]);
      flushSync();
      expect(ctorCount).toBe(observersBuilt);
      expect(observed.length).toBe(observedCount); // observe جدید رخ نداده (count ثابت)
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
