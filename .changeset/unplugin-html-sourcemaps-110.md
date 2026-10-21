---
---

#110: HMR/sourcemap/Vite matrix — HTML sourcemaps (code-first, unrun).

Recon: HMR is implemented (vite-only `handleHotUpdate` + HTML HMR + DevTools
injection in `vite.ts`, portable guard codes ZEN-2520/2521, other bundlers
honestly HMR-free). Two genuine gaps: (1) the HTML transform returned
`{code}` with no `map` — zero sourcemap support; (2) the version-matrix
question.

Sourcemaps (implemented): the HTML transform only swaps attributes within
their lines and injects one `<script>` line, so a dependency-free
line-preserving v3 map is exact, not approximate —
`htmlSourceMap(original, generated, source, moduleName)` (hand-rolled VLQ,
new `@public HtmlSourceMap` interface). Every `TransformResult` now carries
`map` (all three construction sites, cache-safe: the map is deterministic in
the cache key inputs). `CoreHooks.transform` returns `{code, map}`, which
flows to Vite/Rollup/esbuild/rspack through the shared unplugin instance
(verified: `vite.ts` passes the hook result through). Virtual `.zenith.js`
modules stay map-less by documented decision — their line mappings must come
from the compiler's `compiled.code`, a separate change. Tests (written,
unrun): new `it` in `adapters.test.ts` decodes the VLQ mappings and asserts
per-line identity (same original line for every line, exactly one unmapped
`<script>` line).

Version matrix (deliberately NOT extended): the committed contract is Vite
6/7 — `vite-peer.test.mjs` asserts 8.3.4 is ERESOLVE-rejected and
`rfc-decisions.test.mjs` pins DEC-040's `^6.4.4 || ^7.3.7` text. Claiming
Vite 8 in the peer range without a runnable matrix would contradict those
gates; Vite 8 support is a separate card with real 8.x runs. The existing
bundler-matrix test already gates real vite/esbuild/webpack/rspack runs for
validation.

Contracts: snapshot hand-updated (`HtmlSourceMap` interface in
`localeCompare` order, 36→37), INDEX count, `unplugin-zenith.md` row. No new
runtime deps, no `any`/`console`, no layer edges.

NOT done here (validation phase): run unplugin suites (incl. the new map
test + matrix live runs on installed Vite 6/7), regenerate
snapshot/pages/`*.api.md` and confirm hand entries byte-match, typecheck
(`TransformResult.map` required field; `CoreHooks.transform` signature),
publint/attw/pack/install, size budgets.
