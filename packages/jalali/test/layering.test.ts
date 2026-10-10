// #146 — دروازهٔ معماری L0 برای @zenith/jalali (الگوی #141/#143/#144).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const PKG = join('packages', 'jalali');
const pkg = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8'));

function srcFiles(dir = join(PKG, 'src')) {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...srcFiles(p));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

describe('@zenith/jalali L0 layering contract (#146)', () => {
  it('declares exactly @zenith/errors and @zenith/shared as dependencies', () => {
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps.sort()).toEqual(['@zenith/errors', '@zenith/shared']);
    expect(pkg.peerDependencies).toBeUndefined();
    for (const banned of ['@zenith/state', '@zenith/scheduler', '@zenith/i18n']) {
      expect(deps, banned).not.toContain(banned);
    }
  });

  it('src imports nothing from @zenith/* except errors and shared', () => {
    const offenders: string[] = [];
    for (const file of srcFiles()) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/from\s*['"]@zenith\/([a-z0-9-]+)['"]/g)) {
        if (m[1] !== 'errors' && m[1] !== 'shared') offenders.push(`${file}: @zenith/${m[1]}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('is ESM-only per DEC-027 (born 1.5.0, no require condition)', () => {
    expect(pkg.type).toBe('module');
    const entry = pkg.exports['.'];
    expect(entry.import).toBe('./dist/index.js');
    expect(entry.require).toBeUndefined();
    expect(pkg.exports['./package.json']).toBe('./package.json');
    expect(pkg.version).toBe('1.5.0');
    expect(pkg.engines.node).toBe('>=18.19');
    expect(JSON.stringify(pkg.exports)).not.toContain('.cjs');
  });

  it('src has NO timers and NO window/document (pure calendar, SSR-safe)', () => {
    const text = srcFiles()
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    for (const banned of [
      'setTimeout',
      'setInterval',
      'requestAnimationFrame',
      'window.',
      'document.',
    ]) {
      expect(text, banned).not.toContain(banned);
    }
  });

  it('no Math.random in src (deterministic; تست‌ها seed ثابت دارند)', () => {
    const src = srcFiles()
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    expect(src).not.toContain('Math' + '.random');
  });

  it('errors are only ZenithError via catalog codes 1301/1302/1303 (SPEC §۲.۶)', () => {
    const src = srcFiles()
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    expect(src).toContain("createReservedError('ZEN-1301'");
    expect(src).toContain("createReservedError('ZEN-1302'");
    expect(src).toContain("createReservedError('ZEN-1303'");
    expect(src).not.toMatch(/throw new Error\(/);
  });
});
