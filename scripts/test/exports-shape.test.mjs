// scripts/test/exports-shape.test.mjs
// #142/#120 (DEC-036 پیوست الف) — زیرمسیرهای عمومی و «منبع یکتا»:
// شکل هر زیرمسیر باید از scripts/lib/exports-shape.mjs بیاید، هیچ package.json
// نباید زیرمسیر دست‌نویس داشته باشد، و هر ردیف جدول باید فایل src متناظر داشته باشد.
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  PUBLIC_SUBPATHS,
  subpathKey,
  subpathName,
  subpathNames,
  subpathExports,
  exportsFor,
  declaredSubpaths,
  entryFor,
} from '../lib/exports-shape.mjs';
import { standardizePackages } from '../standardize-packages.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const packagesDir = join(root, 'packages');

/** pkgName → { dir, pkgJson } برای همهٔ پکیج‌های ورک‌اسپیس. */
function workspacePackages() {
  /** @type {Map<string, {dir: string, pkgJson: any}>} */
  const out = new Map();
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('tmp-')) continue;
    const pkgPath = join(packagesDir, entry.name, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkgJson.name) out.set(pkgJson.name, { dir: entry.name, pkgJson });
  }
  return out;
}

let packages;

beforeAll(() => {
  packages = workspacePackages();
});

describe('exports-shape: the subpath table is the single source', () => {
  it('generates the flat ESM-only shape for a subpath (no require, types first)', () => {
    expect(subpathExports('@zenith/schema')).toEqual({
      './zod': {
        types: './dist/zod.d.ts',
        import: './dist/zod.js',
        default: './dist/zod.js',
      },
      './json-schema': {
        types: './dist/json-schema.d.ts',
        import: './dist/json-schema.js',
        default: './dist/json-schema.js',
      },
      // #142: زیرمسیر attr نگهبان بودجهٔ ۴KB باندل اصلی schema است.
      './attr': {
        types: './dist/attr.d.ts',
        import: './dist/attr.js',
        default: './dist/attr.js',
      },
    });
    // همان شکل entryFor با dual:false — هیچ شکل دومی وجود ندارد.
    expect(subpathExports('@zenith/schema')['./attr']).toEqual(entryFor('attr', { dual: false }));
  });

  it('key helpers round-trip and never treat ./package.json as a subpath', () => {
    expect(subpathKey('presets/minimal')).toBe('./presets/minimal');
    expect(subpathName('./presets/minimal')).toBe('presets/minimal');
    expect(subpathName('./package.json')).toBe(null);
    expect(subpathName('@zenith/schema')).toBe(null);
    expect(subpathName('./')).toBe(null);
  });

  it('exportsFor keeps the `.` entry first and ./package.json last', () => {
    const ex = exportsFor('@zenith/storage', { types: 't', import: 'i', default: 'i' });
    expect(Object.keys(ex)).toEqual(['.', './signal', './package.json']);
  });

  it('subpathNames hands out a copy (the table cannot be mutated by callers)', () => {
    const names = subpathNames('@zenith/schema');
    names.push('bogus');
    expect(subpathNames('@zenith/schema')).toEqual(['zod', 'json-schema', 'attr']);
    // پکیج ناشناس = بدون زیرمسیر (نه خطا).
    expect(subpathExports('@zenith/errors')).toEqual({ './internal': entryFor('internal', { dual: true }) });
    expect(subpathExports('@zenith/state')).toEqual({ './internal': entryFor('internal', { dual: true }) });
  });

  it('every tabled subpath has a matching src/<name>.ts (a stale row fails CI)', () => {
    const missing = [];
    for (const [pkgName, names] of Object.entries(PUBLIC_SUBPATHS)) {
      const dir = packages.get(pkgName)?.dir;
      if (!dir) {
        missing.push(`${pkgName}: package not found`);
        continue;
      }
      for (const name of names) {
        const file = join(packagesDir, dir, 'src', `${name}.ts`);
        if (!existsSync(file)) missing.push(`${pkgName} → src/${name}.ts`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('the real workspace declares exactly the tabled subpaths, with the generated shape', () => {
    const problems = [];
    for (const [pkgName, { dir, pkgJson }] of packages) {
      const declared = declaredSubpaths(pkgJson);
      const expected = subpathNames(pkgName);
      const key = (n) => subpathKey(n);
      if (declared.join(',') !== expected.join(',')) {
        problems.push(
          `${dir}: declares [${declared.join(', ')}] but the table says [${expected.join(', ')}]`,
        );
        continue;
      }
      for (const name of expected) {
        const actual = pkgJson.exports[key(name)];
        const want = subpathExports(pkgName)[key(name)];
        if (JSON.stringify(actual) !== JSON.stringify(want)) {
          problems.push(
            `${dir}: exports["${key(name)}"] = ${JSON.stringify(actual)} ≠ ${JSON.stringify(want)}`,
          );
        }
      }
      if (pkgJson.name !== 'zenith-vscode' && pkgJson.exports['./package.json'] === undefined) {
        problems.push(`${dir}: missing exports["./package.json"]`);
      }
    }
    expect(problems).toEqual([]);
  });

  it('@zenith/schema/attr is a generated, published-mapped subpath (#142/#120)', () => {
    const schema = packages.get('@zenith/schema');
    expect(schema).toBeDefined();
    expect(schema.pkgJson.exports['./attr']).toEqual(subpathExports('@zenith/schema')['./attr']);
    // فایل ورودی ساخته‌شده هم باید در همان مسیر dist باشد که map می‌گوید.
    expect(schema.pkgJson.files).toContain('dist');
  });
});

describe('standardize-packages: subpaths are regenerated, never inherited', () => {
  let tmp;

  function fixturePackage(name, exportsMap) {
    const dir = join(tmp, 'packages', name.replace('@zenith/', ''));
    mkdirSync(join(dir, 'src'), { recursive: true });
    writeFileSync(join(dir, 'src', 'index.ts'), 'export const x = 1;\n');
    writeFileSync(
      join(dir, 'package.json'),
      JSON.stringify({ name, version: '1.4.0', exports: exportsMap }, null, 2) + '\n',
    );
    return dir;
  }

  it('drops a hand-written subpath that is not in the table and writes the tabled ones', () => {
    tmp = mkdtempSync(join(tmpdir(), 'zenith-exports-'));
    try {
      const dir = fixturePackage('@zenith/schema', {
        '.': { types: './dist/index.d.ts', import: './dist/index.js', default: './dist/index.js' },
        './handwritten': { types: './dist/handwritten.d.ts', import: './dist/handwritten.js' },
        './package.json': './package.json',
      });
      standardizePackages(join(tmp, 'packages'), '1.4.0');
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      expect(Object.keys(pkg.exports)).toEqual([
        '.',
        './zod',
        './json-schema',
        './attr',
        './package.json',
      ]);
      expect(pkg.exports['./attr']).toEqual(entryFor('attr', { dual: false }));
      expect(pkg.exports['./handwritten']).toBeUndefined();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('leaves packages without tabled subpaths untouched apart from the standard shape', () => {
    tmp = mkdtempSync(join(tmpdir(), 'zenith-exports-'));
    try {
      const dir = fixturePackage('@zenith/errors', {
        '.': { types: './dist/index.d.ts', import: './dist/index.js', default: './dist/index.js' },
      });
      standardizePackages(join(tmp, 'packages'), '1.4.0');
      const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
      expect(Object.keys(pkg.exports)).toEqual(['.', './package.json']);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});
