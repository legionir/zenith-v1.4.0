import type { DataTableApi } from './types';
import type { TableVirtualConfig } from './virtual-window';
import { getNestedValue } from './values';
/** Rendering snapshots are read at invocation, not engine construction. @internal */
export type TableGridInput<T extends object> = Pick<DataTableApi<T>, 'visibleColumns' | 'virtualWindow' | 'pageData' | 'sortState' | 'totalRows' | 'isRowSelected'> & { virtualCfg: TableVirtualConfig; rowKey: string; };
/** #100: APG grid pattern — horizontal arrows follow the effective direction
 * (explicit dir → inherited dir → computed style, same resolution as
 * virtual-list/a11y; steps match `resolveHorizontalStep` in @zenith/i18n,
 * inlined here so data-table keeps its dependency surface). Read per keydown
 * so a runtime dir switch needs no re-render. */
function gridRtl(container: HTMLElement): boolean {
  const explicit =
    container.getAttribute('dir') || container.closest?.('[dir]')?.getAttribute('dir');
  if (explicit) return explicit.toLowerCase() === 'rtl';
  return container.ownerDocument.defaultView?.getComputedStyle(container).direction === 'rtl';
}
/** Attach one keyboard listener and retain native cleanup/DOM order. @internal */
export function renderTableGrid<T extends object>(container: HTMLElement, input: TableGridInput<T>): () => void {
  const { visibleColumns, virtualCfg, virtualWindow, pageData, sortState, totalRows, rowKey, isRowSelected } = input;
  const cols = visibleColumns.get();
  const win = virtualCfg.enabled ? virtualWindow.get() : null;
  const rows = win ? win.visibleRows : pageData.get();
  const sorts = sortState.get();

  container.setAttribute('role', 'grid');
  container.setAttribute('aria-rowcount', String(totalRows.get()));
  container.setAttribute('aria-colcount', String(cols.length));
  container.textContent = '';

  const headerRow = container.ownerDocument.createElement('div');
  headerRow.setAttribute('role', 'row');
  cols.forEach((col, colIdx) => {
    const cell = container.ownerDocument.createElement('div');
    cell.setAttribute('role', 'columnheader');
    cell.setAttribute('aria-colindex', String(colIdx + 1));
    cell.setAttribute('tabindex', colIdx === 0 ? '0' : '-1');
    if (col.sortable) {
      const s = sorts.find((item) => item.key === col.key);
      const ariaSort =
        s?.direction === 'asc' ? 'ascending' : s?.direction === 'desc' ? 'descending' : 'none';
      cell.setAttribute('aria-sort', ariaSort);
    }
    cell.textContent = col.title;
    headerRow.appendChild(cell);
  });
  container.appendChild(headerRow);

  rows.forEach((row, idx) => {
    const rowEl = container.ownerDocument.createElement('div');
    rowEl.setAttribute('role', 'row');
    const rKey = Reflect.get(row, rowKey);
    const selected = isRowSelected(rKey);
    rowEl.setAttribute('aria-selected', selected ? 'true' : 'false');
    rowEl.setAttribute('aria-rowindex', String((win ? win.startIndex : 0) + idx + 1));
    cols.forEach((col, colIdx) => {
      const cellEl = container.ownerDocument.createElement('div');
      cellEl.setAttribute('role', 'gridcell');
      cellEl.setAttribute('aria-colindex', String(colIdx + 1));
      cellEl.setAttribute('tabindex', '-1');
      const val = getNestedValue(row, col.dataIndex || col.key);
      cellEl.textContent = String(val ?? '');
      rowEl.appendChild(cellEl);
    });
    container.appendChild(rowEl);
  });

  const onKeyDown = (e: KeyboardEvent) => {
    const cells = Array.from(
      container.querySelectorAll('[role="columnheader"], [role="gridcell"]'),
    ) as HTMLElement[];
    const currentIdx = cells.indexOf(e.target as HTMLElement);
    if (currentIdx === -1) return;
    const colCount = Math.max(1, cols.length);
    let nextIdx = currentIdx;
    const rtl = gridRtl(container);
    if (e.key === 'ArrowRight') nextIdx = Math.min(cells.length - 1, currentIdx + (rtl ? -1 : 1));
    else if (e.key === 'ArrowLeft') nextIdx = Math.max(0, currentIdx + (rtl ? 1 : -1));
    else if (e.key === 'ArrowDown') nextIdx = Math.min(cells.length - 1, currentIdx + colCount);
    else if (e.key === 'ArrowUp') nextIdx = Math.max(0, currentIdx - colCount);
    else return;
    e.preventDefault();
    cells[currentIdx]?.setAttribute('tabindex', '-1');
    cells[nextIdx]?.setAttribute('tabindex', '0');
    cells[nextIdx]?.focus();
  };
  container.addEventListener('keydown', onKeyDown);
  let cleaned = false;
  return () => {
    if (cleaned) return;
    cleaned = true;
    container.removeEventListener('keydown', onKeyDown);
  };
}
