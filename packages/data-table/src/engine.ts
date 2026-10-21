/**
 * @zenith/data-table - Advanced reactive data table
 *
 * Features:
 *  - Sorting (single & multi-column)
 *  - Filtering (global + per-column)
 *  - Search
 *  - Pagination
 *  - Row selection (single & multi)
 *  - Inline editing
 *  - Column grouping
 *  - Data export (CSV, JSON)
 *  - Virtual scrolling support for large datasets
 */

import { deprecate } from '@zenith/errors';
import { signal } from '@zenith/state';
import type { ColumnDef, ColumnSort, ColumnFilter, ColumnFilterOptions, DataTableOptions, DataTableApi, DataTableState, SortDirection } from './types';
import { columnFilterOptions } from './options';
import { createTableViews } from './views';
import { createTableExports } from './export';
import { createTableVirtualWindow } from './virtual-window';
import { renderTableGrid } from './grid';
import { setNestedValue } from './values';

/**
 * Create a fully-featured reactive data table
 */
/** @public */
export function createDataTable<T extends object>(
  options: DataTableOptions<T>,
): DataTableApi<T> {
  const {
    columns: initialColumns,
    data: initialData = [],
    rowKey = 'id',
    pagination = { enabled: true, pageSize: 10, pageSizeOptions: [10, 25, 50, 100] },
    sorting = { enabled: true, multiColumn: false },
    filtering = { enabled: true, globalSearch: true },
    selection = { enabled: false, mode: 'multiple' },
    editing = { enabled: false, mode: 'cell' },
  } = options;

  // === Core State ===
  const data = signal<T[]>([...initialData]);
  const columns = signal<ColumnDef<T>[]>([...initialColumns]);
  const hiddenColumns = signal<Set<string>>(new Set());

  // === Sorting ===
  const sortState = signal<ColumnSort[]>(sorting.initial ? [...sorting.initial] : []);

  // === Filtering ===
  const globalSearch = signal('');
  const columnFilters = signal<ColumnFilter[]>([]);

  // === Pagination ===
  const currentPage = signal(1);
  const pageSize = signal(pagination.pageSize);

  // === Selection ===
  const selectedRows = signal<Set<unknown>>(new Set());

  // === Editing ===
  const editingCell = signal<{ rowKey: unknown; columnKey: string } | null>(null);

  // === Virtualization (#131) ===
  const scrollTopSignal = signal(0);
  const virtualCfg =
    typeof options.virtual === 'object' && options.virtual !== null
      ? {
          enabled: true,
          rowHeight: options.virtual.rowHeight ?? 40,
          overscan: options.virtual.overscan ?? 5,
          viewportHeight: options.virtual.viewportHeight ?? 400,
        }
      : {
          enabled: Boolean(options.virtual),
          rowHeight: 40,
          overscan: 5,
          viewportHeight: 400,
        };
  const { visibleColumns, filteredData, totalRows, totalPages, pageData, selectedRowData } = createTableViews({ data, columns, hiddenColumns, globalSearch, columnFilters, sortState, currentPage, pageSize, selectedRows, rowKey, filtering, sorting, pagination });

  function setData(newData: T[]) {
    data.set([...newData]);
    currentPage.set(1);
  }

  function updateRow(key: unknown, changes: Partial<T>) {
    const current = data.get();
    const index = current.findIndex((r) => Reflect.get(r, rowKey) === key);
    if (index > -1) {
      const updated = [...current];
      updated[index] = { ...updated[index], ...changes } as T;
      data.set(updated);
    }
  }

  function appendRows(rows: T[]) {
    data.set([...data.get(), ...rows]);
  }

  function removeRows(keys: unknown[]) {
    data.set(data.get().filter((r) => !keys.includes(Reflect.get(r, rowKey))));
    const selected = new Set(selectedRows.get());
    keys.forEach((k) => selected.delete(k));
    selectedRows.set(selected);
  }

  function toggleColumn(key: string, visible?: boolean) {
    const hidden = new Set(hiddenColumns.get());
    const shouldHide = visible === undefined ? !hidden.has(key) : !visible;
    if (shouldHide) hidden.add(key);
    else hidden.delete(key);
    hiddenColumns.set(hidden);
  }

  function sort(key: string, direction?: SortDirection) {
    if (!sorting.enabled) return;

    const current = sortState.get();
    const existing = current.find((s) => s.key === key);

    if (direction !== undefined) {
      const updated = sorting.multiColumn
        ? current.filter((s) => s.key !== key).concat(direction ? [{ key, direction }] : [])
        : direction
          ? [{ key, direction }]
          : [];
      sortState.set(updated);
      return;
    }

    // Cycle: null -> asc -> desc -> null
    let nextDir: SortDirection = 'asc';
    if (existing?.direction === 'asc') nextDir = 'desc';
    else if (existing?.direction === 'desc') nextDir = null;

    const updated = sorting.multiColumn
      ? current.filter((s) => s.key !== key).concat(nextDir ? [{ key, direction: nextDir }] : [])
      : nextDir
        ? [{ key, direction: nextDir }]
        : [];
    sortState.set(updated);
  }

  function clearSort() {
    sortState.set([]);
  }

  function setColumnFilter(key: string, options: ColumnFilterOptions): void;
  /** @deprecated Use the options overload (ZEN-DEPR-089). */
  function setColumnFilter(key: string, value: string, operator?: ColumnFilter['operator']): void;
  function setColumnFilter(key: string, optionsOrValue: ColumnFilterOptions | string, legacyOperator?: ColumnFilter['operator']): void {
    let value: string, operator: ColumnFilter['operator'];
    if (typeof optionsOrValue === 'string' || arguments.length > 2) {
      deprecate('ZEN-DEPR-089', 'setColumnFilter(key, value, operator)', 'setColumnFilter(key, { value, operator })');
      value = optionsOrValue as string; operator = legacyOperator === undefined ? 'contains' : legacyOperator;
    } else {
      const resolved = columnFilterOptions.resolve(optionsOrValue); value = resolved.value; operator = resolved.operator ?? 'contains';
    }
    if (!filtering.enabled) return;
    const current = columnFilters.get().filter((f) => f.key !== key);
    if (value.trim()) {
      current.push({ key, value, operator });
    }
    columnFilters.set(current);
    currentPage.set(1);
  }

  function clearFilters() {
    columnFilters.set([]);
    globalSearch.set('');
    currentPage.set(1);
  }

  function goToPage(page: number) {
    const total = totalPages.get();
    currentPage.set(Math.max(1, Math.min(page, total)));
  }

  function nextPage() {
    goToPage(currentPage.get() + 1);
  }

  function previousPage() {
    goToPage(currentPage.get() - 1);
  }

  function setPageSize(size: number) {
    pageSize.set(size);
    currentPage.set(1);
  }

  function isRowSelected(key: unknown): boolean {
    return selectedRows.get().has(key);
  }

  function toggleRowSelection(key: unknown) {
    if (!selection.enabled) return;
    const selected = new Set(selectedRows.get());
    if (selection.mode === 'single') {
      selected.clear();
      selected.add(key);
    } else {
      if (selected.has(key)) selected.delete(key);
      else selected.add(key);
    }
    selectedRows.set(selected);
  }

  function selectAll() {
    if (!selection.enabled || selection.mode === 'single') return;
    selectedRows.set(new Set(pageData.get().map((r) => Reflect.get(r, rowKey))));
  }

  function clearSelection() {
    selectedRows.set(new Set());
  }

  function startEditing(rowKey: unknown, columnKey: string) {
    if (!editing.enabled) return;
    editingCell.set({ rowKey, columnKey });
  }

  function cancelEditing() {
    editingCell.set(null);
  }

  async function saveEditing(value: unknown) {
    const cell = editingCell.get();
    if (!cell) return;

    const col = columns.get().find((c) => c.key === cell.columnKey);
    if (!col) return;

    const changes: Partial<T> = {};
    setNestedValue(changes, { path: col.dataIndex || col.key, value });
    updateRow(cell.rowKey, changes);

    if (editing.onSave) {
      const row = data.get().find((r) => Reflect.get(r, rowKey) === cell.rowKey);
      if (row) await editing.onSave(row, changes);
    }

    editingCell.set(null);
  }

  const { exportCsv, exportToCSV, exportToJSON } = createTableExports({ visibleColumns, selectedRowData, filteredData });
  const virtualWindow = createTableVirtualWindow({ filteredData, pageData, virtualCfg, scrollTopSignal });

  function setScrollTop(scrollTop: number): void {
    scrollTopSignal.set(Math.max(0, scrollTop));
  }

  function renderAriaGrid(container: HTMLElement): () => void {
    return renderTableGrid(container, { visibleColumns, virtualCfg, virtualWindow, pageData, sortState, totalRows, rowKey, isRowSelected });
  }

  function getState(): DataTableState {
    return {
      sort: [...sortState.get()],
      filters: [...columnFilters.get()],
      globalSearch: globalSearch.get(),
      page: currentPage.get(),
      pageSize: pageSize.get(),
      selectedRows: Array.from(selectedRows.get()),
      hiddenColumns: Array.from(hiddenColumns.get()),
    };
  }

  function loadState(state: DataTableState) {
    if (state.sort) sortState.set(state.sort);
    if (state.filters) columnFilters.set(state.filters);
    if (state.globalSearch !== undefined) globalSearch.set(state.globalSearch);
    if (state.page) currentPage.set(state.page);
    if (state.pageSize) pageSize.set(state.pageSize);
    if (state.selectedRows) selectedRows.set(new Set(state.selectedRows));
    if (state.hiddenColumns) hiddenColumns.set(new Set(state.hiddenColumns));
  }

  function reset() {
    sortState.set([]);
    columnFilters.set([]);
    globalSearch.set('');
    currentPage.set(1);
    pageSize.set(pagination.pageSize);
    selectedRows.set(new Set());
    hiddenColumns.set(new Set());
    editingCell.set(null);
  }

  // Dynamic editor paths are not proof of a particular field type. Keep native
  // getter/boxing order and strict assignment failure rather than inventing T.

  return {
    // Data
    data,
    filteredData,
    pageData,
    setData,
    updateRow,
    appendRows,
    removeRows,

    // Columns
    columns,
    visibleColumns,
    toggleColumn,

    // Sorting
    sortState,
    sort,
    clearSort,

    // Filtering
    globalSearch,
    columnFilters,
    setColumnFilter,
    clearFilters,

    // Pagination
    currentPage,
    pageSize,
    totalPages,
    totalRows,
    goToPage,
    nextPage,
    previousPage,
    setPageSize,

    // Selection
    selectedRows,
    selectedRowData,
    isRowSelected,
    toggleRowSelection,
    selectAll,
    clearSelection,

    // Editing
    editingCell,
    startEditing,
    cancelEditing,
    saveEditing,

    // Export
    exportToCSV,
    exportCsv,
    exportToJSON,

    // Virtualization & ARIA Grid (#131)
    virtualWindow,
    setScrollTop,
    renderAriaGrid,

    // State
    getState,
    loadState,
    reset,
  };
}
