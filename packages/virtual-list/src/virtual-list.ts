// packages/virtual-list/src/virtual-list.ts
//
// @zenith/virtual-list — Virtual Scrolling.
//
// ── مسیر واحد پیاده‌سازی (#47) ──
// موتور مبنا `createVirtualList` (controller.ts) است. `processVirtualList`
// دیگر حلقهٔ مجازی‌سازی/اندازه‌گیری/spacer مستقل ندارد؛ صرفاً directive
// processor است که:
//   1) attributeهای zen-* را به options موتور ترجمه می‌کند،
//   2) template را clone و context $item/$index هر آیتم را وصل می‌کند،
//   3) disposeهای per-item را به موتور پس می‌دهد (registerNodeDisposes).
// استفاده از آن در dev یک‌بار هشدار ZEN-DEPR-001 می‌دهد و در major بعدی
// حذف می‌شود (سیاست #58).
//
// ── سینتکس ──
// <div zen-virtual-list="$items" zen-key="item.id" zen-item-height="40" zen-buffer="5"
//      zen-direction="vertical" zen-dynamic-heights="false"
//      zen-animate-mount="fadeIn" zen-animate-unmount="fadeOut">
//   <span zen-text="$item.name"></span>
// </div>
//
// - zen-virtual-list: Expression آرایه
// - zen-item-height: ارتفاع آیتم به پیکسل (پیش‌فرض: 40)
// - zen-direction: "vertical" (پیش‌فرض) | "horizontal"
// - zen-buffer: آیتم‌های اضافی قبل/بعد (پیش‌فرض: 5)
// - zen-dynamic-heights: "true" برای ارتفاع متغیر (پیش‌فرض: "false")
// - zen-animate-mount / zen-animate-unmount: preset انیمیشن mount/unmount


import { signal, effect, type Signal } from '@zenith/state';
import { compileExpression } from '@zenith/expressions';
import { deprecate } from '@zenith/errors';
import { createVirtualList, registerVirtualListNodeDisposes, type VirtualListApi, type VirtualListDirection } from './controller';
import { makeController } from './virtual-list-items';
import { virtualListConfigToOptions, type VirtualListConfig, type VirtualRange, type VirtualListController } from './virtual-list-config';
import { animateItem, type ItemBinding } from './virtual-list-items';

export { virtualListConfigToOptions, type VirtualListConfig, type VirtualRange, type VirtualListController } from './virtual-list-config';

// ── Main Export (deprecated directive wrapper) ──

/**
 * @deprecated از createVirtualList استفاده کنید (ZEN-DEPR-001، #47).
 *
 * پردازش دایرکتیو `zen-virtual-list` — wrapper روی موتور مبنا.
 */
export function processVirtualList(
  el: HTMLElement,
  listExpr: string,
  context: Record<string, unknown>,
  processChildren: (node: HTMLElement, ctx: Record<string, unknown>, disposes: (() => void)[]) => void,
  disposes: (() => void)[],
): VirtualListController {
  deprecate(
    'ZEN-DEPR-001',
    'processVirtualList',
    'createVirtualList({ items, itemSize, container, renderItem, ... })',
  );

  // ── SSR guard (#47) ──
  // موتور مبنا DOM واقعی می‌خواهد (اندازه‌گیری/اسکرول). در SSR این wrapper
  // همه آیتم‌ها را بدون مجازی‌سازی رندر می‌کند — همان رفتار قبلی؛ این مسیر
  // «رندر کامل سرور» است، نه پیاده‌سازی دوم مجازی‌سازی (تصمیم DEC-019).
  if (typeof document === 'undefined') {
    const list = compileExpression(listExpr)(context);
    if (Array.isArray(list)) {
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        const itemSignal = signal<unknown>(item);
        const indexSignal = signal(i);
        const childCtx: Record<string, unknown> = Object.create(context);
        Object.defineProperty(childCtx, '$item', {
          get: () => itemSignal.get(),
          enumerable: true,
          configurable: true,
        });
        Object.defineProperty(childCtx, '$index', {
          get: () => indexSignal.get(),
          enumerable: true,
          configurable: true,
        });
        const itemDisposes: (() => void)[] = [];
        for (const child of Array.from(el.children)) {
          processChildren(child as HTMLElement, childCtx, itemDisposes);
        }
        disposes.push(...itemDisposes);
      }
    }
    return makeController(() => {}, {
      scrollToIndex() {},
      rebuild() {},
      getRange: () => ({ start: 0, end: 0, offsetY: 0, totalHeight: 0 }),
    });
  }

  const itemHeight = Math.max(1, parseInt(el.getAttribute('zen-item-height') || '40', 10) || 40);
  const buffer = Math.max(0, parseInt(el.getAttribute('zen-buffer') || '5', 10));
  const dynamicHeights = el.getAttribute('zen-dynamic-heights') === 'true';
  const direction = (el.getAttribute('zen-direction') as VirtualListDirection) || 'vertical';
  const animateMount = el.getAttribute('zen-animate-mount');
  const animateUnmount = el.getAttribute('zen-animate-unmount');

  // #47 — attributeهای zen-* تنها در قالب config قدیمی پارس می‌شوند و از همان
  // helper واحد به options موتور ترجمه می‌شوند (مسیر دوم ترجمه وجود ندارد).
  const config: VirtualListConfig = {
    itemHeight,
    buffer,
    dynamicHeights,
    direction,
    animateMount,
    animateUnmount,
  };

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
    return makeController(() => {}, {
      scrollToIndex() {},
      rebuild() {},
      getRange: () => ({ start: 0, end: 0, offsetY: 0, totalHeight: 0 }),
    });
  }

  // ── آرایه‌ی آیتم‌ها: expression → signal ──
  // effect جداگانه expression را evaluate و به signal آیتم‌ها می‌ریزد؛
  // موتور مبنا (createVirtualList) همان signal را render می‌کند.
  const listEvalFn = compileExpression(listExpr);
  const items = signal<unknown[]>([]);
  const disposeListEffect = effect(() => {
    const list = listEvalFn(context);
    items.set(Array.isArray(list) ? [...list] : []);
  });
  disposes.push(disposeListEffect);

  // ── bindings: نود → context آیتم (برای onItemUpdated/$index) ──
  const bindings = new WeakMap<HTMLElement, ItemBinding>();

  const api: VirtualListApi<unknown> = createVirtualList({
    // T از items (Signal<unknown[]>) استنتاج می‌شود — مسیر ترجمه همان helper عمومی است.
    ...virtualListConfigToOptions(config, {
      items,
      container: el,
    }),
    renderItem: (item, index) => {
      const node = document.createElement('div');
      node.appendChild(templateContent.cloneNode(true));
      const itemSignal = signal(item);
      const indexSignal = signal(index);
      const childCtx: Record<string, unknown> = Object.create(context);
      Object.defineProperty(childCtx, '$item', {
        get: () => itemSignal.get(),
        enumerable: true,
        configurable: true,
      });
      Object.defineProperty(childCtx, '$index', {
        get: () => indexSignal.get(),
        enumerable: true,
        configurable: true,
      });
      if (!('item' in context)) {
        Object.defineProperty(childCtx, 'item', {
          get: () => itemSignal.get(),
          enumerable: true,
          configurable: true,
        });
      }
      if (!('index' in context)) {
        Object.defineProperty(childCtx, 'index', {
          get: () => indexSignal.get(),
          enumerable: true,
          configurable: true,
        });
      }
      const parentSignals = context.__zenith_signals__ as
        Map<string, Pick<Signal<unknown>, 'get'>> | undefined;
      const signalsMap = parentSignals ? new Map(parentSignals) : new Map<string, Pick<Signal<unknown>, 'get'>>();
      signalsMap.set('item', itemSignal);
      signalsMap.set('index', indexSignal);
      Object.defineProperty(childCtx, '__zenith_signals__', {
        value: signalsMap,
        enumerable: false,
      });

      const itemDisposes: (() => void)[] = [];
      for (const child of Array.from(node.children)) {
        processChildren(child as HTMLElement, childCtx, itemDisposes);
      }
      bindings.set(node, { itemSignal, indexSignal, ctx: childCtx, itemDisposes });
      if (!dynamicHeights) node.style.height = `${itemHeight}px`;
      if (animateMount) animateItem(node, animateMount, true);

      // disposeهای per-item به موتور پس داده می‌شود (#47).
      registerVirtualListNodeDisposes(node, itemDisposes);
      return node;
    },
    onItemUpdated: (node, _item, index) => {
      // نود کش‌شده در index جدید (مثلاً حذف آیتم قبلی): $index را همگام کن.
      const binding = bindings.get(node);
      if (binding && binding.indexSignal.get() !== index) {
        binding.indexSignal.set(index);
      }
    },
    onNodeRemoved: (node) => {
      if (animateUnmount) animateItem(node, animateUnmount, false);
    },
  });

  // ── Controller سازگار با قرارداد قبلی ──
  // dispose کامل موتور هم به disposes اضافه می‌شود تا با حذف المان،
  // listenerها/observerها و نودهای رندرشده آزاد شوند (#47).
  // #116: خودِ controller قابل‌صدازدن است (Cleanup) و dispose idempotent دارد.
  const disposeEngine = (): void => {
    disposeListEffect();
    api.dispose();
  };
  disposes.push(disposeEngine);

  return makeController(disposeEngine, {
    scrollToIndex(index: number) {
      api.scrollToIndex(index);
    },
    rebuild() {
      api.refresh();
    },
    getRange(): VirtualRange {
      const state = api.getState();
      return {
        start: state.start,
        end: state.end,
        offsetY: state.offset,
        totalHeight: state.totalSize,
      };
    },
  });
}