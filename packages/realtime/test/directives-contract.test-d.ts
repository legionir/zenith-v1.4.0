// #120 — duck-typed binder contract pin (type-only, no runtime edge).
//
// `@zenith/realtime` may not depend on the runtime layer, so
// `RealtimeAppHost` carries a local directive-definition shape.
// `app.directive(def)` takes `def` structurally — if the engine adds a
// required `DirectiveDefinition` field (or renames `expr`), this file goes
// red under `npm run typecheck` instead of failing silently at runtime.
//
// Precedent: `packages/shared/test/types.test-d.ts` (DEC-021). Runs under
// `packages/*/test/**/*.test-d.ts` in scripts/typecheck-all.mjs; never built
// or published, so the relative-src import below creates no package edge.
import { describe, it, expectTypeOf } from 'vitest';
import type { DirectiveDefinition, BindContext } from '../../runtime-core/src/index.ts';
import type { RealtimeAppHost } from '../src/plugin';
import type { RealtimeBindContext } from '../src/directive';

describe('#120 — realtime binder contract stays a subset of the engine contract', () => {
  it('the host directive shape is assignable to DirectiveDefinition', () => {
    expectTypeOf<Parameters<RealtimeAppHost['directive']>[0]>().toMatchTypeOf<DirectiveDefinition>();
  });

  it('RealtimeBindContext only uses engine BindContext fields', () => {
    expectTypeOf<RealtimeBindContext>().toMatchTypeOf<Pick<BindContext, 'expr' | 'context'>>();
  });
});
