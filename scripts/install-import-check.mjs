#!/usr/bin/env node
/**
 * #74 — install-and-import check from REAL tarballs.
 *
 *   node scripts/install-import-check.mjs   (after `npm run build`)
 *
 * 1. `npm pack` every publishable package (what `npm publish` would upload).
 * 2. Install ALL tarballs into a fresh project (workspace `@zenith/*` ranges are overridden to the
 *    local tarballs; third-party deps/peers come from the registry like for a real consumer).
 * 3. Import every package (and every declared subpath) as ESM with `import()` and as CommonJS with
 *    `require()`. ESM-only entries need `require(esm)` (Node >= 20.19 / 22.12);
 *    on older Node only ESM-only entries are omitted from CJS; genuine require
 *    entries are always exercised, including their dependency loading failures.
 * 4. Run the installed `zenith` CLI binary and compare `--version` with its package.json.
 *
 * Catches what source-tree tests cannot: files missing from the tarball, wrong `exports` targets,
 * undeclared dependencies, broken CJS entries.
 */
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { conditionTarget, isDualEntry } from './lib/exports-shape.mjs';
import { spawnNpm } from './lib/proc.mjs';
import { checkInstalledCli } from './lib/cli-consumer-check.mjs';

const SKIP = new Set(['devtools-extension', 'vscode-extension']);

/** Packages whose entry runs a program when imported (their `bin` is the entry). */
function isExecutableEntry(manifest) {
  const bins =
    typeof manifest.bin === 'string' ? [manifest.bin] : Object.values(manifest.bin ?? {});
  const entry = conditionTarget(manifest.exports?.['.'], 'import');
  return bins.some((b) => entry && resolve('/', b) === resolve('/', entry));
}

export function listPackages(root) {
  const out = [];
  for (const dir of readdirSync(join(root, 'packages')).sort()) {
    const manifestPath = join(root, 'packages', dir, 'package.json');
    if (SKIP.has(dir) || !existsSync(manifestPath)) continue;
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (manifest.private || !existsSync(join(root, 'packages', dir, 'dist'))) continue;
    out.push({ dir, manifest });
  }
  return out;
}

/** Specifiers to import: the package itself plus each declared subpath. */
export function specifiersOf(manifest) {
  const specs = [];
  for (const key of Object.keys(manifest.exports ?? {})) {
    if (key === './package.json') continue;
    specs.push(key === '.' ? manifest.name : `${manifest.name}/${key.slice(2)}`);
  }
  return specs;
}

/** Select real package entry contracts, never skip all CJS for an old runtime. */
export function consumerTargetsOf(manifest, canRequireEsm) {
  return specifiersOf(manifest)
    .filter(spec => !(isExecutableEntry(manifest) && spec === manifest.name))
    .map(spec => {
      const key = spec === manifest.name ? '.' : `./${spec.slice(manifest.name.length + 1)}`;
      return { spec, cjs: isDualEntry(manifest.exports[key]) || canRequireEsm };
    });
}

function run(cmd, args, opts = {}) {
  // `npm` needs a shell on Windows; everything else is spawned directly (`node` = this process).
  const r =
    cmd === 'npm'
      ? spawnNpm(args, { encoding: 'utf8', ...opts })
      : spawnSync(cmd === 'node' ? process.execPath : cmd, args, { encoding: 'utf8', ...opts });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed (${r.status}):\n${r.stdout}\n${r.stderr}`);
  }
  return r.stdout;
}

export async function installImportCheck(root = process.cwd()) {
  const packages = listPackages(root);
  const work = mkdtempSync(join(tmpdir(), 'zenith-install-'));
  const tarballs = join(work, 'tarballs');
  const project = join(work, 'consumer');
  mkdirSync(tarballs, { recursive: true });
  mkdirSync(project, { recursive: true });
  const problems = [];
  try {
    // 1) pack
    const spec = {};
    for (const { dir, manifest } of packages) {
      const out = run('npm', ['pack', '--json', '--pack-destination', tarballs], {
        cwd: join(root, 'packages', dir),
      });
      spec[manifest.name] = `file:${join(tarballs, JSON.parse(out)[0].filename)}`;
    }

    // 2) install into a clean consumer
    writeFileSync(
      join(project, 'package.json'),
      JSON.stringify(
        {
          name: 'zenith-consumer',
          private: true,
          type: 'module',
          dependencies: { ...spec, jsdom: '^24.0.0' },
          overrides: Object.fromEntries(Object.keys(spec).map((n) => [n, `$${n}`])),
        },
        null,
        2,
      ),
    );
    run('npm', ['install', '--no-audit', '--no-fund', '--ignore-scripts'], { cwd: project });

    // 3) import every entry as ESM and CJS in a child process (clean module registry per format)
    const canRequireEsm = Boolean(process.features.require_module);
    const targets = packages.flatMap(({ manifest }) => consumerTargetsOf(manifest, canRequireEsm));
    const harness = `
      const { JSDOM } = await import('jsdom');
      const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/' });
      globalThis.window = dom.window;
      for (const k of ['document','navigator','HTMLElement','Element','Node','CustomEvent','Event','KeyboardEvent'])
        if (!(k in globalThis)) globalThis[k] = dom.window[k];
      const { createRequire } = await import('node:module');
      const require = createRequire(process.cwd() + '/');
      const mode = process.argv[2];
      const failures = [];
      for (const spec of JSON.parse(process.argv[3])) {
        try {
          const mod = mode === 'esm' ? await import(spec) : require(spec);
          const keys = Object.keys(mod).filter((k) => k !== 'default' && k !== '__esModule');
          if (keys.length === 0) failures.push(spec + ': no named exports');
        } catch (e) {
          failures.push(spec + ': ' + (e && e.code ? e.code + ' ' : '') + String(e && e.message).split('\\n')[0]);
        }
      }
      console.log(JSON.stringify(failures));
    `;
    writeFileSync(join(project, 'harness.mjs'), harness);
    for (const mode of ['esm', 'cjs']) {
      const specs = JSON.stringify(targets.filter(target => mode === 'esm' || target.cjs).map(target => target.spec));
      const out = run('node', ['--no-warnings', 'harness.mjs', mode, specs], { cwd: project });
      for (const f of JSON.parse(out.trim().split('\n').pop())) problems.push(`[${mode}] ${f}`);
    }
    if (!canRequireEsm) {
      console.warn('⚠ Node without require(esm): ESM-only entries omitted from CJS; all declared require entries checked.');
    }

    // 4) the installed CLI binary reports its package version
    const cli = packages.find((p) => p.manifest.name === '@zenith/cli');
    if (cli) {
      // run the installed bin script through node (no .bin/*.cmd shim on Windows)
      const cliBin = join(project, 'node_modules', '@zenith', 'cli', 'dist', 'index.js');
      const version = run('node', [cliBin, '--version'], { cwd: project }).trim();
      checkInstalledCli(project, cliBin);
      if (version !== cli.manifest.version) {
        problems.push(`zenith --version printed "${version}", package is ${cli.manifest.version}`);
      }
    }
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  return { checked: packages.length, problems };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const { checked, problems } = await installImportCheck(resolve('.'));
    if (problems.length > 0) {
      for (const p of problems) console.error(`❌ ${p}`);
      console.error(`install-import: ${problems.length} problem(s) across ${checked} tarballs.`);
      process.exit(1);
    }
    console.log(
      `✅ install-import (#74): ${checked} tarballs installed; ESM + CJS imports OK; CLI version OK.`,
    );
  } catch (err) {
    console.error(`❌ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}
