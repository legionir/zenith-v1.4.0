import { expectTypeOf, it } from 'vitest';
import type { Route } from '../src';
it('keeps loader and arbitrary metadata boundaries unknown rather than publishing any', () => {
  type Loader = Exclude<Route['component'], string | undefined>;
  expectTypeOf<Awaited<ReturnType<Loader>>>().toEqualTypeOf<unknown>();
  expectTypeOf<NonNullable<Route['meta']>[string]>().toEqualTypeOf<unknown>();
});
