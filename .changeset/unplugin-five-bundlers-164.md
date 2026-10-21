---
'@zenith/unplugin-zenith': minor
'@zenith/vite-plugin': patch
---

#164: unified build core on five bundlers (`unplugin`); vite-plugin becomes a
thin facade.

New `@zenith/unplugin-zenith` 1.5.0 (tooling, ESM-only, node target): one
`ZenithUnpluginOptions` object, one portable hook implementation
(`createCoreHooks`: transform/resolveId/load/buildStart/buildEnd plus a
per-build JSON manifest via `meta`), and one `zenithUnplugin` instance
(`unplugin@^3.4.0`) served through five subpaths
(`./vite|./rollup|./webpack|./esbuild|./rspack`, ESM-only per DEC-027).
`./vite` (`zenithVite`) keeps the vite-only behavior (index.html compile in
build through the same shared hooks, HMR tags, DevTools injection,
`handleHotUpdate` with companion-file support, `configureServer`) under the
historic plugin name `zenith-plugin`. Explicit Vite-only keys on other
bundlers are rejected with catalogued codes (`ZEN-2520` unsupported bundler,
`ZEN-2521` incompatible HMR) while absent keys stay portable so one config
builds everywhere.

`@zenith/vite-plugin` keeps every historic name (`zenithPlugin`, default,
`PLUGIN_VERSION`, compile helpers, `zenithPluginOptions*`) as a facade over
`@zenith/unplugin-zenith[/vite]`; its seven core modules and two tests moved
to the new package (tests extended: five-adapter surface, facade parity,
portable guard, core hooks, fixture + bundler matrix with explicit skips).
`DEFAULTS`/resolve are now the unified superset (added
`include`/`exclude`/`strict`/`meta`); any previous config stays valid.

Decisions: ESM-only (not dual-tooling) per DEC-034 (`require(esm)` covers the
dual CJS consumers; `unplugin@3` itself is ESM-only, engines node `^20.19`
upstream while the workspace floor stays `>=18.19`). No fake deprecation
warning on the facade. `bare require.resolve` replaced with `createRequire`
(ESM-safe; the old call only survived via try/catch fallback). Pre-existing
bug fixed en passant: `globToRegex` lacked `export` while the index imported
it. HMR stays Vite-only (no HMR emulation for other bundlers). Validation
must: `npm install` (new: `unplugin`, `webpack`, `@rspack/core`), build both
packages, run new+moved tests (matrix runs real vite/esbuild builds when
installed), regenerate `docs/api` snapshot/pages and `*.api.md`, run
publint/attw/pack/install gates, and the Node 18/20/22 import matrix for the
ESM-only subpaths.
