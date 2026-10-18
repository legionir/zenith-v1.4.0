import { expectTypeOf } from 'vitest';
import { watch, signal, type EffectFn, type EffectSubscriber } from '../src';
const name = signal('one'), count = signal(1);
watch(name, (value, previous, cleanup) => {
  expectTypeOf(value).toEqualTypeOf<string>(); expectTypeOf(previous).toEqualTypeOf<string | undefined>();
  expectTypeOf(cleanup).toEqualTypeOf<(callback: () => void) => void>();
});
watch([name, count], (values, previous) => {
  expectTypeOf(values).toEqualTypeOf<[string, number]>();
  expectTypeOf(previous).toEqualTypeOf<[string, number] | undefined>();
});
// @ts-expect-error A string source cannot certify a numeric callback.
watch(name, (value: number) => { void value; });
// @ts-expect-error Heterogeneous sources retain their ordered item types.
watch([name, count], (values: [number, string]) => { void values; });
expectTypeOf<EffectFn>().toEqualTypeOf<EffectSubscriber>();
expectTypeOf<ReturnType<EffectFn>>().toEqualTypeOf<void>();
declare const callback: EffectFn;
// @ts-expect-error An effect does not return its callback's cleanup result.
const returnedCleanup: () => void = callback();
void returnedCleanup;
const structural = { get: () => 'known' };
watch(structural, value => { expectTypeOf(value).toEqualTypeOf<string>(); });
const containing = signal({ nested: count });
watch(containing, value => { expectTypeOf(value.nested).toEqualTypeOf<typeof count>(); }, { deep: true });
