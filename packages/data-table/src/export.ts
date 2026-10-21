import type { CsvExportOptions, DataTableApi } from './types';
import { getNestedValue, downloadFile } from './values';
/** Export from live owner views; construction does not read them. @internal */
export function createTableExports<T>(input: Pick<DataTableApi<T>, 'visibleColumns' | 'selectedRowData' | 'filteredData'>) {
  const { visibleColumns, selectedRowData, filteredData } = input;
  function exportCsv(csvOptions: CsvExportOptions = {}): string {
    const {
      filename = 'data.csv',
      includeHeaders = true,
      separator = ',',
      bom = false,
      columns: selectedColKeys,
      selectedOnly = false,
      download = false,
    } = csvOptions;

    let cols = visibleColumns.get().filter((c) => !c.hidden);
    if (Array.isArray(selectedColKeys) && selectedColKeys.length > 0) {
      const colSet = new Set(selectedColKeys);
      cols = cols.filter((c) => colSet.has(c.key));
    }

    const rows = selectedOnly ? selectedRowData.get() : filteredData.get();

    const escapeCell = (raw: unknown): string => {
      const str = String(raw ?? '');
      if (
        str.includes('"') ||
        str.includes(separator) ||
        str.includes('\n') ||
        str.includes('\r')
      ) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const lines: string[] = [];
    if (includeHeaders) {
      lines.push(cols.map((c) => escapeCell(c.title)).join(separator));
    }
    for (const row of rows) {
      lines.push(
        cols
          .map((col) => {
            const value = getNestedValue(row, col.dataIndex || col.key);
            return escapeCell(value);
          })
          .join(separator),
      );
    }

    const body = lines.join('\n');
    const output = bom ? `\uFEFF${body}` : body;
    if (download) {
      downloadFile(output, { filename, type: 'text/csv;charset=utf-8;' });
    }
    return output;
  }

  function exportToCSV(
    filename = 'data.csv',
    options: { includeHeaders?: boolean; separator?: string } = {},
  ) {
    const { includeHeaders = true, separator = ',' } = options;
    const cols = visibleColumns.get().filter((c) => !c.hidden);
    const rows = filteredData.get();

    let csv = '';

    if (includeHeaders) {
      csv += cols.map((c) => `"${c.title.replace(/"/g, '""')}"`).join(separator) + '\n';
    }

    for (const row of rows) {
      csv +=
        cols
          .map((col) => {
            const value = getNestedValue(row, col.dataIndex || col.key);
            return `"${String(value ?? '').replace(/"/g, '""')}"`;
          })
          .join(separator) + '\n';
    }

    downloadFile(csv, { filename, type: 'text/csv;charset=utf-8;' });
  }

  function exportToJSON(filename = 'data.json') {
    const json = JSON.stringify(filteredData.get(), null, 2);
    downloadFile(json, { filename, type: 'application/json' });
  }
  return { exportCsv, exportToCSV, exportToJSON };
}
