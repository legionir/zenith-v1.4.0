import { describe, it, expect } from 'vitest';
import {
  TEMPLATE_FIXTURE_KINDS,
  kindPort,
  rewriteZenithDeps,
  snapshotDiff,
} from '../build-template-fixtures.mjs';

describe('template fixture builder contract (#33)', () => {
  it('covers exactly the five engine template kinds on distinct loopback ports', () => {
    expect([...TEMPLATE_FIXTURE_KINDS].sort()).toEqual([
      'dashboard',
      'minimal',
      'pwa',
      'spa',
      'ssr',
    ]);
    const ports = TEMPLATE_FIXTURE_KINDS.map(kindPort);
    expect(new Set(ports).size).toBe(5);
    for (const port of ports) {
      expect(port).toBeGreaterThanOrEqual(8091);
      expect(port).toBeLessThan(8100);
    }
    expect(() => kindPort('unknown')).toThrow(/unknown kind/);
  });

  it('rewrites every @zenith/* range to this-SHA file: tarballs and nothing else', () => {
    const pkg = {
      dependencies: { '@zenith/state': '^1.4.0', '@zenith/runtime': '^1.4.0' },
      devDependencies: { '@zenith/vite-plugin': '^1.4.0', vite: '^6.4.4', typescript: '^5.4.0' },
    };
    const seen = [];
    const { rewritten, tarballs } = rewriteZenithDeps(pkg, (name) => {
      seen.push(name);
      return `/tmp/tarballs/${name.replace('@zenith/', 'zenith-')}-1.4.0.tgz`;
    });
    expect(tarballs).toEqual(['@zenith/runtime', '@zenith/state', '@zenith/vite-plugin']);
    expect(rewritten.dependencies['@zenith/state']).toMatch(/^file:.*zenith-state-1\.4\.0\.tgz$/);
    // Registry-owned ranges pass through untouched.
    expect(rewritten.devDependencies.vite).toBe('^6.4.4');
    expect(rewritten.devDependencies.typescript).toBe('^5.4.0');
    expect(seen.sort()).toEqual(tarballs);
  });

  it('fails closed when a @zenith/* dependency has no packed tarball', () => {
    expect(() =>
      rewriteZenithDeps({ dependencies: { '@zenith/state': '^1.4.0' } }, () => undefined),
    ).toThrow(/no tarball packed/);
  });

  it('passes an identical scaffold and reports missing/extra/changed files', () => {
    const manifest = { 'package.json': '{}', 'index.html': '<html>' };
    expect(snapshotDiff({ ...manifest }, manifest)).toEqual([]);
    // Intentional template bug: changed content breaks the gate (negative control).
    expect(snapshotDiff({ 'package.json': '{}', 'index.html': '<html-bug>' }, manifest)).toEqual([
      'changed: index.html',
    ]);
    expect(snapshotDiff({ 'package.json': '{}' }, manifest)).toEqual(['missing: index.html']);
    expect(snapshotDiff({ ...manifest, 'rogue.js': 'x' }, manifest)).toEqual(['extra: rogue.js']);
  });
});
