// #144 — دروازهٔ معماری L0 برای @zenith/cache (الگوی #141/shared، #143/logger).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const PKG = join('packages', 'cache');
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

describe('@zenith/cache L0 layering contract (#144)', () => {
  it('declares exactly @zenith/errors and @zenith/shared as dependencies', () => {
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps.sort()).toEqual(['@zenith/errors', '@zenith/shared']);
    expect(pkg.peerDependencies).toBeUndefined();
    // state/scheduler peer نیست — cache ساختار داده خالص است و signal از
    // طریق adapter تزریق می‌شود (DEC-021/#141).
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

  it('src has NO timers and NO window/document access (SPEC §۲.۴ lazy expiry, SSR-safe)', () => {
    const text = srcFiles()
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    expect(text).not.toMatch(/\bsetTimeout\b/);
    expect(text).not.toMatch(/\bsetInterval\b/);
    expect(text).not.toMatch(/\brequestIdleCallback\b/);
    expect(text).not.toMatch(/\bwindow\b|\bdocument\b/);
    expect(text).not.toMatch(/\bconsole\./); // قاعدهٔ no-console (#143) — cache مصرف‌کننده logger نیست
  });

  it('signal stays an adapter seam — src contains no @zenith/state edge', () => {
    const text = srcFiles()
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    expect(text).not.toContain('@zenith/state');
    expect(text).toContain('setSignalAdapter');
  });

  it('sideEffects:false is honest — no top-level effect statements in src', () => {
    // الگوی SIDE_EFFECT_RE در scripts/test/side-effects: هیچ فراخوانی لایهٔ
    // بالا (ستون ۰) در src وجود ندارد؛ رجیستری فقط lazy است.
    for (const file of srcFiles()) {
      const text = readFileSync(file, 'utf8');
      const offenders = text
        .split('\n')
        .filter((l) => /^[A-Za-z_$][\w$]*\s*\(/.test(l) && !/^(export|import)/.test(l));
      expect(offenders, file).toEqual([]);
    }
  });
});
