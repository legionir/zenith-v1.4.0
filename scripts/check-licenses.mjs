#!/usr/bin/env node
// scripts/check-licenses.mjs
//
// #78 (SEC): بررسی لایسنس وابستگی‌های نصب‌شده در برابر allowlist مجوزهای
// سازگار با MIT. در CI پس از `npm ci` اجرا می‌شود؛ در محیط بدون node_modules
// با FAIL-FAST خارج نمی‌شود مگر --strict بدهیم.
//
// استفاده:
//   node scripts/check-licenses.mjs [--strict]

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const strict = process.argv.includes('--strict');

// مجوزهای مجاز و سازگار با توزیع MIT (SCP-2/BSD/MIT/ISC/Unlicense/…)
const ALLOWED = new Set([
  'MIT',
  'MIT*',
  'ISC',
  'BSD-2-Clause',
  'BSD-3-Clause',
  'Apache-2.0',
  'CC0-1.0',
  'Unlicense',
  'Python-2.0',
  '(MIT OR CC0-1.0)',
  'MIT OR ISC',
  '(MIT AND ISC)',
  'BlueOak-1.0.0',
  'Zlib',
  // MIT No Attribution — کاملاً سازگار با توزیع MIT.
  'MIT-0',
  // MPL-2.0 (lightningcss — وابستگیٔ اختیاری vite): کپی‌لفت سطح فایل است و
  // با توزیع bundle تحت MIT سازگار محسوب می‌گردد (MPL §1.4/§3.3).
  'MPL-2.0',
]);

// #74 / DEC-034: استثنای محدود و مستند برای ابزار «فقط-زمان-build».
// rollup-plugin-dts (LGPL-3.0-only) تنها ابزاری است که `.d.ts`ها را برای هر ورودی به یک فایل
// تجمیع می‌کند و `declare global` را حفظ می‌کند (جایگزین‌های MIT — dts-bundle-generator — روی
// vite-plugin crash می‌کنند و نوع‌های workspace را inline و تکثیر می‌کنند). LGPL فقط برای
// پیوند/توزیع خودِ کتابخانه الزام می‌آورد؛ این ابزار هرگز منتشر یا لینک نمی‌شود و خروجی‌اش
// (فایل‌های `.d.ts` تولیدشده از کد خودمان) اثر مشتق نیست. شرط: فقط devDependency ریشه باشد و
// هیچ پکیج قابل‌انتشاری آن را در dependencies/peerDependencies نداشته باشد.
export const BUILD_ONLY_EXCEPTIONS = new Map([['rollup-plugin-dts', 'LGPL-3.0-only']]);

function isBuildOnlyException(name, lic) {
  if (BUILD_ONLY_EXCEPTIONS.get(name) !== lic) return false;
  const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  if (!rootPkg.devDependencies?.[name]) return false;
  const pkgsDir = join(root, 'packages');
  for (const d of existsSync(pkgsDir) ? readdirSync(pkgsDir) : []) {
    const f = join(pkgsDir, d, 'package.json');
    if (!existsSync(f)) continue;
    const m = JSON.parse(readFileSync(f, 'utf8'));
    if (m.dependencies?.[name] || m.peerDependencies?.[name] || m.optionalDependencies?.[name]) {
      return false;
    }
  }
  return true;
}

const top = join(root, 'node_modules');
if (!existsSync(top)) {
  const msg =
    '⚠️  node_modules موجود نیست — license check نادیده گرفته شد (در CI پس از npm ci اجرا کنید).';
  if (strict) {
    console.error(`❌ ${msg}`);
    process.exit(1);
  }
  console.log(msg);
  process.exit(0);
}

const pkgDirs = [];
for (const entry of readdirSync(top)) {
  if (entry.startsWith('.')) continue;
  if (entry === '@zenith') continue; // پکیج‌های داخلی خودمان (MIT)
  if (entry.startsWith('@')) {
    for (const sub of readdirSync(join(top, entry))) pkgDirs.push(join(top, entry, sub));
  } else {
    pkgDirs.push(join(top, entry));
  }
}

const violations = [];
let checked = 0;
for (const dir of pkgDirs) {
  const manifest = join(dir, 'package.json');
  if (!existsSync(manifest)) continue;
  let j;
  try {
    j = JSON.parse(readFileSync(manifest, 'utf8'));
  } catch {
    continue;
  }
  checked++;
  // سیگنات لایسنس در npm یا license یا licenses (قدیمی) است.
  let lic = j.license ?? null;
  if (!lic && Array.isArray(j.licenses)) lic = j.licenses.map((l) => l.type).join(' OR ');
  if (!lic) continue; // برخی وابستگی‌های بدون فیلد license (مثل @types قدیمی) — هشدار نمی‌دهیم مگر strict
  lic = String(lic).trim().replace(/^"|"$/g, '');
  if (!ALLOWED.has(lic) && !isBuildOnlyException(j.name, lic)) {
    violations.push(`${j.name ?? dir}@${j.version ?? '?'} → ${lic}`);
  }
}

if (violations.length > 0) {
  console.error('❌ #78: مجوزهای نامشخص/ناسازگار در وابستگی‌ها:');
  for (const v of violations) console.error(`  - ${v}`);
  process.exit(1);
}
console.log(`✅ license check: ${checked} پکیج بررسی شد؛ همهٔ مجوزها مجازند (#78).`);
