// #142 — دروازهٔ معماری L0 برای @zenith/schema (الگوی #141/#143/#144/#146).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const PKG = join('packages', 'schema');
const pkg = JSON.parse(readFileSync(join(PKG, 'package.json'), 'utf8'));

function srcFiles(dir = join(PKG, 'src')): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...srcFiles(p));
    else if (e.name.endsWith('.ts') && !e.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

describe('@zenith/schema L0 layering contract (#142)', () => {
  it('declares exactly @zenith/errors and @zenith/shared as dependencies', () => {
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps.sort()).toEqual(['@zenith/errors', '@zenith/shared']);
    // zod هرگز dep نیست (معیار پذیرش: «zod وابستگی اجباری نیست»)؛
    // ajv فقط در devDependencies ریشه برای تست meta-schema است، نه اینجا.
    expect(pkg.peerDependencies).toBeUndefined();
    expect(pkg.dependencies?.['zod']).toBeUndefined();
    expect(pkg.devDependencies?.['ajv']).toBeUndefined();
    expect(pkg.dependencies?.['ajv']).toBeUndefined();
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

  it('declares the SPEC §۲.۲ subpath exports /zod and /json-schema', () => {
    expect(pkg.exports['./zod'].import).toBe('./dist/zod.js');
    expect(pkg.exports['./zod'].types).toBe('./dist/zod.d.ts');
    expect(pkg.exports['./json-schema'].import).toBe('./dist/json-schema.js');
    expect(pkg.exports['./json-schema'].types).toBe('./dist/json-schema.d.ts');
  });

  it('src has NO console, DOM globals, timers or Math.random (pure, SSR-safe)', () => {
    const text = srcFiles()
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    for (const banned of [
      'console.',
      'setTimeout',
      'setInterval',
      'requestAnimationFrame',
      'window.',
      'document.',
      'Math' + '.random',
    ]) {
      expect(text, banned).not.toContain(banned);
    }
  });

  it('errors are only ZenithError via catalog codes (no raw throw new Error)', () => {
    const src = srcFiles()
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    expect(src).toContain("createReservedError('ZEN-1003'");
    expect(src).toContain('createReservedError(first.code');
    expect(src).not.toMatch(/throw new Error\(/);
    // TypeError مصرفیِ json-schema مجاز است (الگوی shared/assert.ts)؛ فقط
    // Error خام یا throw کد ثبت‌نشده ممنوع است.
    expect(src).not.toContain('new ZenithError(');
  });
});
