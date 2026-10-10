// #145 — دروازهٔ معماری L0 برای @zenith/storage (الگوی #141/#143/#144/#146/#142).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const PKG = join('packages', 'storage');
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

describe('@zenith/storage L0 layering contract (#145)', () => {
  it('declares exactly @zenith/errors, @zenith/logger, @zenith/shared as dependencies', () => {
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps.sort()).toEqual(['@zenith/errors', '@zenith/logger', '@zenith/shared']);
    expect(pkg.peerDependencies).toBeUndefined();
    for (const banned of [
      '@zenith/state',
      '@zenith/scheduler',
      '@zenith/store',
      '@zenith/schema',
      '@zenith/i18n',
    ]) {
      expect(deps, banned).not.toContain(banned);
    }
  });

  it('src imports nothing from @zenith/* except errors/logger/shared', () => {
    const offenders: string[] = [];
    for (const file of srcFiles()) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/from\s*['"]@zenith\/([a-z0-9-]+)(?:\/[a-z-]+)?['"]/g)) {
        if (!['errors', 'logger', 'shared'].includes(m[1]!)) {
          offenders.push(`${file}: @zenith/${m[1]}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('is ESM-only per DEC-027 (born 1.5.0, no require condition) with /signal subpath', () => {
    expect(pkg.type).toBe('module');
    const entry = pkg.exports['.'];
    expect(entry.import).toBe('./dist/index.js');
    expect(entry.require).toBeUndefined();
    expect(pkg.exports['./signal'].import).toBe('./dist/signal.js');
    expect(pkg.exports['./signal'].require).toBeUndefined();
    expect(pkg.exports['./package.json']).toBe('./package.json');
    expect(pkg.version).toBe('1.5.0');
    expect(pkg.engines.node).toBe('>=18.19');
    expect(JSON.stringify(pkg.exports)).not.toContain('.cjs');
  });

  it('barrel has NO direct timers (debounce timer فقط در persist.ts مجاز است)', () => {
    const offenders: string[] = [];
    for (const file of srcFiles()) {
      if (file.endsWith('persist.ts')) continue;
      const text = readFileSync(file, 'utf8');
      for (const banned of ['setTimeout', 'setInterval', 'requestAnimationFrame']) {
        if (text.includes(banned)) offenders.push(`${file}: ${banned}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('window/document/localStorage only behind hasWindow/hasDOM or lazy access (no import-time use)', () => {
    // import-time scan: بدنهٔ top-level هیچ ماژولی نباید مستقیم window/document
    // را بخواند. بررسی سطحی: خط‌های top-level (بدون indent) outside functions.
    const offenders: string[] = [];
    for (const file of srcFiles()) {
      const lines = readFileSync(file, 'utf8').split('\n');
      for (const line of lines) {
        if (line.startsWith(' ') || line.startsWith('\t') || line.trimStart() !== line) continue;
        if (/^(export |const |let |import |function|\/\*|\*|\/\/)/.test(line)) {
          if (
            /\b(window|document|localStorage|sessionStorage)\b/.test(line) &&
            !/^\/\//.test(line) &&
            !/^import type/.test(line)
          ) {
            offenders.push(`${file}: ${line.trim()}`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no console.* anywhere in src (logger owns output; gate #143 ratchet)', () => {
    const src = srcFiles()
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    expect(src).not.toMatch(/\bconsole\./);
  });

  it('no Math.random in src (deterministic)', () => {
    const src = srcFiles()
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    expect(src).not.toContain('Math' + '.random');
  });

  it('storage errors come only from catalog ZEN-1101/1102/1103/1104 (+1201 ttl)', () => {
    const src = srcFiles()
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n');
    for (const code of ['ZEN-1101', 'ZEN-1102', 'ZEN-1103', 'ZEN-1104']) {
      expect(src, code).toContain(code);
    }
    expect(src).not.toMatch(/throw new Error\(/);
  });
});
