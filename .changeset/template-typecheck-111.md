---
---

#111: type-safe template opt-in — shared stateTypes engine (code-first, unrun).

Recon: no state type/schema contract existed anywhere. `#160` diagnostics
cover unknown *directive names* (ZEN-501) + deprecated identifiers only —
expression *contents* were unchecked: `compileTemplate` never parses
expressions (they embed as strings), `expressions/type-check.ts` is
runtime-value utilities (no static analysis), and there was no
unknown-vs-undefined distinction, no scope tracking, no HTML positions.

Implemented (shared engine, one consumer contract):

- `packages/compiler/src/template-typecheck.ts` (new, DOM-free single-pass
  tag-stack scanner + `@zenith/expressions` AST analysis):
  `TemplateStateTypes = Record<string, ExpressionType>` (`$x`/`x` aliased
  like binding-context), `TemplateTypeDiagnostic` (ZEN-502, exact 0-based
  line/character spans via lexer-token zip with arrow-param exclusion),
  `analyzeTemplateTypes(html, stateTypes?)` ([] without schema = legacy
  untouched; never throws). Unknown identifiers say explicitly
  "compile-time unknown, distinct from a runtime undefined value" +
  nearest-name suggestion (≤2, alphabetical ties). Incompatible-type is
  deliberately narrow and sound: calling a declared non-function +
  non-optional dereference of declared null/undefined (`?.` respected).
  Scope: nested zen-for item/index (compiler reading of the declaration),
  nested arrow params with shadowing, `$event` in actions only. Only
  expression/state-path directives are read (text/html/show/if/else-if/
  bind/memo/key/action/model/for); string-valued or unknown directives
  (permission/role/track/ref/slot/…) are skipped — no false positives.
  Unparseable expressions are left to the existing owners (unplugin
  build validation, runtime eval).
- `CompilerOptions.stateTypes?`: findings → `warnings` normally,
  `throw` (build-break, with line/column) under `strict` — same contract
  as unknown directives in walk.ts. Barrel exports (+4) via compiler.ts
  facade + index.ts; `+@zenith/expressions 1.4.0` dep (TOOLING→L1, same
  edge as unplugin-zenith — no new layer).
- Build integration (#164): `transformHtml` accepts out-of-schema
  `stateTypes` (the #52 schema rejects unknown keys, so it is stripped
  before `resolve` and forwarded to `compileTemplate`; stable key added
  to the transform cache). `createCoreHooks.transform` forwards a
  runtime `compile.stateTypes` through its existing spread. Fully-typed
  plugin-level option needs schema `record` support — validation follow-up.
- LSP: `ZenithDiagnosticsOptions.stateTypes?` → same engine, same spans
  as `ZEN-502` errors; `ZenithDiagnosticData.kind` +=
  unknown-identifier/incompatible-type (no quickfix — deliberate);
  threaded through `ZenithLanguageServerOptions` (2 call sites).
- Tests (written, unrun): `compiler/test/template-typecheck.test.ts`
  (24 its: legacy silence, spans, aliasing, suggestions, strict-break vs
  warnings, for/key/arrow/$event scopes, both incompat pins, skip rules,
  malformed/syntax/script/garbage, never-throws) + 3 validation fixtures
  (`test/fixtures/typecheck-{ok,unknown,mismatch}.html`, also exercised
  by the suite); 4 its in `language-server.test.ts` (silence, exact
  range/code/data, compiler parity, server threading); 1 it in
  `adapters.test.ts` (legacy silence, strict break, lax warn, clean).
- Contracts: snapshot compiler 15→19 (localeCompare-verified order/kinds),
  INDEX count, `compiler.md` rows. language-server/unplugin snapshots
  unchanged (no new export names; member-only changes).

NOT done here (validation phase): install; run compiler/language-server/
unplugin suites (incl. new tests); regen snapshot/pages/`*.api.md` and
confirm hand entries byte-match; typecheck (new dep edge, `Required<>`
untouched); publint/attw/pack/install; size budgets (new module bytes);
Node 18/20/22; full typed plugin option (schema record); fixture runs
per plan step 4 (ok/unknown/mismatch + no-schema project) incl. real
bundler builds with `compile.stateTypes`; `?.`-only + shadowing fuzz.
Watch: `unique-type-names.test.mjs` L15-21 asserts
`export interface CompilerOptions` inside `compiler/src/compiler.ts`,
but the interface lives in `src/types.ts` (pre-existing mismatch, not
from this card — confirm whether that test is green on a clean tree).
