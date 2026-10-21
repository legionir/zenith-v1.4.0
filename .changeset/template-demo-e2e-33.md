---
---

#33: real template install/build/boot e2e + demo flows (code-first, unrun).

Recon: `packages/cli/test/templates-e2e.test.ts` is jsdom + string checks
(scaffold parity only — kept as a fast unit check, not acceptance);
`e2e/demos-and-a11y.spec.ts` boots only `e2e/fixture.html`, not templates or
demo flows. testing-e2e infra (`mountApp`, `failOnConsoleError` default true,
trace retain-on-failure) and `e2e/dashboard-rbac.spec.ts` (login/role/deny/
logout + 401/403) already exist from #113/#166 territory and are reused, not
rebuilt. Plan step 3 says "ecommerce login/…" — the ecommerce demo has no
auth concept (guest checkout, client-side inventory per its README scope
limitations), so login/RBAC stays on the dashboard rows; inventing a demo
login would test fiction.

Implemented:

- `scripts/build-template-fixtures.mjs` (new, node builtins only): per kind
  (spa/ssr/pwa/dashboard/minimal) runs the REAL built `create-zenith` CLI
  (`--template <kind> --no-install --no-git --force`) into the out dir,
  snapshots scaffold output vs the built `@zenith/templates`
  `getTemplateManifest` (byte compare — an intentional template bug fails
  this gate), packs every `packages/*` workspace package (`npm pack`,
  filename taken from stdout, never assumed), rewrites all `@zenith/*`
  ranges to `file:` tarballs (registry deps pass through), then
  `npm install` + `npm run build` per fixture; writes `fixtures.json`.
  Pure helpers exported for source-only tests.
- `scripts/test/template-fixtures.test.mjs` (new, source-only): kinds/ports
  (5 kinds, distinct 8091–8095), rewrite mapping incl. missing-tarball
  fail-closed, snapshotDiff identical/changed/missing/extra.
- `e2e/templates-matrix.spec.ts` (new): boots each built fixture on its own
  port (`npm run preview` for spa/pwa/dashboard/minimal, `npm start` with
  `PORT` for the SSR production server), counter 0→1→0 per kind with
  `attachDiags` zero page/console errors; dashboard asserts its summary nav,
  minimal its message, SSR asserts server-rendered HTML carries the project
  name (hydration proof); PWA asserts SW scope + `standalone` manifest,
  offline reload boots from cache, and a shipped `CACHE_VERSION` v1→v2 bump
  installs (`-v2` cache appears). Missing fixtures fail closed with the
  builder command — no silent skip.
- `e2e/ecommerce.spec.ts` (new, ×4): products render from the mock;
  UI add/remove; id 3 (stock 0) add refused; checkout empties with
  `success`, empty checkout stays `idle`; cart survives reload (debounce
  waited out); zero page/console errors.
- `scripts/e2e-server.mjs`: deterministic GET `/api/products` (+ `/:id`,
  404 JSON otherwise) seed `{id,title,price}` ×4 whose ids are exactly the
  demo store inventory keys (1,2,3,7; id 3 stock 0 is the negative
  control). Test-only, never persisted.
- `ecommerce-demo/index.html`: checkout button + order-status line (the
  `checkout` action was already registered in `main.js` but unreachable).
- `e2e/SCENARIOS.md` (new): every kind + both demos → spec mapping, run
  instructions, and a deliberate-non-coverage section (`demos/*` stay
  #114 HTTP smoke; harness consumption stays #165/#166).
- `scripts/test/e2e-scenarios.test.mjs` (new, source-only): mapping rows
  present, no jsdom in new specs, fail-closed + diags gates present,
  seed ids ⊆ store inventory incl. `3: 0`, non-coverage documented.
- `playwright.config.ts`: `testIgnore` skips only `templates-matrix` when
  `ZENITH_TEMPLATE_APPS` is unset (main e2e job has no fixtures); the
  dedicated job sets it, so the matrix runs exactly once per commit.
- CI `templates-e2e` job in `f-github/workflows/main.yml` (Chromium-only):
  build → `build:template-fixtures` → manual e2e-server → matrix +
  ecommerce + dashboard-rbac → `templates-e2e-report` artifact.
- `package.json`: `build:template-fixtures`. `f-gitignore`:
  `e2e/template-apps/`.

Deliberate non-goals (validation/owner): run the builder + all three specs
on Chromium (needs `npm run build` first — 5× real install + vite/tsc builds
take minutes); PWA update assertion against real `vite-plugin-pwa`
injectManifest output shape (spec assumes `dist/sw.js` with
`CACHE_VERSION = 'v1'`); SSR counter-selector fit against the real
`createNodeHandler` HTML; fix any drift the live run exposes (selectors,
timing, preview flags); extend the matrix to Firefox/WebKit only if stable
(the gate stays Chromium); per-demo full flows beyond ecommerce/dashboard
(owner scope decision).
