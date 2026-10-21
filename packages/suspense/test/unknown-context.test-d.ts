import { expectTypeOf } from 'vitest';
import { processSuspense, trackPromise, type SuspenseContextOptions } from '../src';
expectTypeOf<Parameters<typeof processSuspense>[2]>().toEqualTypeOf<Record<string, unknown>>();
expectTypeOf<Parameters<Parameters<typeof processSuspense>[1]>[1]>().toEqualTypeOf<Record<string, unknown>>();
expectTypeOf(trackPromise(Promise.resolve('specific'), {})).toEqualTypeOf<Promise<string>>();
const options: SuspenseContextOptions = { onSettle(value) { expectTypeOf(value).toEqualTypeOf<boolean>(); } }; void options;
