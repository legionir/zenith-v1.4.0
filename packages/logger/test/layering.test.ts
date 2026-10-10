// #143 — دروازهٔ معماری L0 برای @zenith/logger (الگوی #141/shared).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const PKG = join('packages', 'logger');
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

describe('@zenith/logger L0 layering contract (#143)', () => {
  it('declares exactly @zenith/errors and @zenith/shared as dependencies', () => {
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps.sort()).toEqual(['@zenith/errors', '@zenith/shared']);
    expect(pkg.peerDependencies).toBeUndefined();
    for (const banned of ['@zenith/state', '@zenith/scheduler', '@zenith/error-boundary']) {
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

  it('is ESM-only per DEC-027 (no require condition, new package born 1.5.0)', () => {
    expect(pkg.type).toBe('module');
    const entry = pkg.exports['.'];
    expect(entry.import).toBe('./dist/index.js');
    expect(entry.require).toBeUndefined();
    expect(pkg.exports['./package.json']).toBe('./package.json');
    expect(pkg.version).toBe('1.5.0');
    expect(pkg.engines.node).toBe('>=18.19');
    expect(pkg.main.endsWith('.cjs')).toBe(false);
    expect(JSON.stringify(pkg.exports)).not.toContain('.cjs');
  });

  it('has no direct dependency on error-boundary — reportError stays a runtime duck (SPEC §۲.۳ «در صورت وجود»)', () => {
    // error-boundary لایهٔ بالاتر است؛ logger فقط globalThis.reportError را
    // در زمان اجرا بررسی می‌کند (بدون import) تا یال L0→L2 ساخته نشود.
    const text = srcFiles()
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    expect(text).not.toContain('@zenith/error-boundary');
    expect(text).toContain('reportError');
  });
});
