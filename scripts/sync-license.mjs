#!/usr/bin/env node
// Sync the root LICENSE into every workspace package and tool (#68, #51) so
// `npm pack` ships the license text with each published tarball (npm includes
// a LICENSE found in the package directory automatically, even when `files`
// is set) and every distributable tool artifact (VSIX/ZIP) carries it too.
// tools/ are private workspaces built separately (#51), not npm libraries,
// but they are still distributables — never silently skipped here.
// CI verifies freshness: `node scripts/sync-license.mjs --check` fails if any
// package/tool LICENSE differs from (or is missing next to) the root copy.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = readFileSync('LICENSE', 'utf8');
const check = process.argv.includes('--check');
const workspaceParents = ['./packages', './tools'];

const dirs = workspaceParents.flatMap((parentDir) =>
  readdirSync(parentDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => existsSync(join(parentDir, d.name, 'package.json')))
    .map((d) => join(parentDir, d.name)),
);

let drifted = 0;
for (const dir of dirs) {
  const target = join(dir, 'LICENSE');
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
    `${drifted} workspace(s) have missing/stale LICENSE (run: node scripts/sync-license.mjs)`,
  );
  process.exit(1);
}
if (!check) console.log(`LICENSE synced to ${dirs.length} workspaces (packages + tools).`);
