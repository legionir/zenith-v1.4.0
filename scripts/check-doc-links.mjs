#!/usr/bin/env node
// scripts/check-doc-links.mjs
//
// #103 — گیت یکپارچگی لینک‌های نسبی مرجع API:
//
//   • هر لینک نسبی markdown در `docs/api/**/*.md` باید به فایل/دایرکتوری
//     موجود اشاره کند (تولیدکننده: `scripts/generate-api-docs.mjs` فقط
//     لینک نسبی می‌نویسد؛ لینک مطلق ریشه (`/...`) روی ساب‌پس Pages
//     می‌شکند و مجاز نیست).
//   • هر فرگمنت (`#...`) باید با slug یک heading در فایل مقصد بخواند
//     (قاعدهٔ GitHub: lowercase، حذف نقطه‌گذاری، فاصله→`-`).
//   • لینک‌های ورودی (`README.md` ریشه و `docs/README.md` به `docs/api/INDEX.md`)
//     هم همین‌جا بررسی می‌شوند تا نقطهٔ ورود مرجع هرگز یتیم نشود.
//
// اجرا:  node scripts/check-doc-links.mjs   (npm run check:doc-links)

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** فایل‌های زیر پوشش این گیت (مالک #103). */
export function docFiles(root = process.cwd()) {
  const out = [];
  const apiDir = join(root, 'docs', 'api');
  const walk = (dir) => {
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, d.name);
      if (d.isDirectory()) walk(p);
      else if (d.isFile() && d.name.endsWith('.md')) out.push(p);
    }
  };
  if (existsSync(apiDir)) walk(apiDir);
  for (const f of [join(root, 'docs', 'README.md'), join(root, 'README.md')]) {
    if (existsSync(f) && !out.includes(f)) out.push(f);
  }
  return out.sort();
}

/** حذف بلوک‌های fenced تا نمونه‌کدها لینک شمرده نشوند. */
export function stripFenced(text) {
  return text.replace(/^```[\s\S]*?^```[^\S\n]*$/gm, '');
}

/** حذف کد درون‌خطی (`...`) تا مسیرهای داخل متن لینک شمرده نشوند. */
export function stripInlineCode(text) {
  return text.replace(/`[^`\n]*`/g, '');
}

/** لینک‌های markdown متن (پس از strip). */
export function extractRelativeLinks(text) {
  const clean = stripInlineCode(stripFenced(text));
  const out = [];
  for (const m of clean.matchAll(/\[([^\]]*)\]\(([^)\s]+)\)/g)) {
    const target = m[2].trim();
    if (!target) continue;
    if (/^(https?:|mailto:|data:)/i.test(target)) continue;
    out.push(target);
  }
  return out;
}

/** slug heading به قاعدهٔ GitHub (unicode-aware). */
export function slugifyHeading(raw) {
  const text = raw.replace(/`/g, '').trim().toLowerCase();
  return text
    .replace(/[^\p{L}\p{M}\p{N}_ \-]/gu, '')
    .replace(/ +/g, '-');
}

/** مجموعهٔ slugهای headingهای یک متن markdown. */
export function headingSlugs(text) {
  const clean = stripFenced(text);
  const slugs = new Set();
  for (const m of clean.matchAll(/^#{1,6}\s+(.+)$/gm)) {
    slugs.add(slugifyHeading(m[1].replace(/\s+#+\s*$/, '')));
  }
  return slugs;
}

const slugCache = new Map();

function slugsOf(file) {
  if (!slugCache.has(file)) {
    slugCache.set(file, headingSlugs(readFileSync(file, 'utf8')));
  }
  return slugCache.get(file);
}

/**
 * بررسی لینک‌های نسبی فایل‌های مرجع.
 *
 * @param {string} root ریشهٔ مخزن
 * @returns {{problems: string[], checked: number}}
 */
export function auditDocLinks(root = process.cwd()) {
  slugCache.clear();
  const problems = [];
  const files = docFiles(root);
  let checked = 0;

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const links = extractRelativeLinks(text);
    checked += links.length;
    for (const link of links) {
      const [pathPart, fragment] = link.split('#');
      const resolved = pathPart
        ? resolve(pathPart.startsWith('/') ? root : dirname(file), pathPart.replace(/^\//, ''))
        : file;
      if (!existsSync(resolved)) {
        problems.push(`${file}: broken relative link ${link}`);
        continue;
      }
      if (fragment !== undefined && fragment !== '') {
        const targetFile = statSync(resolved).isDirectory() ? null : resolved;
        if (targetFile && targetFile.endsWith('.md')) {
          const slug = decodeURIComponent(fragment).toLowerCase();
          if (!slugsOf(targetFile).has(slug)) {
            problems.push(`${file}: broken fragment ${link}`);
          }
        }
      }
    }
  }
  return { problems, checked };
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const { problems, checked } = auditDocLinks(process.cwd());
  if (problems.length) {
    console.error(
      `❌ لینک‌های نسبی مرجع معتبر نیستند (${problems.length} مورد):\n` +
        problems.map((p) => `   • ${p}`).join('\n'),
    );
    process.exit(1);
  }
  console.log(`✅ ${checked} لینک نسبی مرجع سالم.`);
}
