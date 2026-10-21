---
---

#120: uniform directive binder — duck-typed host contracts pinned (code-first, unrun).

Recon: the engine-side uniform binder is in place (walker `BindContext`
with `expr`/`attrName`/`arg`/`modifiers`/`option()`/`config()` via
`parseConfigAttr`, `DirectiveDefinition.bind`, directive registries,
DIRECTIVE-PARITY.md, conformance tests) and the walker-internal
`processX(el, expr, context, processChildren, disposes)` signature is
classified `data` in the positional allowlist (engine-internal contract, not
debt). What was unprotected: six L2 packages cannot import runtime-core
(layer rule #48/#146), so they carry local duck-typed binder shapes that
`app.directive(def: unknown)` accepts without any static check — an engine
change (new required `DirectiveDefinition` field, renamed `BindContext`
member) would fail silently at runtime:

- `packages/i18n/test/directives-contract.test-d.ts` (new):
  `I18nDirectiveDefinition` → `DirectiveDefinition`,
  `I18nDirectiveBindContext` → `Pick<BindContext, 'expr'|'attrName'>`,
  `ReturnType<createI18nDirectives>` → `DirectiveDefinition[]`.
- Same pin per package host shape: a11y (`A11yAppHost`/`A11yBindContext`),
  analytics (inline `AnalyticsAppHost` def + bind ctx),
  head (`HeadAppHost`/`HeadBindContext`, incl. `skipChildren`),
  realtime (`RealtimeAppHost`/`RealtimeBindContext`), ui
  (`UIAppHost`/`UIBindContext`).
- One comment line in `i18n/src/directives.ts` pointing at the pin.

Form: `import type` only, relative-src (same idiom as the neighboring
`directives.test.ts` and `shared/test/types.test-d.ts` DEC-021 precedent);
never built/published, so no package edge is created. Runs under
`packages/*/test/**/*.test-d.ts` in scripts/typecheck-all.mjs. No runtime
code changed, no new exports, no `any`/`console`/layer edges.

NOT done here (validation phase): `npm run typecheck` over the new test-d
files (proves the pins hold), full package test suites, lint pass.
