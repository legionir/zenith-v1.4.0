#!/usr/bin/env node
// scripts/check-error-docs.mjs
//
// #112 — گیت CI مستندات خطا:
//   ۱) هر کد کاتالوگ (۴رقمی رزورشده + سه‌رقمی کلاسیک + ZEN-DEPR) صفحهٔ
//      `docs/errors/<code>.md` دارد.
//   ۲) صفحه‌ها/جدول/فهرست با کاتالوگ هم‌گام‌اند (drift check؛ همان منطق تولید).
//   ۳) هر صفحه «علت»، «نمونهٔ کد خطادار» و «رفع» دارد و لینک `docsUrl` را
//      نشان می‌دهد — همان لینکی که `ZenithError.toUserString()` چاپ می‌کند.
//
// اجرا: node scripts/check-error-docs.mjs   (npm run check:error-docs)

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { buildErrorDocs, catalog, errorsDir } from './lib/error-docs.mjs';
import { DOMAIN_SAMPLES } from './lib/error-doc-samples.mjs';

const root = process.cwd();
const { files } = buildErrorDocs();
const problems = [];

// ── ۱+۲) صفحه برای هر کد و نبود drift ──
for (const [rel, body] of files) {
  const abs = join(root, rel);
  if (!existsSync(abs)) problems.push(`missing: ${rel}`);
  else if (readFileSync(abs, 'utf8') !== body) problems.push(`stale: ${rel}`);
}

for (const entry of catalog.reserved) {
  const page = join(errorsDir, `${entry.code}.md`);
  if (!existsSync(page)) {
    problems.push(`no page for catalog code ${entry.code}`);
    continue;
  }
  const body = readFileSync(page, 'utf8');
  for (const heading of ['## علت', '## نمونهٔ کد خطادار', '## رفع']) {
    if (!body.includes(heading)) problems.push(`${entry.code}.md missing "${heading}"`);
  }
  if (!body.includes(`https://zenith.dev/errors/${entry.code}`)) {
    problems.push(`${entry.code}.md missing docsUrl`);
  }
  if (!body.includes(entry.faSuggestion)) {
    problems.push(`${entry.code}.md is out of sync with the catalog suggestion`);
  }
  if (!DOMAIN_SAMPLES[entry.domain]) {
    problems.push(`no domain sample template for domain "${entry.domain}" (${entry.code})`);
  }
}

for (const entry of catalog.legacy) {
  if (!existsSync(join(errorsDir, `${entry.code}.md`))) {
    problems.push(`no page for legacy code ${entry.code}`);
  }
}

for (const entry of catalog.deprecations) {
  const page = join(errorsDir, `${entry.code}.md`);
  if (!existsSync(page)) {
    problems.push(`no page for deprecation code ${entry.code}`);
    continue;
  }
  if (!readFileSync(page, 'utf8').includes(entry.replacement)) {
    problems.push(`${entry.code}.md missing replacement "${entry.replacement}"`);
  }
}

// ── صفحه‌های یتیم ──
if (existsSync(errorsDir)) {
  for (const dirent of readdirSync(errorsDir, { withFileTypes: true })) {
    if (!dirent.isFile() || !dirent.name.endsWith('.md') || dirent.name === 'README.md') continue;
    if (!files.has(join('docs/errors', dirent.name))) {
      problems.push(`orphan page: docs/errors/${dirent.name}`);
    }
  }
}

if (problems.length) {
  console.error(
    `❌ مستندات خطا ناقص/کهنه است (${problems.length} مورد):\n` +
      problems
        .slice(0, 20)
        .map((p) => `   • ${p}`)
        .join('\n') +
      `\n   → رفع: node scripts/generate-error-docs.mjs`,
  );
  process.exit(1);
}

console.log(
  `✅ مستندات خطا کامل است: ${catalog.reserved.length} کد ۴رقمی + ` +
    `${catalog.legacy.length} کد ۳رقمی + ${catalog.deprecations.length} کد deprecation، ` +
    `همه با صفحهٔ علت/نمونهٔ خطا/رفع و لینک docsUrl.`,
);
