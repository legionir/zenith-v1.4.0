// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { signal } from '@zenith/state';
import { parseForSyntax } from '../src/directives/for-syntax';
import { createLoopContext, createStaticLoopContext, computeKey } from '../src/directives/for-context';
import { buildVirtualLayout, findScrollContainer } from '../src/directives/virtual-layout';
afterEach(() => { document.body.innerHTML = ''; });
it('preserves simple and indexed loop parsing with the original invalid-expression error', () => {
  expect(parseForSyntax(' row in $rows ')).toEqual({ itemName: 'row', indexName: 'index', listExpr: '$rows' });
  expect(parseForSyntax('(row, pos) in rows.filter(active)')).toEqual({ itemName: 'row', indexName: 'pos', listExpr: 'rows.filter(active)' });
  expect(() => parseForSyntax('row of rows')).toThrow();
});
it('keeps inherited getters live and exposes the exact local item/index signal objects', () => {
  let parentValue = 'first'; const parent = { get $parent() { return parentValue; } };
  const itemSignal = signal<unknown>({ id: 1 }), indexSignal = signal(2);
  const context = createLoopContext(parent, { itemName: 'row', indexName: 'pos', itemSignal, indexSignal });
  expect(Object.getPrototypeOf(context)).toBe(parent); expect(context.row).toEqual({ id: 1 }); expect(context.$pos).toBe(2);
  const map = context.__zen_signals_map as Record<string, unknown>; expect(map.row).toBe(itemSignal); expect(map.pos).toBe(indexSignal);
  itemSignal.set({ id: 3 }); indexSignal.set(4); parentValue = 'second'; expect(context.$row).toEqual({ id: 3 }); expect(context.pos).toBe(4); expect(context.$parent).toBe('second');
  itemSignal.dispose(); indexSignal.dispose();
});
it('keeps bare-name shadowing semantics for dynamic and static loop contexts', () => {
  const parent = { row: 'parent', pos: 9 }, itemSignal = signal<unknown>('local'), indexSignal = signal(1);
  const dynamic = createLoopContext(parent, { itemName: 'row', indexName: 'pos', itemSignal, indexSignal });
  const fixed = createStaticLoopContext(parent, { itemName: 'row', indexName: 'pos', item: 'local', index: 1 });
  for (const context of [dynamic, fixed]) { expect(context.row).toBe('parent'); expect(context.pos).toBe(9); expect(context.$row).toBe('local'); expect(context.$pos).toBe(1); }
  expect(Object.hasOwn(fixed, '__zen_signals_map')).toBe(false); itemSignal.dispose(); indexSignal.dispose();
});
it('preserves key coercion, inherited context and fallback-on-evaluation-failure', () => {
  const input = { item: { id: 7 }, index: 2, parentContext: { prefix: 'row' }, itemName: 'row', indexName: 'pos' };
  expect(computeKey(null, input)).toBe('2');
  expect(computeKey(context => Reflect.get(context, 'prefix') + ':' + Reflect.get(context, '$pos'), input)).toBe('row:2');
  expect(computeKey(() => ({ custom: true }), input)).toBe('[object Object]');
  expect(computeKey(() => { throw new Error('key'); }, input)).toBe('2');
});
it('keeps the original generic template detached and places three scaffold children in order', () => {
  const parent = document.createElement('main'), template = document.createElement('article'); parent.append(template); document.body.append(parent);
  const { topSpacer, bottomSpacer, contentContainer } = buildVirtualLayout(template, { parent, isTableMode: false });
  const wrapper = parent.firstElementChild; expect(template.parentElement).toBeNull(); expect(wrapper?.getAttribute('data-zen-virtual-container')).toBe('true');
  expect(Array.from(wrapper?.children ?? [])).toEqual([topSpacer, contentContainer, bottomSpacer]); expect(contentContainer.getAttribute('data-zen-virtual-content')).toBe('true');
});
it('keeps table mode inside the same tbody with the original colspan and no wrapper', () => {
  const table = document.createElement('table'); table.innerHTML = '<tbody><tr><td>a</td><td>b</td></tr></tbody>'; document.body.append(table);
  const parent = table.tBodies[0]!, template = parent.rows[0]!;
  const { topSpacer, bottomSpacer, contentContainer } = buildVirtualLayout(template, { parent, isTableMode: true });
  expect(contentContainer).toBe(parent); expect(Array.from(parent.children)).toEqual([topSpacer, bottomSpacer]);
  expect(topSpacer.querySelector('td')?.colSpan).toBe(2); expect(bottomSpacer.querySelector('td')?.colSpan).toBe(2); expect(template.parentElement).toBeNull();
});
it('retains explicit scroll ancestry and document fallback discovery', () => {
  const scroll = document.createElement('div'), parent = document.createElement('section'), child = document.createElement('b');
  scroll.style.overflowY = 'auto'; scroll.style.height = '300px'; scroll.append(parent); parent.append(child); document.body.append(scroll);
  expect(findScrollContainer(child)).toBe(scroll); scroll.style.overflowY = ''; scroll.style.height = ''; expect(findScrollContainer(child)).toBe(document.body);
});
