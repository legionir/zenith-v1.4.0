// Publint gate for CI (#79, package-lint stage).
// Runs publint's Node API over every publishable workspace package and fails
// on *errors* only. Warnings/suggestions (e.g. the dual "types" condition and
// missing sideEffects) are reported but tracked separately (#74 deepens this
// gate with attw + npm pack --dry-run; #70 adds package.json fields).
import { readdirSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { publint } from 'publint';

// Directories that are not npm packages or not published from CI today.
const SKIP = new Set(['devtools-extension']); // no package.json (raw extension)

const packagesDir = join(process.cwd(), 'packages');
let failed = false;
let checked = 0;

for (const dir of readdirSync(packagesDir).sort()) {
  const pkgDir = join(packagesDir, dir);
  const pkgJson = join(pkgDir, 'package.json');
  if (SKIP.has(dir) || !existsSync(pkgJson)) continue;
  checked += 1;
  const name = JSON.parse(readFileSync(pkgJson, 'utf8')).name;
  // dist/ and out/ must exist for entry files; CI builds before this stage.
  const { messages } = await publint({ pkgDir });
  const errors = messages.filter((m) => m.type === 'error');
  const warnings = messages.filter((m) => m.type === 'warning');
  if (errors.length > 0) {
    failed = true;
    console.error(`✖ ${name}`);
    for (const e of errors) console.error(`  error: ${e.code} ${JSON.stringify(e.path)}`);
  } else if (warnings.length > 0) {
    console.log(`⚠ ${name} — 0 errors, ${warnings.length} warnings (tracked: #74/#70)`);
  } else {
    console.log(`✔ ${name}`);
  }
}

if (failed) {
  console.error('publint failed — fix packaging errors above.');
  process.exit(1);
}
console.log(`publint: ${checked} packages clean of errors.`);
