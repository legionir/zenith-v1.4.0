#!/usr/bin/env node
// #45 — بررسی خودکار وابستگی‌های @zenith بلااستفاده در همهٔ پکیج‌ها.
//
// برای هر پکیج ورک‌اسپیس، هر وابستگی اعلام‌شدهٔ @zenith/* (در
// dependencies / devDependencies / peerDependencies) باید دست‌کم یک‌بار در
// فایل‌های src/ یا test/ همان پکیج «وارد» شود — static import، type-only،
// dynamic `import('@zenith/x')`، `export ... from` یا `require('@zenith/x')`.
// ارجاع فقط داخل کامنت شمارش نمی‌شود (کامنت‌ها با state-machine حذف می‌شوند
// تا string literalها دست‌نخورده بمانند).
//
// نکته: vitest ریشه همهٔ @zenith/* را به src alias می‌کند، پس حذف
// devDependency اشتباه در تست‌ها BREAK نمی‌شود — همین است که #45 می‌خواهد:
// گراف اعلامی = واقعیت importها.
//
// خروج: کد 0 اگر «بلااستفاده: صفر»؛ در غیر این صورت 1 + لیست موارد.
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** کامنت‌ها را حذف می‌کند بدون آنکه داخل string/template literal دست ببرد. */
function stripComments(code) {
  let out = '';
  let i = 0;
  const n = code.length;
  let mode = 'code'; // code | sq | dq | tpl | line | block
  while (i < n) {
    const c = code[i];
    const c2 = code[i + 1];
    if (mode === 'code') {
      if (c === '/' && c2 === '/') {
        mode = 'line';
        i += 2;
        continue;
      }
      if (c === '/' && c2 === '*') {
        mode = 'block';
        i += 2;
        continue;
      }
      if (c === "'") mode = 'sq';
      else if (c === '"') mode = 'dq';
      else if (c === '`') mode = 'tpl';
      out += c;
      i += 1;
    } else if (mode === 'sq' || mode === 'dq' || mode === 'tpl') {
      const quote = mode === 'sq' ? "'" : mode === 'dq' ? '"' : '`';
      if (c === '\\') {
        out += c + (c2 ?? '');
        i += 2;
        continue;
      }
      if (c === quote) mode = 'code';
      out += c;
      i += 1;
    } else if (mode === 'line') {
      if (c === '\n') {
        mode = 'code';
        out += c;
      }
      i += 1;
    } else if (mode === 'block') {
      if (c === '*' && c2 === '/') {
        mode = 'code';
        i += 2;
        continue;
      }
      if (c === '\n') out += c; // حفظ خطوط
      i += 1;
    }
  }
  return out;
}

/**
 * ست nameهای کوتاه @zenith/<name> که در فایل‌های import شده‌اند.
 * pattern فقط کانتکست import/export/require را می‌گیرد تا رشته‌های
 * تصادفی (مثلاً در template) شمارش نشوند.
 * (خارج‌شده برای استفادهٔ scripts/peer-rule.mjs — #46)
 */
const USED_RE =
  /(?:\bimport\b|\bexport\b|\brequire\s*\()?[^'"`;]{0,80}?['"]@zenith\/([a-z0-9-]+(?:\/[^'"`;]*)?)['"]/g;

export function collectUsed(pkgDir, subs = ['src', 'test']) {
  const used = new Set();
  const files = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(?:m?js|ts)$/.test(e.name) && statSync(p).isFile()) files.push(p);
    }
  };
  for (const sub of subs) walk(join(pkgDir, sub));

  for (const f of files) {
    const stripped = stripComments(readFileSync(f, 'utf8'));
    // خط‌به‌خط: خطوط import/export/require (یا `from '<mod>'` در import
    // چندخطی) بررسی می‌شوند تا رشته‌های خام در template شمارش نشوند.
    for (const line of stripped.split('\n')) {
      if (!/\b(?:import|export|require)\b|from\s*['"]/.test(line)) continue;
      let m;
      USED_RE.lastIndex = 0;
      while ((m = USED_RE.exec(line)) !== null) {
        // زیرمسیرها به پکیج والد نگاشت می‌شوند: '@zenith/schema/zod' → 'schema'
        // ('@zenith/service-worker/sw' → 'service-worker').
        used.add(m[1].split('/')[0]);
      }
    }
  }
  return used;
}

export function findUnused(packagesDir, dirsOverride) {
  const dirs =
    dirsOverride ??
    readdirSync(packagesDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .filter((d) => existsSync(join(packagesDir, d.name, 'package.json')))
      .map((d) => d.name);

  const problems = [];
  let checked = 0;
  for (const dir of dirs) {
    const pkgPath = join(packagesDir, dir, 'package.json');
    if (!existsSync(pkgPath)) continue;
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg.name !== `@zenith/${dir}`) continue; // فقط پکیج‌های zenith
    checked += 1;
    const used = collectUsed(join(packagesDir, dir));
    for (const field of ['dependencies', 'devDependencies', 'peerDependencies']) {
      const deps = pkg[field] ?? {};
      for (const depName of Object.keys(deps)) {
        if (!depName.startsWith('@zenith/')) continue;
        const short = depName.slice('@zenith/'.length);
        if (!used.has(short)) problems.push({ pkg: dir, field, dep: depName });
      }
    }
  }
  return { checked, problems };
}

function main() {
  const packagesDir = join(process.cwd(), 'packages');
  const { checked, problems } = findUnused(packagesDir);
  console.log(
    `🔎 unused-zenith-deps: ${checked} packages checked, ${problems.length} unused declaration(s).`,
  );
  for (const p of problems) {
    console.log(
      `  ✗ ${p.pkg} [${p.field}] -> ${p.dep} (no import/export/require reference in src/test)`,
    );
  }
  if (problems.length > 0) {
    console.error(
      '\n❌ وابستگی بلااستفادهٔ @zenith یافت شد (#45). حذفش کن یا import واقعی اضافه کن.',
    );
    process.exit(1);
  }
  console.log('✅ همهٔ پکیج‌ها: وابستگی بلااستفاده = صفر');
}

// فقط وقتی مستقیم اجرا شد (نه هنگام import برای تست).
if (import.meta.url === `file://${process.argv[1]}`) main();
