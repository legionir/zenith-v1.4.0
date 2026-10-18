// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { createRoot } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { resetDeprecationWarnings } from '@zenith/errors';
import { setHostPrinter } from '@zenith/errors/internal';
import { createDataTable } from '../src';
import { createDataTable as Established } from '../src/data-table';
import { createDataTable as Factory } from '../src/engine';
import { getNestedValue, setNestedValue } from '../src/values';
const releases: Array<() => void> = [];
afterEach(() => { for (const release of releases.splice(0).reverse()) release(); vi.restoreAllMocks(); document.body.innerHTML = ''; resetDeprecationWarnings(); });
function owned<T>(run: () => T): T { return createRoot(dispose => { releases.push(dispose); return run(); }); }
it('preserves factory identity through root and established import paths', () => { expect(createDataTable).toBe(Established); expect(createDataTable).toBe(Factory); });
it('keeps one live set of owner signals through derived views, selection and editing', async () => {
  const key = { identity: 'object' };
  const table = owned(() => createDataTable({ data: [{ id: key, profile: { name: 'One' } }], columns: [{ key: 'name', dataIndex: 'profile.name', title: 'Name' }], selection: { enabled: true }, editing: { enabled: true } }));
  const data = table.data, selection = table.selectedRows, view = table.pageData;
  expect(view.get()[0]?.profile.name).toBe('One'); table.toggleRowSelection(key); expect(table.selectedRowData.get()[0]).toBe(data.get()[0]);
  table.startEditing(key, 'name'); await table.saveEditing('Two'); flushSync(); flushSync(); expect(data.get()[0]?.profile.name).toBe('Two');
  expect(table.data).toBe(data); expect(table.selectedRows).toBe(selection); expect(table.pageData).toBe(view);
});
it('validates canonical filter configuration and preserves legacy default semantics with one bridge warning', () => {
  const diagnostics: string[] = []; releases.push(setHostPrinter((_severity, text) => { diagnostics.push(text); }));
  const table = owned(() => createDataTable({ data: [{ id: 1, name: 'One' }, { id: 2, name: 'Two' }], columns: [{ key: 'name', title: 'Name' }] }));
  table.setColumnFilter('name', { value: 'One', operator: 'equals' }); expect(diagnostics.some(text => text.includes('ZEN-DEPR-089'))).toBe(false); expect(table.filteredData.get()).toHaveLength(1);
  table.setColumnFilter('name', 'Two'); table.setColumnFilter('name', 'One', undefined);
  expect(table.columnFilters.get()[0]?.operator).toBe('contains'); expect(diagnostics.filter(text => text.includes('ZEN-DEPR-089'))).toHaveLength(1);
  // @ts-expect-error Deliberately malformed JavaScript options.
  expect(() => table.setColumnFilter('name', { value: 1 })).toThrow();
});
it('does not send disabled-filter legacy arity through canonical validation', () => {
  const table = owned(() => createDataTable({ columns: [], filtering: { enabled: false } }));
  expect(() => table.setColumnFilter('name', undefined as unknown as string, undefined)).not.toThrow();
});
it('retains separate canonical and historical CSV escaping formats after extraction', () => {
  const table = owned(() => createDataTable({ data: [{ id: 1, name: 'a,b' }, { id: 2, name: 'plain' }], columns: [{ key: 'name', title: 'Name' }] }));
  expect(table.exportCsv()).toBe('Name\n"a,b"\nplain'); expect(table.exportCsv({ bom: true, includeHeaders: false })).toBe('\uFEFF"a,b"\nplain');
  table.setData([{ id: 3, name: 'changed' }]); flushSync(); flushSync(); expect(table.exportCsv()).toBe('Name\nchanged');
});
it('renders the current virtual window and owns exactly the keyboard listener it installs', () => {
  const table = owned(() => createDataTable({ data: Array.from({ length: 30 }, (_, id) => ({ id, name: `row-${id}` })), columns: [{ key: 'name', title: 'Name' }], virtual: { rowHeight: 20, viewportHeight: 40, overscan: 0 } }));
  const grid = document.createElement('main'); document.body.append(grid); const remove = vi.spyOn(grid, 'removeEventListener');
  table.setScrollTop(100); const stop = table.renderAriaGrid(grid); releases.push(stop); expect(grid.getAttribute('aria-rowcount')).toBe('30'); expect(grid.querySelector('[role="gridcell"]')?.textContent).toBe('row-5');
  stop(); stop(); expect(remove.mock.calls.filter(([name]) => name === 'keydown')).toHaveLength(1);
});
it('preserves dynamic path boxing, getter order and strict write failures without inferring a payload type', () => {
  expect(getNestedValue({ value: 'abc' }, 'value.length')).toBe(3); expect(getNestedValue({ value: null }, 'value.name')).toBeUndefined();
  const nested = { value: 'old' }, reads: string[] = [], target = { get nested() { reads.push('get'); return nested; } };
  setNestedValue(target, { path: 'nested.value', value: 'new' }); expect(reads).toEqual(['get', 'get']); expect(nested.value).toBe('new');
  expect(() => setNestedValue(Object.freeze({ value: 'fixed' }), { path: 'value', value: 'bad' })).toThrow(TypeError);
});
