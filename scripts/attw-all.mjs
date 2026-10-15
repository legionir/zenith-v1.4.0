#!/usr/bin/env node
/**
 * #74 — "Are the types wrong?" for every publishable package.
 *
 *   node scripts/attw-all.mjs         (after `npm run build`)
 *
 * Packs each package exactly like `npm publish` would and feeds the tarball to
 * @arethetypeswrong/core. Dual (ESM+CJS) packages must be clean under every resolution mode
 * (node10, node16 from CJS / from ESM, bundler). ESM-only packages (no `require` condition,
 * DEC-027) are checked with the `esm-only` profile: node10 and node16-from-CJS are skipped, since
 * CommonJS consumers reach them through `require(esm)` which attw reports as a warning.
 */
import { checkPackage, createPackageFromTarballData } from '@arethetypeswrong/core';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDualEntry } from './lib/exports-shape.mjs';
import { spawnNpm } from './lib/proc.mjs';

const SKIP = new Set(['devtools-extension', 'vscode-extension']);
/** resolution modes ignored for ESM-only packages (attw's `esm-only` profile). */
const ESM_ONLY_IGNORED = new Set(['node10', 'node16-cjs']);

export async function attwAll(root = process.cwd()) {
  const tmp = mkdtempSync(join(tmpdir(), 'attw-'));
  const failures = [];
  let checked = 0;
  try {
    for (const dir of readdirSync(join(root, 'packages')).sort()) {
      const pkgDir = join(root, 'packages', dir);
      const manifestPath = join(pkgDir, 'package.json');
      if (SKIP.has(dir) || !existsSync(manifestPath)) continue;
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      if (manifest.private || !existsSync(join(pkgDir, 'dist'))) continue;

      const pack = spawnNpm(['pack', '--json', '--pack-destination', tmp], {
        cwd: pkgDir,
        encoding: 'utf8',
      });
      if (pack.status !== 0) {
        failures.push({ pkg: manifest.name, problems: [`npm pack failed: ${pack.stderr}`] });
        continue;
      }
      const filename = JSON.parse(pack.stdout)[0].filename;
      const tarball = join(tmp, filename);
      const analysis = await checkPackage(createPackageFromTarballData(readFileSync(tarball)));
      checked += 1;
      if (analysis.types === false) continue; // untyped package: nothing to verify

      const dual = isDualEntry(manifest.exports?.['.']);
      const problems = (analysis.problems ?? [])
        .filter((p) => dual || !ESM_ONLY_IGNORED.has(p.resolutionKind))
        .map(
          (p) =>
            `${p.kind}${p.resolutionKind ? ` [${p.resolutionKind}]` : ''}${
              p.entrypoint ? ` ${p.entrypoint}` : ''
            }${p.fileName ? ` (${p.fileName})` : ''}`,
        );
      if (problems.length > 0) failures.push({ pkg: manifest.name, dual, problems });
      rmSync(tarball, { force: true });
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  return { checked, failures };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { checked, failures } = await attwAll(resolve('.'));
  if (failures.length > 0) {
    for (const f of failures) {
      console.error(`❌ ${f.pkg} (${f.dual ? 'dual' : 'esm-only'})`);
      for (const p of f.problems) console.error(`    ${p}`);
    }
    console.error(`attw: ${failures.length}/${checked} packages have type-resolution problems.`);
    process.exit(1);
  }
  console.log(`✅ attw (#74): ${checked} packages — types resolve correctly under every mode.`);
}
