// Tests for the LICENSE policy (#68).
// Root MIT license file, an identical copy in every workspace package (so
// every npm tarball carries it), and the sync script's --check mode.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { describe, it, expect } from 'vitest';

const rootLicense = readFileSync('LICENSE', 'utf8');

const dirs = readdirSync('packages', { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .filter((d) => existsSync(join('packages', d.name, 'package.json')))
  .map((d) => d.name);

describe('LICENSE (#68)', () => {
  it('root LICENSE is the MIT text with a copyright line', () => {
    expect(rootLicense).toContain('MIT License');
    expect(rootLicense).toMatch(/Copyright \(c\) \d{4} Zenith Team/);
  });

  it.each(dirs)('%s package carries an identical LICENSE', (dir) => {
    const p = join('packages', dir, 'LICENSE');
    expect(existsSync(p), p).toBe(true);
    expect(readFileSync(p, 'utf8')).toBe(rootLicense);
  });

  it('every package declares license MIT', () => {
    for (const dir of dirs) {
      const pkg = JSON.parse(readFileSync(join('packages', dir, 'package.json'), 'utf8'));
      expect(pkg.license, dir).toBe('MIT');
    }
  });

  it('sync script --check passes on a fresh tree', () => {
    expect(() =>
      execFileSync(process.execPath, ['scripts/sync-license.mjs', '--check'], { stdio: 'pipe' }),
    ).not.toThrow();
  });

  it('npm pack includes the LICENSE (state)', () => {
    // Deterministic: --json reports the tarball inventory regardless of the
    // inherited loglevel (a parent `npm test --silent` otherwise suppresses
    // npm's stderr notices). "packages/state" without ./ would be read as a
    // git spec, so the path form matters.
    const r = spawnSync('npm', ['pack', '--dry-run', '--json', './packages/state'], {
      encoding: 'utf8',
    });
    expect(r.status).toBe(0);
    const packed = JSON.parse(r.stdout);
    expect(
      packed[0].files.some((f) => f.path === 'LICENSE'),
      'LICENSE in tarball',
    ).toBe(true);
  });
});
