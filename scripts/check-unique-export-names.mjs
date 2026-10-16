#!/usr/bin/env node
// scripts/check-unique-export-names.mjs
//
// #119 — گیت «یک نام، یک معنا» روی سطح عمومی پکیج‌های workspace.
//
// قاعده (acceptance #119):
//   «یک نام export عمومی در دو پکیج نباید **دو معنا** داشته باشد.»
//
// چه چیزی تخلف است؟
//   نامی که در ≥۲ پکیج **در همان پکیج تعریف شده** (origin = local) و tag آن
//   `public` است. re-export از پکیج دیگر (origin = facade) تخلف نیست — آن
//   پکیج صرفاً چتر/facade است (`zenith` → بقیه) و نام یکی است.
//   نام‌های `@deprecated` (aliasهای مهاجرت، DEC-026) و `@internal` هم شمرده
//   نمی‌شوند: آن‌ها عمداً موقت‌اند و در ۲.۰ حذف می‌شوند.
//
// استثناها فقط از فایل allowlist می‌آیند و هر ردیف **باید** `reason` و
// `status` داشته باشد؛ ردیف اضافی (stale) هم خطاست تا فهرست واقعی بماند.
//
// اجرا:
//   node scripts/check-unique-export-names.mjs           # گیت (exit 1 روی تخلف)
//   node scripts/check-unique-export-names.mjs --json    # برای ابزار/تست
//   node scripts/check-unique-export-names.mjs --list    # چاپ همهٔ برخوردها

import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { collectWorkspaceExports } from './lib/public-exports.mjs';

/** مسیر پیش‌فرض allowlist. */
export const ALLOWLIST_PATH = join('scripts', 'unique-export-names.allowlist.json');

/** وضعیت‌های مجاز برای یک ردیف allowlist. */
export const ALLOWED_STATUSES = [
  // یک نام، یک معنا — دو پیاده‌سازی لایه‌ای (مثلاً L0 بدون وابستگی به L1)
  'same-meaning',
  // یک نام، مفهوم مشترک اما دامنهٔ متفاوت (پکیج X روی پکیج Y را می‌پوشاند)
  'layered',
  // قرارداد پکیج‌محور: هر پکیج DEFAULTS خودش را دارد (API-CONVENTIONS §3)
  'convention',
];

/**
 * برخوردهای «محلی در ≥۲ پکیج» را برمی‌گرداند.
 *
 * @param {string} root ریشهٔ workspace
 * @returns {Map<string, Array<{pkg: string, kind: string, tag: string}>>}
 */
export function findLocalCollisions(root = process.cwd()) {
  const byName = collectWorkspaceExports(root);
  const collisions = new Map();
  for (const [name, entries] of byName) {
    const local = entries.filter((e) => e.origin === 'local' && e.tag === 'public');
    if (local.length < 2) continue;
    collisions.set(
      name,
      local.map((e) => ({ pkg: e.pkg, kind: e.kind, tag: e.tag })),
    );
  }
  return collisions;
}

/** خواندن allowlist (با اعتبارسنجی شکل). */
export function loadAllowlist(root = process.cwd(), path = ALLOWLIST_PATH) {
  const raw = JSON.parse(readFileSync(resolve(root, path), 'utf8'));
  const entries = raw.entries ?? [];
  for (const entry of entries) {
    if (typeof entry.name !== 'string' || !entry.name) {
      throw new Error('allowlist#119: هر ردیف باید «name» داشته باشد.');
    }
    if (!ALLOWED_STATUSES.includes(entry.status)) {
      throw new Error(
        `allowlist#119: وضعیت نامعتبر برای «${entry.name}»: ${String(entry.status)} ` +
          `(مجاز: ${ALLOWED_STATUSES.join(' | ')})`,
      );
    }
    if (typeof entry.reason !== 'string' || entry.reason.trim().length < 10) {
      throw new Error(`allowlist#119: «${entry.name}» باید reason توضیحی داشته باشد.`);
    }
    if (!('packages' in entry)) {
      throw new Error(`allowlist#119: «${entry.name}» باید «packages» داشته باشد (آرایه یا "*").`);
    }
  }
  return entries;
}

/**
 * ممیزی کامل: تخلف‌های بدون استثنا + ردیف‌های بی‌استفاده.
 *
 * @param {{root?: string, allowlist?: Array<object>}} [opts]
 */
export function auditUniqueExportNames(opts = {}) {
  const root = opts.root ?? process.cwd();
  const allowlist = opts.allowlist ?? loadAllowlist(root);
  const byName = new Map(allowlist.map((e) => [e.name, e]));
  const collisions = findLocalCollisions(root);

  const violations = [];
  const details = [];
  for (const [name, pkgs] of collisions) {
    const entry = byName.get(name);
    const covered = (entry?.packages ?? []).includes('*')
      ? pkgs.map((p) => p.pkg)
      : (entry?.packages ?? []);
    const uncovered = pkgs.filter((p) => !covered.includes(p.pkg));
    details.push({
      name,
      packages: pkgs.map((p) => `${p.pkg}:${p.kind}`),
      status: entry?.status ?? null,
      reason: entry?.reason ?? null,
    });
    if (uncovered.length > 0) {
      violations.push({
        name,
        uncovered: uncovered.map((p) => `${p.pkg}:${p.kind}`),
        hint: entry
          ? `ردیف allowlist پکیج‌های ${uncovered.map((p) => p.pkg).join('، ')} را پوشش نمی‌دهد.`
          : 'نام در دو پکیج مستقل تعریف شده است: یکی را با @deprecated alias تغییر نام دهید یا ردیف allowlist با دلیل اضافه کنید.',
      });
    }
  }

  const stale = allowlist
    .filter((e) => !collisions.has(e.name))
    .map((e) => e.name)
    .sort();

  return {
    collisions: collisions.size,
    names: [...collisions.keys()].sort(),
    details,
    violations,
    stale,
    allowlisted: allowlist.length,
  };
}

function main(argv) {
  const json = argv.includes('--json');
  const list = argv.includes('--list');
  const report = auditUniqueExportNames();

  if (json) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.violations.length > 0 || report.stale.length > 0 ? 1 : 0;
  }

  if (list) {
    for (const d of report.details) {
      process.stdout.write(
        `${d.name} → ${d.packages.join(' | ')}${d.status ? `  [${d.status}]` : ''}\n`,
      );
    }
    process.stdout.write(`\n${report.collisions} نام مشترک (محلی در ≥۲ پکیج).\n`);
    return 0;
  }

  if (report.violations.length > 0) {
    process.stderr.write('\n❌ گیت نام‌های تکراری export (#119):\n');
    for (const v of report.violations) {
      process.stderr.write(`  • ${v.name}: ${v.uncovered.join('، ')}\n    ${v.hint}\n`);
    }
    process.stderr.write(
      `\n  راه اصلاح: نام یکی از پکیج‌ها را تغییر دهید (alias قدیمی با ` +
        `\`deprecate()\` و JSDoc @deprecated) یا دلیل را در ` +
        `${ALLOWLIST_PATH} ثبت کنید.\n\n`,
    );
  }
  if (report.stale.length > 0) {
    process.stderr.write(
      `\n❌ allowlist#119 ردیف بی‌استفاده دارد (نام دیگر تکراری نیست): ` +
        `${report.stale.join('، ')}\n\n`,
    );
  }
  if (report.violations.length === 0 && report.stale.length === 0) {
    process.stdout.write(
      `✅ نام‌های export یکتا (یا مستند‌شده): ${report.collisions} نام مشترک، ` +
        `${report.allowlisted} ردیف allowlist — گیت #119.\n`,
    );
  }
  return report.violations.length > 0 || report.stale.length > 0 ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main(process.argv.slice(2));
}
