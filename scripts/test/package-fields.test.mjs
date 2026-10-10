// Tests for package.json completeness (#70).
// Contract: every workspace package declares repository (with directory),
// homepage, bugs, publishConfig (public + provenance) and sideEffects; the
// CI validator script enforces the same thing.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

function packageDirs() {
  return readdirSync('packages', { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .filter((d) => existsSync(join('packages', d.name, 'package.json')))
    .map((d) => d.name);
}

describe('package.json fields (#70)', () => {
  const dirs = packageDirs();

  it('covers all 38 packages', () => {
    expect(dirs).toHaveLength(38);
  });

  it.each(dirs)('%s has repository with directory', (dir) => {
    const pkg = JSON.parse(readFileSync(join('packages', dir, 'package.json'), 'utf8'));
    expect(pkg.repository, `${dir}: repository`).toBeTypeOf('object');
    expect(pkg.repository.url).toContain('github.com/legionir/zenith-v1.4.0');
    expect(pkg.repository.directory).toBe(`packages/${dir}`);
  });

  it.each(dirs)('%s has homepage and bugs', (dir) => {
    const pkg = JSON.parse(readFileSync(join('packages', dir, 'package.json'), 'utf8'));
    expect(pkg.homepage, `${dir}: homepage`).toContain('github.com/legionir/zenith-v1.4.0');
    expect(pkg.bugs, `${dir}: bugs`).toBeTypeOf('object');
    expect(pkg.bugs.url).toContain('github.com/legionir/zenith-v1.4.0');
  });

  it.each(dirs)('%s has publishConfig (public access; provenance except vscode)', (dir) => {
    const pkg = JSON.parse(readFileSync(join('packages', dir, 'package.json'), 'utf8'));
    expect(pkg.publishConfig, `${dir}: publishConfig`).toBeTypeOf('object');
    expect(pkg.publishConfig.access).toBe('public');
    if (pkg.name !== 'zenith-vscode') {
      expect(pkg.publishConfig.provenance, `${dir}: provenance`).toBe(true);
    }
  });

  it.each(dirs)('%s declares sideEffects', (dir) => {
    const pkg = JSON.parse(readFileSync(join('packages', dir, 'package.json'), 'utf8'));
    // either `false` or an explicit glob list; both are valid declarations
    const value = pkg.sideEffects;
    const ok =
      value === false || (Array.isArray(value) && value.every((g) => typeof g === 'string'));
    expect(ok, `${dir}: sideEffects must be false or string[]`).toBe(true);
  });

  it('CI validator script exists and passes', async () => {
    const { execFileSync } = await import('node:child_process');
    expect(existsSync('scripts/validate-package-fields.mjs')).toBe(true);
    expect(() =>
      execFileSync(process.execPath, ['scripts/validate-package-fields.mjs'], { stdio: 'pipe' }),
    ).not.toThrow();
  });
});
