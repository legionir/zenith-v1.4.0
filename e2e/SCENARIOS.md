# #33 — template/demo e2e scenario map

Every template kind and designated demo maps to exactly one executable
scenario. A row is covered only when its spec boots the REAL artifact
(installed/built project, production server, real browser) — jsdom and
string checks do not count (see `packages/cli/test/templates-e2e.test.ts`,
which stays a fast unit-level scaffold check, not acceptance).

Fixtures for the template rows are built by
`node scripts/build-template-fixtures.mjs --out e2e/template-apps`
(gitignored): real `create-zenith` CLI → snapshot vs the built
`@zenith/templates` manifest → `@zenith/*` rewritten to `file:` tarballs
packed from the same checkout → `npm install` → `npm run build`.
`e2e/template-apps/fixtures.json` records the result.

| Template / demo | Scenario (spec) | What it proves |
|---|---|---|
| spa | `e2e/templates-matrix.spec.ts` — spa | `vite preview` of the `file:`-installed build boots; counter 0→1→0; zero page/console errors |
| ssr | `e2e/templates-matrix.spec.ts` — ssr | `tsx server/index.ts --production` serves rendered HTML carrying the project name; counter hydrates and runs |
| pwa | `e2e/templates-matrix.spec.ts` — pwa (×2) | SW registers with a same-origin scope; `/manifest.json` is `standalone`; offline reload boots the counter from cache; a shipped `CACHE_VERSION` bump installs (`-v2` cache appears) |
| dashboard | `e2e/templates-matrix.spec.ts` — dashboard | Scaffold boots with the summary nav; counter runs |
| minimal | `e2e/templates-matrix.spec.ts` — minimal | Scaffold boots and renders `Hello Zenith` |
| ecommerce-demo | `e2e/ecommerce.spec.ts` (×4) | Products render from the deterministic `/api/products` mock; add/remove through the UI; id 3 (stock 0) cannot be added; checkout empties the cart with `success`, empty checkout stays `idle`; cart survives reload |
| dashboard demo | `e2e/dashboard-rbac.spec.ts` (×4, #113) | admin/editor/viewer login; viewer sees no delete buttons and the mock API answers 403; wrong password + logged-out API 401; logout returns to login |

## Deliberate non-coverage (not claimed)

- `demos/*` (20 integration showcases): HTTP-level build + smoke only
  (`scripts/build-demos.mjs`, `demos` CI job, #114). Full interaction flows
  per demo are out of scope for #33.
- The ecommerce demo is guest checkout by design (client-side inventory, no
  auth concept — see its README scope limitations); login/RBAC is covered by
  the dashboard rows, not by inventing a login the demo does not have.
- `testing-e2e` harness consumption (`mountApp`, `failOnConsoleError`,
  trace) belongs to #165/#166; the specs above use the `attachDiags`
  console/pageerror gates directly (same bar, no double work).

## Running

```bash
npm run build
node scripts/build-template-fixtures.mjs --out e2e/template-apps
ZENITH_TEMPLATE_APPS=e2e/template-apps ZENITH_E2E_NO_SERVER=1 npx playwright test \
  e2e/templates-matrix.spec.ts e2e/ecommerce.spec.ts e2e/dashboard-rbac.spec.ts \
  --project=chromium
```

Without fixtures the matrix spec fails closed (it throws the builder command);
the main e2e job skips `templates-matrix.spec.ts` unless
`ZENITH_TEMPLATE_APPS` is set — the dedicated `templates-e2e` CI job always
builds fixtures first, so the matrix runs exactly once per commit, on
Chromium.
