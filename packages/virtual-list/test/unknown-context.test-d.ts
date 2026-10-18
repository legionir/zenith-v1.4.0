import { expectTypeOf } from 'vitest';
import { processVirtualList } from '../src';
expectTypeOf<Parameters<typeof processVirtualList>[2]>().toEqualTypeOf<Record<string, unknown>>();
expectTypeOf<Parameters<Parameters<typeof processVirtualList>[3]>[1]>().toEqualTypeOf<Record<string, unknown>>();
