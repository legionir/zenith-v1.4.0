import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { publint } from 'publint';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPackage } from '../build-package.mjs';
import { ACCEPTANCE_CHECKLIST_ITEMS, parseScaffoldArgs, scaffoldPackage } from '../new-package.mjs';
import { checkPeerRule } from '../peer-rule.mjs';
import { findUnused } from '../unused-zenith-deps.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('new-package scaffold (#172, SPEC §6)', () => {
  const tempRoots = [];
  const repoCleanupDirs = [];

  afterEach(() => {
    for (const dir of tempRoots.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
    for (const dir of repoCleanupDirs.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  function makeTempRepo() {
    const dir = mkdtempSync(join(tmpdir(), 'zenith-scaffold-'));
    tempRoots.push(dir);
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name: 'zenith-monorepo', version: '1.4.0', private: true }, null, 2) + '\n',
    );
    writeFileSync(join(dir, 'LICENSE'), readFileSync(join(ROOT, 'LICENSE'), 'utf8'));
    writeFileSync(join(dir, '.size-limit.json'), '[]\n');
    writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify({ references: [] }, null, 2) + '\n');
    return dir;
  }

  it('parses CLI flags (--layer, --budget, --dual, --no-peers, --unscoped)', () => {
    const parsed = parseScaffoldArgs(['@zenith/ui-test', '--layer', 'L2', '--budget', '9 kb']);
    expect(parsed.name).toBe('ui-test');
    expect(parsed.layer).toBe('L2');
    expect(parsed.budget).toBe('9 kb');
  });

  it('rejects invalid package names and invalid layers', () => {
    const rootDir = makeTempRepo();
    expect(() => scaffoldPackage({ name: 'BadName', layer: 'L2', rootDir })).toThrow(
      /Invalid package name/,
    );
    expect(() => scaffoldPackage({ name: '../escape', layer: 'L2', rootDir })).toThrow(
      /Invalid package name/,
    );
    expect(() => scaffoldPackage({ name: 'valid-name', layer: 'L9', rootDir })).toThrow(
      /Invalid --layer/,
    );
  });

  it('rejects duplicate package directory', () => {
    const rootDir = makeTempRepo();
    scaffoldPackage({ name: 'dup-pkg', layer: 'L0', rootDir });
    expect(() => scaffoldPackage({ name: 'dup-pkg', layer: 'L0', rootDir })).toThrow(
      /already exists/,
    );
  });

  it('generates L0 package without peerDependencies and ESM-only exports (SPEC §6.1, DEC-027)', () => {
    const rootDir = makeTempRepo();
    const res = scaffoldPackage({ name: 'sample-l0', layer: 'L0', rootDir });

    expect(res.pkgName).toBe('@zenith/sample-l0');
    expect(res.pkgJson.version).toBe('1.5.0');
    expect(res.pkgJson.sideEffects).toBe(false);
    expect(res.pkgJson.peerDependencies).toBeUndefined();
    expect(res.pkgJson.exports['.']).toEqual({
      types: './dist/index.d.ts',
      development: './dist/index.js',
      import: './dist/index.js',
    });
    expect(res.pkgJson.exports['./package.json']).toBe('./package.json');
    expect(res.pkgJson.files).toEqual(['dist', 'README.md', 'LICENSE']);
    expect(res.pkgJson.engines).toEqual({ node: '>=18.19' });
    expect(res.pkgJson.publishConfig).toEqual({ access: 'public', provenance: true });
  });

  it('generates L2 package with @zenith/state and @zenith/scheduler peerDependencies', () => {
    const rootDir = makeTempRepo();
    const res = scaffoldPackage({ name: 'sample-l2', layer: 'L2', rootDir });

    expect(res.hasPeers).toBe(true);
    expect(res.pkgJson.peerDependencies).toEqual({
      '@zenith/state': '^1.4.0',
      '@zenith/scheduler': '^1.4.0',
    });

    const sizeLimit = JSON.parse(readFileSync(join(rootDir, '.size-limit.json'), 'utf8'));
    expect(sizeLimit).toContainEqual({
      name: '@zenith/sample-l2',
      path: 'packages/sample-l2/dist/index.js',
      limit: '8 kb',
    });

    const tsconfig = JSON.parse(readFileSync(join(rootDir, 'tsconfig.json'), 'utf8'));
    expect(tsconfig.references).toContainEqual({ path: './packages/sample-l2' });
  });

  it('generates tooling package with dual ESM + CJS require condition (DEC-027)', () => {
    const rootDir = makeTempRepo();
    const res = scaffoldPackage({ name: 'create-zenith', layer: 'tooling', rootDir });

    expect(res.pkgName).toBe('create-zenith');
    expect(res.isDual).toBe(true);
    expect(res.pkgJson.peerDependencies).toBeUndefined();
    expect(res.pkgJson.exports['.'].require).toBe('./dist/index.cjs');
  });

  it('includes all 12 SPEC §6.2 acceptance checklist items in README and .github/ISSUE_TEMPLATE/new-package.md', () => {
    const rootDir = makeTempRepo();
    scaffoldPackage({ name: 'check-pkg', layer: 'L2', rootDir });

    const readme = readFileSync(join(rootDir, 'packages', 'check-pkg', 'README.md'), 'utf8');
    const templatePath = join(ROOT, '.github', 'ISSUE_TEMPLATE', 'new-package.md');
    expect(existsSync(templatePath)).toBe(true);
    const issueTemplate = readFileSync(templatePath, 'utf8');

    expect(ACCEPTANCE_CHECKLIST_ITEMS.length).toBe(12);
    for (const item of ACCEPTANCE_CHECKLIST_ITEMS) {
      expect(readme).toContain(item);
      expect(issueTemplate).toContain(item);
    }
  });

  it('scaffolded L2 package builds, passes publint with 0 errors, and passes unused-deps/peer-rule gates without manual edits', async () => {
    const slug = 'tmp-scaffold-verify';
    const pkgDir = join(ROOT, 'packages', slug);
    repoCleanupDirs.push(pkgDir);

    scaffoldPackage({
      name: slug,
      layer: 'L2',
      rootDir: ROOT,
      updateWorkspaceFiles: false,
    });

    // Ensure peer targets have emitted declarations when running in a fresh checkout before npm run build.
    // Full dependency closure, TOPOLOGICAL order (typed `exports.types` point at dist/*.d.ts):
    // errors is the L0 root imported by shared/scheduler/logger; state needs all four upstream.
    // Without this, tsc hits TS2307 (e.g. '@zenith/logger' from packages/state/src) on a pristine
    // CI checkout where `npm run build` never ran (unit job has no build step, unlike os-matrix).
    for (const dep of ['errors', 'shared', 'scheduler', 'logger', 'state']) {
      if (!existsSync(join(ROOT, 'packages', dep, 'dist', 'index.d.ts'))) {
        await buildPackage(dep);
      }
    }

    // 1. Build (esbuild + tsc declarations)
    const built = await buildPackage(slug);
    expect(built).toBe(true);
    expect(existsSync(join(pkgDir, 'dist', 'index.js'))).toBe(true);
    expect(existsSync(join(pkgDir, 'dist', 'index.d.ts'))).toBe(true);

    // 2. publint 0 errors
    const { messages } = await publint({ pkgDir });
    const errors = messages.filter((m) => m.type === 'error');
    expect(errors).toEqual([]);

    // 3. unused-zenith-deps 0 problems on the scaffolded package
    const unused = findUnused(join(ROOT, 'packages'), [slug]);
    expect(unused.problems).toEqual([]);

    // 4. peer-rule 0 violations across workspace including the scaffolded package
    const peerViolations = checkPeerRule(join(ROOT, 'packages'), '1.4.0');
    expect(peerViolations).toEqual([]);
  });
});
