// scripts/test/dts-js-parity.test.mjs
// #140 — the .d.ts ↔ ESM ↔ CJS export parity gate: fixtures prove it detects missing / extra
// names in either format and ignores type-only exports; the real workspace must be in parity.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPackageParity, checkDtsJsParity } from '../check-dts-js-parity.mjs';
import { isFullyBuilt } from '../lib/workspace.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
let tmp;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'dts-parity-'));
});
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

function makePkg(name, { dts, esm, cjs }) {
  const dir = join(tmp, name);
  mkdirSync(join(dir, 'dist'), { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({
      name: `@fx/${name}`,
      type: 'module',
      exports: {
        '.': {
          types: './dist/index.d.ts',
          import: './dist/index.js',
          require: './dist/index.cjs',
        },
      },
    }),
  );
  writeFileSync(join(dir, 'dist', 'index.d.ts'), dts);
  writeFileSync(join(dir, 'dist', 'index.js'), esm);
  writeFileSync(join(dir, 'dist', 'index.cjs'), cjs);
  return dir;
}

const DTS = `export declare function a(): void;
export declare const b: number;
export declare class C {}
export interface OnlyType { x: number }
export type Alias = string;
export {};`;
const ESM = 'export function a(){}\nexport const b = 1;\nexport class C {}\n';
const CJS =
  'Object.defineProperty(exports,"__esModule",{value:true});exports.a=function(){};exports.b=1;exports.C=class{};';

describe('#140 .d.ts ↔ ESM ↔ CJS export parity', () => {
  it('equal sets (types/interfaces ignored) ⇒ no problems', async () => {
    const dir = makePkg('ok', { dts: DTS, esm: ESM, cjs: CJS });
    expect(await checkPackageParity(dir)).toEqual([]);
  });

  it('name declared in .d.ts but missing from ESM and CJS is reported per format', async () => {
    const dir = makePkg('missing', {
      dts: DTS + '\nexport declare const ghost: number;',
      esm: ESM,
      cjs: CJS,
    });
    const r = await checkPackageParity(dir);
    expect(r).toEqual([
      { pkg: '@fx/missing', format: 'ESM', kind: 'missing', names: ['ghost'] },
      { pkg: '@fx/missing', format: 'CJS', kind: 'missing', names: ['ghost'] },
    ]);
  });

  it('runtime export not declared in .d.ts (extra) breaks the gate', async () => {
    const dir = makePkg('extra', {
      dts: DTS,
      esm: ESM + 'export const leaked = 1;\n',
      cjs: CJS + 'exports.leaked=1;',
    });
    const r = await checkPackageParity(dir);
    expect(r.map((p) => `${p.format}:${p.kind}:${p.names}`)).toEqual([
      'ESM:extra:leaked',
      'CJS:extra:leaked',
    ]);
  });

  it('ESM and CJS disagreeing with each other is caught even if one matches the .d.ts', async () => {
    const dir = makePkg('skew', { dts: DTS, esm: ESM, cjs: CJS.replace('exports.b=1;', '') });
    const r = await checkPackageParity(dir);
    expect(r).toEqual([{ pkg: '@fx/skew', format: 'CJS', kind: 'missing', names: ['b'] }]);
  });

  it('`export { type X }` is not a runtime export even when X is a class', async () => {
    const dir = makePkg('typeonly', {
      dts: 'declare class K {}\nexport { type K };\nexport declare const real: number;',
      esm: 'export const real = 1;\n',
      cjs: 'exports.real=1;',
    });
    expect(await checkPackageParity(dir)).toEqual([]);
  });

  it('unbuilt package (no .d.ts) is skipped, not failed', async () => {
    const dir = makePkg('unbuilt', { dts: DTS, esm: ESM, cjs: CJS });
    rmSync(join(dir, 'dist', 'index.d.ts'));
    expect(await checkPackageParity(dir)).toBeNull();
  });

  it.skipIf(!isFullyBuilt(root))(
    'the real workspace (built) has full parity across every package',
    async () => {
      const { checkedPackages, mismatches } = await checkDtsJsParity(root);
      expect(checkedPackages).toBeGreaterThanOrEqual(34);
      expect(mismatches).toEqual([]);
    },
    120_000,
  );
});
