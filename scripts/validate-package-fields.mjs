#!/usr/bin/env node
// Validate that every workspace package.json declares the required
// production fields (#70): repository (with directory), homepage, bugs,
// publishConfig (public access; provenance for npm-published packages) and
// sideEffects (false or an explicit glob list). Runs in CI as the
// `package-fields` check; the same rules are unit-tested in
// scripts/test/package-fields.test.mjs.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const REQUIRED_REPOSITORY_URL = 'github.com/legionir/zenith-v1.4.0';
const packagesDir = './packages';

const dirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .filter((d) => existsSync(join(packagesDir, d.name, 'package.json')))
  .map((d) => d.name);

const errors = [];

for (const dir of dirs) {
  const pkg = JSON.parse(readFileSync(join(packagesDir, dir, 'package.json'), 'utf8'));
  const where = (msg) => errors.push(`${dir}: ${msg}`);

  if (!pkg.repository || typeof pkg.repository !== 'object') {
    where('repository must be an object with url+directory');
  } else {
    if (!String(pkg.repository.url).includes(REQUIRED_REPOSITORY_URL)) {
      where(`repository.url must reference ${REQUIRED_REPOSITORY_URL}`);
    }
    if (pkg.repository.directory !== `packages/${dir}`) {
      where(`repository.directory must be "packages/${dir}"`);
    }
  }

  if (!pkg.homepage || !String(pkg.homepage).includes(REQUIRED_REPOSITORY_URL)) {
    where('homepage must link to the repository');
  }

  if (!pkg.bugs || !pkg.bugs.url) {
    where('bugs.url missing');
  }

  if (!pkg.publishConfig || pkg.publishConfig.access !== 'public') {
    where('publishConfig.access must be "public"');
  } else if (pkg.name !== 'zenith-vscode' && pkg.publishConfig.provenance !== true) {
    // provenance is npm-only; the marketplace artifact is not npm-published.
    where('publishConfig.provenance must be true for npm packages');
  }

  const se = pkg.sideEffects;
  const valid = se === false || (Array.isArray(se) && se.every((g) => typeof g === 'string'));
  if (!valid) where('sideEffects must be false or an array of globs');
}

if (errors.length > 0) {
  console.error('package-fields validation failed:');
  for (const e of errors) console.error('  -', e);
  process.exit(1);
}
console.log(`package-fields: ${dirs.length} packages OK`);
