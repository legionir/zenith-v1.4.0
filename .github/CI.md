# CI workflows

## `main.yml` — the quality pipeline (#79)

Every gate is its **own parallel job**, so each appears as a separate check on
a PR and a failure in any single one blocks merging. Normal development/test gates run on Node 22.12+ (22 LTS, DEC-040);
the bundle build retains the 18.19/20/22 artifact-compatibility matrix.
Library `engines >=18.19` is not a promise of Vitest 4/lint-staged 16 support on old Node. A normal PR completes well under ~10 minutes.

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
| Dependency audit | `npm audit --omit=dev --audit-level=high` + `npm audit --audit-level=low`      | any advisory in prod+dev (no non-blocking dev exception)     | —                            |
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

- Browser/editor extensions are private workspaces under `tools/`, not silently
  skipped npm libraries. Root `build` includes `build:libraries` and `build:tools`;
  the dedicated tools job packages Chrome/Firefox ZIPs and a VSIX. Store upload
  and Extension Host/browser-install acceptance remain separate owner/QA work.
- `npm ci` requires `package-lock.json` to stay in sync with
  `package.json`.
- The browser-e2e job installs Chromium with `npx playwright install
  --with-deps chromium` and serves the repo over a tiny dependency-free
  static server (`scripts/e2e-server.mjs`) so the fixture loads the real
  built ESM bundles.

## `bundle.yml` — versioned browser bundles (#76)

Runs on pushes of a `v*` tag (and manually). `scripts/build-browser-bundle.mjs --require-lockstep`
builds, per release, into `browser-bundles/`:

| file                                       | what                                                                  |
| ------------------------------------------ | --------------------------------------------------------------------- |
| `<version>/zenith.min.js`                  | minified IIFE exposing `window.Zenith` (`Zenith.version === <version>`) |
| `<version>/zenith.min.js.map`              | separate sourcemap, referenced by a trailing `sourceMappingURL` comment |
| `<version>/zenith-runtime.js` (+ `.map`)   | minified ESM runtime bundle                                           |
| `<version>/integrity.json`                 | `sha384` SRI hash + byte size of every file                           |
| `latest/…`                                 | same bytes as the newest version, `"pinned": false` — never pin SRI here |

`<version>` is the `zenith` umbrella version. The build **fails** if it differs from the version
the bundle reports at runtime or (with `--require-lockstep`) from any workspace package
(DEC-026); the workflow also refuses to overwrite an already published `<version>/` (immutable).
Both directories are deployed to the orphan `bundles` branch with `keep_files` (older versions stay).
CI checks: `scripts/test/browser-bundle-release.test.mjs` (layout, hashes, minification, sourcemap,
version coherence) and `e2e/browser-bundle.spec.ts` (loads the bundle through
`<script integrity>` in Chromium/Firefox/WebKit; a wrong hash is blocked). The size budget in
`main.yml` is measured against the flat `browser-bundles/zenith-runtime.js` copy.

```html
<script
  src="https://cdn.jsdelivr.net/gh/legionir/zenith-v1.4.0@bundles/1.5.0/zenith.min.js"
  integrity="sha384-…copy from 1.5.0/integrity.json…"
  crossorigin="anonymous"
></script>
```

### Vite integration (#13)

Two jobs run the built plugin against Vite 6.4.4 and 7.3.7 using
`node scripts/vite-plugin-integration.mjs 6|7`. They build a real directive-bearing
HTML entry and fetch a real dev server response. Negative peer-install tests use
isolated local tarball metadata and expect npm ERESOLVE for incompatible/unsafe
versions. Vite 8, state-preserving browser HMR and sourcemaps remain #110 work.


## Code-first remediation additions (2026-10-16, not executed)

The declaration API job and publication preflight now fail closed on missing
reports, signature drift, public any and unclassified/internal exports. Reviewed
baselines and migration of the full legacy inventory are still pending; the new
gate is not a claim that this working tree passes. See
`docs/api/CONTRACT-GATES.md`. Release attachments depend on all quality jobs;
Trusted Publishing uses job-scoped id-token permission and pinned npm 11.21.1.
Owner configuration/provenance still requires real external evidence. No workflow
or test was run during the current implementation-only phase.

### Shared API candidate (2026-10-17)

Public-any no longer scans just `src/index.ts`: it follows emitted declarations
for every published subpath/condition. Unit/consumer jobs therefore build library
artifacts before those assertions. Missing artifacts are errors, not skipped
checks. `api:strict` additionally compares release level, deprecation metadata,
signatures and API Extractor reports. During code-first authoring these commands
are **not executed**; new snapshots/reports are generated/reviewed only in the
final validation phase. A changed gate is not a passing result.
