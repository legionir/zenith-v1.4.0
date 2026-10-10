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
import {
  createVirtualList,
  registerVirtualListNodeDisposes,
  type VirtualItemSize,
  type VirtualListApi,
  type VirtualListDirection,
  type VirtualListOptions,
} from './controller';

// ── Types (قرارداد عمومی پکیج) ──

/**
 * @deprecated از `VirtualListOptions<T>` API مبنا استفاده کنید (#47، ZEN-DEPR-001).
 *
 * یکی‌سازی #47: این تایپ دیگر ساختار مستقلی نیست — صرفاً نمای قدیمی
 * (`itemHeight`/`buffer`) از فیلدهای مشترک `VirtualListOptions` است و
 * type-check تضمین می‌کند هر وقت دو طرف واگرا شوند اینجا می‌شکند.
 * ترجمهٔ اجرایی با `virtualListConfigToOptions` انجام می‌شود.
 */
export interface VirtualListConfig {
  itemHeight: number;
  buffer: number;
  /** فقط wrapper مصرف می‌کند (measure/height style) — خارج از options موتور. */
  dynamicHeights: boolean;
  direction: 'vertical' | 'horizontal';
  /** فقط wrapper مصرف می‌کند (انیمیشن mount/unmount آیتم). */
  animateMount: string | null;
  animateUnmount: string | null;
}

/**
 * #47 — پل نوعی: فیلدهای مشترک config قدیمی باید هم‌نوع با options موتور
 * بمانند (itemHeight:number ↔ itemSize شامل number، buffer:number ↔
 * overscan?: number، direction ↔ VirtualListDirection). واگرایی = خطای compile.
 */
const _configUnified: {
  itemHeight: number extends VirtualItemSize<unknown> ? true : false;
  buffer: number extends NonNullable<VirtualListOptions<unknown>['overscan']> ? true : false;
  direction: 'vertical' | 'horizontal' extends VirtualListDirection ? true : false;
} = { itemHeight: true, buffer: true, direction: true };
void _configUnified;

/**
 * @deprecated ترجیحاً `createVirtualList(VirtualListOptions<T>)` مستقیم؛ این
 * helper همان پل config→options است که داخل wrapper دایرکتیو هم استفاده می‌شود
 * تا فقط یک مسیر ترجمه وجود داشته باشد (#47 — «یکی کردن VirtualListConfig و
 * VirtualListOptions<T>»). فیلدهای فقط-wrapper (dynamicHeights/animateMount/
 * animateUnmount) به options موتور ترجمه نمی‌شوند؛ موتور از آن‌ها بی‌خبر است.
 */
export function virtualListConfigToOptions<
  T,
  B extends Pick<VirtualListOptions<T>, 'items' | 'container'>,
>(
  config: VirtualListConfig,
  base: B,
): B & {
  itemSize: VirtualItemSize<T>;
  overscan: number;
  direction: VirtualListDirection;
} {
  const itemSize: VirtualItemSize<T> = config.dynamicHeights
    ? () => config.itemHeight
    : config.itemHeight;
  return {
    ...base,
    itemSize,
    overscan: config.buffer,
    direction: config.direction,
  };
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
  /** بازسازی محاسبات offset (برای dynamic heights) */
  rebuild(): void;
  /** دریافت محدوده visible فعلی */
  getRange(): VirtualRange;
}

// ── Animate Mount/Unmount ──
// (انیمیشن mount/unmount آیتم‌ها: فقط در همین wrapper مصرف می‌شود؛
// موتور مبنا از آن بی‌خبر است — #47.)
const MOUNT_PRESETS: Record<string, Keyframe[]> = {
  fadeIn: [{ opacity: '0' }, { opacity: '1' }],
  slideDown: [
    { transform: 'translateY(-10px)', opacity: '0' },
    { transform: 'none', opacity: '1' },
  ],
  slideUp: [
    { transform: 'translateY(10px)', opacity: '0' },
    { transform: 'none', opacity: '1' },
  ],
  scaleIn: [
    { transform: 'scale(0.9)', opacity: '0' },
    { transform: 'scale(1)', opacity: '1' },
  ],
};

const UNMOUNT_PRESETS: Record<string, Keyframe[]> = {
  fadeOut: [{ opacity: '1' }, { opacity: '0' }],
  slideUp: [
    { transform: 'none', opacity: '1' },
    { transform: 'translateY(-10px)', opacity: '0' },
  ],
  slideDown: [
    { transform: 'none', opacity: '1' },
    { transform: 'translateY(10px)', opacity: '0' },
  ],
  scaleOut: [
    { transform: 'scale(1)', opacity: '1' },
    { transform: 'scale(0.9)', opacity: '0' },
  ],
};

function animateItem(el: HTMLElement, preset: string, isMount: boolean): void {
  const presets = isMount ? MOUNT_PRESETS : UNMOUNT_PRESETS;
  const keyframes = presets[preset];
  if (!keyframes || typeof el.animate !== 'function') return;
  const anim = el.animate(keyframes, { duration: 200, easing: 'ease-out' });
  anim.onfinish = () => {
    try {
      anim.commitStyles();
    } catch {
      /* noop */
    }
    anim.cancel();
  };
}

/** context آیتم‌محور: $item/$index getter + نگاشت سیگنال‌ها برای zen-* . */
interface ItemBinding {
  itemSignal: Signal<unknown>;
  indexSignal: Signal<number>;
  ctx: Record<string, unknown>;
  itemDisposes: (() => void)[];
}

// ── Main Export (deprecated directive wrapper) ──

/**
 * @deprecated از createVirtualList استفاده کنید (ZEN-DEPR-001، #47).
 *
 * پردازش دایرکتیو `zen-virtual-list` — wrapper روی موتور مبنا.
 */
export function processVirtualList(
  el: HTMLElement,
  listExpr: string,
  context: Record<string, any>,
  processChildren: (node: HTMLElement, ctx: Record<string, any>, disposes: (() => void)[]) => void,
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
        const childCtx: Record<string, any> = Object.create(context);
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
    return {
      scrollToIndex() {},
      rebuild() {},
      getRange: () => ({ start: 0, end: 0, offsetY: 0, totalHeight: 0 }),
    };
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
    return {
      scrollToIndex() {},
      rebuild() {},
      getRange: () => ({ start: 0, end: 0, offsetY: 0, totalHeight: 0 }),
    };
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
      const childCtx: Record<string, any> = Object.create(context);
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
      const parentSignals = (context as any).__zenith_signals__ as
        Map<string, Signal<any>> | undefined;
      const signalsMap = parentSignals ? new Map(parentSignals) : new Map<string, Signal<any>>();
      signalsMap.set('item', itemSignal);
      signalsMap.set('index', indexSignal as Signal<any>);
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
  disposes.push(() => api.dispose());

  return {
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
  };
}
