import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const pkgDir = resolve(__dirname, '..');

describe('zenith L5 layering & peer contract (#149)', () => {
  it('declares @zenith/state and @zenith/scheduler as peerDependencies (DEC-018)', () => {
    const pkg = JSON.parse(readFileSync(resolve(pkgDir, 'package.json'), 'utf8'));
    expect(pkg.peerDependencies).toEqual({
      '@zenith/scheduler': '^1.4.0',
      '@zenith/state': '^1.4.0',
    });
    expect(pkg.dependencies?.['@zenith/state']).toBeUndefined();
    expect(pkg.dependencies?.['@zenith/scheduler']).toBeUndefined();
  });

  it('declares all SPEC §2.9 subpath exports', () => {
    const pkg = JSON.parse(readFileSync(resolve(pkgDir, 'package.json'), 'utf8'));
    expect(Object.keys(pkg.exports)).toEqual([
      '.',
      './core',
      './ssr',
      './testing',
      './presets/minimal',
      './presets/spa',
      './presets/full',
      './browser',
      './package.json',
    ]);
  });
});
