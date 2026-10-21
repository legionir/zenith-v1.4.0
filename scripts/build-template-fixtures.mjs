// scripts/build-template-fixtures.mjs — #33: real template install/build/boot fixtures.
//
// Every template kind is produced by the REAL `create-zenith` CLI (built
// `packages/create-zenith/dist/index.js`) into a temp/out directory, snapshotted
// against the built `@zenith/templates` manifest (`getTemplateManifest`), then
// installed from THIS checkout's packages (packed with `npm pack`, rewritten to
// `file:` tarballs so no published @zenith/* version can hide an unpublished
// dependency) and built with its own `npm run build`. The JSON record tells
// `e2e/templates-matrix.spec.ts` exactly what booted where.
//
// CLI: `node scripts/build-template-fixtures.mjs --out e2e/template-apps`
//      `node scripts/build-template-fixtures.mjs --out <dir> --skip-install`
//      `node scripts/build-template-fixtures.mjs --out <dir> --skip-build`
// Exit 0 on success; exit 1 prints every failure (any kind failing breaks the
// job — no silent per-kind skip). Only node builtins are used.
//
// The pure helpers (`rewriteZenithDeps`, `snapshotDiff`, `kindPort`,
// `TEMPLATE_FIXTURE_KINDS`) are unit-tested source-only in
// `scripts/test/template-fixtures.test.mjs`; everything that shells out to
// npm/vite/tsx runs in the `templates-e2e` CI job (validation phase).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

/** Every kind the matrix boots. Mirrors TEMPLATE_KINDS in @zenith/templates. @internal */
export const TEMPLATE_FIXTURE_KINDS = ['spa', 'ssr', 'pwa', 'dashboard', 'minimal'];

/**
 * Loopback preview ports for the built fixtures (e2e-server keeps 8089).
 * Pinned so `e2e/templates-matrix.spec.ts` and CI agree without discovery.
 * @internal
 */
export function kindPort(kind) {
  const ports = { spa: 8091, ssr: 8092, pwa: 8093, dashboard: 8094, minimal: 8095 };
  if (!(kind in ports)) throw new Error(`build-template-fixtures: unknown kind "${kind}"`);
  return ports[kind];
}

/**
 * Rewrite every `@zenith/*` range in a scaffolded package.json to the
 * `file:` tarball packed from this checkout (both dependencies and
 * devDependencies). Non-Zenith ranges (vite, typescript, …) pass through
 * untouched — they are registry-owned, never ours.
 *
 * @internal Returns `{ rewritten, tarballs }` where `rewritten` is the new
 * package.json object and `tarballs` the sorted `@zenith/*` names replaced.
 */
export function rewriteZenithDeps(pkg, tarballFor) {
  const rewritten = { ...pkg };
  const tarballs = [];
  for (const section of ['dependencies', 'devDependencies']) {
    const deps = pkg[section];
    if (!deps || typeof deps !== 'object') continue;
    const next = { ...deps };
    for (const name of Object.keys(next)) {
      if (!name.startsWith('@zenith/')) continue;
      const tarball = tarballFor(name);
      if (!tarball) throw new Error(`build-template-fixtures: no tarball packed for "${name}"`);
      next[name] = `file:${tarball}`;
      tarballs.push(name);
    }
    rewritten[section] = next;
  }
  tarballs.sort();
  return { rewritten, tarballs };
}

/**
 * Diff scaffolded files on disk against the engine manifest. Returns the
 * list of mismatches (`missing:`, `extra:`, `changed:`); empty means the CLI
 * output is byte-identical to `getTemplateManifest`. An intentional template
 * bug fails this gate — that is the negative control.
 *
 * @internal
 */
export function snapshotDiff(actualFiles, manifestFiles) {
  const failures = [];
  for (const name of Object.keys(manifestFiles).sort()) {
    if (!(name in actualFiles)) failures.push(`missing: ${name}`);
    else if (actualFiles[name] !== manifestFiles[name]) failures.push(`changed: ${name}`);
  }
  for (const name of Object.keys(actualFiles).sort()) {
    if (!(name in manifestFiles)) failures.push(`extra: ${name}`);
  }
  return failures;
}

function listFilesRecursive(dir, base = dir) {
  const out = {};
  const walk = (current, prefix) => {
    for (const entry of readdirSync(current).sort()) {
      const full = join(current, entry);
      if (statSync(full).isDirectory()) walk(full, `${prefix}${entry}/`);
      else if (statSync(full).isFile()) out[`${prefix}${entry}`] = readFileSync(full, 'utf8');
    }
  };
  walk(dir, '');
  return out;
}

function run(cmd, args, cwd) {
  return execFileSync(cmd, args, { cwd, stdio: 'pipe', encoding: 'utf8' });
}

/** Pack every `packages/*` workspace package; returns name → tarball path. */
function packWorkspace(rootDir, packDir) {
  mkdirSync(packDir, { recursive: true });
  const mapping = {};
  for (const entry of readdirSync(join(rootDir, 'packages')).sort()) {
    const pkgDir = join(rootDir, 'packages', entry);
    const manifest = join(pkgDir, 'package.json');
    if (!statSync(pkgDir).isDirectory() || !existsSync(manifest)) continue;
    const { name } = JSON.parse(readFileSync(manifest, 'utf8'));
    if (typeof name !== 'string' || !name) continue;
    // `npm pack` prints the tarball filename — never assume the naming rule.
    const printed = run('npm', ['pack', '--pack-destination', packDir], pkgDir).trim().split('\n').pop();
    mapping[name] = join(packDir, printed);
  }
  return mapping;
}

function buildKind(rootDir, outDir, kind, { skipInstall, skipBuild, tarballs }) {
  const failures = [];
  const name = `zenith-${kind}-fixture`;
  const dest = join(outDir, kind);
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(outDir, { recursive: true });
  const cli = join(rootDir, 'packages', 'create-zenith', 'dist', 'index.js');
  if (!existsSync(cli)) {
    return { kind, failures: [`missing built CLI: ${cli} (run \`npm run build\` first)`] };
  }
  try {
    run('node', [cli, name, '--template', kind, '--no-install', '--no-git', '--force'], outDir);
  } catch (error) {
    return { kind, failures: [`scaffold failed: ${error.message}`] };
  }
  const projectDir = join(outDir, name);
  return { kind, projectDir, dest, failures, tarballs, skipInstall, skipBuild, name };
}

async function snapshotAndInstall(rootDir, job) {
  const { kind, projectDir, dest, name } = job;
  let failures = [...job.failures];
  try {
    const engine = await import(new URL('../packages/templates/dist/index.js', import.meta.url).href);
    const manifest = engine.getTemplateManifest(name, kind);
    const actual = listFilesRecursive(projectDir);
    failures.push(...snapshotDiff(actual, manifest).map((f) => `snapshot ${f}`));
  } catch (error) {
    failures.push(`snapshot failed: ${error.message}`);
    return { kind, failures };
  }
  // Move <out>/<name> → <out>/<kind> (stable path the matrix spec serves).
  rmSync(dest, { recursive: true, force: true });
  try {
    renameSync(projectDir, dest);
  } catch (error) {
    failures.push(`rename failed: ${error.message}`);
    return { kind, failures };
  }
  if (job.skipInstall) return { kind, dest, failures, installed: false, built: false, tarballs: [] };
  // Rewrite @zenith/* to this-SHA file: tarballs, then install + build.
  try {
    const pkgPath = join(dest, 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const { rewritten, tarballs } = rewriteZenithDeps(pkg, (dep) => job.tarballs[dep]);
    writeFileSync(pkgPath, JSON.stringify(rewritten, null, 2) + '\n');
    run('npm', ['install', '--no-audit', '--no-fund'], dest);
    if (!job.skipBuild) run('npm', ['run', 'build'], dest);
    return { kind, dest, failures, installed: true, built: !job.skipBuild, tarballs };
  } catch (error) {
    failures.push(`install/build failed: ${error.message}`);
    return { kind, dest, failures, installed: false, built: false, tarballs: [] };
  }
}

async function main() {
  const rootDir = resolve(process.cwd());
  const args = process.argv.slice(2);
  const outFlag = args.indexOf('--out');
  const outValue = outFlag === -1 ? join('e2e', 'template-apps') : args[outFlag + 1];
  if (!outValue) {
    console.error('build-template-fixtures: --out needs a directory value');
    process.exit(1);
  }
  const outDir = resolve(rootDir, outValue);
  const skipInstall = args.includes('--skip-install');
  const skipBuild = args.includes('--skip-build');
  mkdirSync(outDir, { recursive: true });

  let tarballs = {};
  if (!skipInstall) {
    try {
      tarballs = packWorkspace(rootDir, join(outDir, '.tarballs'));
    } catch (error) {
      console.error(`build-template-fixtures: pack failed: ${error.message}`);
      process.exit(1);
    }
  }

  const record = { version: 1, kinds: [], failures: [] };
  for (const kind of TEMPLATE_FIXTURE_KINDS) {
    const job = buildKind(rootDir, outDir, kind, { skipInstall, skipBuild, tarballs });
    if (job.projectDir) {
      const done = await snapshotAndInstall(rootDir, job);
      record.kinds.push({ kind, port: kindPort(kind), ...done });
      record.failures.push(...done.failures.map((f) => `${kind}: ${f}`));
    } else {
      record.kinds.push({ kind, port: kindPort(kind), failures: job.failures });
      record.failures.push(...job.failures.map((f) => `${kind}: ${f}`));
    }
  }
  writeFileSync(join(outDir, 'fixtures.json'), JSON.stringify(record, null, 2) + '\n');
  if (record.failures.length > 0) {
    for (const failure of record.failures) console.error(`build-template-fixtures: ${failure}`);
    process.exit(1);
  }
  console.log(`build-template-fixtures: 5 kinds ready in ${outDir}`);
}

const invoked = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop());
if (invoked) {
  await main();
}
