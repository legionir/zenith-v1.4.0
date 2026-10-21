import { expectTypeOf } from 'vitest';
import type { AsyncProcessChildren } from '../src';
expectTypeOf<Parameters<AsyncProcessChildren>[1]>().toEqualTypeOf<Record<string, unknown>>();
const process: AsyncProcessChildren = (_element, context, _disposes) => {
  const value = context.value;
  expectTypeOf(value).toEqualTypeOf<unknown>();
  if (typeof value === 'string') expectTypeOf(value).toEqualTypeOf<string>();
  // @ts-expect-error A remote component's inherited binding is not decoded data.
  value.unsafeMethod();
};
void process;
