// @vitest-environment jsdom
// #47 — «یکی کردن VirtualListConfig و VirtualListOptions<T>»
// API قدیمی `VirtualListConfig` دیگر ساختار مستقل نیست: پل نوعی در
// virtual-list.ts فیلدهای مشترک را به VirtualListOptions قفل می‌کند و
// helper اجرایی `virtualListConfigToOptions` تنها مسیر ترجمه است
// (خودِ wrapper دایرکتیو هم از همان helper عبور می‌کند).
import { describe, it, expect, vi } from 'vitest';
import { signal } from '@zenith/state';
import {
  processVirtualList,
  virtualListConfigToOptions,
  type VirtualListConfig,
} from '../src/virtual-list';

describe('VirtualListConfig ↔ VirtualListOptions unification (#47)', () => {
  it('common fields stay type-compatible with the engine options', () => {
    // پل نوعی داخل virtual-list.ts (itemHeight ↔ itemSize، buffer ↔ overscan،
    // direction ↔ VirtualListDirection) در compile تضمین می‌شود؛ این تست
    // رفتار ترجمه در runtime را قفل می‌کند.
    const cfg: VirtualListConfig = {
      itemHeight: 40,
      buffer: 5,
      dynamicHeights: false,
      direction: 'horizontal',
      animateMount: null,
      animateUnmount: 'fadeOut',
    };
    const opts = virtualListConfigToOptions(cfg, {
      items: [1, 2],
      container: document.createElement('div'),
      renderItem: () => document.createElement('div'),
    });
    expect(opts.direction).toBe('horizontal');
    expect(opts.overscan).toBe(5);
    expect(opts.itemSize).toBe(40);
  });

  it('maps old field names onto engine option names', () => {
    const cfg: VirtualListConfig = {
      itemHeight: 48,
      buffer: 3,
      dynamicHeights: false,
      direction: 'vertical',
      animateMount: 'fadeIn',
      animateUnmount: null,
    };
    const opts = virtualListConfigToOptions(cfg, {
      items: [],
      container: document.createElement('div'),
      renderItem: () => document.createElement('div'),
    });
    expect(opts.itemSize).toBe(48);
    expect(opts.overscan).toBe(3);
    expect(opts.direction).toBe('vertical');
    // فیلدهای فقط-wrapper به options موتور ترجمه نمی‌شوند (موتور بی‌خبر است).
    expect('dynamicHeights' in opts).toBe(false);
    expect('animateMount' in opts).toBe(false);
  });

  it('dynamicHeights switches itemSize to a function (constant measurement)', () => {
    const opts = virtualListConfigToOptions<unknown>(
      {
        itemHeight: 40,
        buffer: 5,
        dynamicHeights: true,
        direction: 'vertical',
        animateMount: null,
        animateUnmount: null,
      },
      {
        items: [],
        container: document.createElement('div'),
        renderItem: () => document.createElement('div'),
      },
    );
    expect(typeof opts.itemSize).toBe('function');
    expect((opts.itemSize as (item: unknown, index: number) => number)({}, 0)).toBe(40);
  });

  it('base options (items/container/renderItem/hooks) flow through untouched', () => {
    const onNodeRemoved = vi.fn();
    const opts = virtualListConfigToOptions<
      unknown,
      {
        items: unknown[];
        container: HTMLElement;
        renderItem: (item: unknown, index: number) => HTMLElement;
        onNodeRemoved: (node: HTMLElement, item: unknown, index: number) => void;
      }
    >(
      {
        itemHeight: 40,
        buffer: 5,
        dynamicHeights: false,
        direction: 'vertical',
        animateMount: null,
        animateUnmount: null,
      },
      {
        items: [],
        container: document.createElement('div'),
        renderItem: () => document.createElement('div'),
        onNodeRemoved,
      },
    );
    expect(opts.items).toEqual([]);
    expect(typeof opts.renderItem).toBe('function');
    expect(opts.onNodeRemoved).toBe(onNodeRemoved);
    expect(opts.itemSize).toBe(40);
  });

  it('the directive wrapper reaches the engine only through this translation', () => {
    // attributeهای zen-* جایی جز config → virtualListConfigToOptions مصرف
    // نمی‌شوند؛ اگر مسیر دوم ترجمه‌ای اضافه شود، این رفتار از کار می‌افتد:
    // zen-item-height=25 و zen-buffer=2 باید عیناً در موتور مبنا اعمال شود.
    document.body.innerHTML = `
      <div id="c" zen-item-height="25" zen-buffer="2">
        <template><div class="row"><span class="name"></span></div></template>
      </div>`;
    const el = document.getElementById('c')!;
    Object.defineProperty(el, 'clientHeight', { value: 100, configurable: true });
    const items = signal(Array.from({ length: 40 }, (_, i) => ({ id: i })));
    const ctx: Record<string, any> = {};
    Object.defineProperty(ctx, '$items', { get: () => items.get(), enumerable: true });
    const disposes: (() => void)[] = [];
    const ctl = processVirtualList(
      el,
      '$items',
      ctx,
      (node, itemCtx, itemDisposes) => {
        node.querySelector('.name')!.textContent = String(itemCtx.$item.id);
        itemDisposes.push(() => {});
      },
      disposes,
    );
    expect(ctl.getRange().totalHeight).toBe(40 * 25); // itemHeight → itemSize
    ctl.scrollToIndex(20);
    expect(el.scrollTop).toBe(20 * 25);
    // buffer=2 → overscan؛ نودهای رندرشده کمتر از کل آیتم‌ها ولی بیشتر از visible
    const rows = el.querySelectorAll('.row').length;
    expect(rows).toBeLessThan(40);
    expect(rows).toBeGreaterThan(0);
    disposes.forEach((d) => d());
    items.set([]);
  });
});
