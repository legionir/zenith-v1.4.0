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

import { signal, computed } from '@zenith/state';
import type { Signal, ReadonlySignal } from '@zenith/state';

// ============================================================
// Types & Interfaces
// ============================================================

export type SortDirection = 'asc' | 'desc' | null;

export interface ColumnSort {
  key: string;
  direction: SortDirection;
}

export interface ColumnFilter {
  key: string;
  value: string;
  operator?: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
}

export interface ColumnDef<T = any> {
  /** Unique key for the column */
  key: string;
  /** Display title */
  title: string;
  /** Property path in data object (supports dot notation for nested) */
  dataIndex?: string;
  /** Custom render function */
  render?: (value: any, row: T, index: number) => string | HTMLElement;
  /** Enable sorting on this column */
  sortable?: boolean;
  /** Enable filtering on this column */
  filterable?: boolean;
  /** Column width */
  width?: string | number;
  /** Text alignment */
  align?: 'left' | 'center' | 'right';
  /** Is column editable */
  editable?: boolean;
  /** Editor type for inline editing */
  editor?: 'text' | 'number' | 'select' | 'checkbox' | 'date';
  /** Options for select editor */
  editorOptions?: Array<{ label: string; value: any }>;
  /** Hide column */
  hidden?: boolean;
  /** Group name for column grouping */
  group?: string;
  /** Custom class for column cells */
  className?: string;
}

export interface DataTableOptions<T = any> {
  /** Table columns definition */
  columns: ColumnDef<T>[];
  /** Initial data */
  data?: T[];
  /** Unique identifier field for rows */
  rowKey?: string;
  /** Pagination configuration */
  pagination?: {
    enabled: boolean;
    pageSize: number;
    pageSizeOptions?: number[];
  };
  /** Sorting configuration */
  sorting?: {
    enabled: boolean;
    multiColumn?: boolean;
    initial?: ColumnSort[];
  };
  /** Filtering configuration */
  filtering?: {
    enabled: boolean;
    globalSearch?: boolean;
  };
  /** Selection configuration */
  selection?: {
    enabled: boolean;
    mode?: 'single' | 'multiple';
  };
  /** Inline editing configuration */
  editing?: {
    enabled: boolean;
    mode?: 'cell' | 'row';
    onSave?: (row: T, changes: Partial<T>) => Promise<void> | void;
  };
  /** Column groups (for header grouping) */
  columnGroups?: Array<{
    title: string;
    columns: string[];
  }>;
}

export interface DataTableApi<T = any> {
  // === Data ===
  /** Raw data */
  data: Signal<T[]>;
  /** Processed data after filtering/sorting */
  filteredData: ReadonlySignal<T[]>;
  /** Data for current page */
  pageData: ReadonlySignal<T[]>;
  /** Set new data */
  setData: (data: T[]) => void;
  /** Update a single row */
  updateRow: (key: any, changes: Partial<T>) => void;
  /** Append rows */
  appendRows: (rows: T[]) => void;
  /** Remove rows */
  removeRows: (keys: any[]) => void;

  // === Columns ===
  columns: Signal<ColumnDef<T>[]>;
  visibleColumns: ReadonlySignal<ColumnDef<T>[]>;
  toggleColumn: (key: string, visible?: boolean) => void;

  // === Sorting ===
  sortState: Signal<ColumnSort[]>;
  sort: (key: string, direction?: SortDirection) => void;
  clearSort: () => void;

  // === Filtering ===
  globalSearch: Signal<string>;
  columnFilters: Signal<ColumnFilter[]>;
  setColumnFilter: (key: string, value: string, operator?: ColumnFilter['operator']) => void;
  clearFilters: () => void;

  // === Pagination ===
  currentPage: Signal<number>;
  pageSize: Signal<number>;
  totalPages: ReadonlySignal<number>;
  totalRows: ReadonlySignal<number>;
  goToPage: (page: number) => void;
  nextPage: () => void;
  previousPage: () => void;
  setPageSize: (size: number) => void;

  // === Selection ===
  selectedRows: Signal<Set<any>>;
  selectedRowData: ReadonlySignal<T[]>;
  isRowSelected: (key: any) => boolean;
  toggleRowSelection: (key: any) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // === Editing ===
  editingCell: Signal<{ rowKey: any; columnKey: string } | null>;
  startEditing: (rowKey: any, columnKey: string) => void;
  cancelEditing: () => void;
  saveEditing: (value: any) => Promise<void>;

  // === Export ===
  exportToCSV: (filename?: string, options?: { includeHeaders?: boolean; separator?: string }) => void;
  exportToJSON: (filename?: string) => void;

  // === State ===
  getState: () => DataTableState;
  loadState: (state: DataTableState) => void;
  reset: () => void;
}

export interface DataTableState {
  sort: ColumnSort[];
  filters: ColumnFilter[];
  globalSearch: string;
  page: number;
  pageSize: number;
  selectedRows: any[];
  hiddenColumns: string[];
}

// ============================================================
// Table Creation
// ============================================================

/**
 * Create a fully-featured reactive data table
 */
export function createDataTable<T extends Record<string, any>>(
  options: DataTableOptions<T>
): DataTableApi<T> {
  const {
    columns: initialColumns,
    data: initialData = [],
    rowKey = 'id',
    pagination = { enabled: true, pageSize: 10, pageSizeOptions: [10, 25, 50, 100] },
    sorting = { enabled: true, multiColumn: false },
    filtering = { enabled: true, globalSearch: true },
    selection = { enabled: false, mode: 'multiple' },
    editing = { enabled: false, mode: 'cell' }
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
  const selectedRows = signal<Set<any>>(new Set());

  // === Editing ===
  const editingCell = signal<{ rowKey: any; columnKey: string } | null>(null);

  // ============================================================
  // Computed: Visible Columns
  // ============================================================
  const visibleColumns = computed(() =>
    columns.get().filter(col => !hiddenColumns.get().has(col.key))
  );

  // ============================================================
  // Computed: Filtered Data
  // ============================================================
  const filteredData = computed(() => {
    let result = [...data.get()];
    const search = globalSearch.get().toLowerCase().trim();
    const filters = columnFilters.get();
    const cols = columns.get();

    // Global search
    if (search && filtering.globalSearch) {
      result = result.filter(row =>
        cols.some(col => {
          const value = getNestedValue(row, col.dataIndex || col.key);
          return String(value ?? '').toLowerCase().includes(search);
        })
      );
    }

    // Column filters
    if (filters.length > 0) {
      result = result.filter(row =>
        filters.every(filter => {
          const col = cols.find(c => c.key === filter.key);
          if (!col) return true;
          const value = String(getNestedValue(row, col.dataIndex || col.key) ?? '').toLowerCase();
          const filterValue = filter.value.toLowerCase();

          switch (filter.operator || 'contains') {
            case 'equals': return value === filterValue;
            case 'startsWith': return value.startsWith(filterValue);
            case 'endsWith': return value.endsWith(filterValue);
            case 'greaterThan': return Number(value) > Number(filterValue);
            case 'lessThan': return Number(value) < Number(filterValue);
            default: return value.includes(filterValue);
          }
        })
      );
    }

    // Sorting
    const sorts = sortState.get();
    if (sorts.length > 0 && sorting.enabled) {
      result.sort((a, b) => {
        for (const sort of sorts) {
          const col = cols.find(c => c.key === sort.key);
          if (!col || !sort.direction) continue;

          const aVal = getNestedValue(a, col.dataIndex || col.key);
          const bVal = getNestedValue(b, col.dataIndex || col.key);
          const comparison = compareValues(aVal, bVal);

          if (comparison !== 0) {
            return sort.direction === 'asc' ? comparison : -comparison;
          }
        }
        return 0;
      });
    }

    return result;
  });

  // ============================================================
  // Computed: Pagination
  // ============================================================
  const totalRows = computed(() => filteredData.get().length);

  const totalPages = computed(() => {
    if (!pagination.enabled) return 1;
    return Math.max(1, Math.ceil(totalRows.get() / pageSize.get()));
  });

  const pageData = computed(() => {
    if (!pagination.enabled) return filteredData.get();
    const start = (currentPage.get() - 1) * pageSize.get();
    return filteredData.get().slice(start, start + pageSize.get());
  });

  // ============================================================
  // Computed: Selection
  // ============================================================
  const selectedRowData = computed(() => {
    const selected = selectedRows.get();
    return data.get().filter(row => selected.has(row[rowKey]));
  });

  // ============================================================
  // Data Operations
  // ============================================================

  function setData(newData: T[]) {
    data.set([...newData]);
    currentPage.set(1);
  }

  function updateRow(key: any, changes: Partial<T>) {
    const current = data.get();
    const index = current.findIndex(r => r[rowKey] === key);
    if (index > -1) {
      const updated = [...current];
      updated[index] = { ...updated[index], ...changes } as T;
      data.set(updated);
    }
  }

  function appendRows(rows: T[]) {
    data.set([...data.get(), ...rows]);
  }

  function removeRows(keys: any[]) {
    data.set(data.get().filter(r => !keys.includes(r[rowKey])));
    const selected = new Set(selectedRows.get());
    keys.forEach(k => selected.delete(k));
    selectedRows.set(selected);
  }

  // ============================================================
  // Column Operations
  // ============================================================

  function toggleColumn(key: string, visible?: boolean) {
    const hidden = new Set(hiddenColumns.get());
    const shouldHide = visible === undefined ? !hidden.has(key) : !visible;
    if (shouldHide) hidden.add(key); else hidden.delete(key);
    hiddenColumns.set(hidden);
  }

  // ============================================================
  // Sort Operations
  // ============================================================

  function sort(key: string, direction?: SortDirection) {
    if (!sorting.enabled) return;

    const current = sortState.get();
    const existing = current.find(s => s.key === key);

    if (direction !== undefined) {
      const updated = sorting.multiColumn
        ? current.filter(s => s.key !== key).concat(direction ? [{ key, direction }] : [])
        : direction ? [{ key, direction }] : [];
      sortState.set(updated);
      return;
    }

    // Cycle: null -> asc -> desc -> null
    let nextDir: SortDirection = 'asc';
    if (existing?.direction === 'asc') nextDir = 'desc';
    else if (existing?.direction === 'desc') nextDir = null;

    const updated = sorting.multiColumn
      ? current.filter(s => s.key !== key).concat(nextDir ? [{ key, direction: nextDir }] : [])
      : nextDir ? [{ key, direction: nextDir }] : [];
    sortState.set(updated);
  }

  function clearSort() {
    sortState.set([]);
  }

  // ============================================================
  // Filter Operations
  // ============================================================

  function setColumnFilter(key: string, value: string, operator: ColumnFilter['operator'] = 'contains') {
    if (!filtering.enabled) return;
    const current = columnFilters.get().filter(f => f.key !== key);
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

  // ============================================================
  // Pagination Operations
  // ============================================================

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

  // ============================================================
  // Selection Operations
  // ============================================================

  function isRowSelected(key: any): boolean {
    return selectedRows.get().has(key);
  }

  function toggleRowSelection(key: any) {
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
    selectedRows.set(new Set(pageData.get().map(r => r[rowKey])));
  }

  function clearSelection() {
    selectedRows.set(new Set());
  }

  // ============================================================
  // Editing Operations
  // ============================================================

  function startEditing(rowKey: any, columnKey: string) {
    if (!editing.enabled) return;
    editingCell.set({ rowKey, columnKey });
  }

  function cancelEditing() {
    editingCell.set(null);
  }

  async function saveEditing(value: any) {
    const cell = editingCell.get();
    if (!cell) return;

    const col = columns.get().find(c => c.key === cell.columnKey);
    if (!col) return;

    const changes: Partial<T> = {};
    setNestedValue(changes, col.dataIndex || col.key, value);
    updateRow(cell.rowKey, changes);

    if (editing.onSave) {
      const row = data.get().find(r => r[rowKey] === cell.rowKey);
      if (row) await editing.onSave(row, changes);
    }

    editingCell.set(null);
  }

  // ============================================================
  // Export
  // ============================================================

  function exportToCSV(filename = 'data.csv', options: { includeHeaders?: boolean; separator?: string } = {}) {
    const { includeHeaders = true, separator = ',' } = options;
    const cols = visibleColumns.get().filter(c => !c.hidden);
    const rows = filteredData.get();

    let csv = '';

    if (includeHeaders) {
      csv += cols.map(c => `"${c.title.replace(/"/g, '""')}"`).join(separator) + '\n';
    }

    for (const row of rows) {
      csv += cols.map(col => {
        const value = getNestedValue(row, col.dataIndex || col.key);
        return `"${String(value ?? '').replace(/"/g, '""')}"`;
      }).join(separator) + '\n';
    }

    downloadFile(csv, filename, 'text/csv;charset=utf-8;');
  }

  function exportToJSON(filename = 'data.json') {
    const json = JSON.stringify(filteredData.get(), null, 2);
    downloadFile(json, filename, 'application/json');
  }

  // ============================================================
  // State Management
  // ============================================================

  function getState(): DataTableState {
    return {
      sort: [...sortState.get()],
      filters: [...columnFilters.get()],
      globalSearch: globalSearch.get(),
      page: currentPage.get(),
      pageSize: pageSize.get(),
      selectedRows: Array.from(selectedRows.get()),
      hiddenColumns: Array.from(hiddenColumns.get())
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

  // ============================================================
  // Internal Helpers
  // ============================================================

  function getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((acc, key) => acc?.[key], obj);
  }

  function setNestedValue(obj: any, path: string, value: any): void {
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i]!;
      if (!current[key]) current[key] = {};
      current = current[key];
    }
    const lastKey = keys[keys.length - 1];
    if (lastKey) current[lastKey] = value;
  }

  function compareValues(a: any, b: any): number {
    if (a == null && b == null) return 0;
    if (a == null) return -1;
    if (b == null) return 1;
    if (typeof a === 'number' && typeof b === 'number') return a - b;
    return String(a).localeCompare(String(b));
  }

  function downloadFile(content: string, filename: string, type: string) {
    if (typeof document === 'undefined') return;
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ============================================================
  // Public API
  // ============================================================

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
    exportToJSON,

    // State
    getState,
    loadState,
    reset
  };
}
