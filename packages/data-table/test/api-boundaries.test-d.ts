import { expectTypeOf } from 'vitest';
import { createDataTable, type ColumnDef, type DataTableState, type DataTableApi } from '../src';
interface Row { id: number; name: string; score: number }
const rows: Row[] = [{ id: 1, name: 'One', score: 10 }];
const table = createDataTable({ data: rows, columns: [{ key: 'name', title: 'Name', render(value, row) { expectTypeOf(value).toBeUnknown(); expectTypeOf(row).toEqualTypeOf<Row>(); return row.name; } }] });
expectTypeOf(table.data.get()).toEqualTypeOf<Row[]>();
expectTypeOf<Parameters<NonNullable<ColumnDef['render']>>[0]>().toBeUnknown();
expectTypeOf<DataTableState['selectedRows']>().toEqualTypeOf<unknown[]>();
expectTypeOf<DataTableApi['selectedRows']>().toEqualTypeOf<import('@zenith/state').Signal<Set<unknown>>>();
table.setColumnFilter('name', { value: 'One', operator: 'equals' });
// @ts-expect-error Canonical filter operators are finite and validated.
table.setColumnFilter('name', { value: 'One', operator: 'arbitrary' });
// @ts-expect-error Default dynamic cell values require narrowing.
const unchecked: string = {} as Parameters<NonNullable<ColumnDef['render']>>[0];
// @ts-expect-error Row inference is preserved after construction.
table.setData([{ id: 'not a number', name: 'Bad', score: 2 }]);
void unchecked;
