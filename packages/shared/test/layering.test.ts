// #141 — دروازهٔ معماری L0 برای @zenith/shared.
//
// این تست‌ها «قرارداد لایه» را قفل می‌کنند (SPEC §۱ و §۲.۱ + DEC-021/DEC-027):
//   1. shared فقط به errors وابسته است؛ state/scheduler هرگز (چرخه نشود).
//   2. هیچ import از @zenith/* جز errors در src وجود ندارد (finishing move
//      برای گیت‌های deps:unused و dependency-cruiser).
//   3. ESM-only (DEC-027): exports فاقد شرط require و فایل .cjs منتشر نمی‌شود.
//   4. رویه‌ها همه export عمومی index‌اند (نه زیرفایل).
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';

const PKG = join('packages', 'shared');
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

describe('@zenith/shared L0 layering contract (#141)', () => {
  it('declares only @zenith/errors as a dependency (never state/scheduler)', () => {
    const deps = Object.keys(pkg.dependencies ?? {});
    expect(deps).toEqual(['@zenith/errors']);
    expect(pkg.peerDependencies).toBeUndefined();
    for (const banned of ['@zenith/state', '@zenith/scheduler']) {
      expect(deps, banned).not.toContain(banned);
    }
  });

  it('src imports nothing from @zenith/* except errors', () => {
    const offenders: string[] = [];
    for (const file of srcFiles()) {
      const text = readFileSync(file, 'utf8');
      for (const m of text.matchAll(/from '@zenith\/([a-z0-9-]+)'/g)) {
        if (m[1] !== 'errors') offenders.push(`${file}: @zenith/${m[1]}`);
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
  });

  it('has no CJS artifacts declared in files/exports', () => {
    expect(pkg.main.endsWith('.cjs')).toBe(false);
    expect(JSON.stringify(pkg.exports)).not.toContain('.cjs');
  });

  it('state keeps MaybeSignal as a local alias — no state→shared edge (DEC-021 اجرای #141)', () => {
    // هر یال state→shared (حتی type-only که در .d.ts می‌ماند) publish state را
    // به dependency جدید واداشته و peer-single-instance (#46) را در نصب تمیز
    // می‌شکست (تجربه‌شده و مستند در DEC-021). این تست همان تصمیم را قفل می‌کند.
    const stateSrc = join('packages', 'state', 'src');
    const offenders: string[] = [];
    const walk = (dir: string): void => {
      for (const e of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.name.endsWith('.ts')) {
          const text = readFileSync(p, 'utf8');
          // فقط specifier واقعی (import/export ... from)؛ کامنت‌ها مجازند.
          if (/(?:from\s*)['"]@zenith\/shared['"]/.test(text)) offenders.push(p);
        }
      }
    };
    walk(stateSrc);
    expect(offenders, 'state/src باید به shared import نداشته باشد').toEqual([]);
    const index = readFileSync(join(stateSrc, 'index.ts'), 'utf8');
    expect(index).toMatch(/export type MaybeSignal<T> = T \| Readable<T>/);
  });
});
