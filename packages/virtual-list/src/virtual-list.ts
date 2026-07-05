// packages/virtual-list/src/virtual-list.ts
//
// @zenith/virtual-list — Virtual Scrolling (Phase 5 Critical).
//
// فقط visible rows را render می‌کند (10-20 آیتم به‌جای 10000).
// از scroll position برای محاسبه range استفاده می‌کند.
//
// ── سینتکس ──
// <div zen-virtual-list="$items" zen-key="item.id" zen-item-height="40" zen-buffer="5"
//      zen-direction="vertical" zen-animate-mount="fadeIn">
//   <span zen-text="$item.name"></span>
// </div>
//
// - zen-virtual-list: Expression آرایه
// - zen-key: Expression کلید (مثل item.id)
// - zen-item-height: ارتفاع آیتم به پیکسل (پیش‌فرض: 40)
// - zen-direction: "vertical" (پیش‌فرض) | "horizontal"
// - zen-buffer: تعداد آیتم‌های اضافی قبل/بعد visible area (پیش‌فرض: 5)
// - zen-dynamic-heights: "true" برای فعال‌سازی ارتفاع متغیر (پیش‌فرض: "false")
// - zen-animate-mount: نام preset انیمیشن برای mount آیتم‌ها
// - zen-animate-unmount: نام preset انیمیشن برای unmount آیتم‌ها
//
// IMP-VL-01 (v1.3.0): پشتیبانی از جهت افقی (horizontal scrolling).
// IMP-VL-02 (v1.3.0): انیمیشن mount/unmount آیتم‌ها.
// IMP-VL-03 (v1.3.0): متد scrollToIndex.
// BUG-VL-01 (v1.3.0): SSR guard برای observerها.
// BUG-VL-02 (v1.3.0): Debounce prefix sum rebuild.
// BUG-VL-03 (v1.3.0): Boundary checks در binary search.
// BUG-VL-04 (v1.3.0): Dynamic buffer size بر اساس viewport.

// ── SSR Guard ──
// BUG FIX (BUG-VL-01): IntersectionObserver و ResizeObserver در SSR وجود ندارند.
// قبل از استفاده، وجود APIها را بررسی می‌کنیم.
const HAS_RO = typeof ResizeObserver !== 'undefined';
const HAS_IO = typeof IntersectionObserver !== 'undefined';

import { signal, effect, type Signal } from '@zenith/state';
import { compileExpression } from '@zenith/expressions';

// ── Types ──

export interface VirtualListConfig {
  itemHeight: number;
  buffer: number;
  dynamicHeights: boolean;
  direction: 'vertical' | 'horizontal';
  animateMount: string | null;
  animateUnmount: string | null;
}

export interface VirtualRange {
  start: number;
  end: number;
  offsetY: number;
  totalHeight: number;
}

export interface VirtualListController {
  /** اسکرول به آیتم با index مشخص */
  scrollToIndex(index: number): void;
  /**强制 بازسازی prefix sum (برای dynamic heights) */
  rebuild(): void;
  /** دریافت محدوده visible فعلی */
  getRange(): VirtualRange;
}

// ── Dynamic Buffer ──
// BUG FIX (BUG-VL-04): buffer پویا بر اساس اندازه viewport.
function calculateDynamicBuffer(
  viewportSize: number,
  itemSize: number,
  configBuffer: number,
): number {
  const visibleItems = Math.ceil(viewportSize / Math.max(itemSize, 1));
  const dynamic = Math.max(5, Math.ceil(visibleItems * 0.5)); // 50% اضافه
  return Math.max(configBuffer, dynamic);
}

// ── Binary Search with Bounds ──
// BUG FIX (BUG-VL-03): boundary checks در binary search برای جلوگیری از
// index نامعتبر وقتی offset خارج از محدوده است یا آرایه خالی است.

// ── Animate Mount/Unmount ──
// IMP-VL-02: انیمیشن ساده برای mount/unmount آیتم‌ها.
const MOUNT_PRESETS: Record<string, Keyframe[]> = {
  fadeIn: [{ opacity: '0' }, { opacity: '1' }],
  slideDown: [{ transform: 'translateY(-10px)', opacity: '0' }, { transform: 'none', opacity: '1' }],
  slideUp: [{ transform: 'translateY(10px)', opacity: '0' }, { transform: 'none', opacity: '1' }],
  scaleIn: [{ transform: 'scale(0.9)', opacity: '0' }, { transform: 'scale(1)', opacity: '1' }],
};

const UNMOUNT_PRESETS: Record<string, Keyframe[]> = {
  fadeOut: [{ opacity: '1' }, { opacity: '0' }],
  slideUp: [{ transform: 'none', opacity: '1' }, { transform: 'translateY(-10px)', opacity: '0' }],
  slideDown: [{ transform: 'none', opacity: '1' }, { transform: 'translateY(10px)', opacity: '0' }],
  scaleOut: [{ transform: 'scale(1)', opacity: '1' }, { transform: 'scale(0.9)', opacity: '0' }],
};

function animateItem(el: HTMLElement, preset: string, isMount: boolean): void {
  const presets = isMount ? MOUNT_PRESETS : UNMOUNT_PRESETS;
  const keyframes = presets[preset];
  if (!keyframes || typeof el.animate !== 'function') return;
  const anim = el.animate(keyframes, { duration: 200, easing: 'ease-out' });
  anim.onfinish = () => { try { anim.commitStyles(); } catch { } anim.cancel(); };
}

// ── Main Export ──

export function processVirtualList(
  el: HTMLElement,
  listExpr: string,
  context: Record<string, any>,
  processChildren: (node: HTMLElement, ctx: Record<string, any>, disposes: (() => void)[]) => void,
  disposes: (() => void)[],
): VirtualListController {
  // ── BUG-VL-01: SSR Guard ──
  // اگر در محیط SSR هستیم، observerها در دسترس نیستند.
  // در این حالت، همه آیتم‌ها را render می‌کنیم (بدون virtual scrolling).
  if (!HAS_RO || !HAS_IO) {
    // Fallback SSR: همه آیتم‌ها را رندر کن
    const fallbackEval = compileExpression(listExpr);
    const fallbackList = fallbackEval(context);
    if (Array.isArray(fallbackList)) {
      for (let i = 0; i < fallbackList.length; i++) {
        const item = fallbackList[i];
        const itemSignal = signal(item);
        const indexSignal = signal(i);
        const childCtx: Record<string, any> = Object.create(context);
        Object.defineProperty(childCtx, '$item', { get: () => itemSignal.get(), enumerable: true, configurable: true });
        Object.defineProperty(childCtx, '$index', { get: () => indexSignal.get(), enumerable: true, configurable: true });
        const signalsMap = new Map<string, Signal<any>>();
        const parentSignals = (context as any).__zenith_signals__ as Map<string, Signal<any>> | undefined;
        if (parentSignals) {
          for (const [k, v] of parentSignals) signalsMap.set(k, v);
        }
        signalsMap.set('item', itemSignal);
        signalsMap.set('index', indexSignal as Signal<any>);
        Object.defineProperty(childCtx, '__zenith_signals__', { value: signalsMap, enumerable: false });

        const itemDisposes: (() => void)[] = [];
        for (const child of Array.from(el.children)) {
          processChildren(child as HTMLElement, childCtx, itemDisposes);
        }
        disposes.push(...itemDisposes);
      }
    }
    return {
      scrollToIndex() {},
      rebuild() {},
      getRange(): VirtualRange { return { start: 0, end: 0, offsetY: 0, totalHeight: 0 }; },
    };
  }

  const config: VirtualListConfig = {
    itemHeight: parseInt(el.getAttribute('zen-item-height') || '40', 10),
    buffer: parseInt(el.getAttribute('zen-buffer') || '5', 10),
    dynamicHeights: el.getAttribute('zen-dynamic-heights') === 'true',
    direction: (el.getAttribute('zen-direction') as 'vertical' | 'horizontal') || 'vertical',
    animateMount: el.getAttribute('zen-animate-mount'),
    animateUnmount: el.getAttribute('zen-animate-unmount'),
  };

  const isVertical = config.direction === 'vertical';
  const scrollPosProp = isVertical ? 'scrollTop' : 'scrollLeft';
  const clientSizeProp = isVertical ? 'clientHeight' : 'clientWidth';

  // Container setup
  el.style.overflow = 'auto';
  el.style.position = 'relative';
  el.style.contain = 'strict';

  // Spacer برای ایجاد scroll size صحیح
  const spacer = document.createElement('div');
  spacer.style.position = 'absolute';
  spacer.style.top = '0';
  spacer.style.left = '0';
  spacer.style.right = '0';
  spacer.style.pointerEvents = 'none';
  el.appendChild(spacer);

  // Content container برای visible items
  const content = document.createElement('div');
  content.style.position = 'relative';
  el.appendChild(content);

  // State: visible range
  const rangeSignal: Signal<{ start: number; end: number }> = signal({ start: 0, end: 0 });
  // State: visible items (clone template)
  const renderedNodes = new Map<number, { node: HTMLElement; disposes: (() => void)[] }>();

  // ── Dynamic Heights State ──
  const heights: Map<number, number> = new Map();
  let offsetsCache: number[] = [];
  let totalHeightCache: number = 0;

  // ── Template ──
  const templateEl = el.querySelector(':scope > template');
  const firstChild = el.firstElementChild as HTMLElement | null;
  let templateContent: DocumentFragment;

  if (templateEl) {
    templateContent = (templateEl as HTMLTemplateElement).content;
    templateEl.remove();
  } else if (firstChild) {
    const tpl = document.createElement('template');
    tpl.content.appendChild(firstChild.cloneNode(true));
    templateContent = tpl.content;
    firstChild.remove();
  } else {
    console.error('[zen-virtual-list] No template or child found.');
    return {
      scrollToIndex() {},
      rebuild() {},
      getRange(): VirtualRange { return { start: 0, end: 0, offsetY: 0, totalHeight: 0 }; },
    };
  }

  // Empty slot
  const emptySlot = el.querySelector(':scope > [slot="empty"]');
  let emptyNode: HTMLElement | null = null;
  if (emptySlot) emptySlot.remove();

  // Loading slot
  const loadingSlot = el.querySelector(':scope > [slot="loading"]');
  let loadingNode: HTMLElement | null = null;
  if (loadingSlot) loadingSlot.remove();

  let currentList: any[] = [];
  let scrollRaf: number | null = null;

  // Scroll handler
  const onScroll = () => {
    if (scrollRaf !== null) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = null;
      updateRange();
    });
  };
  el.addEventListener('scroll', onScroll, { passive: true });

  // Container resize handler
  let resizeRaf: number | null = null;
  const resizeObserver = new ResizeObserver(() => {
    if (resizeRaf !== null) return;
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = null;
      updateRange();
    });
  });
  resizeObserver.observe(el);

  // ── Dynamic Heights: per-item ResizeObserver ──
  let itemResizeRaf: number | null = null;
  const pendingItemResizes: Set<number> = new Set();

  let itemResizeObserver: ResizeObserver;
  // BUG-VL-01: اگر ResizeObserver در دسترس نباشد (نظری)
  if (HAS_RO) {
    itemResizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const idx = (entry.target as HTMLElement).dataset.zenVlistIdx;
        if (idx == null) continue;
        const i = parseInt(idx, 10);
        const newHeight = entry.contentRect.height;
        const oldHeight = heights.get(i);
        if (oldHeight !== newHeight) {
          heights.set(i, newHeight);
          pendingItemResizes.add(i);
        }
      }
      // تجمیع بازمحاسبه‌ها در یک RAF
      if (itemResizeRaf !== null) return;
      itemResizeRaf = requestAnimationFrame(() => {
        itemResizeRaf = null;
        if (pendingItemResizes.size === 0) return;
        pendingItemResizes.clear();
        // BUG-VL-02: debounce بازسازی prefix sum
        scheduleRebuild();
      });
    });
  }

  // BUG-VL-02: Debounce بازسازی prefix sum برای جلوگیری از layout thrashing
  let rebuildTimeout: ReturnType<typeof setTimeout> | null = null;

  function scheduleRebuild(): void {
    if (rebuildTimeout) return;
    rebuildTimeout = setTimeout(() => {
      rebuildTimeout = null;
      recomputeOffsets();
      updateRange();
    }, 16); // ~1 frame
  }

  function recomputeOffsets(): void {
    if (!config.dynamicHeights) return;
    offsetsCache = new Array(currentList.length);
    let acc = 0;
    for (let i = 0; i < currentList.length; i++) {
      offsetsCache[i] = acc;
      const h = heights.get(i);
      acc += h !== undefined ? h : config.itemHeight;
    }
    totalHeightCache = acc;
  }

  /**
   * یافتن index آیتمی که در offset مشخص قرار دارد.
   * BUG FIX (BUG-VL-03): boundary checks کامل.
   */
  function findItemByOffset(offset: number): number {
    if (offsetsCache.length === 0) return 0;
    if (offset <= 0) return 0;
    const lastIdx = offsetsCache.length - 1;
    if (offset >= totalHeightCache) return lastIdx;

    let lo = 0;
    let hi = lastIdx;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (offset >= offsetsCache[mid]!) {
        const nextOffset = mid + 1 < offsetsCache.length ? offsetsCache[mid + 1]! : totalHeightCache;
        if (offset < nextOffset) return mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return Math.max(0, Math.min(lo, offsetsCache.length - 1));
  }

  function getHeight(i: number): number {
    if (!config.dynamicHeights) return config.itemHeight;
    const h = heights.get(i);
    return h !== undefined ? h : config.itemHeight;
  }

  // IMP-VL-03: دریافت offset برای index مشخص
  function getOffset(i: number): number {
    if (!config.dynamicHeights) return i * config.itemHeight;
    if (i < offsetsCache.length) return offsetsCache[i]!;
    return i * config.itemHeight;
  }

  // ── Dynamic Buffer ──
  // BUG FIX (BUG-VL-04): buffer پویا بر اساس اندازه viewport.
  function getDynamicBuffer(): number {
    const viewportSize = el[clientSizeProp];
    return calculateDynamicBuffer(viewportSize, config.itemHeight, config.buffer);
  }

  function updateRange(): void {
    const scrollPos = (el as any)[scrollPosProp] as number;
    const viewportSize = el[clientSizeProp];
    const total = currentList.length;
    const dynBuffer = getDynamicBuffer();

    let start: number, end: number;

    if (config.dynamicHeights && offsetsCache.length > 0) {
      start = Math.max(0, findItemByOffset(Math.max(0, scrollPos - dynBuffer * config.itemHeight)));

      let acc = getOffset(start);
      end = start;
      while (end < total && acc < scrollPos + viewportSize + dynBuffer * config.itemHeight) {
        acc += getHeight(end);
        end++;
      }
      // به‌علاوه buffer بعد
      end = Math.min(total, end + dynBuffer);
    } else {
      // حالت ثابت: محاسبه ساده
      const visibleCount = Math.ceil(viewportSize / config.itemHeight);
      start = Math.max(0, Math.floor(scrollPos / config.itemHeight) - dynBuffer);
      end = Math.min(total, start + visibleCount + dynBuffer * 2);
    }

    // Update spacer size
    const totalHeight = config.dynamicHeights ? totalHeightCache : total * config.itemHeight;
    if (isVertical) {
      spacer.style.height = `${totalHeight}px`;
    } else {
      spacer.style.width = `${totalHeight}px`;
    }

    rangeSignal.set({ start, end });
    renderVisible(start, end);
    updateEmptyState();
  }

  // IMP-VL-03: متد scrollToIndex
  function scrollToIndex(index: number): void {
    if (index < 0 || index >= currentList.length) return;
    const offset = getOffset(index);
    if (isVertical) {
      el.scrollTop = offset;
    } else {
      el.scrollLeft = offset;
    }
  }

  function updateEmptyState(): void {
    const shouldShowEmpty = currentList.length === 0 && emptySlot;
    const shouldShowLoading = false;

    if (shouldShowEmpty && !emptyNode) {
      emptyNode = document.createElement('div');
      emptyNode.className = 'zen-vlist-empty';
      emptyNode.style.cssText = 'padding:20px;text-align:center;';
      emptyNode.appendChild((emptySlot as HTMLTemplateElement).content.cloneNode(true));
      el.appendChild(emptyNode);
      spacer.style.display = 'none';
      content.style.display = 'none';
    } else if (!shouldShowEmpty && emptyNode) {
      emptyNode.remove();
      emptyNode = null;
      spacer.style.display = '';
      content.style.display = '';
    }

    if (shouldShowLoading && !loadingNode && loadingSlot) {
      loadingNode = document.createElement('div');
      loadingNode.className = 'zen-vlist-loading';
      loadingNode.style.cssText = 'padding:20px;text-align:center;';
      loadingNode.appendChild((loadingSlot as HTMLTemplateElement).content.cloneNode(true));
      el.appendChild(loadingNode);
    } else if (!shouldShowLoading && loadingNode) {
      loadingNode.remove();
      loadingNode = null;
    }
  }

  function renderVisible(start: number, end: number): void {
    // Remove nodes خارج از range
    for (const [idx, entry] of renderedNodes) {
      if (idx < start || idx >= end) {
        // IMP-VL-02: انیمیشن unmount
        if (config.animateUnmount) {
          animateItem(entry.node, config.animateUnmount, false);
        }
        if (itemResizeObserver && config.dynamicHeights) {
          itemResizeObserver.unobserve(entry.node);
        }
        entry.node.remove();
        entry.disposes.forEach(d => { try { d(); } catch {} });
        renderedNodes.delete(idx);
      }
    }

    // Add nodes داخل range
    for (let i = start; i < end && i < currentList.length; i++) {
      if (renderedNodes.has(i)) continue;

      const item = currentList[i];
      const frag = templateContent.cloneNode(true);
      const newNode = document.createElement('div');
      newNode.appendChild(frag);

      // Build context
      const itemSignal = signal(item);
      const indexSignal = signal(i);
      const childCtx: Record<string, any> = Object.create(context);
      Object.defineProperty(childCtx, '$item', { get: () => itemSignal.get(), enumerable: true, configurable: true });
      Object.defineProperty(childCtx, '$index', { get: () => indexSignal.get(), enumerable: true, configurable: true });

      if (!('item' in context)) {
        Object.defineProperty(childCtx, 'item', { get: () => itemSignal.get(), enumerable: true, configurable: true });
      }
      if (!('index' in context)) {
        Object.defineProperty(childCtx, 'index', { get: () => indexSignal.get(), enumerable: true, configurable: true });
      }

      const parentSignals = (context as any).__zenith_signals__ as Map<string, Signal<any>> | undefined;
      const signalsMap = parentSignals ? new Map(parentSignals) : new Map<string, Signal<any>>();
      signalsMap.set('item', itemSignal);
      signalsMap.set('index', indexSignal as Signal<any>);
      Object.defineProperty(childCtx, '__zenith_signals__', { value: signalsMap, enumerable: false });

      newNode.style.position = 'absolute';
      newNode.style.top = '0';
      newNode.style.left = '0';
      newNode.style.right = '0';

      if (!config.dynamicHeights) {
        newNode.style.height = `${config.itemHeight}px`;
      }

      const offset = getOffset(i);
      newNode.style.transform = isVertical ? `translateY(${offset}px)` : `translateX(${offset}px)`;
      newNode.dataset.zenVlistIdx = String(i);

      // IMP-VL-02: انیمیشن mount
      if (config.animateMount) {
        animateItem(newNode, config.animateMount, true);
      }

      const itemDisposes: (() => void)[] = [];
      for (const child of Array.from(newNode.children)) {
        processChildren(child as HTMLElement, childCtx, itemDisposes);
      }

      content.appendChild(newNode);

      if (config.dynamicHeights && itemResizeObserver) {
        itemResizeObserver.observe(newNode);
      }

      renderedNodes.set(i, { node: newNode, disposes: itemDisposes });
    }
  }

  // ── compile-once: listExpr فقط یک‌بار parse می‌شود ──
  const listEvalFn = compileExpression(listExpr);

  // ── Effect: watch list expression ──
  const disposeEffect = effect(() => {
    const list = listEvalFn(context);
    const newList = Array.isArray(list) ? list : [];
    // اگر طول list تغییر کرد، heights را برای آیتم‌های حذف‌شده پاک کن
    if (newList.length < currentList.length) {
      for (const key of heights.keys()) {
        if (key >= newList.length) heights.delete(key);
      }
    }
    currentList = newList;
    recomputeOffsets();
    updateRange();
  });

  disposes.push(() => {
    el.removeEventListener('scroll', onScroll);
    resizeObserver.disconnect();
    if (itemResizeObserver) itemResizeObserver.disconnect();
    if (scrollRaf !== null) cancelAnimationFrame(scrollRaf);
    if (resizeRaf !== null) cancelAnimationFrame(resizeRaf);
    if (itemResizeRaf !== null) cancelAnimationFrame(itemResizeRaf);
    if (rebuildTimeout) clearTimeout(rebuildTimeout);
    for (const [, entry] of renderedNodes) {
      entry.disposes.forEach(d => { try { d(); } catch {} });
    }
    renderedNodes.clear();
    disposeEffect();
  });

  // ── Return Controller ──
  return {
    scrollToIndex,
    rebuild: () => {
      recomputeOffsets();
      updateRange();
    },
    getRange: (): VirtualRange => {
      const s = rangeSignal.get();
      const total = currentList.length;
      return {
        start: s.start,
        end: s.end,
        offsetY: el.scrollTop,
        totalHeight: config.dynamicHeights ? totalHeightCache : total * config.itemHeight,
      };
    },
  };
}
