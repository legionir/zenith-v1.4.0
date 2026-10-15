import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { entryFor, isDualEntry } from './lib/exports-shape.mjs';

// #172 — Standardize workspace package.json manifests while respecting:
// - DEC-026: lockstep 1.5.0 on born-1.5.0 packages (1.4.0 on legacy packages until release bump)
// - DEC-027: ESM-only exports on born-ESM packages; dual ESM+CJS on legacy/tooling packages
// - #68: LICENSE included in files[]
// - #70: repository, homepage, bugs, publishConfig, sideEffects, engines >=18.19
export function standardizePackages(packagesDir = './packages', rootVersion = '1.4.0') {
  const pkgDirs = readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name);

  const versionByPkg = new Map();
  for (const dir of pkgDirs) {
    const pkgPath = join(packagesDir, dir, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const p = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (p.name) versionByPkg.set(p.name, p.version || rootVersion);
  }

  const updated = [];

  for (const dir of pkgDirs) {
    const pkgPath = join(packagesDir, dir, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

    pkg.version = pkg.version === '1.5.0' ? '1.5.0' : rootVersion;
    pkg.type = 'module';
    pkg.license = pkg.license || 'MIT';
    pkg.engines = { node: '>=18.19' };

    if (pkg.name !== 'zenith-vscode') {
      const rootExp = pkg.exports?.['.'];
      const isDual = isDualEntry(rootExp) || String(pkg.main ?? '').endsWith('.cjs');

      pkg.main = isDual ? './dist/index.cjs' : './dist/index.js';
      pkg.module = './dist/index.js';
      pkg.types = './dist/index.d.ts';

      // #74: shape defined once in scripts/lib/exports-shape.mjs
      const base = entryFor('index', { dual: isDual });
      const development =
        rootExp && typeof rootExp === 'object' && rootExp.development
          ? { development: rootExp.development }
          : {};
      const nextDot = isDual
        ? { ...development, ...base }
        : { types: base.types, ...development, import: base.import, default: base.default };

      pkg.exports = {
        ...(pkg.exports ?? {}),
        '.': nextDot,
        './package.json': './package.json',
      };

      const files = new Set(Array.isArray(pkg.files) ? pkg.files : ['dist', 'README.md']);
      files.add('dist');
      files.add('README.md');
      files.add('LICENSE');
      pkg.files = [...files];

      pkg.scripts = {
        ...pkg.scripts,
        build: 'tsc -p tsconfig.json',
        typecheck: 'tsc --noEmit',
      };
    }

    const fixDeps = (deps) => {
      if (!deps) return;
      for (const key of Object.keys(deps)) {
        if (versionByPkg.has(key)) {
          deps[key] = versionByPkg.get(key);
        }
      }
    };

    const fixPeers = (peers) => {
      if (!peers) return;
      for (const key of Object.keys(peers)) {
        if (versionByPkg.has(key)) {
          peers[key] = `^${rootVersion}`;
        }
      }
    };

    fixDeps(pkg.dependencies);
    fixDeps(pkg.devDependencies);
    fixPeers(pkg.peerDependencies);

    writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
    updated.push(pkg.name);
  }

  return updated;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const updated = standardizePackages('./packages');
  console.log(`Standardized ${updated.length} packages.`);
}
