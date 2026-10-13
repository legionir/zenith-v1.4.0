import { effect, signal, untrack, type ReadonlySignal, type Signal } from '@zenith/state';
import { developerError, ErrorCode } from '@zenith/errors';

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
  /**
   * #47: درست پیش از حذف نود یک آیتم از DOM (خروج از range یا dispose)
   * فراخوانی می‌شود تا مصرف‌کننده (مثل wrapper دایرکتیو) بتواند disposeهای
   * per-item و انیمیشن unmount را وصل کند.
   */
  onNodeRemoved?: (node: HTMLElement, item: T, index: number) => void;
  /**
   * #47: وقتی یک نود کش‌شده برای همان آیتم در index جدید باقی می‌ماند
   * (مثلاً حذف آیتم قبلی)، درست پس از به‌روزرسانی index فراخوانی می‌شود تا
   * wrapper بتواند signal `$index` آن آیتم را همگام نگه دارد.
   */
  onItemUpdated?: (node: HTMLElement, item: T, index: number) => void;
}

export interface VirtualListState {
  start: number;
  end: number;
  totalSize: number;
  offset: number;
}

export interface VirtualListApi<T> {
  readonly items: ReadonlySignal<T[]>;
  readonly visibleItems: ReadonlySignal<VirtualItem<T>[]>;
  scrollToIndex(index: number, align?: ScrollAlignment): void;
  scrollToOffset(offset: number): void;
  refresh(): void;
  /** #18: باطل کردن اندازه‌های کش‌شده (یک کلید مشخص یا تمام کلیدها) و بازمحاسبهٔ آفست‌ها. */
  invalidateMeasurements(key?: string | number): void;
  /** #18: پاک‌سازی اندازه‌های کش‌شده و اندازه‌گیری مجدد آیتم‌های رندرشده. */
  remeasure(): void;
  /** #47: وضعیت جاری range/offset/totalSize — برای wrapper دایرکتیو (getRange). */
  getState(): VirtualListState;
  dispose(): void;
}

interface RenderedItem {
  node: HTMLElement;
  index: number;
  // FIX (#17): نگه‌داشتن ارجاع آیتم رندرشده تا اگر همان key به آیتم جدیدی
  // نگاشت شد (مرتب‌سازی، جایگزینی شیء، درج/حذف میانی) نود کهنه دوباره رندر شود.
  item: unknown;
}

/**
 * #47: disposeهای per-item که مصرف‌کننده (wrapper دایرکتیو) ثبت می‌کند؛ درست
 * پیش از حذف نود (خروج از range یا dispose کامل) به‌ترتیب اجرا می‌شوند.
 * تابع module-level است تا wrapper هنگام construction (داخل renderItem، پیش
 * از بازگشت api) بدون TDZ بتواند disposeها را ثبت کند.
 */
const nodeDisposes = new WeakMap<HTMLElement, (() => void)[]>();

/**
 * #47: ثبت disposeهای یک نود رندرشده (برای wrapper دایرکتیو).
 * #116 cleanup protocol: خروجی یک `Cleanup` idempotent که نگاشت node را
 * حذف می‌کند (فقط اگر هنوز همان آرایه باشد).
 */
export function registerVirtualListNodeDisposes(
  node: HTMLElement,
  disposes: (() => void)[],
): () => void {
  nodeDisposes.set(node, disposes);
  let removed = false;
  return () => {
    if (removed) return;
    removed = true;
    if (nodeDisposes.get(node) === disposes) {
      nodeDisposes.delete(node);
    }
  };
}

function resolveContainer(container: HTMLElement | string): HTMLElement {
  if (typeof container !== 'string') return container;
  const element = document.querySelector<HTMLElement>(container);
  if (!element)
    throw developerError(
      `Container '${container}' was not found.`,
      ErrorCode.RUNTIME_COMPONENT_NOT_FOUND,
      { suggestion: 'کانتینر باید قبل از createVirtualList در DOM موجود باشد.' },
    );
  return element;
}

function isSignal<T>(value: T[] | Signal<T[]>): value is Signal<T[]> {
  return (
    typeof (value as Signal<T[]>).get === 'function' &&
    typeof (value as Signal<T[]>).set === 'function'
  );
}

/**
 * FIX (#17): مقایسه‌ی سبک «تغییر آیتم» — اول ارجاع (ارزان‌ترین و رایج‌ترین
 * حالت: همان شیء)، سپس برای primitive ها برابری مقدار، و برای آبجکت‌های
 * تخت (record ها) مقایسه‌ی سطح‌یک روی key/value ها.
 *
 * هدف: جلوگیری از بازرندر بی‌دلیل وقتی آیتم از نظر محتوا تغییر نکرده ولی
 * ارجعش عوض شده (مثل `items.set([...sameObjects])` در stateای که آرایه‌ی نو
 * می‌سازد)، و در عوض تشخیص دقیق تغییر واقعی در مرتب‌سازی/جایگزینی/درج.
 */
function itemChanged(a: unknown, b: unknown): boolean {
  if (a === b) return false;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    // primitive (یا ترکیب primitive/object): تفاوت = تغییر
    return true;
  }
  const ao = a as Record<string, unknown>;
  const bo = b as Record<string, unknown>;
  const ak = Object.keys(ao);
  const bk = Object.keys(bo);
  if (ak.length !== bk.length) return true;
  for (const k of ak) {
    if (!Object.prototype.hasOwnProperty.call(bo, k)) return true;
    if (ao[k] !== bo[k]) return true; // سطح‌یک: nested object تغییر ارجاع = تغییر
  }
  return false;
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
    throw developerError(
      'createVirtualList requires a browser DOM.',
      ErrorCode.INTERNAL_DEVELOPER_ERROR,
      { suggestion: 'در SSR از @zenith/ssr استفاده کنید یا ساخت لیست را به مرورگر موکول کنید.' },
    );
  }

  const container = resolveContainer(options.container);
  const items = isSignal(options.items) ? options.items : signal(options.items);
  const visibleItems = signal<VirtualItem<T>[]>([]);
  const direction = options.direction ?? 'vertical';
  const overscan = Math.max(0, Math.floor(options.overscan ?? 5));
  // FIX (#19): همهٔ callbackهای کاربر (getItemKey، itemSize تابعی، renderItem،
  // onScroll، onVisibleRangeChange) داخل untrack اجرا می‌شوند تا خواندن
  // signal در آن‌ها وابستگی effect نسازد — وگرنه هر signal بیرونی باعث
  // بازسازی کامل لیست می‌شد و نوشتن signal وابسته حلقهٔ بی‌نهایت می‌ساخت.
  // تنها وابستگی reactive باقی‌مانده: خودِ signal آیتم‌ها (items.get()).
  const keyFor = (item: T, index: number): string | number =>
    options.getItemKey ? untrack(() => options.getItemKey!(item, index)) : index;
  const isVertical = direction === 'vertical';
  const scrollProperty = isVertical ? 'scrollTop' : 'scrollLeft';
  const clientProperty = isVertical ? 'clientHeight' : 'clientWidth';
  const rawSizeOption =
    options.itemSize ?? (options as unknown as { itemHeight?: number }).itemHeight ?? 40;
  const fixedNumericSize =
    typeof rawSizeOption === 'number' && Number.isFinite(rawSizeOption) && rawSizeOption > 0
      ? rawSizeOption
      : null;

  const isRtlHorizontal = (): boolean => {
    if (isVertical) return false;
    const explicitDir =
      container.getAttribute('dir') ||
      container.closest?.('[dir]')?.getAttribute('dir') ||
      document.documentElement.getAttribute('dir');
    if (explicitDir) return explicitDir.toLowerCase() === 'rtl';
    return getComputedStyle(container).direction === 'rtl';
  };

  const getScrollOffset = (): number => {
    const raw = container[scrollProperty];
    return !isVertical && isRtlHorizontal() ? Math.abs(raw) : raw;
  };

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
  // FIX (#18): نگه‌داشتن آیتم متناظر با هر اندازهٔ کش‌شده تا با تغییر هویت آیتم
  // در همان کلید (یا حذف کلید از لیست)، اندازهٔ قدیمی باطل شود و نشت نکند.
  const measuredItems = new Map<string | number, unknown>();
  let offsets: number[] = [];
  let totalSize = 0;
  let offsetsDirty = true;
  let lastListRef: T[] | null = null;
  let lastListLength = -1;
  let previousStart = -1;
  let previousEnd = -1;
  let scrollFrame: number | null = null;
  let resizeFrame: number | null = null;
  let disposed = false;

  const syncMeasurements = (list: T[]) => {
    if (measurements.size === 0) return;
    const activeKeys = new Set<string | number>();
    for (let index = 0; index < list.length; index++) {
      const item = list[index]!;
      const key = keyFor(item, index);
      activeKeys.add(key);
      if (measuredItems.has(key) && itemChanged(measuredItems.get(key), item)) {
        measurements.delete(key);
        measuredItems.delete(key);
        offsetsDirty = true;
      }
    }
    for (const key of [...measurements.keys()]) {
      if (!activeKeys.has(key)) {
        measurements.delete(key);
        measuredItems.delete(key);
        offsetsDirty = true;
      }
    }
  };

  const sizeAt = (list: T[], index: number): number => {
    if (fixedNumericSize !== null && measurements.size === 0) {
      return fixedNumericSize;
    }
    const item = list[index]!;
    const key = keyFor(item, index);
    const measured = measurements.get(key);
    if (measured !== undefined) return measured;
    const estimated =
      typeof rawSizeOption === 'function'
        ? untrack(() => rawSizeOption(item, index))
        : rawSizeOption;
    return Number.isFinite(estimated) && estimated > 0 ? estimated : 1;
  };

  const offsetAt = (index: number): number => {
    if (fixedNumericSize !== null && measurements.size === 0) {
      return index * fixedNumericSize;
    }
    return offsets[index] ?? 0;
  };

  const rebuildOffsets = (list: T[], force = false) => {
    if (!force && !offsetsDirty && lastListRef === list && lastListLength === list.length) {
      return;
    }
    syncMeasurements(list);
    lastListRef = list;
    lastListLength = list.length;
    offsetsDirty = false;

    if (fixedNumericSize !== null && measurements.size === 0) {
      offsets = [];
      totalSize = list.length * fixedNumericSize;
    } else {
      offsets = new Array(list.length);
      let offset = 0;
      for (let index = 0; index < list.length; index++) {
        offsets[index] = offset;
        offset += sizeAt(list, index);
      }
      totalSize = offset;
    }
    if (isVertical) spacer.style.height = `${totalSize}px`;
    else spacer.style.width = `${totalSize}px`;
  };

  const findIndexAtOffset = (list: T[], offset: number): number => {
    if (list.length === 0 || offset <= 0) return 0;
    if (fixedNumericSize !== null && measurements.size === 0) {
      return Math.min(list.length - 1, Math.max(0, Math.floor(offset / fixedNumericSize)));
    }
    if (offsets.length === 0) return 0;
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
          measuredItems.set(key, item);
          offsetsDirty = true;
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
    // #47: اجرای disposeهای per-item و اطلاع به wrapper پیش از حذف نود.
    const disposes = nodeDisposes.get(entry.node);
    if (disposes) {
      nodeDisposes.delete(entry.node);
      for (const dispose of disposes) {
        try {
          dispose();
        } catch {
          /* cleanup errors must not break the loop */
        }
      }
    }
    options.onNodeRemoved?.(entry.node, entry.item as T, entry.index);
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

    const rtlHoriz = isRtlHorizontal();
    if (!isVertical) {
      content.style.left = rtlHoriz ? '' : '0';
      content.style.right = rtlHoriz ? '0' : '';
    }

    const nextVisible: VirtualItem<T>[] = [];
    for (let index = start; index < end; index++) {
      const item = list[index]!;
      const key = keyFor(item, index);
      let entry = rendered.get(key);
      // FIX (#17): اگر نود کش‌شده برای این key به آیتم دیگری تعلق دارد
      // (مرتب‌سازی با index-key، جایگزینی شیء با همان key، درج/حذف میانی)،
      // نود کهنه را دور بریزیم و دوباره رندر کنیم.
      if (entry && itemChanged(entry.item, item)) {
        removeRendered(key);
        entry = undefined;
      }
      if (!entry) {
        const node = untrack(() => options.renderItem(item, index));
        node.style.position = 'absolute';
        node.dataset.zenVirtualIndex = String(index);
        content.appendChild(node);
        entry = { node, index, item };
        rendered.set(key, entry);
        itemResizeObserver?.observe(node);
      }
      const itemOffset = offsetAt(index);
      entry.index = index;
      entry.node.dataset.zenVirtualIndex = String(index);
      if (isVertical) {
        entry.node.style.transform = `translateY(${itemOffset}px)`;
      } else if (rtlHoriz) {
        entry.node.style.right = '0';
        entry.node.style.left = '';
        entry.node.style.transform = `translateX(-${itemOffset}px)`;
        entry.node.style.height = '100%';
      } else {
        entry.node.style.left = '0';
        entry.node.style.right = '';
        entry.node.style.transform = `translateX(${itemOffset}px)`;
        entry.node.style.height = '100%';
      }
      // #47: نود کش‌شده در index جدید — wrapper باید $index را همگام کند.
      options.onItemUpdated?.(entry.node, item, index);
      nextVisible.push({ item, index, offset: itemOffset });
    }
    visibleItems.set(nextVisible);
  };

  const update = () => {
    if (disposed) return;
    const list = items.get();
    rebuildOffsets(list);
    const offset = getScrollOffset();
    const viewportSize = container[clientProperty];
    const firstVisible = findIndexAtOffset(list, offset);
    const endVisible = Math.min(list.length, findIndexAtOffset(list, offset + viewportSize) + 1);
    const start = Math.max(0, firstVisible - overscan);
    const end = Math.min(list.length, endVisible + overscan);

    renderRange(list, start, end);
    if (start !== previousStart || end !== previousEnd) {
      previousStart = start;
      previousEnd = end;
      untrack(() => options.onVisibleRangeChange?.(start, end));
    }
  };

  const onScroll = () => {
    // FIX (#19): onScroll یک event handler است؛ داخل effect نیست اما برای
    // اطمینان از عدم track شدن (استفادهٔ مجدد در context) untrack می‌شود.
    untrack(() =>
      options.onScroll?.({
        offset: getScrollOffset(),
        viewportSize: container[clientProperty],
        totalSize,
        direction,
      }),
    );
    if (scrollFrame !== null) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = null;
      update();
    });
  };

  const containerResizeObserver =
    typeof ResizeObserver === 'undefined'
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

  const refresh = () => {
    offsetsDirty = true;
    update();
  };
  const scrollToOffset = (offset: number) => {
    const clamped = Math.max(
      0,
      Math.min(offset, Math.max(0, totalSize - container[clientProperty])),
    );
    container[scrollProperty] = isRtlHorizontal() ? -clamped : clamped;
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
      let offset = offsetAt(index);
      if (align === 'center') offset -= (viewportSize - itemSize) / 2;
      if (align === 'end') offset -= viewportSize - itemSize;
      scrollToOffset(offset);
    },
    scrollToOffset,
    refresh,
    invalidateMeasurements(key?: string | number) {
      if (disposed) return;
      if (key !== undefined) {
        measurements.delete(key);
        measuredItems.delete(key);
      } else {
        measurements.clear();
        measuredItems.clear();
      }
      refresh();
    },
    remeasure() {
      if (disposed) return;
      measurements.clear();
      measuredItems.clear();
      const list = items.get();
      for (const [key, entry] of rendered.entries()) {
        if (entry.index >= 0 && entry.index < list.length) {
          const rect = entry.node.getBoundingClientRect();
          const domSize = isVertical ? rect.height : rect.width;
          if (domSize > 0) {
            measurements.set(key, domSize);
            measuredItems.set(key, list[entry.index]);
          }
        }
      }
      refresh();
    },
    getState: () => ({
      // #47: range جاری حتی اگر هنوز تغییر نکرده (previous* با initial refresh
      // در update() ست می‌شود؛ مقدار اولیه -1 نباید به بیرون نشت کند).
      start: Math.max(0, previousStart),
      end: Math.max(0, previousEnd),
      totalSize,
      offset: getScrollOffset(),
    }),
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
      measurements.clear();
      measuredItems.clear();
      spacer.remove();
      content.remove();
    },
  };
}
