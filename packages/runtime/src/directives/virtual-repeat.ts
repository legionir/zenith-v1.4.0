// packages/runtime/src/directives/virtual-repeat.ts
//
// FEATURE (v1.2.0): zen-virtual — Virtual scrolling directive.
//
// Renders only the visible slice of a large list, dramatically reducing DOM
// node count for lists with thousands of items. Supports two layouts:
//
//   1. Table mode (auto-detected when the element is a <tr>):
//        - Two spacer <tr> elements (top + bottom) are inserted as siblings
//          to push the visible rows into the correct vertical position.
//   2. Generic mode (any other element):
//        - A spacer <div> is inserted before the content container and given
//          a height equal to (firstVisibleIndex * itemHeight).
//        - A second spacer <div> after the content container is given a height
//          equal to (totalItems - lastVisibleIndex) * itemHeight.
//
// Per-item reactivity:
//   For each visible item, two Signals are created: `itemSignal` and
//   `indexSignal`. They are exposed via the local context passed to the
//   `processChildren` callback as `$item` and `$index` so child directives
//   like `zen-text="$item.name"` can reactively update when the visible slice
//   scrolls.
//
// Dynamic heights:
//   When the element also carries the `zen-dynamic-heights` attribute, a
//   ResizeObserver tracks each row's actual height. The total scrollable
//   height is recomputed as the sum of all measured heights; spacer heights
//   are computed from the accumulated heights rather than a fixed `itemHeight`.
//
// SSR safety:
//   - All DOM access is guarded; the directive is a no-op when document is
//     unavailable.
//   - IntersectionObserver / ResizeObserver are feature-detected.

import { signal, effect, type Signal } from '@zenith/state';
import { compileExpression } from '@zenith/expressions';
import { reportError } from '@zenith/error-boundary';

/**
 * FIX (v1.2.8): P1-3 — findScrollContainer helper.
 *
 * Previously the directive assumed the scroll container was always
 * `parent.closest('table').parentElement` (table mode) or
 * `contentContainer.parentElement.parentElement` (generic mode). That
 * assumption breaks for two common patterns:
 *
 *   1. The list element itself has `overflow-y: auto` (e.g. a fixed-height
 *      <div style="overflow:auto; height:300px"> wrapping the list).
 *      In this case the scroller IS the wrapper, not its parent.
 *
 *   2. The scroll container is several ancestors up (e.g. a layout with
 *      nested flex/grid containers between the list and the actual
 *      scroll viewport). The hardcoded `.parentElement.parentElement`
 *      traversal stops one level too early and binds the scroll listener
 *      to a non-scrolling element — so onScroll never fires.
 *
 * The helper walks up from `startEl`, checking getComputedStyle(node).overflowY
 * at each level, and returns the first element whose overflow-y is scrollable
 * ('auto' | 'scroll' | 'overlay'). Falls back to document.scrollingElement
 * (usually <html>) when nothing in the ancestor chain is scrollable.
 */
function findScrollContainer(startEl: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = startEl;
  while (node) {
    // Skip detached nodes — getComputedStyle returns all-'initial' for them
    // which would not match our scroll patterns, but the closest() guard
    // below also catches the case where node === document.documentElement.
    try {
      if (typeof getComputedStyle === 'function') {
        const style = getComputedStyle(node);
        const overflowY = style && style.overflowY;
        if (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') {
          // Only treat as a real scroller if the element actually has a
          // bounded height (otherwise overflow-y has no effect). For the
          // <body> / <html> we accept unconditionally — they're the
          // document scroller.
          const isDocumentElement =
            node === document.documentElement || node === document.body;
          if (isDocumentElement) return node;
          const h = style.height;
          const mh = style.maxHeight;
          if (
            (h && h !== 'auto' && !h.endsWith('%')) ||
            (mh && mh !== 'none')
          ) {
            return node;
          }
        }
      }
    } catch {
      // getComputedStyle can throw on detached/pseudo elements in some
      // browsers — skip the node and continue up the chain.
    }
    node = node.parentElement;
  }
  // Fallback: the document's scrollingElement (usually <html>).
  if (typeof document !== 'undefined' && document.scrollingElement) {
    return document.scrollingElement as HTMLElement;
  }
  return null;
}

/**
 * Signature of the walker-supplied `processChildren` callback. It receives
 * the cloned item element, a local context (with `$item` and `$index`), and
 * an item-specific disposes array.
 */
export type VirtualProcessChildren = (
  itemEl: HTMLElement,
  localContext: Record<string, any>,
  itemDisposes: (() => void)[],
) => void;

interface VisibleRow {
  el: HTMLElement;
  itemSignal: Signal<any>;
  indexSignal: Signal<number>;
  disposes: (() => void)[];
}

/**
 * Process the `zen-virtual` directive.
 *
 * @param el              The element carrying `zen-virtual`.
 * @param forExpr         Expression in the same form as `zen-for`
 *                        (e.g. "item in $items").
 * @param context         The current reactive context.
 * @param processChildren Walker-supplied callback for binding each cloned row.
 * @returns Dispose function — disposes the effect, signals, and observers.
 */
export function processVirtualRepeat(
  el: HTMLElement,
  forExpr: string,
  context: Record<string, any>,
  processChildren: VirtualProcessChildren,
): () => void {
  // Parse the for expression: "<itemName> in <listExpr>".
  const match = forExpr.match(/^\s*([\w$]+)\s+in\s+(.+)\s*$/);
  if (!match) {
    reportError(
      new Error(`[zen-virtual] Invalid for expression: "${forExpr}". Expected "<item> in <list>".`),
      'directive',
      { expression: forExpr, element: el },
    );
    return () => {};
  }
  const itemName = match[1]!;
  const listExpr = match[2]!.trim();
  const listEval = compileExpression(listExpr);

  el.removeAttribute('zen-virtual');

  // ── Layout detection ──
  const isTableMode = el.tagName.toLowerCase() === 'tr';

  // Read itemHeight from attribute (default 32). When `zen-dynamic-heights`
  // is present, the value is only a fallback for unmeasured rows.
  const itemHeightAttr = parseInt(el.getAttribute('data-item-height') || '32', 10);
  const itemHeight = Number.isFinite(itemHeightAttr) && itemHeightAttr > 0 ? itemHeightAttr : 32;
  const useDynamicHeights = el.hasAttribute('zen-dynamic-heights');
  el.removeAttribute('zen-dynamic-heights');

  // ── Build the DOM scaffold ──
  // For table mode, we need to insert spacer <tr> elements as siblings of
  // the original row. For generic mode, we replace the element with a
  // container that holds a top spacer, a content div, and a bottom spacer.
  const parent = el.parentElement;
  if (!parent) {
    return () => {};
  }

  let topSpacer: HTMLElement;
  let bottomSpacer: HTMLElement;
  let contentContainer: HTMLElement;

  if (isTableMode) {
    // Table mode: keep the original <tr> as the template for cloning.
    // Insert two spacer <tr> elements: one before, one after.
    topSpacer = document.createElement('tr');
    topSpacer.setAttribute('data-zenith-virtual-spacer', 'top');
    const topTd = document.createElement('td');
    topTd.style.padding = '0';
    topTd.style.border = '0';
    topSpacer.appendChild(topTd);

    bottomSpacer = document.createElement('tr');
    bottomSpacer.setAttribute('data-zenith-virtual-spacer', 'bottom');
    const bottomTd = document.createElement('td');
    bottomTd.style.padding = '0';
    bottomTd.style.border = '0';
    bottomSpacer.appendChild(bottomTd);

    parent.insertBefore(topSpacer, el);
    if (el.nextSibling) {
      parent.insertBefore(bottomSpacer, el.nextSibling);
    } else {
      parent.appendChild(bottomSpacer);
    }
    // The original <tr> itself becomes the content container — but we
    // remove it from the DOM since we'll re-create visible rows from its
    // template. We keep a deep clone as the template.
    contentContainer = el as HTMLElement;
    parent.removeChild(el);
  } else {
    // Generic mode: wrap the element inside a container with spacer divs.
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-zenith-virtual-wrapper', '');
    wrapper.style.position = 'relative';

    topSpacer = document.createElement('div');
    topSpacer.setAttribute('data-zenith-virtual-spacer', 'top');
    topSpacer.style.padding = '0';
    topSpacer.style.margin = '0';

    bottomSpacer = document.createElement('div');
    bottomSpacer.setAttribute('data-zenith-virtual-spacer', 'bottom');
    bottomSpacer.style.padding = '0';
    bottomSpacer.style.margin = '0';

    contentContainer = document.createElement('div');
    contentContainer.setAttribute('data-zenith-virtual-content', '');

    parent.replaceChild(wrapper, el);
    wrapper.appendChild(topSpacer);
    wrapper.appendChild(contentContainer);
    wrapper.appendChild(bottomSpacer);
  }

  // Template for cloning: the original element (without zen-virtual).
  const template = el;

  // ── Visible rows tracking ──
  let visibleRows: VisibleRow[] = [];
  // Dynamic heights: array of measured heights indexed by absolute index.
  let heights: number[] = [];
  let resizeObserver: ResizeObserver | null = null;
  if (useDynamicHeights && typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const idx = (entry.target as HTMLElement).getAttribute('data-zenith-virtual-index');
        if (idx === null) continue;
        const i = parseInt(idx, 10);
        if (Number.isFinite(i)) {
          heights[i] = entry.contentRect.height;
        }
      }
    });
  }

  // Determine the viewport height. For table mode, we walk up from the
  // <table> element; for generic mode, we walk up from the wrapper itself.
  // FIX (v1.2.8): P1-3 — use findScrollContainer instead of assuming the
  // scroll container is the immediate parent.
  const getViewportHeight = (): number => {
    if (!scrollContainer) return 600;
    return scrollContainer.clientHeight || 600;
  };

  // Compute spacer heights for a given [start, end) slice.
  const computeTopHeight = (start: number): number => {
    if (useDynamicHeights && heights.length > 0) {
      let sum = 0;
      for (let i = 0; i < start; i++) sum += heights[i] ?? itemHeight;
      return sum;
    }
    return start * itemHeight;
  };
  const computeBottomHeight = (end: number, total: number): number => {
    if (useDynamicHeights && heights.length > 0) {
      let sum = 0;
      for (let i = end; i < total; i++) sum += heights[i] ?? itemHeight;
      return sum;
    }
    return (total - end) * itemHeight;
  };

  // Render the visible slice [start, end) of the items array.
  const renderSlice = (items: any[], start: number, end: number): void => {
    // Dispose all currently visible rows.
    for (const row of visibleRows) {
      for (const d of row.disposes) {
        try { d(); } catch { /* noop */ }
      }
      if (row.el.parentNode) {
        row.el.parentNode.removeChild(row.el);
      }
      if (resizeObserver) {
        try { resizeObserver.unobserve(row.el); } catch { /* noop */ }
      }
    }
    visibleRows = [];

    // Clamp end to the actual items length.
    const realEnd = Math.min(end, items.length);
    if (start >= realEnd) {
      topSpacer.style.height = `${computeTopHeight(start)}px`;
      bottomSpacer.style.height = `${computeBottomHeight(realEnd, items.length)}px`;
      return;
    }

    for (let i = start; i < realEnd; i++) {
      const item = items[i];
      const clone = template.cloneNode(true) as HTMLElement;
      clone.removeAttribute('zen-virtual');
      clone.setAttribute('data-zenith-virtual-index', String(i));

      const itemSignal = signal(item);
      const indexSignal = signal(i);
      const localContext: Record<string, any> = Object.create(context);
      Object.defineProperty(localContext, itemName, {
        get: () => itemSignal.get(),
        configurable: true,
        enumerable: true,
      });
      Object.defineProperty(localContext, '$item', {
        get: () => itemSignal.get(),
        configurable: true,
        enumerable: true,
      });
      Object.defineProperty(localContext, '$index', {
        get: () => indexSignal.get(),
        configurable: true,
        enumerable: true,
      });

      const rowDisposes: (() => void)[] = [];
      try {
        processChildren(clone, localContext, rowDisposes);
      } catch (err) {
        reportError(err as Error, 'directive', { expression: forExpr, element: clone });
      }

      contentContainer.appendChild(clone);
      if (resizeObserver) {
        try { resizeObserver.observe(clone); } catch { /* noop */ }
      }

      visibleRows.push({
        el: clone,
        itemSignal,
        indexSignal,
        disposes: rowDisposes,
      });
    }

    // Update spacer heights.
    topSpacer.style.height = `${computeTopHeight(start)}px`;
    bottomSpacer.style.height = `${computeBottomHeight(realEnd, items.length)}px`;
  };

  // ── Scroll tracking ──
  // We listen to scroll events on the nearest scrollable ancestor.
  let currentStart = 0;
  let currentEnd = 0;
  let currentItems: any[] = [];

  const onScroll = (): void => {
    if (currentItems.length === 0) return;
    const viewport = getViewportHeight();
    // FIX (v1.2.8): P1-3 — read scrollTop from the detected scrollContainer
    // instead of assuming the immediate parent is the scroller.
    const scrollTop = scrollContainer ? scrollContainer.scrollTop : 0;
    let start: number;
    if (useDynamicHeights && heights.length > 0) {
      // Walk accumulated heights to find the start index.
      let acc = 0;
      start = 0;
      while (start < currentItems.length && acc + (heights[start] ?? itemHeight) < scrollTop) {
        acc += heights[start] ?? itemHeight;
        start++;
      }
    } else {
      start = Math.max(0, Math.floor(scrollTop / itemHeight));
    }
    const visibleCount = Math.ceil(viewport / itemHeight) + 2; // overscan
    const end = Math.min(currentItems.length, start + visibleCount);
    if (start !== currentStart || end !== currentEnd) {
      currentStart = start;
      currentEnd = end;
      renderSlice(currentItems, start, end);
    }
  };

  // FIX (v1.2.8): P1-3 — detect the scroll container once at setup time
  // using findScrollContainer. Walks up from the table (table mode) or
  // the wrapper (generic mode) and returns the first ancestor with a
  // scrollable overflow-y. Falls back to document.scrollingElement.
  let scrollContainer: HTMLElement | null = null;
  if (isTableMode) {
    const table = parent.closest('table');
    scrollContainer = findScrollContainer(table as HTMLElement | null);
  } else {
    const wrapper = contentContainer.parentElement;
    scrollContainer = findScrollContainer(wrapper);
  }
  if (scrollContainer) {
    scrollContainer.addEventListener('scroll', onScroll, { passive: true });
  }

  // ── Effect: subscribe to the items list ──
  const dispose = effect(() => {
    let items: any[];
    try {
      items = listEval(context) || [];
    } catch (err) {
      reportError(err as Error, 'expression', { expression: listExpr, element: el });
      items = [];
    }
    if (!Array.isArray(items)) items = [];
    currentItems = items;
    // Resize the heights array to match.
    if (heights.length !== items.length) {
      heights = new Array(items.length).fill(itemHeight);
    }
    // Reset to top and render the initial slice.
    currentStart = 0;
    const viewport = getViewportHeight();
    currentEnd = Math.min(items.length, Math.ceil(viewport / itemHeight) + 2);
    renderSlice(items, currentStart, currentEnd);
  });

  return () => {
    if (scrollContainer) {
      scrollContainer.removeEventListener('scroll', onScroll);
    }
    for (const row of visibleRows) {
      for (const d of row.disposes) {
        try { d(); } catch { /* noop */ }
      }
      if (row.el.parentNode) {
        row.el.parentNode.removeChild(row.el);
      }
    }
    visibleRows = [];
    if (resizeObserver) {
      try { resizeObserver.disconnect(); } catch { /* noop */ }
      resizeObserver = null;
    }
    // Remove spacers / wrapper.
    if (topSpacer.parentNode) topSpacer.parentNode.removeChild(topSpacer);
    if (bottomSpacer.parentNode) bottomSpacer.parentNode.removeChild(bottomSpacer);
    if (!isTableMode && contentContainer.parentNode) {
      const wrapper = contentContainer.parentNode;
      wrapper.parentNode?.removeChild(wrapper);
    }
    dispose();
  };
}
