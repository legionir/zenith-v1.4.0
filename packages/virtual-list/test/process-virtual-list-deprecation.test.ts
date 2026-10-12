// @vitest-environment jsdom
//
// #47 — processVirtualList باید صرفاً wrapper روی API مبنا (createVirtualList)
// باشد: حلقهٔ مجازی‌سازی/اندازه‌گیری/اسپیسر در controller است و wrapper فقط
// قالب، context آیتم‌ها و processChildren را وصل می‌کند + هشدار deprecation
// یک‌باره با ZEN-DEPR-001.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signal, type Signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { resetDeprecationWarnings } from '@zenith/errors';
import { processVirtualList } from '../src/virtual-list';

interface Row {
  id: number;
  name: string;
}

let idSeq = 0;

function makeContainer(n: number): HTMLElement {
  document.body.innerHTML = `
    <div id="c${++idSeq}" style="height:100px;overflow:auto">
      <template><div class="row"><span class="name"></span></div></template>
    </div>`;
  const c = document.getElementById(`c${idSeq}`)!;
  Object.defineProperty(c, 'clientHeight', { value: 100, configurable: true });
  void n;
  return c;
}

function makeRows(n: number): Row[] {
  return Array.from({ length: n }, (_, i) => ({ id: i, name: `row-${i}` }));
}

/**
 * context مشابه createContext رانتایم: $items getter روی signal آرایه +
 * برای هر آیتم رندرشده $item/$index getter.
 */
function makeCtx(items: Signal<Row[]>): Record<string, any> {
  const ctx: Record<string, any> = {};
  Object.defineProperty(ctx, '$items', {
    get: () => items.get(),
    enumerable: true,
    configurable: true,
  });
  return ctx;
}

/**
 * شبیه‌ساز walker: zen-text در template را با getter $item آیتم فعلی پر می‌کند.
 * signature دقیق processChildren راکنترلر: (node, itemCtx, itemDisposes)
 */
function fakeProcessChildren(
  node: HTMLElement,
  itemCtx: Record<string, any>,
  itemDisposes: (() => void)[],
) {
  const name = node.querySelector('.name');
  if (name) {
    name.textContent = String(itemCtx.$item.name);
    itemDisposes.push(() => {});
  }
}

describe('processVirtualList is a deprecated wrapper over createVirtualList (#47)', () => {
  let calls: string[];
  let spy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    calls = [];
    spy = vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
      calls.push(args.map(String).join(' '));
    });
    resetDeprecationWarnings();
  });

  afterEach(() => {
    spy.mockRestore();
    resetDeprecationWarnings();
  });

  it('warns once with ZEN-DEPR-001 pointing to createVirtualList', () => {
    const items = signal(makeRows(20));
    const disposes: (() => void)[] = [];
    const a = makeContainer(20);
    processVirtualList(a, '$items', makeCtx(items), fakeProcessChildren, disposes);
    const b = makeContainer(20);
    processVirtualList(b, '$items', makeCtx(items), fakeProcessChildren, disposes);
    const dep = calls.filter((c) => c.includes('ZEN-DEPR-001'));
    expect(dep).toHaveLength(1);
    expect(dep[0]).toContain('processVirtualList');
    expect(dep[0]).toContain('createVirtualList');
    disposes.forEach((d) => d());
  });

  it('renders visible rows through the shared engine with $item/$index context', () => {
    const items = signal(makeRows(50));
    const el = makeContainer(50);
    const disposes: (() => void)[] = [];
    const ctl = processVirtualList(el, '$items', makeCtx(items), fakeProcessChildren, disposes);
    const rows = el.querySelectorAll('.row');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThan(50); // واقعاً مجازی‌سازی می‌شود
    expect(rows[0]!.querySelector('.name')!.textContent).toBe('row-0');
    const range = ctl.getRange();
    expect(range.start).toBe(0);
    expect(range.totalHeight).toBe(50 * 40); // zen-item-height پیش‌فرض ۴۰
    disposes.forEach((d) => d());
  });

  it('reacts to list replacement (single reactive path via engine)', () => {
    const items = signal(makeRows(30));
    const el = makeContainer(30);
    const disposes: (() => void)[] = [];
    processVirtualList(el, '$items', makeCtx(items), fakeProcessChildren, disposes);
    const before = el.querySelectorAll('.row').length;
    items.set([]);
    flushSync();
    const after = el.querySelectorAll('.row').length;
    expect(after).toBe(0);
    expect(before).toBeGreaterThan(0);
    disposes.forEach((d) => d());
  });

  it('controller surface (scrollToIndex/rebuild/getRange) keeps working through the wrapper', () => {
    const items = signal(makeRows(100));
    const el = makeContainer(100);
    const disposes: (() => void)[] = [];
    const ctl = processVirtualList(el, '$items', makeCtx(items), fakeProcessChildren, disposes);
    ctl.scrollToIndex(10);
    // jsdom scrollTop را واقعاً اعمال می‌کند (setter قابل‌نوشتن)
    expect(el.scrollTop).toBe(10 * 40);
    ctl.rebuild();
    expect(ctl.getRange().totalHeight).toBe(100 * 40);
    disposes.forEach((d) => d());
  });

  it('cleanup via disposes removes engine nodes and layers (no leak)', () => {
    const items = signal(makeRows(40));
    const el = makeContainer(40);
    const disposes: (() => void)[] = [];
    processVirtualList(el, '$items', makeCtx(items), fakeProcessChildren, disposes);
    expect(el.querySelectorAll('.row').length).toBeGreaterThan(0);
    disposes.forEach((d) => d());
    expect(el.querySelectorAll('.row').length).toBe(0);
    expect(el.querySelectorAll('.zen-virtual-list-spacer, .zen-virtual-list-content').length).toBe(
      0,
    );
  });
});
