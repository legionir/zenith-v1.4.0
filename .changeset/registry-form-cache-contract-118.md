---
---

#118: app-scoped registries — form + cache 5-method contract and reset hooks (code-first, unrun).

Recon: the wave-4 5-method contract + `resetForTesting` coverage spans nine
registries (actions, components, resource, store, ssr, auth, permission,
events modifiers, runtime directives, devtools-core panels) with ≥12 global-
reset hooks, and ownership routing (shared `RegistryOwner` table + app/request
providers in runtime-core, adapter-node, ssr) is in place. Two global
registries were outside the contract, and two leaked across tests:

1. `@zenith/form` validation rules: `defineRule`/`defineAsyncRule` returned
   `void`, the raw `customRules`/`asyncRules` maps were the only accessors,
   and nothing cleared them on global reset. Now: both define functions
   return idempotent `Cleanup` (identity-checked, cache pattern; additive —
   existing callers ignore the return), plus `getRule`/`hasRule`/`listRules`/
   `unregisterRule` and the parallel async set (separate namespace, as
   before). `clearCustomRules()` is hooked to `onGlobalReset` (PURE-
   annotated, same as notifications; `sideEffects: false` unchanged).
2. `@zenith/cache` name registry: `unregisterCache` returned `void` and there
   were no getters. Now: `getCache`/`hasCache`, `unregisterCache` returns
   `boolean` (the one internal caller ignores it — source-compatible), and an
   `@internal resetCachesInternal()` hooked to `onGlobalReset`. The signal
   adapter (state injection) is deliberately untouched by the reset.

Out of scope (verified, not changed): state's signal registry is a deprecated
legacy bridge to devtools-core (which is reset-hooked); devtools-core's own
`registerCache` is a deprecated alias for panel registration, unrelated to the
cache name registry.

Tests (written, unrun): new `it` in `scripts/test/api-conformance.test.mjs`
(full contract incl. idempotent double-cleanup, async/sync namespace split,
boolean unregisters) + form/cache rows in the reset-leak test. Contracts:
snapshot hand-updated in generator order (form 43→51, cache 16→19;
`localeCompare` placement verified programmatically), INDEX counts, `cache.md`
table rows, cache README signatures. No new types (unique-names safe), no
`any`, no `console`, no new layer edges (cache→errors L0→L0 and form→errors
have precedent; the shared import in form is type-only).

NOT done here (validation phase): run the conformance suite (jsdom) + form/
cache package tests, regenerate snapshot/pages/`*.api.md` after final build
and confirm the hand-written entries byte-match, publint/attw/pack/install,
typecheck (defineRule/unregisterCache signature changes), size budgets.
