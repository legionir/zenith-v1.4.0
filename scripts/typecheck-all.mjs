// Type-check every package WITHOUT emitting (#26, AUDIT.md §3.10).
//
// Why this exists: the old script ran `tsc --declaration
// --emitDeclarationOnly`, i.e. the "check" quietly wrote real `dist/*.d.ts`
// files. That had two failure modes: (a) `npm run typecheck` dirtied the
// tree, and (b) *stale* declarations from a previous run could mask type
// errors in downstream packages (they compiled against old dist types while
// src had already changed).
//
// How it avoids that: for each package we generate a temporary tsconfig under
// `.tsbuild/` (wiped at the start of every run) that extends the package's
// own tsconfig, forces `noEmit`, and maps every `@zenith/*` module specifier
// straight at the sibling package's `src` via `paths`. Type-checking therefore
// always reads the *current sources* of workspace dependencies — dist is
// never consulted and never written. `npm run build` remains the only thing
// that emits declarations.
//
// The generated configs are built by `typecheckConfigFor()` (exported and
// unit-tested in scripts/test/typecheck-all.test.mjs).
import { existsSync, readdirSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join, relative } from 'path';
import { spawnSync } from 'child_process';
import { createRequire } from 'module';

// Always run the workspace-installed compiler — a stray global/newer tsc
// must not change what counts as an error (and `npx` would resolve per-cwd).
const requireFromHere = createRequire(import.meta.url);
const TSC_PATH = requireFromHere.resolve('typescript/bin/tsc');

export const TS_BUILD_DIR = '.tsbuild';

/**
 * The temporary noEmit tsconfig for one package, as a plain object.
 * `extends` and relative paths are written from inside the repo root's
 * `.tsbuild/` directory; `rootDir` is pinned back to the package sources so
 * output-path computation (and error paths) match the package's own config.
 *
 * @param {string} dir package directory name (e.g. "state")
 */
export function typecheckConfigFor(dir) {
  return {
    extends: `../packages/${dir}/tsconfig.json`,
    compilerOptions: {
      noEmit: true,
      declaration: false,
      declarationMap: false,
      sourceMap: false,
      rootDir: '..',
      outDir: `../${TS_BUILD_DIR}/unused`,
      tsBuildInfoFile: `../${TS_BUILD_DIR}/${dir}.tsbuildinfo`,
      // Relative paths in `paths` (no baseUrl) resolve against this config's
      // own directory, i.e. the repo root's `.tsbuild/`.
      paths: {
        // Every @zenith/<name> resolves to that package's src entry.
        '@zenith/*': ['../packages/*/src'],
        // Subpath exports that exist today (see vitest.config.ts #27).
        '@zenith/service-worker/sw': ['../packages/service-worker/src/sw.ts'],
      },
    },
    include: [`../packages/${dir}/src/**/*.ts`],
  };
}

/**
 * Run tsc --noEmit for every package, from a repo root (cwd overridable for
 * tests). Returns { failed, checked, output }.
 *
 * @param {string} root repository root containing packages/
 */
export function runTypecheckAll(root = process.cwd()) {
  const packagesDir = join(root, 'packages');
  const buildDir = join(root, TS_BUILD_DIR);

  // Fresh temp dir on every run (#26 acceptance: stale artifacts can't hide
  // anything, and nothing survives the run).
  rmSync(buildDir, { recursive: true, force: true });
  mkdirSync(buildDir, { recursive: true });

  const dirs = readdirSync(packagesDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((dir) => existsSync(join(packagesDir, dir, 'tsconfig.json')))
    .sort();

  let failed = 0;
  /** @type {string[]} */
  const errorOutput = [];

  for (const dir of dirs) {
    console.log(`🔍 Type-checking @zenith/${dir} (noEmit, src-resolved)…`);
    const cfgPath = join(buildDir, `${dir}.tsconfig.json`);
    writeFileSync(cfgPath, JSON.stringify(typecheckConfigFor(dir), null, 2));

    const result = spawnSync(process.execPath, [TSC_PATH, '-p', cfgPath], {
      cwd: root,
      encoding: 'utf8',
    });

    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
    if (result.status !== 0) {
      failed++;
      errorOutput.push(output);
      process.stdout.write(output);
    }
  }

  // The temp dir survives the run for debugging; it is wiped at the START of
  // every run, so nothing stale can ever mask an error (#26 acceptance).
  return { failed, checked: dirs.length, output: errorOutput.join('\n') };
}

// Only execute when run directly (so the functions above are testable).
if (process.argv[1] && relative(process.cwd(), process.argv[1]).startsWith('scripts')) {
  const { failed, checked } = runTypecheckAll();
  if (failed > 0) {
    console.error(`\n⚠️  ${failed} package(s) have type errors`);
    process.exit(1);
  }
  console.log(`\n🎉 All ${checked} packages type-checked successfully (0 files written).`);
}
