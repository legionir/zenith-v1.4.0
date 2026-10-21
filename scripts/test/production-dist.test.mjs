// scripts/test/production-dist.test.mjs
// #57 — published artifacts are production builds: `__ZENITH_DEV__` must not
// survive in shipped JS. The define in scripts/build-package.mjs only fires
// with NODE_ENV=production, and no release/CI path set it — so the build
// entry points now default to production (this file pins that), the browser
// bundle defines it unconditionally, and a dist scan (on built workspaces)
// fails on any remnant.
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isFullyBuilt } from '../lib/workspace.mjs';

const ROOT = process.cwd();
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

function distJsFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of readdirSync(dir)) {
      const p = join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.c?js$/.test(e) && !e.endsWith('.map')) out.push(p);
    }
  };
  for (const d of readdirSync(join(ROOT, 'packages'), { withFileTypes: true })) {
    if (!d.isDirectory() || d.name.startsWith('tmp-')) continue;
    const dist = join(ROOT, 'packages', d.name, 'dist');
    if (existsSync(dist)) walk(dist);
  }
  return out;
}

describe('#57 — production builds strip __ZENITH_DEV__', () => {
  it('defaults the artifact producers to NODE_ENV=production (opt-out, not opt-in)', () => {
    for (const script of ['scripts/build-all.mjs', 'scripts/build-tools.mjs']) {
      expect(read(script), script).toContain("process.env.NODE_ENV ??= 'production'");
    }
    // The release preflight (`npm run build`) inherits this default — no
    // separate env plumbing in scripts/release.mjs to drift.
    expect(read('scripts/build-package.mjs')).toContain("__ZENITH_DEV__: 'false'");
  });

  it('defines production unconditionally in the published browser bundle', () => {
    const bundle = read('scripts/build-browser-bundle.mjs');
    expect(bundle).toContain("__ZENITH_DEV__: 'false'");
    expect(bundle).toContain("'globalThis.__ZENITH_DEV__': 'false'");
  });

  it.skipIf(!isFullyBuilt(ROOT))('no shipped JS still references __ZENITH_DEV__', () => {
    const remnants = [];
    for (const file of distJsFiles()) {
      const text = readFileSync(file, 'utf8');
      if (text.includes('__ZENITH_DEV__')) {
        remnants.push(file.slice(ROOT.length + 1));
      }
    }
    expect(remnants).toEqual([]);
  });
});
