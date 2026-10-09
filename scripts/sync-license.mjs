#!/usr/bin/env node
// Sync the root LICENSE into every workspace package (#68) so `npm pack`
// ships the license text with each published tarball (npm includes a LICENSE
// found in the package directory automatically, even when `files` is set).
// CI verifies freshness: `node scripts/sync-license.mjs --check` fails if any
// package LICENSE differs from (or is missing next to) the root copy.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = readFileSync('LICENSE', 'utf8');
const check = process.argv.includes('--check');
const packagesDir = './packages';

const dirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .filter((d) => existsSync(join(packagesDir, d.name, 'package.json')))
  .map((d) => d.name);

let drifted = 0;
for (const dir of dirs) {
  const target = join(packagesDir, dir, 'LICENSE');
  if (existsSync(target) && readFileSync(target, 'utf8') === root) continue;
  drifted++;
  if (check) {
    console.error(`LICENSE out of sync: ${target}`);
  } else {
    writeFileSync(target, root);
    console.log(`synced ${target}`);
  }
}

if (drifted > 0 && check) {
  console.error(
    `${drifted} package(s) have missing/stale LICENSE (run: node scripts/sync-license.mjs)`,
  );
  process.exit(1);
}
if (!check) console.log(`LICENSE synced to ${dirs.length} packages.`);
