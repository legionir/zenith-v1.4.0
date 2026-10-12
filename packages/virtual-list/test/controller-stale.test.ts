// @vitest-environment jsdom
//
// #17 — نودهای کش‌شده باید با تغییر آیتم (مرتب‌سازی / جایگزینی آرایه /
// جایگزینی شیء با همان key / درج و حذف میانی) دوباره رندر شوند.
import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createVirtualList } from '../src/controller';

interface Row {
  id: number;
  label: string;
}

function setup(rows: Row[], getItemKey?: (r: Row, i: number) => string | number) {
  document.body.innerHTML = '<div id="c" style="height:100px"></div>';
  const container = document.getElementById('c')!;
  Object.defineProperty(container, 'clientHeight', { value: 1000, configurable: true });
  const items = signal(rows);
  const calls: string[] = [];
  const api = createVirtualList<Row>({
    items,
    itemSize: 10,
    container,
    getItemKey,
    renderItem: (item, _index) => {
      calls.push(item.label);
      const el = document.createElement('div');
      el.textContent = item.label;
      return el;
    },
  });
  return { api, items, calls, container };
}

function renderedLabels(container: HTMLElement): string[] {
  const content = container.querySelector('.zen-virtual-list-content')!;
  return Array.from(content.children)
    .map((c) => c.textContent ?? '')
    .sort();
}

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('virtual-list controller: stale node cache (#17)', () => {
  it('re-renders rows after items.set(sorted) with default index key', () => {
    const rows: Row[] = [
      { id: 1, label: 'A' },
      { id: 2, label: 'B' },
      { id: 3, label: 'C' },
    ];
    const { api, items, container } = setup(rows);
    expect(renderedLabels(container)).toEqual(['A', 'B', 'C']);

    items.set([rows[2]!, rows[0]!, rows[1]!]); // C, A, B
    flushSync();
    flushSync();

    // هر سه ردیف جابه‌جا شدند؛ محتوا باید با آیتم متناظر برابر باشد
    expect(renderedLabels(container)).toEqual(['A', 'B', 'C']);
    const content = container.querySelector('.zen-virtual-list-content')!;
    const byOffset = Array.from(content.children).sort(
      (a, b) =>
        parseFloat((a as HTMLElement).style.transform.replace(/\D/g, '')) -
        parseFloat((b as HTMLElement).style.transform.replace(/\D/g, '')),
    );
    expect(byOffset.map((c) => c.textContent)).toEqual(['C', 'A', 'B']);
    api.dispose();
  });

  it('re-renders when an object with the same id-key is replaced', () => {
    const rows: Row[] = [
      { id: 1, label: 'A' },
      { id: 2, label: 'B' },
    ];
    const keyFn = (r: Row) => r.id;
    const { api, items, calls, container } = setup(rows, keyFn);
    calls.length = 0;

    items.set([{ id: 1, label: 'A2' }, rows[1]!]); // جایگزینی id=1
    flushSync();
    flushSync();

    expect(calls).toEqual(['A2']); // فقط آیتم تغییرکرده دوباره رندر شد
    expect(renderedLabels(container)).toEqual(['A2', 'B']);
    api.dispose();
  });

  it('does NOT re-render rows whose item identity is unchanged', () => {
    const rows: Row[] = [
      { id: 1, label: 'A' },
      { id: 2, label: 'B' },
      { id: 3, label: 'C' },
    ];
    const { api, items, calls } = setup(rows, (r) => r.id);
    calls.length = 0;

    // همان آبجکت‌ها، آرایه‌ی نو ولی محتوای یکسان → نباید renderItem صدا زده شود
    items.set([rows[0]!, rows[1]!, rows[2]!]);
    flushSync();
    flushSync();

    expect(calls).toEqual([]);
    api.dispose();
  });

  it('handles insert/remove in the middle with id keys', () => {
    const rows: Row[] = [
      { id: 1, label: 'A' },
      { id: 2, label: 'B' },
      { id: 3, label: 'C' },
    ];
    const { api, items, container } = setup(rows, (r) => r.id);
    const inserted = { id: 9, label: 'X' };
    items.set([rows[0]!, inserted, rows[2]!]); // B حذف، X درج
    flushSync();
    flushSync();
    expect(renderedLabels(container)).toEqual(['A', 'C', 'X']);
    api.dispose();
  });
});
