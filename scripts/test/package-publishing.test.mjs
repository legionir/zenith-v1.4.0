// scripts/test/package-publishing.test.mjs
// #74 — published-package validation: exports shape helper, d.ts bundling fix-ups, the audits
// wired into CI, and (when the workspace is built) the real attw gate on every package.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { conditionTarget, distName, entryFor, isDualEntry } from '../lib/exports-shape.mjs';
import { collectTypeOnlyReexports, restoreTypeOnlyReexports } from '../lib/dts-bundle.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { attwAll } from '../attw-all.mjs';
import { auditPackages, ALLOWED_TARBALL_FILES } from '../pack-audit.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

describe('#74 exports shape', () => {
  it('dual entries carry separate .d.cts types for require; ESM-only get a default for require(esm)', () => {
    expect(entryFor('index', { dual: true })).toEqual({
      import: { types: './dist/index.d.ts', default: './dist/index.js' },
      require: { types: './dist/index.d.cts', default: './dist/index.cjs' },
    });
    expect(entryFor('zod', { dual: false })).toEqual({
      types: './dist/zod.d.ts',
      import: './dist/zod.js',
      default: './dist/zod.js',
    });
  });

  it('conditionTarget reads flat and nested shapes', () => {
    const dual = entryFor('index', { dual: true });
    expect(conditionTarget(dual, 'types')).toBe('./dist/index.d.ts');
    expect(conditionTarget(dual, 'import')).toBe('./dist/index.js');
    expect(conditionTarget(dual, 'require')).toBe('./dist/index.cjs');
    const flat = { types: './a.d.ts', import: './a.js', require: './a.cjs' };
    expect(conditionTarget(flat, 'types')).toBe('./a.d.ts');
    expect(conditionTarget(flat, 'require')).toBe('./a.cjs');
    expect(isDualEntry(dual)).toBe(true);
    expect(isDualEntry(entryFor('index', { dual: false }))).toBe(false);
    expect(distName('./dist/presets/minimal.d.ts')).toBe('presets/minimal');
    expect(distName('./dist/index.d.cts')).toBe('index');
  });

  it('every workspace package follows the shape (dual ⇒ nested+.d.cts, ESM-only ⇒ default)', () => {
    const res = auditPackages(root, { runNpmPack: false });
    expect(res.errors).toEqual([]);
  });
});

describe('#74 d.ts bundling keeps type-only re-exports type-only', () => {
  function scratch(files) {
    const dir = mkdtempSync(join(tmpdir(), 'dts-'));
    for (const [name, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, name)), { recursive: true });
      writeFileSync(join(dir, name), body);
    }
    return dir;
  }

  it('restores `type` that rollup-plugin-dts drops for names re-exported from externals', () => {
    const dir = scratch({
      'index.d.ts': "export { run, type Thing } from './impl';\n",
      'impl.d.ts':
        "import { make, type Thing } from '@zenith/ext';\nexport { make as run, type Thing };\n",
    });
    const typeOnly = collectTypeOnlyReexports(dir);
    expect([...(typeOnly.get('@zenith/ext') ?? [])]).toEqual(['Thing']);
    const bundled = "export { Thing, make as run } from '@zenith/ext';\n";
    expect(restoreTypeOnlyReexports(bundled, typeOnly)).toBe(
      "export { type Thing, make as run } from '@zenith/ext';\n",
    );
    rmSync(dir, { recursive: true, force: true });
  });

  it('a name that is a VALUE somewhere stays a value', () => {
    const dir = scratch({
      'a.d.ts': "import { Both } from '@zenith/ext';\nexport { Both };\n",
      'b.d.ts': "import type { Both } from '@zenith/ext';\nexport type { Both };\n",
    });
    const typeOnly = collectTypeOnlyReexports(dir);
    expect(typeOnly.get('@zenith/ext')?.has('Both') ?? false).toBe(false);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe('#74 tarball allowlist', () => {
  it('accepts dist output, README, LICENSE, package.json; rejects sources, tests, scratch d.ts', () => {
    const ok = (f) => ALLOWED_TARBALL_FILES.some((re) => re.test(f));
    for (const f of [
      'dist/index.js',
      'dist/index.d.cts',
      'dist/presets/a.js.map',
      'README.md',
      'LICENSE',
      'package.json',
    ]) {
      expect(ok(f), f).toBe(true);
    }
    for (const f of [
      'src/index.ts',
      'test/a.test.ts',
      'dist/.dts/index.d.ts',
      'tsconfig.json',
      '.env',
      'scripts/x.mjs',
    ]) {
      expect(ok(f), f).toBe(false);
    }
  });
});

describe('#74 CI wiring and the real gates', () => {
  it('package-lint runs pack-audit, attw and the install-and-import check', () => {
    const wf = readFileSync(join(root, '.github', 'workflows', 'main.yml'), 'utf8');
    for (const cmd of [
      'node scripts/pack-audit.mjs --pack',
      'node scripts/attw-all.mjs',
      'node scripts/install-import-check.mjs',
      'npm run publint',
    ]) {
      expect(wf, cmd).toContain(cmd);
    }
  });

  it.skipIf(!existsSync(join(root, 'packages', 'state', 'dist', 'index.d.cts')))(
    'attw: every built package resolves its types under every mode (dual) / esm-only profile',
    async () => {
      const { checked, failures } = await attwAll(root);
      expect(checked).toBeGreaterThanOrEqual(34);
      expect(failures).toEqual([]);
    },
    180_000,
  );
});
