// Tests for scripts/unused-zenith-deps.mjs (#45).
// Synthetic workspace fixtures in a temp dir:
//  1. declared-but-never-imported @zenith dep → reported (any field),
//  2. static/type/dynamic/re-export imports → NOT reported,
//  3. mention only inside comments (line or block) → still reported,
//  4. real repo packages → zero unused (acceptance criterion).
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { findUnused } from '../unused-zenith-deps.mjs';

function makePkg(root, name, pkgJson, files) {
  const dir = join(root, 'packages', name);
  mkdirSync(join(dir, 'src'), { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify(pkgJson));
  for (const [f, content] of Object.entries(files)) {
    writeFileSync(join(dir, 'src', f), content);
  }
  return dir;
}

let tmp;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), 'zen-unused-'));
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe('findUnused (synthetic fixtures)', () => {
  it('reports declared deps with no import', () => {
    const root = join(tmp, 'a');
    makePkg(
      root,
      'alpha',
      { name: '@zenith/alpha', dependencies: { '@zenith/beta': '1.0.0' } },
      { 'index.ts': `export const x = 1;\n` },
    );
    makePkg(root, 'beta', { name: '@zenith/beta' }, { 'index.ts': `export const y = 2;\n` });
    const { problems } = findUnused(join(root, 'packages'));
    expect(problems).toEqual([{ pkg: 'alpha', field: 'dependencies', dep: '@zenith/beta' }]);
  });

  it('accepts static, type-only, dynamic and re-export imports', () => {
    const root = join(tmp, 'b');
    makePkg(
      root,
      'alpha',
      {
        name: '@zenith/alpha',
        dependencies: {
          '@zenith/beta': '1.0.0',
          '@zenith/gamma': '1.0.0',
          '@zenith/delta': '1.0.0',
          '@zenith/eps': '1.0.0',
        },
      },
      {
        'index.ts':
          `import { b } from '@zenith/beta';\n` +
          `import type { G } from '@zenith/gamma';\n` +
          `const load = async () => await import('@zenith/delta');\n` +
          `export * from '@zenith/eps';\n` +
          `void b; type _ = G; void load;\n`,
      },
    );
    for (const n of ['beta', 'gamma', 'delta', 'eps']) {
      makePkg(root, n, { name: `@zenith/${n}` }, { 'index.ts': `export const v = 1;\n` });
    }
    const { problems } = findUnused(join(root, 'packages'));
    expect(problems).toEqual([]);
  });

  it('does not count comment-only mentions as usage', () => {
    const root = join(tmp, 'c');
    makePkg(
      root,
      'alpha',
      { name: '@zenith/alpha', dependencies: { '@zenith/beta': '1.0.0' } },
      {
        'index.ts':
          `// usage: import { x } from '@zenith/beta';\n` +
          `/* multiline — import { y } from '@zenith/beta'; */\n` +
          `export const z = 3;\n`,
      },
    );
    makePkg(root, 'beta', { name: '@zenith/beta' }, { 'index.ts': `export const v = 1;\n` });
    const { problems } = findUnused(join(root, 'packages'));
    expect(problems.length).toBe(1);
    expect(problems[0].dep).toBe('@zenith/beta');
  });

  it('ignores non-zenith deps and non-zenith package names', () => {
    const root = join(tmp, 'd');
    const dir = makePkg(
      root,
      'alpha',
      { name: 'not-zenith', dependencies: { '@zenith/beta': '1.0.0', lodash: '4' } },
      { 'index.ts': `export const x = 1;\n` },
    );
    void dir;
    makePkg(root, 'beta', { name: '@zenith/beta' }, { 'index.ts': `export const v = 1;\n` });
    const { problems, checked } = findUnused(join(root, 'packages'));
    expect(problems).toEqual([]);
    expect(checked).toBe(1); // only @zenith/beta counted
  });
});

describe('real repo workspace', () => {
  const repoPackages = join(process.cwd(), 'packages');

  it('has zero unused @zenith declarations in every package (#45 acceptance)', () => {
    const { checked, problems } = findUnused(repoPackages);
    expect(checked).toBeGreaterThanOrEqual(34);
    if (problems.length > 0) {
      throw new Error(
        'unused deps:\n' + problems.map((p) => `  ${p.pkg} [${p.field}] ${p.dep}`).join('\n'),
      );
    }
    expect(problems).toEqual([]);
  });
});
