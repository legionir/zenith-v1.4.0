// #147 — دروازهٔ معماری L1 برای @zenith/devtools-core (SPEC §۲.۷).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const pkgDir = join(process.cwd(), 'packages/devtools-core');
const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'));

describe('@zenith/devtools-core L1 layering contract (#147)', () => {
  it('declares only L0 runtime dependencies and @zenith/state as peerDependency', () => {
    const deps = Object.keys(pkg.dependencies ?? {}).sort();
    expect(deps).toEqual(['@zenith/errors', '@zenith/schema', '@zenith/shared']);
    expect(pkg.peerDependencies).toEqual({
      '@zenith/state': '^1.4.0',
    });
  });

  it('is born 1.5.0 and ESM-only per DEC-026 / DEC-027', () => {
    expect(pkg.version).toBe('1.5.0');
    expect(pkg.type).toBe('module');
    expect(pkg.main).toBe('./dist/index.js');
    expect(pkg.exports['.'].require).toBeUndefined();
  });

  it('@zenith/state does not depend on @zenith/devtools or @zenith/devtools-core (no cycle)', () => {
    const statePkg = JSON.parse(
      readFileSync(join(process.cwd(), 'packages/state/package.json'), 'utf8'),
    );
    const stateDeps = [
      ...Object.keys(statePkg.dependencies ?? {}),
      ...Object.keys(statePkg.peerDependencies ?? {}),
    ];
    expect(stateDeps).not.toContain('@zenith/devtools');
    expect(stateDeps).not.toContain('@zenith/devtools-core');
  });
});
