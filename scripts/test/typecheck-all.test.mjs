// Tests for scripts/typecheck-all.mjs (#26).
// Guarantees:
//  - generated per-package tsconfigs are noEmit and resolve @zenith/* to src
//    (never dist),
//  - on a fixture workspace, a stale dist/*.d.ts CANNOT mask a downstream
//    type error (tsc reads src),
//  - a consistent fixture passes and nothing is written to dist/.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  typecheckConfigFor,
  typeTestConfigFor,
  listTypeTestFiles,
  runTypecheckAll,
  TS_BUILD_DIR,
} from '../typecheck-all.mjs';

const PKG_TSCONFIG = {
  compilerOptions: {
    target: 'ES2022',
    module: 'ESNext',
    moduleResolution: 'Bundler',
    lib: ['ES2022', 'DOM'],
    declaration: true,
    declarationMap: true,
    sourceMap: true,
    outDir: './dist',
    rootDir: './src',
    strict: true,
    esModuleInterop: true,
    skipLibCheck: true,
  },
  include: ['src/**/*'],
  exclude: ['node_modules', 'dist', 'test'],
};

/** @type {string} */
let root;

function pkg(dir, { src, staleDistTypes = null } = {}) {
  const base = join(root, 'packages', dir);
  mkdirSync(join(base, 'src'), { recursive: true });
  writeFileSync(join(base, 'package.json'), JSON.stringify({ name: `@zenith/${dir}` }));
  writeFileSync(join(base, 'tsconfig.json'), JSON.stringify(PKG_TSCONFIG));
  writeFileSync(join(base, 'src', 'index.ts'), src);
  if (staleDistTypes !== null) {
    mkdirSync(join(base, 'dist'), { recursive: true });
    writeFileSync(join(base, 'dist', 'index.d.ts'), staleDistTypes);
  }
}

/** fixture root: همان tsconfig.base.json مخزن، ولی بدون include خودکار. */
function baseConfig() {
  writeFileSync(
    join(root, 'tsconfig.base.json'),
    JSON.stringify({ compilerOptions: PKG_TSCONFIG.compilerOptions }),
  );
}

function listDist(dir) {
  const dist = join(root, 'packages', dir, 'dist');
  try {
    return readdirSync(dist).sort();
  } catch {
    return [];
  }
}

describe('typecheck-all (#26)', () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'zenith-tc-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('generated configs are noEmit, disable declaration emit, and map @zenith/* to src', () => {
    const cfg = typecheckConfigFor('state');
    expect(cfg.extends).toBe('../packages/state/tsconfig.json');
    expect(cfg.compilerOptions.noEmit).toBe(true);
    expect(cfg.compilerOptions.declaration).toBe(false);
    expect(cfg.compilerOptions.declarationMap).toBe(false);
    expect(cfg.compilerOptions.sourceMap).toBe(false);
    expect(cfg.compilerOptions.rootDir).toBe('..');
    expect(cfg.compilerOptions.paths['@zenith/*']).toEqual(['../packages/*/src']);
    expect(cfg.compilerOptions.paths['@zenith/service-worker/sw']).toEqual([
      '../packages/service-worker/src/sw.ts',
    ]);
    // #142 — زیرمسیرهای @zenith/schema.
    expect(cfg.compilerOptions.paths['@zenith/schema/zod']).toEqual([
      '../packages/schema/src/zod.ts',
    ]);
    expect(cfg.compilerOptions.paths['@zenith/schema/json-schema']).toEqual([
      '../packages/schema/src/json-schema.ts',
    ]);
  });

  it('stale dist declarations cannot mask a downstream type error', () => {
    // a's src says number, but a stale dist/index.d.ts from a previous run
    // claims string. b assigns x to a string — that would PASS against the
    // stale dist types but MUST FAIL once @zenith/a resolves to src.
    pkg('a', { src: 'export const x = 1;\n', staleDistTypes: 'export declare const x: string;\n' });
    pkg('b', { src: "import { x } from '@zenith/a';\nexport const s: string = x;\n" });

    const result = runTypecheckAll(root);
    expect(result.failed).toBe(1); // only b is inconsistent
    expect(result.output).toMatch(/TS2322/); // Type 'number' is not assignable to type 'string'
    // dist/ was never rewritten: still exactly the one planted stale file.
    expect(listDist('a')).toEqual(['index.d.ts']);
    expect(listDist('b')).toEqual([]);
  });

  it('a consistent fixture passes with an empty dist and writes nothing', () => {
    pkg('a', { src: 'export const x = 1;\n' });
    pkg('b', { src: "import { x } from '@zenith/a';\nexport const n: number = x;\n" });

    const result = runTypecheckAll(root);
    expect(result.failed).toBe(0);
    expect(listDist('a')).toEqual([]);
    expect(listDist('b')).toEqual([]);
    // temp configs land under TS_BUILD_DIR and are cleaned at the start of the run
    expect(readdirSync(join(root, TS_BUILD_DIR))).toContain('a.tsconfig.json');
  });

  it('uses the shared .tsbuild dir name', () => {
    expect(TS_BUILD_DIR).toBe('.tsbuild');
  });

  // ── #118/#120 — pass دوم: type-testها ──
  it('type-test config compiles packages/*/test/**/*.test-d.ts against src', () => {
    const cfg = typeTestConfigFor();
    expect(cfg.include).toEqual(['../packages/*/test/**/*.test-d.ts']);
    expect(cfg.compilerOptions.noEmit).toBe(true);
    expect(cfg.compilerOptions.declaration).toBe(false);
    expect(cfg.compilerOptions.paths['@zenith/*']).toEqual(['../packages/*/src']);
    // زیرمسیرها هم مثل pass اول src-resolvedاند (dist روی CI ساخته نمی‌شود).
    expect(cfg.compilerOptions.paths['@zenith/schema/attr']).toEqual([
      '../packages/schema/src/attr.ts',
    ]);
  });

  it('listTypeTestFiles finds nested .test-d.ts files and ignores tmp-* packages', () => {
    pkg('a', { src: 'export const x = 1;\n' });
    mkdirSync(join(root, 'packages/a/test'), { recursive: true });
    writeFileSync(join(root, 'packages/a/test/types.test-d.ts'), 'export {};\n');
    mkdirSync(join(root, 'packages/a/test/nested'), { recursive: true });
    writeFileSync(join(root, 'packages/a/test/nested/deep.test-d.ts'), 'export {};\n');
    writeFileSync(join(root, 'packages/a/test/plain.test.ts'), 'export {};\n');
    mkdirSync(join(root, 'packages/tmp-scratch/test'), { recursive: true });
    writeFileSync(join(root, 'packages/tmp-scratch/test/x.test-d.ts'), 'export {};\n');

    expect(listTypeTestFiles(root)).toEqual([
      join('packages/a/test/nested/deep.test-d.ts'),
      join('packages/a/test/types.test-d.ts'),
    ]);
  });

  it('returns an empty list (no tsc run, no TS18003) when a workspace has no type-tests', () => {
    pkg('a', { src: 'export const x = 1;\n' });
    expect(listTypeTestFiles(root)).toEqual([]);
    const result = runTypecheckAll(root);
    expect(result.failed).toBe(0);
    expect(result.typeTests).toBe(0);
  });

  it('a wrong type assertion in a *.test-d.ts fixture fails the run', () => {
    baseConfig();
    pkg('a', { src: 'export declare function f(): number;\n' });
    mkdirSync(join(root, 'packages/a/test'), { recursive: true });
    writeFileSync(
      join(root, 'packages/a/test/bad.test-d.ts'),
      [
        "import { f } from '@zenith/a';",
        '// ادعای غلط: f عدد برمی‌گرداند، نه string (شبیه expectTypeOf().toEqualTypeOf).',
        'export const broken: string = f();',
        '',
      ].join('\n'),
    );
    // runTypecheckAll خروجی tsc را برای دیباگ روی stdout می‌نویسد؛ در تست آن را
    // می‌گیریم تا لاگ CI با annotationهای گمراه‌کننده (خطای عمدی داخل fixture)
    // پر نشود — خودِ assertion روی result.output می‌سنجد که متن موجود است.
    const stdoutWrite = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    let result;
    try {
      result = runTypecheckAll(root);
    } finally {
      stdoutWrite.mockRestore();
    }
    expect(result.typeTests).toBe(1);
    expect(result.failed).toBe(1);
    // خطا باید از خودِ فایل type-test باشد، نه از حل‌نشدن import (fixture بدون node_modules است).
    expect(result.output).toContain('bad.test-d.ts');
    expect(result.output).toContain("Type 'number' is not assignable to type 'string'");
  });
});
