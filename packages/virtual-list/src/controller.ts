import { effect, signal, type ReadonlySignal, type Signal } from '@zenith/state';

export type VirtualListDirection = 'vertical' | 'horizontal';
export type ScrollAlignment = 'start' | 'center' | 'end';
export type VirtualItemSize<T> = number | ((item: T, index: number) => number);

export interface VirtualItem<T> {
  item: T;
  index: number;
  offset: number;
}

export interface ScrollInfo {
  offset: number;
  viewportSize: number;
  totalSize: number;
  direction: VirtualListDirection;
}

export interface VirtualListOptions<T> {
  items: T[] | Signal<T[]>;
  itemSize: VirtualItemSize<T>;
  container: HTMLElement | string;
  /** Creates the DOM node for a visible item. */
  renderItem: (item: T, index: number) => HTMLElement;
  overscan?: number;
  direction?: VirtualListDirection;
  getItemKey?: (item: T, index: number) => string | number;
  onScroll?: (info: ScrollInfo) => void;
  onVisibleRangeChange?: (start: number, end: number) => void;
}

export interface VirtualListApi<T> {
  readonly items: ReadonlySignal<T[]>;
  readonly visibleItems: ReadonlySignal<VirtualItem<T>[]>;
  scrollToIndex(index: number, align?: ScrollAlignment): void;
  scrollToOffset(offset: number): void;
  refresh(): void;
  dispose(): void;
}

interface RenderedItem {
  node: HTMLElement;
  index: number;
}

function resolveContainer(container: HTMLElement | string): HTMLElement {
  if (typeof container !== 'string') return container;
  const element = document.querySelector<HTMLElement>(container);
  if (!element) throw new Error(`[virtual-list] Container '${container}' was not found.`);
  return element;
}

function isSignal<T>(value: T[] | Signal<T[]>): value is Signal<T[]> {
  return typeof (value as Signal<T[]>).get === 'function' && typeof (value as Signal<T[]>).set === 'function';
}

/**
 * Create a standalone virtual-list controller.
 *
 * Only elements inside the viewport plus overscan are mounted. The controller
 * owns a spacer and a content layer inside `container`; dispose it before
 * removing the container from the DOM.
 */
export function createVirtualList<T>(options: VirtualListOptions<T>): VirtualListApi<T> {
  if (typeof document === 'undefined') {
    throw new Error('[virtual-list] createVirtualList requires a browser DOM.');
  }

  const container = resolveContainer(options.container);
  const items = isSignal(options.items) ? options.items : signal(options.items);
  const visibleItems = signal<VirtualItem<T>[]>([]);
  const direction = options.direction ?? 'vertical';
  const overscan = Math.max(0, Math.floor(options.overscan ?? 5));
  const keyFor = options.getItemKey ?? ((_item: T, index: number) => index);
  const isVertical = direction === 'vertical';
  const scrollProperty = isVertical ? 'scrollTop' : 'scrollLeft';
  const clientProperty = isVertical ? 'clientHeight' : 'clientWidth';

  const computedPosition = getComputedStyle(container).position;
  if (computedPosition === 'static') container.style.position = 'relative';
  container.style.overflow = 'auto';

  const spacer = document.createElement('div');
  spacer.className = 'zen-virtual-list-spacer';
  spacer.setAttribute('aria-hidden', 'true');

  const content = document.createElement('div');
  content.className = 'zen-virtual-list-content';
  content.style.position = 'absolute';
  content.style.top = '0';
  content.style.left = '0';
  if (isVertical) {
    content.style.right = '0';
  } else {
    content.style.bottom = '0';
  }

  container.append(spacer, content);

  const rendered = new Map<string | number, RenderedItem>();
  const measurements = new Map<string | number, number>();
  let offsets: number[] = [];
  let totalSize = 0;
  let previousStart = -1;
  let previousEnd = -1;
  let scrollFrame: number | null = null;
  let resizeFrame: number | null = null;
  let disposed = false;

  const sizeAt = (list: T[], index: number): number => {
    const item = list[index]!;
    const key = keyFor(item, index);
    const measured = measurements.get(key);
    if (measured !== undefined) return measured;
    const estimated = typeof options.itemSize === 'function'
      ? options.itemSize(item, index)
      : options.itemSize;
    return Number.isFinite(estimated) && estimated > 0 ? estimated : 1;
  };

  const rebuildOffsets = (list: T[]) => {
    offsets = new Array(list.length);
    let offset = 0;
    for (let index = 0; index < list.length; index++) {
      offsets[index] = offset;
      offset += sizeAt(list, index);
    }
    totalSize = offset;
    if (isVertical) spacer.style.height = `${totalSize}px`;
    else spacer.style.width = `${totalSize}px`;
  };

  const findIndexAtOffset = (offset: number): number => {
    if (offsets.length === 0 || offset <= 0) return 0;
    let low = 0;
    let high = offsets.length - 1;
    while (low < high) {
      const middle = Math.ceil((low + high) / 2);
      if (offsets[middle]! <= offset) low = middle;
      else high = middle - 1;
    }
    return low;
  };

  let itemResizeObserver: ResizeObserver | null = null;
  if (typeof ResizeObserver !== 'undefined') {
    itemResizeObserver = new ResizeObserver((entries) => {
      let changed = false;
      const list = items.get();
      for (const entry of entries) {
        const index = Number((entry.target as HTMLElement).dataset.zenVirtualIndex);
        if (!Number.isInteger(index) || index < 0 || index >= list.length) continue;
        const item = list[index]!;
        const key = keyFor(item, index);
        const size = isVertical ? entry.contentRect.height : entry.contentRect.width;
        if (size > 0 && measurements.get(key) !== size) {
          measurements.set(key, size);
          changed = true;
        }
      }
      if (changed) refresh();
    });
  }

  const removeRendered = (key: string | number) => {
    const entry = rendered.get(key);
    if (!entry) return;
    itemResizeObserver?.unobserve(entry.node);
    entry.node.remove();
    rendered.delete(key);
  };

  const renderRange = (list: T[], start: number, end: number) => {
    const wanted = new Set<string | number>();
    for (let index = start; index < end; index++) {
      wanted.add(keyFor(list[index]!, index));
    }
    for (const key of rendered.keys()) {
      if (!wanted.has(key)) removeRendered(key);
    }

    const nextVisible: VirtualItem<T>[] = [];
    for (let index = start; index < end; index++) {
      const item = list[index]!;
      const key = keyFor(item, index);
      let entry = rendered.get(key);
      if (!entry) {
        const node = options.renderItem(item, index);
        node.style.position = 'absolute';
        node.dataset.zenVirtualIndex = String(index);
        content.appendChild(node);
        entry = { node, index };
        rendered.set(key, entry);
        itemResizeObserver?.observe(node);
      }
      entry.index = index;
      entry.node.dataset.zenVirtualIndex = String(index);
      entry.node.style.transform = isVertical
        ? `translateY(${offsets[index] ?? 0}px)`
        : `translateX(${offsets[index] ?? 0}px)`;
      if (!isVertical) entry.node.style.height = '100%';
      nextVisible.push({ item, index, offset: offsets[index] ?? 0 });
    }
    visibleItems.set(nextVisible);
  };

  const update = () => {
    if (disposed) return;
    const list = items.get();
    rebuildOffsets(list);
    const offset = container[scrollProperty];
    const viewportSize = container[clientProperty];
    const firstVisible = findIndexAtOffset(offset);
    const endVisible = Math.min(list.length, findIndexAtOffset(offset + viewportSize) + 1);
    const start = Math.max(0, firstVisible - overscan);
    const end = Math.min(list.length, endVisible + overscan);

    renderRange(list, start, end);
    if (start !== previousStart || end !== previousEnd) {
      previousStart = start;
      previousEnd = end;
      options.onVisibleRangeChange?.(start, end);
    }
  };

  const onScroll = () => {
    options.onScroll?.({
      offset: container[scrollProperty],
      viewportSize: container[clientProperty],
      totalSize,
      direction,
    });
    if (scrollFrame !== null) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = null;
      update();
    });
  };

  const containerResizeObserver = typeof ResizeObserver === 'undefined'
    ? null
    : new ResizeObserver(() => {
      if (resizeFrame !== null) return;
      resizeFrame = requestAnimationFrame(() => {
        resizeFrame = null;
        update();
      });
    });

  container.addEventListener('scroll', onScroll, { passive: true });
  containerResizeObserver?.observe(container);
  const disposeItemsEffect = effect(update);

  const refresh = () => update();
  const scrollToOffset = (offset: number) => {
    container[scrollProperty] = Math.max(0, Math.min(offset, Math.max(0, totalSize - container[clientProperty])));
    update();
  };
  refresh();

  return {
    items: items as ReadonlySignal<T[]>,
    visibleItems: visibleItems as ReadonlySignal<VirtualItem<T>[]>,
    scrollToIndex(index, align = 'start') {
      const list = items.get();
      if (index < 0 || index >= list.length) return;
      rebuildOffsets(list);
      const itemSize = sizeAt(list, index);
      const viewportSize = container[clientProperty];
      let offset = offsets[index] ?? 0;
      if (align === 'center') offset -= (viewportSize - itemSize) / 2;
      if (align === 'end') offset -= viewportSize - itemSize;
      scrollToOffset(offset);
    },
    scrollToOffset,
    refresh,
    dispose() {
      if (disposed) return;
      disposed = true;
      container.removeEventListener('scroll', onScroll);
      containerResizeObserver?.disconnect();
      itemResizeObserver?.disconnect();
      if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
      if (resizeFrame !== null) cancelAnimationFrame(resizeFrame);
      disposeItemsEffect();
      for (const key of [...rendered.keys()]) removeRendered(key);
      spacer.remove();
      content.remove();
    },
  };
}
