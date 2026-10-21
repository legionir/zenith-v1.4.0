// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { createVirtualList } from '../src/index';

describe('@zenith/virtual-list 100k items, variable height, horizontal & RTL (#89)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('dir');
    container = document.createElement('div');
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(container, 'clientWidth', { value: 600, configurable: true });
    document.body.appendChild(container);
    // Warm up jsdom's lazy CSSOM parser before timing virtual-list mount
    void getComputedStyle(container).position;
  });

  it('mounts 100,000 fixed-height items in < 50ms and keeps DOM node count bounded during scroll', () => {
    const items = Array.from({ length: 100_000 }, (_, i) => ({ id: i, label: `Row #${i}` }));
    const t0 = performance.now();
    const list = createVirtualList({
      container,
      items,
      itemSize: 40,
      overscan: 3,
      renderItem: (item) => {
        const el = document.createElement('div');
        el.textContent = item.label;
        return el;
      },
    });
    const mountMs = performance.now() - t0;
    expect(mountMs).toBeLessThan(50);

    const content = container.querySelector('.zen-virtual-list-content')!;
    expect(content.children.length).toBeLessThanOrEqual(20);
    expect(list.getState().totalSize).toBe(4_000_000);

    // Simulate 50 rapid scroll jumps across 4,000,000px
    const scrollStart = performance.now();
    for (let step = 1; step <= 50; step++) {
      list.scrollToOffset(step * 75_000);
      expect(content.children.length).toBeLessThanOrEqual(25);
    }
    const avgFrameMs = (performance.now() - scrollStart) / 50;
    expect(avgFrameMs).toBeLessThan(16);

    list.dispose();
  });

  it('supports 100,000 variable-height items and accurate scrollToIndex(start | center | end)', () => {
    const items = Array.from({ length: 100_000 }, (_, i) => i);
    const list = createVirtualList({
      container,
      items,
      itemSize: (_item, index) => 30 + (index % 4) * 10, // 30, 40, 50, 60 (avg 45)
      overscan: 2,
      renderItem: (item) => {
        const el = document.createElement('div');
        el.textContent = `Item ${item}`;
        return el;
      },
    });

    // Total size = 25,000 * (30 + 40 + 50 + 60) = 4,500,000
    expect(list.getState().totalSize).toBe(4_500_000);

    list.scrollToIndex(50_000, 'start');
    // Offset of index 50,000 = 12,500 * 180 = 2,250,000
    expect(list.getState().offset).toBe(2_250_000);

    list.scrollToIndex(50_000, 'center');
    // itemSize at 50,000 is 30; viewport is 400 -> offset = 2,250,000 - (400 - 30)/2 = 2,249,815
    expect(list.getState().offset).toBe(2_249_815);

    list.scrollToIndex(50_000, 'end');
    // offset = 2,250,000 - (400 - 30) = 2,249,630
    expect(list.getState().offset).toBe(2_249_630);

    list.dispose();
  });

  it('positions items from right-to-left with negative translateX in horizontal RTL mode', () => {
    container.setAttribute('dir', 'rtl');
    const items = Array.from({ length: 1_000 }, (_, i) => `ستون ${i}`);
    const list = createVirtualList({
      container,
      items,
      direction: 'horizontal',
      itemSize: 100,
      overscan: 2,
      renderItem: (label) => {
        const el = document.createElement('div');
        el.textContent = label;
        return el;
      },
    });

    const firstNode = container.querySelector('[data-zen-virtual-index="1"]') as HTMLElement;
    expect(firstNode).toBeTruthy();
    expect(firstNode.style.right).toBe('0px');
    expect(firstNode.style.transform).toBe('translateX(-100px)');

    list.scrollToIndex(20, 'start');
    expect(container.scrollLeft).toBe(-2000);
    expect(list.getState().offset).toBe(2000);
    expect(list.visibleItems.get().some((v) => v.index === 20)).toBe(true);

    list.dispose();
  });
});
