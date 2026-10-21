import { s, defineOptions } from '@zenith/schema';
import type { ColumnFilterOptions } from './types';
/** Private canonical validation; legacy operands bypass it. @internal */
export const columnFilterOptions = defineOptions<ColumnFilterOptions>('ColumnFilterOptions', s.object({
  value: s.string(), operator: s.optional(s.enum(['contains', 'equals', 'startsWith', 'endsWith', 'greaterThan', 'lessThan'] as const)),
}));
