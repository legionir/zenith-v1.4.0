# CI workflows

## `main.yml` — the quality pipeline (#79)

Every gate is its **own parallel job**, so each appears as a separate check on
a PR and a failure in any single one blocks merging. All gates run on Node 22;
only the bundle build keeps the Node 18/22 matrix (Node 18 is the `engines`
floor). A normal PR completes well under ~10 minutes.

### When it runs

| Trigger                     | Notes                                              |
| --------------------------- | -------------------------------------------------- |
| Push to any branch          | Includes `v104` and feature branches               |
| Push of a `v*` tag          | Also runs the `release` job                        |
| Pull request                | Same checks as a branch push                       |
| Manual                      | "Run workflow" button on the Actions tab           |

Runs for the same branch supersede each other (cancel-in-progress), except on
`v104` where every commit keeps its own artifacts.

### The jobs

| Job            | Command(s)                                       | Fails when                                        | Artifact                     |
| -------------- | ------------------------------------------------ | ------------------------------------------------- | ---------------------------- |
| Lint           | `npm run lint` (#36 ESLint flat config)          | any ESLint **error** (`any` warnings tracked #38) | —                            |
| Format         | `npm run format:check` (#36 Prettier)            | any file not Prettier-formatted                   | —                            |
| Type-check     | `npm run typecheck`                              | any `tsc` error in any package                    | —                            |
| Unit tests     | `npm run test:coverage` (#27 vitest)             | failing test **or** <70% core statement coverage  | `coverage/` (14 days)        |
| Dependency audit | `npm audit --omit=dev --audit-level=high`      | high/critical advisory in the production tree     | —                            |
| Dependency graph | `npm run deps` (dependency-cruiser, #79 baseline; #49 extends) | static import cycle or src→devDep import | —                        |
| Build          | `npm run build` + collect (Node 18 **and** 22)   | build or `.d.ts` emit error                       | `zenith-bundles-node18/22`   |
| Package lint   | `npm run publint` (needs Build; #74 adds attw)   | publint **error** in any package's published shape| —                            |
| Size budget    | `npm run size` (needs Build; `.size-limit.json`) | bundle exceeds its gzip budget (#83 expands)      | —                            |
| Browser e2e    | `npm run test:e2e` (needs Build; Playwright Chromium, real built ESM via `scripts/e2e-server.mjs`) | smoke test fails in a real browser | `playwright-report/` (14 days) |
| Release        | tag-only, after Build                            | —                                                 | tarball attached to release  |

Jobs marked "needs Build" wait for a green bundle build, then run the build
inside their own runner (each job is self-contained; no cross-job dist sharing).

### What the build job does

1. `npm ci` — installs from the lockfile (fails on lockfile drift).
2. `npm run build` — esbuild ESM + CJS bundles and `tsc` declarations.
   The build script fails on `tsc` errors, so this also proves every
   package emits its `.d.ts`.
3. `node scripts/collect-artifacts.mjs artifacts` — gathers the output.
4. Writes a bundle-size table to the run summary.
5. Uploads `artifacts/` via `actions/upload-artifact`.

### Where the bundles go

Open the workflow run and download from the **Artifacts** section:

- `zenith-bundles-node18`
- `zenith-bundles-node22`

Retained for 30 days. Each archive contains:

```
packages/<name>/
  dist/            index.js (ESM), index.cjs (CJS), index.d.ts, sourcemaps
  package.json
  README.md
manifest.json      index of every package: version, byte size, entry points
```

`manifest.json` also records the commit SHA, ref and run ID that produced the
build, so an artifact can be traced back to its source.

To reproduce the same layout locally:

```bash
npm run build
node scripts/collect-artifacts.mjs artifacts
```

`artifacts/` is gitignored.

### Tagged releases

Pushing a `v*` tag runs the `release` job after a successful build. It
downloads the Node 22 bundles, packs them into
`zenith-bundles-<tag>.tar.gz` and attaches that to the GitHub release.
This job is the only one that needs `contents: write`; everything else is
read-only.

### Notes

- Two packages are intentionally skipped by the collector and reported in
  the log: `devtools-extension` (no `package.json`) and `vscode-extension`
  (no `src/index.ts`, so no esbuild bundle — it compiles with `tsc` via
  `npm run compile -w zenith-vscode`, which the Package-lint job runs).
- `npm ci` requires `package-lock.json` to stay in sync with
  `package.json`.
- The browser-e2e job installs Chromium with `npx playwright install
  --with-deps chromium` and serves the repo over a tiny dependency-free
  static server (`scripts/e2e-server.mjs`) so the fixture loads the real
  built ESM bundles.

## `bundle.yml` — standalone browser bundle

Separate workflow, runs only on pushes to `v104` (and manually). Builds
`scripts/build-browser-bundle.mjs` (the minified `zenith-runtime.js`) and
publishes it to the orphan `bundles` branch via gh-pages-style deploy. The
size budget in `main.yml` is measured against this same bundle output.
