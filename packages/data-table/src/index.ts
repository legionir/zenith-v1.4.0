/**
 * @zenith/data-table - Advanced reactive data table
 */

export * from './data-table';
export { createDataTable } from './data-table';
export type {
  ColumnDef,
  DataTableOptions,
  DataTableApi,
  DataTableState,
  DataTableVirtualWindow,
  CsvExportOptions,
  ColumnSort,
  ColumnFilter,
  SortDirection,
} from './data-table';

/**
 * #53: پیش‌فرض‌های منجمد برای `@zenith/data-table` (`DataTableOptions`).
 * @default { pageSize: 10, initialPage: 1, selectable: false, multiSort: false }
 * @since 1.4.0
 */
export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  pageSize: 10,
  initialPage: 1,
  selectable: false,
  multiSort: false,
});

