// #148 — دروازهٔ معماری L3 برای @zenith/runtime-core (SPEC §۲.۸).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const pkgDir = join(process.cwd(), 'packages/runtime-core');
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));

describe('@zenith/runtime-core L3 layering contract (#148)', () => {
  it('depends only on L0..L2 core packages and declares state/scheduler as peers', () => {
    const deps = Object.keys(pkg.dependencies ?? {}).sort();
    expect(deps).toEqual([
      '@zenith/errors',
      '@zenith/expressions',
      '@zenith/logger',
      '@zenith/schema',
      '@zenith/security',
      '@zenith/shared',
    ]);
    expect(pkg.peerDependencies).toEqual({
      '@zenith/scheduler': '^1.4.0',
      '@zenith/state': '^1.4.0',
    });
  });

  it('is born 1.5.0 and ESM-only per DEC-026 / DEC-027', () => {
    expect(pkg.version).toBe('1.5.0');
    expect(pkg.type).toBe('module');
    expect(pkg.main).toBe('./dist/index.js');
    expect(pkg.exports['.'].require).toBeUndefined();
  });
});
