// Tests for the engines floor (#14, AUDIT.md A10).
// process.getBuiltinModule (router SSR isolation) needs Node 18.19+, so the
// declared floor must be >=18.19 everywhere: root, every package, and the
// lockfile. This test is the executable contract for that decision.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const EXPECTED = '>=18.19';

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

describe('engines.node floor (#14)', () => {
  it('root package.json declares the floor', () => {
    expect(readJson('package.json').engines?.node).toBe(EXPECTED);
  });

  it('every workspace package declares the same floor', () => {
    const dirs = readdirSync('packages', { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .filter((d) => {
        try {
          readJson(join('packages', d.name, 'package.json'));
          return true;
        } catch {
          return false;
        }
      })
      .map((d) => d.name);

    expect(dirs.length).toBeGreaterThanOrEqual(35);
    for (const dir of dirs) {
      const pkg = readJson(join('packages', dir, 'package.json'));
      expect(pkg.engines?.node, `${dir} engines`).toBe(EXPECTED);
    }
  });

  it('lockfile root entry matches', () => {
    const lock = readJson('package-lock.json');
    expect(lock.packages?.['']?.engines?.node).toBe(EXPECTED);
  });

  it('CI matrix covers the floor and the current LTS', () => {
    const wf = readFileSync('.github/workflows/main.yml', 'utf8');
    // Node 18 on GitHub runners resolves to the newest 18.x (>=18.19), and 22
    // is the active LTS — both must appear in the build matrix.
    expect(wf).toMatch(/node: \['18', '22'\]/);
  });
});
