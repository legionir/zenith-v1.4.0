import { computed } from '@zenith/state';
import type { DataTableApi, DataTableOptions } from './types';
import { getNestedValue, compareValues } from './values';
/** Internal derived-state operands; these are the real owner signals. @internal */
export type TableViewInput<T extends object> = Pick<DataTableApi<T>, 'data' | 'columns' | 'hiddenColumns' | 'globalSearch' | 'columnFilters' | 'sortState' | 'currentPage' | 'pageSize' | 'selectedRows'> & { rowKey: string; filtering: NonNullable<DataTableOptions<T>['filtering']>; sorting: NonNullable<DataTableOptions<T>['sorting']>; pagination: NonNullable<DataTableOptions<T>['pagination']>; };
/** Construct once in the caller's active reactive owner. @internal */
export function createTableViews<T extends object>(input: TableViewInput<T>) {
  const { data, columns, hiddenColumns, globalSearch, columnFilters, sortState, currentPage, pageSize, selectedRows, rowKey, filtering, sorting, pagination } = input;
  const visibleColumns = computed(() =>
    columns.get().filter((col) => !hiddenColumns.get().has(col.key)),
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
      result = result.filter((row) =>
        cols.some((col) => {
          const value = getNestedValue(row, col.dataIndex || col.key);
          return String(value ?? '')
            .toLowerCase()
            .includes(search);
        }),
      );
    }

    // Column filters
    if (filters.length > 0) {
      result = result.filter((row) =>
        filters.every((filter) => {
          const col = cols.find((c) => c.key === filter.key);
          if (!col) return true;
          const value = String(getNestedValue(row, col.dataIndex || col.key) ?? '').toLowerCase();
          const filterValue = filter.value.toLowerCase();

          switch (filter.operator || 'contains') {
            case 'equals':
              return value === filterValue;
            case 'startsWith':
              return value.startsWith(filterValue);
            case 'endsWith':
              return value.endsWith(filterValue);
            case 'greaterThan':
              return Number(value) > Number(filterValue);
            case 'lessThan':
              return Number(value) < Number(filterValue);
            default:
              return value.includes(filterValue);
          }
        }),
      );
    }

    // Sorting
    const sorts = sortState.get();
    if (sorts.length > 0 && sorting.enabled) {
      result.sort((a, b) => {
        for (const sort of sorts) {
          const col = cols.find((c) => c.key === sort.key);
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
    return data.get().filter((row) => selected.has(Reflect.get(row, rowKey)));
  });

  return { visibleColumns, filteredData, totalRows, totalPages, pageData, selectedRowData };
}
