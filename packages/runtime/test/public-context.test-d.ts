import { expectTypeOf } from 'vitest';
import { Zen, registerCustomDirective, type CustomDirectiveHandler, type CustomDirectiveOptions, type Hydrator, type ParityAssertionOptions } from '../src';
import type { CompiledExpr } from '../src/hydrate';
import { createContext } from '../src/context';
expectTypeOf<NonNullable<Parameters<typeof Zen.start>[1]>>().toEqualTypeOf<Record<string, unknown>>();
expectTypeOf<Hydrator['state']>().toEqualTypeOf<Record<string, unknown>>();
expectTypeOf<ReturnType<CompiledExpr>>().toEqualTypeOf<unknown>();
expectTypeOf<Parameters<CustomDirectiveHandler>[2]>().toEqualTypeOf<Record<string, unknown>>();
expectTypeOf<ParityAssertionOptions['runtimeValue']>().toEqualTypeOf<unknown>();
const context = createContext({ value: 1 });
expectTypeOf(context.$value).toEqualTypeOf<unknown>();
// @ts-expect-error Context lookup is not a proof of a concrete payload type.
const unchecked: string = context.$value;
const options: CustomDirectiveOptions = { handler(_element, _attribute, bindings) {
  expectTypeOf(bindings.value).toEqualTypeOf<unknown>();
  // @ts-expect-error Dynamic directive values require narrowing.
  bindings.value.unsafeMethod();
  return () => {};
} };
void registerCustomDirective; void options; void unchecked;
