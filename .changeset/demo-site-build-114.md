---
---

#114: demo-site build/smoke/deploy contract (code-first, unrun).

Recon: no demo build existed — `bundle.yml` publishes the *library* bundle
to the orphan `bundles` branch for jsDelivr, which the plan explicitly says
is NOT the demo deploy. Demos are plain HTML+JS on
workspace `packages/*/dist` via importmap (all 20 `demos/*` have importmaps;
integration additionally imports `/packages/*` directly); backends are
in-page fetch-patched mocks (`@zenith/mock` `installFetchMock` — no SW
scope involved), so `/api/*` stays origin-relative by contract. Absolute
asset inventory (complete): importmap `"/packages/*"`, direct
`from '/packages/*'`, `src="/{dashboard,ecommerce-demo,demos}/…"`,
`href="/index.html"`, `href="/demos/"`, router `src="/demos/router/pages/*"`.
`zen-link`/`path` are router semantics (not URLs) and `&lt;`-escaped samples
are docs — all untouched.

Implemented:

- `demos/manifest.json` (new single source, version 1): 20 `demos/*` +
  `ecommerce-demo` + `dashboard` with titles from each page's `<title>`;
  `build: workspace` records honestly that demos need no per-demo bundler
  step (they run from workspace dist built by `npm run build`).
- `scripts/build-demos.mjs` (new, node builtins only): `auditDemos`
  (manifest↔fs sync, index-card sync incl. orphans both ways, importmap
  values resolve to real workspace `dist` incl. subpath keys like
  `@zenith/schema/attr`, no npm/CDN imports except the Vazirmatn font
  allowlist, no stray absolute asset refs, no non-`/api/` absolute fetch,
  router `src` targets on disk), `checkDistFiles` (fail-closed missing
  dist), `stageDemos` (copies home + demos + dashboard + ecommerce +
  needed `packages/*/dist` + manifest, relativizes refs per file depth,
  writes `demo-version.json`, then fails closed if any root-absolute ref
  remains), `smokeStage` (loopback server, GET `/`, index, every manifest
  path, version stamp incl. version-match + `<title>` + no-`/packages/`
  proofs). CLI: bare = audit only; `--with-dist`; `--stage <dir>`;
  `--smoke [--stage <dir>] [--port N]` (temp dir default). Exit 1 lists
  every failure — any demo failure breaks the job.
- `scripts/test/demos-manifest.test.mjs` (new, source-only, win-safe):
  manifest shape (22 entries), 20-dir coverage, card↔manifest equality,
  audit pass + references shape, root-home links ⊆ manifest, rel-prefix
  math, rewrite rules incl. router/API/escaped-sample preservation.
- `package.json`: `build:demos` (stage to `demo-dist/`), `demos:smoke`.
  `.gitignore`: `demo-dist/`.
- CI `demos` job in `.github/workflows/main.yml` (needs build, dist
  cache incl. demo sources in the key, `demos:smoke -- --stage demo-dist`,
  `demo-site` artifact).
- `.github/workflows/demos-pages.yml` (new): push to `main` (+ manual)
  → build → stage+smoke → `upload-pages-artifact` → `deploy-pages`.
  Separate product from the library `bundles` branch, as the plan
  requires. Trigger is `main` per plan §114 — if the default branch is
  named differently the owner changes one line (flagged here).
- `README.md`: relative demo/manifest/build links.

Deliberate non-goals (validation/owner): real CI runs (matrix + Pages),
interactive proof that fetch-mocked demos (dashboard/resource/store/
integration) work under a project sub-path, browser e2e of demo flows
(#33 owns page behavior; smoke is HTTP-level), custom-domain decision,
per-demo performance budgets (#90 owns vitals; LHCI config exists).
