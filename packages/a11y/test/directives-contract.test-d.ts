// #120 — duck-typed binder contract pin (type-only, no runtime edge).
//
// `@zenith/a11y` may not depend on the runtime layer, so `A11yAppHost`
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
import type { A11yAppHost, A11yBindContext } from '../src/plugin';

describe('#120 — a11y binder contract stays a subset of the engine contract', () => {
  it('the host directive shape is assignable to DirectiveDefinition', () => {
    expectTypeOf<Parameters<A11yAppHost['directive']>[0]>().toMatchTypeOf<DirectiveDefinition>();
  });

  it('A11yBindContext only uses engine BindContext fields', () => {
    expectTypeOf<A11yBindContext>().toMatchTypeOf<Pick<BindContext, 'expr' | 'context'>>();
  });
});
