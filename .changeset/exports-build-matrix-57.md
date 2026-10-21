---
---

#57: exports/build matrix — five recon gaps closed (code-first, unrun).

Five gaps from the 2026-10-18 recon are now closed in code+tests (no runs —
validation phase, per code-first rules):

1. `cli ./program` registered: the real `@zenith/cli/program` entry
   (`createProgram`/`runCli` without autorun) is now a row in
   `PUBLIC_SUBPATHS` (`scripts/lib/exports-shape.mjs`) and the dual list, so
   `standardize-packages` no longer deletes it and the exports-shape test
   covers it. Plus: `SRC_PATHS`/vitest alias, `docs/api/cli--program.md`,
   snapshot + INDEX entries. The emitted shape already equaled the dual
   helper output, so there is no published-behavior change.
2. `side-effects.test` refreshed: router now pins two entries
   (`./dist/index.js`, `./dist/node.js` — the node entry genuinely runs
   `installRouteContextStorage`), and the auth/cli/mock arrays pin their real
   effects (`onGlobalReset`, `void runCli()` on import, mock SW listeners).
3. Production `__ZENITH_DEV__` scan: `build-all.mjs`/`build-tools.mjs` now
   default `NODE_ENV` to `production`, `build-browser-bundle.mjs` defines the
   flag false, and `scripts/test/production-dist.test.mjs` scans dist for
   surviving dev branches. The release/CI path that sets `NODE_ENV` is
   checked in validation (the `.github` workflow is not in this snapshot).
4. Deno wiring: the existing `scripts/repro/edge-deno.mjs` probe (fails
   closed without the `deno` binary, 100 isolated requests, per-response CSP
   nonce) is exposed as `npm run test:deno` and pinned by
   `scripts/test/edge-runtime-wiring.test.mjs`. Execution with a real Deno +
   built bundles stays in validation (dedicated CI job).
5. Conditions-by-design gate: `scripts/test/export-conditions.test.mjs`
   rejects any `exports` condition beyond `import`/`require`/`types`/`default`
   in every workspace package, and pins the designed alternative — the
   environment split lives in explicit subpath rows (`./node`, `./edge`,
   `./sw`, `./browser`, `./worker`, `./program`).

Decision: **DEC-041** (subpath-per-environment, no export conditions) —
conditions mean different things to different bundlers/runtimes and fail
silently; one deliberate `PUBLIC_SUBPATHS` row per environment replaces them.
Dev/prod (`__ZENITH_DEV__`) is a build-time define, not an exports condition
(two artifacts behind one condition would complicate cache and SRI).
Resolve behavior today is unchanged; the DEC records and locks the already-
correct practice. Test ceiling 40→41 (`rfc-decisions.test.mjs` + DEC-041
content test); `docs/decisions/README.md` lists DEC-041; the DEC is described
in `docs/progress/PROGRESS.md` (rule 4 of the decisions README).

NOT done here (validation phase): run the new vitest files, regenerate the
API snapshot + pages + `*.api.md` after final build, run
publint/attw/pack/install gates, the Node 18/20/22 import matrix, and the
Deno probe with real Deno. The snapshot subpath table (11 vs 34) and missing
`.size-limit.json`/`.dependency-cruiser.cjs` are pre-existing validation
debts, not regressions from this card.
