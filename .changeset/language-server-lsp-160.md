---
'@zenith/language-server': minor
---

#160: real LSP 3.17 server (pre-req for #111).

`@zenith/language-server` grows from the regex-analysis skeleton into a full
language server (tooling, ESM-only, node target, `@zenith/compiler` dep):
versioned document store, `ZEN-501` unknown-directive diagnostics (warning,
error under `strict`, with closest-name suggestion), `ZEN-DEPR-xxx`
diagnostics plus quick-fixes for the five single-identifier renames
(001/005/042/043/044), directive/option completion, seed-registry hover,
`$signal` definition/references/rename (definition = first reference),
safe formatting (trailing-whitespace + final newline, idempotent), semantic
tokens, folding, `zen-link` document links, and a crash-free JSON-RPC
dispatcher with byte-counted stdio framing. Known names come from
`COMPILABLE/RUNTIME/CORE_DIRECTIVES` (imported, `@public`) plus the seed
registry and the eslint builtins; hover prose is hand-written from the seed
(no per-directive metadata exists in the compiler). Legacy
`analyzeZenithDocument`/`createZenithServerCore`/`createServerLifecycle`
stay byte-compatible (wave5 contract). Tests: unit + seed/compiler
freshness + stdio round-trip over memory streams + a seeded 300-document
fuzz asserting no-throw, in-bounds ranges, format idempotency, and
fix-monotonicity.

Decisions (recorded): target `universal`→`node` (stdio needs node, like
`unplugin-zenith`); only `@zenith/compiler` as a new dep (Tooling→Tooling;
`vscode-languageserver-protocol` hand-rolled instead); no new ZEN codes
(diagnostics reuse the error catalog; the server itself never throws);
size budget 6→25 KB gzip (a real server cannot fit the skeleton budget —
same class as `@zenith/cli`); full binder/grammar migration stays with
#120; thin client/vsix/Marketplace stay with #67. Validation must:
`npm install` (@zenith/compiler), build, run the new tests, regen
snapshot/pages and `*.api.md` (hand-written snapshot order follows the
`localeCompare` generator), publint/attw/pack/install, check-docs-examples
(README snippets typecheck), api:strict, unique-type-names, template-lint
(no backtick-`<` literals in sources/tests).
