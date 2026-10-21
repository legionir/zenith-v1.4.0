// scripts/test/unique-export-names.test.mjs
//
// #119 — گیت «یک نام، یک معنا»: تست‌های مثبت، منفی و اعتبارسنجی allowlist.

import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { describe, it, expect, afterAll } from 'vitest';

import { collectWorkspaceExports } from '../lib/public-exports.mjs';
import {
  ALLOWED_STATUSES,
  ALLOWLIST_PATH,
  auditUniqueExportNames,
  findLocalCollisions,
  loadAllowlist,
} from '../check-unique-export-names.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const probes = [];

/** یک workspace مصنوعی می‌سازد: { pkg: { name: source } } */
function makeProbe(packages) {
  const root = mkdtempSync(join(tmpdir(), 'zenith-unique-'));
  probes.push(root);
  for (const [pkg, files] of Object.entries(packages)) {
    const src = join(root, 'packages', pkg, 'src');
    mkdirSync(src, { recursive: true });
    writeFileSync(join(src, 'index.ts'), files);
  }
  return root;
}

afterAll(() => {
  for (const p of probes) rmSync(p, { recursive: true, force: true });
});

describe('#119 — unique public export names', () => {
  it('workspace فعلی هیچ نام تکراریِ بدون استثنا ندارد', () => {
    const report = auditUniqueExportNames({ root: ROOT });
    expect(report.violations).toEqual([]);
    expect(report.stale).toEqual([]);
    // قرارداد فعلی: DEFAULTS + ۱۱ نام لایه‌ای مستند
    expect(report.collisions).toBeGreaterThanOrEqual(12);
    expect(report.names).toContain('DEFAULTS');
  });

  it('هر نام مشترک واقعاً در ≥۲ پکیج تعریف محلی دارد (نه facade)', () => {
    const collisions = findLocalCollisions(ROOT);
    const byName = collectWorkspaceExports(ROOT);
    for (const [name, pkgs] of collisions) {
      const all = byName.get(name) ?? [];
      const facades = all.filter((e) => e.origin === 'facade');
      // facadeها نباید تخلف بسازند
      for (const f of facades) expect(pkgs.map((p) => p.pkg)).not.toContain(f.pkg);
      expect(new Set(pkgs.map((p) => p.pkg)).size).toBeGreaterThanOrEqual(2);
    }
  });

  it('allowlist هر نام مشترک را پوشش می‌دهد و ردیف بی‌استفاده ندارد', () => {
    const entries = loadAllowlist(ROOT);
    const collisions = findLocalCollisions(ROOT);
    expect(entries.map((e) => e.name).sort()).toEqual([...collisions.keys()].sort());
    for (const e of entries) {
      expect(ALLOWED_STATUSES).toContain(e.status);
      expect(e.reason.length).toBeGreaterThan(10);
    }
  });

  // ── تست منفی: نام تکراری تازه باید گیت را قرمز کند ──
  it('یک نام تعریف‌شده در دو پکیج را تخلف می‌داند (probe)', () => {
    const root = makeProbe({
      alpha: 'export function duplicated(): void {}\n',
      beta: 'export function duplicated(): void {}\n',
    });
    const report = auditUniqueExportNames({ root, allowlist: [] });
    expect(report.collisions).toBe(1);
    expect(report.violations).toHaveLength(1);
    expect(report.violations[0].name).toBe('duplicated');
    expect(report.violations[0].uncovered.sort()).toEqual(['alpha:function', 'beta:function']);
  });

  it('re-export از پکیج دیگر (facade) تخلف نیست (probe)', () => {
    const root = makeProbe({
      alpha: 'export function sharedHelper(): void {}\n',
      beta: "export { sharedHelper } from '@zenith/alpha';\n",
    });
    const report = auditUniqueExportNames({ root, allowlist: [] });
    expect(report.collisions).toBe(0);
    expect(report.violations).toEqual([]);
  });

  it('alias با JSDoc @deprecated تخلف نیست (probe)', () => {
    const root = makeProbe({
      alpha: 'export function newName(): void {}\n',
      beta: '/**\n * @deprecated استفاده از newName\n */\nexport function newName(): void {}\n',
    });
    const report = auditUniqueExportNames({ root, allowlist: [] });
    expect(report.violations).toEqual([]);
  });

  it('ردیف allowlist باید پکیج‌ها را کامل پوشش دهد (probe)', () => {
    const root = makeProbe({
      alpha: 'export const shared = 1;\n',
      beta: 'export const shared = 2;\n',
    });
    const partial = auditUniqueExportNames({
      root,
      allowlist: [
        {
          name: 'shared',
          packages: ['alpha'],
          status: 'convention',
          reason: 'پوشش ناقص برای تست',
        },
      ],
    });
    expect(partial.violations).toHaveLength(1);
    expect(partial.violations[0].uncovered).toEqual(['beta:const']);

    const full = auditUniqueExportNames({
      root,
      allowlist: [
        { name: 'shared', packages: '*', status: 'convention', reason: 'پوشش کامل برای تست' },
      ],
    });
    expect(full.violations).toEqual([]);
  });

  it('ردیف بی‌استفاده (stale) گزارش می‌شود', () => {
    const root = makeProbe({ alpha: 'export const only = 1;\n' });
    const report = auditUniqueExportNames({
      root,
      allowlist: [
        { name: 'gone', packages: '*', status: 'convention', reason: 'دیگر تکراری نیست' },
      ],
    });
    expect(report.stale).toEqual(['gone']);
  });

  it.each([
    [
      'وضعیت نامعتبر',
      { name: 'x', packages: '*', status: 'whatever', reason: 'دلیل کافی برای تست' },
    ],
    ['بدون دلیل', { name: 'x', packages: '*', status: 'convention', reason: 'کوتاه' }],
    ['بدون packages', { name: 'x', status: 'convention', reason: 'دلیل کافی برای تست' }],
  ])('allowlist خراب رد می‌شود: %s', (_label, entry) => {
    const root = makeProbe({ alpha: 'export const x = 1;\n' });
    const file = join(root, ALLOWLIST_PATH);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ entries: [entry] }));
    expect(() => loadAllowlist(root)).toThrow();
    expect(readFileSync(file, 'utf8')).toContain('x');
  });
});
