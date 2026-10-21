import { expectTypeOf } from 'vitest';
import { computed, signal, type ReadonlySignal } from '../src';
const source = signal(1), value: ReadonlySignal<number> = computed(() => source.get() + 1);
expectTypeOf(value.peek()).toEqualTypeOf<number>();
expectTypeOf(value.subscriberCount).toEqualTypeOf<number>();
// @ts-expect-error Readonly values must not expose set.
value.set(2);
// @ts-expect-error Omitting only set must not leak the other mutation method.
value.update(current => current + 1);
expectTypeOf(source.update).parameter(0).toEqualTypeOf<(current: number) => number>();
