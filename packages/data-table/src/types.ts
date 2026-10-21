import type { Signal, ReadonlySignal } from '@zenith/state';

/** @public */
export type SortDirection = 'asc' | 'desc' | null;

/** @public */
export interface ColumnSort {
  key: string;
  direction: SortDirection;
}

/** @public */
export interface ColumnFilter {
  key: string;
  value: string;
  operator?: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan';
}

/** @public */
export interface ColumnDef<T = Record<string, unknown>> {
  /** Unique key for the column */
  key: string;
  /** Display title */
  title: string;
  /** Property path in data object (supports dot notation for nested) */
  dataIndex?: string;
  /** Custom render function */
  render?: (value: unknown, row: T, index: number) => string | HTMLElement;
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
  editorOptions?: Array<{ label: string; value: unknown }>;
  /** Hide column */
  hidden?: boolean;
  /** Group name for column grouping */
  group?: string;
  /** Custom class for column cells */
  className?: string;
}

/** @public */
export interface DataTableOptions<T = Record<string, unknown>> {
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
  /** #131: مجازی‌سازی ردیف‌ها برای جداول بزرگ (۱۰۰k+ ردیف) */
  virtual?:
    | boolean
    | {
        rowHeight?: number;
        overscan?: number;
        viewportHeight?: number;
      };
}

/** #131: پنجرهٔ مجازی‌سازی ردیف‌های جدول */
/** @public */
export interface DataTableVirtualWindow<T = Record<string, unknown>> {
  startIndex: number;
  endIndex: number;
  offsetTop: number;
  totalHeight: number;
  visibleRows: T[];
}

/** #131: گزینه‌های خروجی CSV جدول */
/** @public */
export interface CsvExportOptions {
  filename?: string;
  includeHeaders?: boolean;
  separator?: string;
  /** افزودن UTF-8 BOM (`\uFEFF`) برای نمایش صحیح فارسی در Excel */
  bom?: boolean;
  /** انتخاب کلید ستون‌های خاص */
  columns?: string[];
  /** فقط ردیف‌های انتخاب‌شده خروجی گرفته شوند */
  selectedOnly?: boolean;
  /** آیا فایل در مرورگر دانلود شود؟ (پیش‌فرض: false در صورت فراخوانی برنامه‌نویسی) */
  download?: boolean;
}

/** Canonical column-filter configuration. @public */
export interface ColumnFilterOptions { value: string; operator?: ColumnFilter['operator']; }


/** @public */
export interface DataTableApi<T = Record<string, unknown>> {
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
  updateRow: (key: unknown, changes: Partial<T>) => void;
  /** Append rows */
  appendRows: (rows: T[]) => void;
  /** Remove rows */
  removeRows: (keys: unknown[]) => void;

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
  setColumnFilter(key: string, options: ColumnFilterOptions): void;
  /** @deprecated Use setColumnFilter(key, { value, operator }) (ZEN-DEPR-089). */
  setColumnFilter(key: string, value: string, operator?: ColumnFilter['operator']): void;
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
  selectedRows: Signal<Set<unknown>>;
  selectedRowData: ReadonlySignal<T[]>;
  isRowSelected: (key: unknown) => boolean;
  toggleRowSelection: (key: unknown) => void;
  selectAll: () => void;
  clearSelection: () => void;

  // === Editing ===
  editingCell: Signal<{ rowKey: unknown; columnKey: string } | null>;
  startEditing: (rowKey: unknown, columnKey: string) => void;
  cancelEditing: () => void;
  saveEditing: (value: unknown) => Promise<void>;

  // === Export ===
  exportToCSV: (
    filename?: string,
    options?: { includeHeaders?: boolean; separator?: string },
  ) => void;
  /** #131: خروجی استاندارد CSV با پشتیبانی از BOM فارسی، انتخاب ستون/ردیف و escape کامل */
  exportCsv: (options?: CsvExportOptions) => string;
  exportToJSON: (filename?: string) => void;

  // === Virtualization & ARIA Grid (#131) ===
  virtualWindow: ReadonlySignal<DataTableVirtualWindow<T>>;
  setScrollTop: (scrollTop: number) => void;
  renderAriaGrid: (container: HTMLElement) => () => void;

  // === State ===
  getState: () => DataTableState;
  loadState: (state: DataTableState) => void;
  reset: () => void;
}

/** @public */
export interface DataTableState {
  sort: ColumnSort[];
  filters: ColumnFilter[];
  globalSearch: string;
  page: number;
  pageSize: number;
  selectedRows: unknown[];
  hiddenColumns: string[];
}

