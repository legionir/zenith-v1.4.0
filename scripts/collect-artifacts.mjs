// Collect every package's build output into a single directory so CI can
// upload it as one artifact (and so the same layout can be produced locally).
//
// Layout produced under <outDir> (default: ./artifacts):
//
//   artifacts/
//     packages/<name>/         dist/ + package.json + README.md
//     manifest.json            machine-readable index of what was collected
//
// Usage:
//   node scripts/collect-artifacts.mjs [outDir]

import {
  readdirSync,
  existsSync,
  rmSync,
  mkdirSync,
  cpSync,
  copyFileSync,
  writeFileSync,
  readFileSync,
  statSync,
} from 'fs';
import { join, relative } from 'path';

const packagesDir = './packages';
const outDir = process.argv[2] ?? './artifacts';

/** Recursively sum the size of every file in a directory. */
function dirSize(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    total += entry.isDirectory() ? dirSize(full) : statSync(full).size;
  }
  return total;
}

function readJSON(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true });
}
mkdirSync(join(outDir, 'packages'), { recursive: true });

const pkgDirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const collected = [];
const skipped = [];

for (const name of pkgDirs) {
  const pkgPath = join(packagesDir, name);
  const distPath = join(pkgPath, 'dist');
  const pkgJsonPath = join(pkgPath, 'package.json');

  if (!existsSync(distPath) || !existsSync(pkgJsonPath)) {
    skipped.push({ name, reason: !existsSync(pkgJsonPath) ? 'no package.json' : 'no dist/' });
    continue;
  }

  const destPath = join(outDir, 'packages', name);
  mkdirSync(destPath, { recursive: true });
  cpSync(distPath, join(destPath, 'dist'), { recursive: true });
  copyFileSync(pkgJsonPath, join(destPath, 'package.json'));

  const readme = join(pkgPath, 'README.md');
  if (existsSync(readme)) {
    copyFileSync(readme, join(destPath, 'README.md'));
  }

  const pkgJson = readJSON(pkgJsonPath);
  const files = readdirSync(distPath);
  collected.push({
    name: pkgJson.name ?? `@zenith/${name}`,
    directory: name,
    version: pkgJson.version ?? null,
    path: relative(outDir, destPath).split('\\').join('/'),
    bytes: dirSize(distPath),
    entries: {
      esm: files.includes('index.js') ? 'dist/index.js' : null,
      cjs: files.includes('index.cjs') ? 'dist/index.cjs' : null,
      types: files.includes('index.d.ts') ? 'dist/index.d.ts' : null,
    },
  });
}

const rootPkg = readJSON('./package.json');
const manifest = {
  name: rootPkg.name,
  version: rootPkg.version,
  generatedAt: new Date().toISOString(),
  commit: process.env.GITHUB_SHA ?? null,
  ref: process.env.GITHUB_REF ?? null,
  runId: process.env.GITHUB_RUN_ID ?? null,
  totalBytes: collected.reduce((sum, p) => sum + p.bytes, 0),
  packageCount: collected.length,
  packages: collected,
  skipped,
};

writeFileSync(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);

const mb = (manifest.totalBytes / 1024 / 1024).toFixed(2);
console.log(`Collected ${collected.length} package(s) into ${outDir} (${mb} MB)`);

const missingTypes = collected.filter((p) => !p.entries.types);
if (missingTypes.length > 0) {
  console.log(`Note: ${missingTypes.length} package(s) have no index.d.ts: ${missingTypes.map((p) => p.name).join(', ')}`);
}
for (const s of skipped) {
  console.log(`Skipped ${s.name}: ${s.reason}`);
}
