// #120 — duck-typed binder contract pin (type-only, no runtime edge).
//
// `@zenith/i18n` may not depend on @zenith/runtime-core (layer rule #48/#146),
// so `I18nDirectiveDefinition`/`I18nDirectiveBindContext` are local duck-types
// that must stay a subset of the engine's `DirectiveDefinition`/`BindContext`.
// The plugin registers them with `app.directive(def)` where `def: unknown` —
// no static check happens there — so THIS file is the check: if the engine
// adds a required field (or renames `expr`/`attrName`), `npm run typecheck`
// goes red here instead of failing silently at runtime.
//
// Precedent: `packages/shared/test/types.test-d.ts` (DEC-021) pins the
// cross-layer structural equality the same way. Runs under
// `packages/*/test/**/*.test-d.ts` in scripts/typecheck-all.mjs; never built
// or published, so the relative-src import below creates no package edge.
import { describe, it, expectTypeOf } from 'vitest';
import type { DirectiveDefinition, BindContext } from '../../runtime-core/src/index.ts';
import type {
  I18nDirectiveDefinition,
  I18nDirectiveBindContext,
  createI18nDirectives,
} from '../src/index';

describe('#120 — i18n binder contract stays a subset of the engine contract', () => {
  it('I18nDirectiveDefinition is assignable to DirectiveDefinition', () => {
    expectTypeOf<I18nDirectiveDefinition>().toMatchTypeOf<DirectiveDefinition>();
  });

  it('I18nDirectiveBindContext only uses engine BindContext fields', () => {
    expectTypeOf<I18nDirectiveBindContext>().toMatchTypeOf<
      Pick<BindContext, 'expr' | 'attrName'>
    >();
  });

  it('createI18nDirectives() output registers on a real engine app', () => {
    expectTypeOf<ReturnType<typeof createI18nDirectives>>().toMatchTypeOf<
      DirectiveDefinition[]
    >();
  });
});
