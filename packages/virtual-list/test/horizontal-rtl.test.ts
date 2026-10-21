// @vitest-environment jsdom
//
// #100 — horizontal virtual-list inherits RTL from an ancestor (explicit dir
// on the container is covered in scale-100k-rtl.test.ts). Code-first tests,
// not executed.
import { describe, it, expect, beforeEach } from 'vitest';
import { createVirtualList } from '../src/index';

describe('@zenith/virtual-list inherited horizontal RTL (#100)', () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    document.body.innerHTML = '';
    document.documentElement.removeAttribute('dir');
    const host = document.createElement('div');
    host.setAttribute('dir', 'rtl');
    container = document.createElement('div');
    Object.defineProperty(container, 'clientHeight', { value: 400, configurable: true });
    Object.defineProperty(container, 'clientWidth', { value: 600, configurable: true });
    host.appendChild(container);
    document.body.appendChild(host);
    void getComputedStyle(container).position;
  });

  it('positions items from right-to-left without an explicit dir on the container', () => {
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

    list.dispose();
  });
});
