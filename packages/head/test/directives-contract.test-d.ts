// #120 — duck-typed binder contract pin (type-only, no runtime edge).
//
// `@zenith/head` may not depend on the runtime layer, so `HeadAppHost`
// carries a local directive-definition shape. `app.directive(def)` takes
// `def` structurally — if the engine adds a required `DirectiveDefinition`
// field (or renames `expr`), this file goes red under `npm run typecheck`
// instead of failing silently at runtime.
//
// Precedent: `packages/shared/test/types.test-d.ts` (DEC-021). Runs under
// `packages/*/test/**/*.test-d.ts` in scripts/typecheck-all.mjs; never built
// or published, so the relative-src import below creates no package edge.
import { describe, it, expectTypeOf } from 'vitest';
import type { DirectiveDefinition, BindContext } from '../../runtime-core/src/index.ts';
import type { HeadAppHost, HeadBindContext } from '../src/plugin';

describe('#120 — head binder contract stays a subset of the engine contract', () => {
  it('the host directive shape is assignable to DirectiveDefinition', () => {
    expectTypeOf<Parameters<HeadAppHost['directive']>[0]>().toMatchTypeOf<DirectiveDefinition>();
  });

  it('HeadBindContext only uses engine BindContext fields', () => {
    expectTypeOf<HeadBindContext>().toMatchTypeOf<
      Pick<BindContext, 'expr' | 'context' | 'skipChildren'>
    >();
  });
});
