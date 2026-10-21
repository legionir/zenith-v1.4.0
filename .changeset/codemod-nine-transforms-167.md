---
'@zenith/codemod': minor
---

#167: new AST codemod package for the 1.x → 2.0 migration (pre-req for #109).

New `@zenith/codemod` 1.5.0 (tooling, dual, node target, `typescript` dep):
nine separately-runnable transforms over a shared engine (TS parse with a
no-resolve checker for binding-aware renames, descending text edits with
overlap guards, grouped import removal, batched import injection at file top)
— `destroy-to-dispose` (tracked `const x = new Cls()` instances from the CLI
upgrade class map, `.destroy()` ⇒ `.dispose()`), `process-to-bind`
(manual-only: `processTrack` needs an `analytics` instance), `clear-to-reset`
(the eleven ZEN-DEPR-054..064 globals ⇒ `resetForTesting()` in test files,
manual in production), `form-unify` (three legacy creators ⇒ `createForm`,
same args), `error-class` (`throw new Error(msg[, {cause}])` ⇒ `ZenithError`
with an empty-code placeholder the reviewer must fill), `console-to-logger`
(single-arg `log/info` ⇒ `info`, `warn`/`error`/`debug` same level),
`cache-unify` (`registerCache` ⇒ `registerDevtoolsCache` plus manual flags
for hand-rolled cache structures), `i18n-jalali` (exact `jalali-compat`
rename/module table with tuple→object and null→throw notes),
`runtime-imports` (curated origin table from `runtime/exports.ts`, residual
import plus manual for runtime-owned names). Unprovable cases always become
`ManualItem`s with file/line/action — never silent rewrites. `transformText`
(pure, per-subset) and `runCodemods` (directory scan, dry-run by default,
`write`, JSON-serializable `{ files, manual, changedCount, checkFailed }`
report for `upgrade --report json`). Tests: nine before/after fixture pairs,
per-transform manual assertions, after-fixture idempotency, an end-to-end
legacy demo with committed migrated output, and runner dry/write/check tests.

Decisions (deviations from SPEC §4.7 recorded): `x.cancel()` is NOT rewritten
(no Zenith API gives it dispose meaning — streams/DOM/animation); `createForm`
takes no `{ mode }` (overloads resolve the variant, same args); error codes
stay catalog-free (`CodemodError`, like CLI `CliFailure` — tooling errors,
not program runtime errors); the `zenith upgrade` flags (`--from/--to/--dry/
--glob/--write/--report`) stay with #109, which consumes this package;
`toJalali`/`parseJalaliParts`-shape changes are rename+manual (no silent
behavior change). Validation must: `npm install` (typescript), build, run the
new tests, `tsc`-build the migrated demo, regen snapshot/pages and `*.api.md`,
publint/attw/pack/install gates, check-docs-examples (README snippets
typecheck).
