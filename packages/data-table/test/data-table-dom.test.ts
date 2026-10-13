// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { flushSync } from '@zenith/scheduler';
import { createDataTable } from '../src/index';

interface UserRow {
  id: number;
  name: string;
  role: string;
  score: number;
}

function flushComputedChain(): void {
  flushSync();
  flushSync();
}

describe('@zenith/data-table DOM & reactive unit tests (#28)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('supports sorting, filtering, search, pagination, selection, editing, and state snapshot/restore', async () => {
    const initialRows: UserRow[] = [
      { id: 1, name: 'Alice', role: 'admin', score: 90 },
      { id: 2, name: 'Bob', role: 'editor', score: 75 },
      { id: 3, name: 'Cara', role: 'admin', score: 95 },
    ];

    const table = createDataTable<UserRow>({
      data: initialRows,
      rowKey: 'id',
      columns: [
        { key: 'name', title: 'Name', sortable: true, filterable: true, editable: true },
        { key: 'role', title: 'Role', sortable: true, filterable: true },
        { key: 'score', title: 'Score', sortable: true },
      ],
      pagination: { enabled: true, pageSize: 2 },
      sorting: { enabled: true },
      filtering: { enabled: true, globalSearch: true },
      selection: { enabled: true, mode: 'multiple' },
      editing: { enabled: true, mode: 'cell' },
    });

    expect(table.totalRows.get()).toBe(3);
    expect(table.pageData.get()).toHaveLength(2);
    expect(table.totalPages.get()).toBe(2);

    // Sorting descending by score
    table.sort('score', 'desc');
    flushComputedChain();
    expect(table.pageData.get()[0].name).toBe('Cara');

    // Filtering by role
    table.setColumnFilter('role', 'admin', 'equals');
    flushComputedChain();
    expect(table.totalRows.get()).toBe(2);

    // Global search
    table.clearFilters();
    table.globalSearch.set('Bob');
    flushComputedChain();
    expect(table.totalRows.get()).toBe(1);
    expect(table.pageData.get()[0].name).toBe('Bob');

    // Selection & Inline editing
    table.globalSearch.set('');
    table.toggleRowSelection(2);
    flushComputedChain();
    expect(table.selectedRows.get().has(2)).toBe(true);
    expect(table.selectedRowData.get().map((r) => r.id)).toEqual([2]);

    table.startEditing(2, 'name');
    await table.saveEditing('Robert');
    flushComputedChain();
    expect(table.data.get().find((r) => r.id === 2)?.name).toBe('Robert');

    // State snapshot & restore
    const snapshot = table.getState();
    expect(snapshot.selectedRows).toEqual([2]);
    table.reset();
    flushComputedChain();
    expect(table.selectedRows.get().size).toBe(0);
    table.loadState(snapshot);
    flushComputedChain();
    expect(table.selectedRows.get().has(2)).toBe(true);
  });
});
