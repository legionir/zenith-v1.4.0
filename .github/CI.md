# CI workflows

## `ci.yml`

Builds every package and publishes the bundles as a downloadable artifact.

### When it runs

| Trigger | Notes |
|---|---|
| Push to any branch | Includes `v104` and feature branches |
| Push of a `v*` tag | Also runs the `release` job |
| Pull request | Same checks as a branch push |
| Manual | "Run workflow" button on the Actions tab |

Runs for the same branch supersede each other, except on `v104` where every
commit keeps its own artifacts.

### What it does

1. `npm ci` — installs from the lockfile.
2. `npm run typecheck` — all 35 packages, must be clean.
3. `npm run build` — esbuild ESM + CJS bundles and `tsc` declarations.
   The build script fails on `tsc` errors, so this also proves every
   package emits its `.d.ts`.
4. `node scripts/collect-artifacts.mjs artifacts` — gathers the output.
5. Writes a bundle-size table to the run summary.
6. Uploads `artifacts/` via `actions/upload-artifact`.

Runs against Node 18 (the `engines` floor) and Node 22 (current LTS).

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

`manifest.json` also records the commit SHA, ref and run ID that produced
the build, so an artifact can be traced back to its source.

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
This job is the only one that needs `contents: write`; the build job is
read-only.

### Notes

- Two packages are intentionally skipped by the collector and reported in
  the log: `devtools-extension` (no `package.json`) and `vscode-extension`
  (no `src/index.ts`, so no bundle).
- `npm ci` requires `package-lock.json` to stay in sync with
  `package.json`. If installs start failing, refresh it with `npm install`
  and commit the result.
