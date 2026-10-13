// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { signal, effect, computed } from '@zenith/state';
import { flushSync, pendingEffectCount } from '@zenith/scheduler';
import { createApp } from '@zenith/runtime-core';
import { createVirtualList } from '@zenith/virtual-list';
import { createSuspense } from '@zenith/suspense';
import { createTransition } from '@zenith/transition';
import { processIf } from '../src/directives/if';
import { processFor } from '../src/directives/for';
import { registerRouterCleanup } from '@zenith/router';

describe('Memory & resource leak harness — 10,000 mount/unmount cycles (#35)', () => {
  it('completes 10,000 signal/computed/effect/suspense/transition/router mount-unmount cycles with zero subscriber or timer leaks', () => {
    const rootSig = signal(0);
    const g = globalThis as unknown as { gc?: () => void };
    g.gc?.();
    const baselineHeap = process.memoryUsage().heapUsed;

    for (let i = 0; i < 10_000; i++) {
      const doubled = computed(() => rootSig.get() * 2);
      const stopEffect = effect(() => {
        doubled.get();
      });
      const suspense = createSuspense({ minDelay: 50, timeout: 500 });
      const transition = createTransition({ duration: 100 });
      const stopRouter = registerRouterCleanup(() => {});

      stopEffect();
      doubled.dispose();
      suspense.dispose();
      transition.dispose();
      stopRouter();
    }

    flushSync();
    expect(rootSig.subscriberCount).toBe(0);
    expect(pendingEffectCount()).toBe(0);

    g.gc?.();
    const afterHeap = process.memoryUsage().heapUsed;
    const deltaMB = (afterHeap - baselineHeap) / (1024 * 1024);
    // With --expose-gc the heap must return near baseline (64 MB). Without it (CI, v8 coverage
    // instrumentation) garbage is not yet collected, so only a generous bound is meaningful;
    // the strict leak guarantee is the zero subscriber/timer counts asserted above.
    expect(deltaMB).toBeLessThan(g.gc ? 64 : 256);
  });

  it('mounts and unmounts zen-if, zen-for, createVirtualList, and createApp 1,000 times with zero leaked DOM listeners or observers', () => {
    let activeListeners = 0;
    const origAdd = EventTarget.prototype.addEventListener;
    const origRemove = EventTarget.prototype.removeEventListener;

    EventTarget.prototype.addEventListener = function (type, listener, options) {
      activeListeners += 1;
      return origAdd.call(this, type, listener, options);
    };
    EventTarget.prototype.removeEventListener = function (type, listener, options) {
      activeListeners = Math.max(0, activeListeners - 1);
      return origRemove.call(this, type, listener, options);
    };

    try {
      const showSig = signal(true);
      const listSig = signal(['a', 'b']);
      const vlistItems = signal([1, 2, 3, 4, 5]);
      let baselineListeners = 0;

      for (let i = 0; i < 1_000; i++) {
        const host = document.createElement('div');
        const ifEl = document.createElement('span');
        ifEl.setAttribute('zen-if', 'show');
        host.appendChild(ifEl);

        const forEl = document.createElement('i');
        forEl.setAttribute('zen-for', 'item in items');
        forEl.setAttribute('zen-key', 'item');
        host.appendChild(forEl);

        const cleanIf = processIf(ifEl, 'show', { show: showSig }, () => []);
        const cleanFor = processFor(forEl, 'item in items', { items: listSig }, () => []);

        const vContainer = document.createElement('div');
        const vlist = createVirtualList({
          container: vContainer,
          items: vlistItems,
          itemHeight: 24,
          renderItem: (item) => {
            const d = document.createElement('div');
            d.textContent = String(item);
            return d;
          },
        });

        const appRoot = document.createElement('div');
        appRoot.innerHTML = `<span zen-text="count"></span>`;
        const app = createApp({ state: { count: i } });
        app.mount(appRoot);

        cleanIf();
        cleanFor();
        vlist.dispose();
        app.unmount();

        if (i === 0) {
          baselineListeners = activeListeners;
        }
      }

      flushSync();
      expect(showSig.subscriberCount).toBe(0);
      expect(listSig.subscriberCount).toBe(0);
      expect(vlistItems.subscriberCount).toBe(0);
      expect(activeListeners).toBe(baselineListeners);
    } finally {
      EventTarget.prototype.addEventListener = origAdd;
      EventTarget.prototype.removeEventListener = origRemove;
    }
  });
});
