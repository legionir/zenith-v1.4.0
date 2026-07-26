# @zenith/data-table

Advanced reactive data table for Zenith with sorting, filtering, pagination, selection, inline editing, and export.

## Installation

```bash
npm install @zenith/data-table
```

## Usage

### Basic Setup

```typescript
import { createDataTable } from '@zenith/data-table';
import type { ColumnDef } from '@zenith/data-table';

const columns: ColumnDef<User>[] = [
  { key: 'id', title: 'ID', sortable: true, width: 80, align: 'center' },
  { key: 'name', title: 'Name', sortable: true, filterable: true, editable: true, editor: 'text' },
  { key: 'email', title: 'Email', sortable: true, filterable: true },
  { key: 'role', title: 'Role', sortable: true, filterable: true, editable: true, editor: 'select',
    editorOptions: [
      { label: 'Admin', value: 'admin' },
      { label: 'User', value: 'user' },
      { label: 'Guest', value: 'guest' }
    ]
  },
  { key: 'status', title: 'Status', sortable: true,
    render: (value) => value === 'active' ? '✅ Active' : '❌ Inactive'
  },
  { key: 'createdAt', title: 'Created', sortable: true,
    render: (value) => new Date(value).toLocaleDateString('fa-IR')
  }
];

const usersTable = createDataTable<User>({
  columns,
  data: [],
  rowKey: 'id',
  pagination: { enabled: true, pageSize: 25, pageSizeOptions: [10, 25, 50, 100] },
  sorting: { enabled: true, multiColumn: true },
  filtering: { enabled: true, globalSearch: true },
  selection: { enabled: true, mode: 'multiple' },
  editing: {
    enabled: true,
    mode: 'cell',
    onSave: async (row, changes) => {
      await api.updateUser(row.id, changes);
    }
  }
});

// Load data
async function loadUsers() {
  const { data } = await http.get<User[]>('/api/users');
  usersTable.setData(data);
}
```

### Common Operations

```typescript
// Global search
usersTable.globalSearch.set('Ali');

// Column filter
usersTable.setColumnFilter('role', 'admin', 'equals');

// Sorting
usersTable.sort('createdAt', 'desc');
usersTable.clearSort();

// Pagination
usersTable.nextPage();
usersTable.goToPage(3);
usersTable.setPageSize(50);

// Selection
usersTable.selectAll();
usersTable.toggleRowSelection(123);
const selected = usersTable.selectedRowData.get();

// Inline editing
usersTable.startEditing(123, 'name');
await usersTable.saveEditing('Ali Rezaei');
usersTable.cancelEditing();

// Export
usersTable.exportToCSV('users.csv');
usersTable.exportToJSON('users.json');

// State persistence
const state = usersTable.getState();
localStorage.setItem('tableState', JSON.stringify(state));
usersTable.loadState(JSON.parse(savedState));

// Reset
usersTable.reset();
```

## API Reference

### Data
- `data` — Raw data Signal
- `filteredData` — Data after filtering/sorting (ReadonlySignal)
- `pageData` — Current page data (ReadonlySignal)
- `setData(data)` — Set new data
- `updateRow(key, changes)` — Update a single row
- `appendRows(rows)` — Append rows
- `removeRows(keys)` — Remove rows by key

### Columns
- `columns` — Column definitions Signal
- `visibleColumns` — Non-hidden columns (ReadonlySignal)
- `toggleColumn(key, visible?)` — Toggle column visibility

### Sorting
- `sortState` — Current sort state Signal
- `sort(key, direction?)` — Sort by column
- `clearSort()` — Clear all sorts

### Filtering
- `globalSearch` — Global search text Signal
- `columnFilters` — Column filters Signal
- `setColumnFilter(key, value, operator?)` — Set column filter
- `clearFilters()` — Clear all filters

### Pagination
- `currentPage` — Current page Signal
- `pageSize` — Page size Signal
- `totalPages` — Total pages (ReadonlySignal)
- `totalRows` — Total rows (ReadonlySignal)
- `goToPage(page)` — Go to specific page
- `nextPage()` / `previousPage()` — Navigate pages
- `setPageSize(size)` — Change page size

### Selection
- `selectedRows` — Selected row keys Signal
- `selectedRowData` — Selected row data (ReadonlySignal)
- `isRowSelected(key)` — Check if row is selected
- `toggleRowSelection(key)` — Toggle row selection
- `selectAll()` — Select all visible rows
- `clearSelection()` — Clear selection

### Editing
- `editingCell` — Currently editing cell Signal
- `startEditing(rowKey, columnKey)` — Start editing
- `cancelEditing()` — Cancel editing
- `saveEditing(value)` — Save edited value

### Export
- `exportToCSV(filename?, options?)` — Export to CSV
- `exportToJSON(filename?)` — Export to JSON

### State
- `getState()` — Get serializable state
- `loadState(state)` — Restore state
- `reset()` — Reset to defaults
