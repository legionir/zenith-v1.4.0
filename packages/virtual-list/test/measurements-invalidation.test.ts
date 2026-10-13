// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createVirtualList } from '../src/controller';

interface RowItem {
  id: string;
  height: number;
}

describe('virtual-list measurements invalidation & pruning (#18)', () => {
  let resizeCallbacks: ResizeObserverCallback[] = [];
  const OriginalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    resizeCallbacks = [];
    class MockResizeObserver {
      private cb: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.cb = cb;
        resizeCallbacks.push(cb);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
  });

  afterEach(() => {
    globalThis.ResizeObserver = OriginalResizeObserver;
    document.body.innerHTML = '';
  });

  it('invalidates cached measurements when item at the same index-key changes or list shrinks', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientHeight', { value: 200, configurable: true });
    document.body.appendChild(container);

    const items = signal<RowItem[]>([
      { id: 'a', height: 40 },
      { id: 'b', height: 60 },
      { id: 'c', height: 80 },
    ]);

    const vlist = createVirtualList({
      container,
      items,
      itemSize: (item) => item.height,
      renderItem: (item) => {
        const el = document.createElement('div');
        el.textContent = item.id;
        el.getBoundingClientRect = () => ({ height: item.height, width: 100 }) as DOMRect;
        return el;
      },
    });

    expect(vlist.getState().totalSize).toBe(180);

    // Simulate ResizeObserver measuring index 0 as 100px instead of 40px
    const node0 = container.querySelector('[data-zen-virtual-index="0"]') as HTMLElement;
    resizeCallbacks[0]?.(
      [
        {
          target: node0,
          contentRect: { height: 100, width: 100 },
        } as unknown as ResizeObserverEntry,
      ],
      {} as ResizeObserver,
    );
    expect(vlist.getState().totalSize).toBe(100 + 60 + 80);

    // Replace list with new items at the same default index keys -> stale 100px measurement must be invalidated!
    items.set([
      { id: 'x', height: 30 },
      { id: 'y', height: 50 },
    ]);
    flushSync();

    expect(vlist.getState().totalSize).toBe(80);
    expect(vlist.visibleItems.get().map((v) => v.offset)).toEqual([0, 30]);

    vlist.dispose();
  });

  it('supports invalidateMeasurements() and remeasure() APIs and prunes removed keys across 1000 replacements', () => {
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientHeight', { value: 200, configurable: true });
    document.body.appendChild(container);

    let customHeight = 50;
    const items = signal<RowItem[]>([
      { id: 'k1', height: 40 },
      { id: 'k2', height: 40 },
    ]);

    const vlist = createVirtualList({
      container,
      items,
      getItemKey: (item) => item.id,
      itemSize: (item) => item.height,
      renderItem: (item) => {
        const el = document.createElement('div');
        el.textContent = item.id;
        el.getBoundingClientRect = () => ({ height: customHeight, width: 100 }) as DOMRect;
        return el;
      },
    });

    expect(vlist.getState().totalSize).toBe(80);

    // remeasure() reads current DOM getBoundingClientRect (50px each => 100px total)
    vlist.remeasure();
    expect(vlist.getState().totalSize).toBe(100);

    // invalidateMeasurements('k1') reverts k1 to estimated 40px (40 + 50 = 90)
    vlist.invalidateMeasurements('k1');
    expect(vlist.getState().totalSize).toBe(90);

    // invalidateMeasurements() clears all -> 40 + 40 = 80
    vlist.invalidateMeasurements();
    expect(vlist.getState().totalSize).toBe(80);

    // 1000 list replacements with distinct keys must prune old keys and compute exact totalSize
    for (let i = 0; i < 1000; i++) {
      items.set([
        { id: `batch-${i}-0`, height: 25 },
        { id: `batch-${i}-1`, height: 35 },
      ]);
      flushSync();
      vlist.remeasure();
    }
    // After 1000 replacements, invalidateMeasurements returns to exact sum of current 2 items (60)
    vlist.invalidateMeasurements();
    expect(vlist.getState().totalSize).toBe(60);

    vlist.dispose();
  });
});
