// #120 — duck-typed binder contract pin (type-only, no runtime edge).
//
// `@zenith/ui` may not depend on the runtime layer, so `UIAppHost` carries a
// local directive-definition shape. `app.directive(def)` takes `def`
// structurally — if the engine adds a required `DirectiveDefinition` field
// (or renames `expr`), this file goes red under `npm run typecheck` instead
// of failing silently at runtime.
//
// Precedent: `packages/shared/test/types.test-d.ts` (DEC-021). Runs under
// `packages/*/test/**/*.test-d.ts` in scripts/typecheck-all.mjs; never built
// or published, so the relative-src import below creates no package edge.
import { describe, it, expectTypeOf } from 'vitest';
import type { DirectiveDefinition, BindContext } from '../../runtime-core/src/index.ts';
import type { UIAppHost, UIBindContext } from '../src/plugin';

describe('#120 — ui binder contract stays a subset of the engine contract', () => {
  it('the host directive shape is assignable to DirectiveDefinition', () => {
    expectTypeOf<Parameters<UIAppHost['directive']>[0]>().toMatchTypeOf<DirectiveDefinition>();
  });

  it('UIBindContext only uses engine BindContext fields', () => {
    expectTypeOf<UIBindContext>().toMatchTypeOf<Pick<BindContext, 'expr' | 'context'>>();
  });
});
