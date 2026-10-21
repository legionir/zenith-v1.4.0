// scripts/test/export-conditions.test.mjs
// #57 / DEC-041 (conditions-by-design): environment split is expressed with
// explicit subpaths (./node, ./edge, ./sw, ./browser, …), NEVER with export
// conditions beyond import/require/types/default. Conditions mean different
// things to different bundlers/runtimes and fail silently; a subpath is one
// deliberate table row (PUBLIC_SUBPATHS) with its own size budget, target,
// attw/publint coverage and docs page.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/** Only these condition keys may appear in any workspace `exports` map. */
const ALLOWED_CONDITIONS = new Set(['import', 'require', 'types', 'default']);

function workspacePackages() {
  const root = process.cwd();
  return readdirSync(join(root, 'packages'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('tmp-'))
    .filter((d) => existsSync(join(root, 'packages', d.name, 'package.json')))
    .map((d) => d.name);
}

function forbiddenConditions(exportsMap, trail = 'exports') {
  const problems = [];
  if (!exportsMap || typeof exportsMap !== 'object') return problems;
  for (const [key, value] of Object.entries(exportsMap)) {
    if (key.startsWith('./') || key === '.') {
      problems.push(...forbiddenConditions(value, `${trail}["${key}"]`));
    } else if (!ALLOWED_CONDITIONS.has(key)) {
      problems.push(`${trail} uses condition "${key}" (allowed: import/require/types/default)`);
    } else if (value && typeof value === 'object') {
      problems.push(...forbiddenConditions(value, `${trail}.${key}`));
    }
  }
  return problems;
}

describe('#57 / DEC-041 — no export conditions beyond import/require/types/default', () => {
  it('rejects development/production/browser/node/worker conditions in every package', () => {
    const root = process.cwd();
    const problems = [];
    for (const dir of workspacePackages()) {
      const pkg = JSON.parse(readFileSync(join(root, 'packages', dir, 'package.json'), 'utf8'));
      for (const p of forbiddenConditions(pkg.exports)) problems.push(`${dir}: ${p}`);
    }
    expect(problems).toEqual([]);
  });

  it('keeps the environment split in the subpath table (the designed alternative)', () => {
    // These subpath ROWS are the "environment conditions" of this workspace;
    // environments are chosen by explicit import, not by resolver flags.
    const table = readFileSync(join(process.cwd(), 'scripts/lib/exports-shape.mjs'), 'utf8');
    for (const row of ['node', 'edge', 'sw', 'browser', 'worker', 'program']) {
      expect(table, `subpath row ./${row}`).toContain(`'${row}'`);
    }
  });
});
