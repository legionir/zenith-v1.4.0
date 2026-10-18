#!/usr/bin/env node
// scripts/positional-config-audit.mjs
//
// #55 — ممیزی «پیکربندی positional» در سطح عمومی پکیج‌ها.
//
// قاعدهٔ API-CONVENTIONS §۱.۱/§۴ (#55): هر تابع عمومی که بیش از یک ورودی
// *پیکربندی* دارد باید امضای `fn(main, options?)` داشته باشد؛ پارامترهای
// positional علاوه بر «ورودی اصلی» ممنوع‌اند (و اگر قدیمی باشند فقط به‌عنوان
// overloadِ `@deprecated` مجازند).
//
// این اسکریپت با AST تایپ‌اسکریپت هر export عمومی را می‌خواند و توابعی را
// فهرست می‌کند که:
//   • بیش از یک پارامتر «پیکربندی‌مانند» دارند (پارامتر اول = ورودی اصلی)،
//   • overloadِ options-object ندارند،
//   • `@deprecated` نیستند (alias مهاجرت، حذف در ۲.۰ طبق DEC-026)،
//   • در allowlist مستدل (`scripts/positional-config.allowlist.json`) نیستند.
//
// حالت‌ها:
//   node scripts/positional-config-audit.mjs            # گیت (exit 1 روی تخلف)
//   node scripts/positional-config-audit.mjs --json     # خروجی ماشینی
//   node scripts/positional-config-audit.mjs --list     # جدول همهٔ امضاها

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { collectSourceSignatures, signatureAllowed } from './lib/positional-signatures.mjs';

/** مسیر پیش‌فرض allowlist. */
export const ALLOWLIST_PATH = join('scripts', 'positional-config.allowlist.json');

function walkDir(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('tmp-') || entry.name.startsWith('dist.')) continue;
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walkDir(p));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) out.push(p);
  }
  return out;
}

/**
 * آیا این پارامتر یک «options object» است؟
 * ملاک: نام `…Options` / `…Config` یا نوع متناظر، یا literal نوع object.
 */
/**
 * تنها منبع حقیقت «آیا این پارامتر یک options object است؟» — هم این گیت و هم
 * قاعدهٔ ESLint `zenith/options-object` از همین تابع استفاده می‌کنند تا هیچ‌وقت
 * واگرا نشوند.
 *
 * @param {string} paramText متن پارامتر (مثل `options?: FetchOptions` یا `{ ttl?: number }`).
 * @returns {boolean} true اگر پارامتر پیکربندی be-shape options باشد.
 */
export { isOptionsParamText } from '../packages/eslint-plugin/src/rules/options-object.js';
import { isOptionsParamText } from '../packages/eslint-plugin/src/rules/options-object.js';

/** Source-export inventory includes classes, interfaces and object methods. */
function exportedFunctions(file) { return collectSourceSignatures(file, readFileSync(file, 'utf8')); }

/**
 * ممیزی کامل.
 *
 * @param {{root?: string, allowlist?: Array<{name: string, pkg: string, reason: string}>}} [opts]
 */
export function auditPositionalConfig(opts = {}) {
  const root = opts.root ?? process.cwd();
  const allowlist = opts.allowlist ?? loadAllowlist(root);

  const packagesDir = join(root, 'packages');
  const signatures = [];
  const violations = [];

  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('tmp-')) continue;
    const pkg = entry.name;
    for (const file of walkDir(join(packagesDir, pkg, 'src'))) {
      for (const fn of exportedFunctions(file)) {
        // «پیکربندی positional»: بیش از یک پارامتر، که هیچ‌کدام options نیست.
        const configCount = fn.params.filter((p) => !isOptionsParamText(p)).length;
        const flagged =
          fn.params.length > 2 &&
          !fn.deprecated &&
          !signatureAllowed({ pkg, ...fn, file: relative(root, file).split('\\').join('/') }, allowlist);
        signatures.push({
          pkg,
          file: relative(root, file).split('\\').join('/'),
          ...fn,
          configParams: Math.max(0, configCount - 1),
          flagged,
        });
        if (flagged) {
          violations.push({
            pkg,
            name: fn.name,
            file: relative(root, file).split('\\').join('/'),
            line: fn.line,
            params: fn.params,
          });
        }
      }
    }
  }

  const stale = allowlist
    .filter((e) => !signatures.some((s) => signatureAllowed(s, [e])))
    .map((e) => `${e.pkg}:${e.name}`)
    .sort();

  return { scope: 'source-export-inventory', signatures, violations, allowlisted: allowlist.length, stale };
}

/**
 * خواندن allowlist دسته‌محور: هر دسته یک `reason` بازبینی‌شده دارد و اعضای
 * آن (`pkg`+`name`) فهرست شده‌اند.
 *
 * @returns {{entries: Array<{pkg: string, name: string, category: string, reason: string}>}}
 */
export function loadAllowlist(root = process.cwd(), path = ALLOWLIST_PATH) {
  const full = resolve(root, path);
  if (!existsSync(full) || !statSync(full).isFile()) {
    throw new Error(`positional-config-audit: allowlist یافت نشد: ${path}`);
  }
  const raw = JSON.parse(readFileSync(full, 'utf8'));
  const entries = [];
  for (const category of raw.categories ?? []) {
    if (typeof category.id !== 'string') {
      throw new Error('positional-config allowlist: هر دسته باید «id» داشته باشد.');
    }
    if (typeof category.reason !== 'string' || category.reason.trim().length < 20) {
      throw new Error(
        `positional-config allowlist: دستهٔ «${category.id}» باید reason توضیحی داشته باشد.`,
      );
    }
    for (const e of category.entries ?? []) {
      if (typeof e.pkg !== 'string' || typeof e.name !== 'string') {
        throw new Error(`positional-config allowlist: عضو نامعتبر در دستهٔ «${category.id}».`);
      }
      if (e.params !== undefined && (!Array.isArray(e.params) || e.params.some(param => typeof param !== 'string'))) throw new Error('positional-config allowlist: params must be strings.');
      if (e.file !== undefined && (typeof e.file !== 'string' || e.file.startsWith('/') || e.file.split('/').includes('..'))) throw new Error('positional-config allowlist: file must be workspace-relative.');
      entries.push({ pkg: e.pkg, name: e.name, ...(e.params ? { params: e.params } : {}), ...(e.file ? { file: e.file } : {}), category: category.id, reason: category.reason });
    }
  }
  return entries;
}

function main(argv) {
  const report = auditPositionalConfig();
  if (argv.includes('--json')) {
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    return report.violations.length + report.stale.length > 0 ? 1 : 0;
  }
  if (argv.includes('--list')) {
    for (const s of report.signatures.sort((a, b) => a.pkg.localeCompare(b.pkg))) {
      const mark = s.flagged ? '❌' : s.deprecated ? '↩︎' : s.optionsParam ? '✅' : '·';
      process.stdout.write(
        `${mark} ${s.pkg}:${s.name}(${s.params.length} params) — ${s.file}:${s.line}\n`,
      );
    }
    process.stdout.write(
      `\n${report.signatures.length} امضای export منبع؛ ${report.violations.length} تخلف؛ ${report.allowlisted} ردیف allowlist.\n`,
    );
    return 0;
  }
  if (report.violations.length > 0) {
    process.stderr.write('\n❌ پیکربندی positional در API عمومی (#55):\n');
    for (const v of report.violations) {
      process.stderr.write(
        `  • ${v.pkg}:${v.name}(${v.params.join(', ')}) — ${v.file}:${v.line}\n` +
          `    ↳ امضای ` +
          '`fn(main, options?)` بسازید (overload قدیمی با @deprecated + deprecate()) ' +
          `یا دلیل را در ${ALLOWLIST_PATH} ثبت کنید.\n`,
      );
    }
    process.stderr.write('\n');
  }
  if (report.stale.length > 0) {
    process.stderr.write(
      `❌ ردیف بی‌استفادهٔ allowlist#55 (امضا دیگر وجود ندارد): ${report.stale.join('، ')}\n\n`,
    );
  }
  if (report.violations.length === 0 && report.stale.length === 0) {
    process.stdout.write(
      `✅ پیکربندی positional: ${report.signatures.length} امضای export منبع بررسی شد؛ ` +
        `${report.allowlisted} ردیف allowlist مستند — گیت #55.\n`,
    );
  }
  return report.violations.length + report.stale.length > 0 ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main(process.argv.slice(2));
}
