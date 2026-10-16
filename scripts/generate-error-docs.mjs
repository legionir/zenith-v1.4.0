#!/usr/bin/env node
// scripts/generate-error-docs.mjs
//
// #102 (I18N) + #112 (DX) — نوشتن/بررسی مستندات خطاها از کاتالوگ
// packages/errors/src/core.ts: docs/ERROR-CODES.md، صفحهٔ هر کد در
// docs/errors/<CODE>.md و فهرست docs/errors/README.md.
//
// اجرا:  node scripts/generate-error-docs.mjs           # نوشتن
//        node scripts/generate-error-docs.mjs --check   # گیت drift (CI)
//
// منطق تولید در scripts/lib/error-docs.mjs است تا گیت CI
// (scripts/check-error-docs.mjs) و تست‌ها همان منبع را مصرف کنند.

import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildErrorDocs, catalog, errorsDir } from './lib/error-docs.mjs';

const checkMode = process.argv.includes('--check');
const { files, counts } = buildErrorDocs();

if (checkMode) {
  const problems = [];
  for (const [rel, body] of files) {
    let current = null;
    try {
      current = readFileSync(join(process.cwd(), rel), 'utf8');
    } catch {
      current = null;
    }
    if (current !== body) problems.push(rel);
  }
  // صفحه‌های یتیم (کدی که دیگر در کاتالوگ نیست)
  for (const name of readdirSync(errorsDir, { withFileTypes: true })) {
    if (!name.isFile() || !name.name.endsWith('.md') || name.name === 'README.md') continue;
    if (!files.has(join('docs/errors', name.name))) problems.push(join('docs/errors', name.name));
  }
  if (problems.length) {
    console.error(
      `❌ مستندات خطا کهنه است (${problems.length} مورد) — \`node scripts/generate-error-docs.mjs\` اجرا کنید:\n` +
        problems
          .slice(0, 10)
          .map((p) => `   • ${p}`)
          .join('\n'),
    );
    process.exit(1);
  }
  console.log(
    `✅ مستندات خطا تازه است (${counts.reserved} کد ۴رقمی + ${counts.legacy} کد ۳رقمی + ` +
      `${counts.deprecations} کد deprecation + فهرست).`,
  );
} else {
  mkdirSync(errorsDir, { recursive: true });
  for (const name of readdirSync(errorsDir, { withFileTypes: true })) {
    if (!name.isFile() || !name.name.endsWith('.md') || name.name === 'README.md') continue;
    if (!files.has(join('docs/errors', name.name))) rmSync(join(errorsDir, name.name));
  }
  for (const [rel, body] of files) writeFileSync(join(process.cwd(), rel), body);
  console.log(
    `✅ docs/ERROR-CODES.md + docs/errors/ نوشته شد (${counts.reserved} کد ۴رقمی + ` +
      `${counts.legacy} کد ۳رقمی + ${counts.deprecations} کد deprecation؛ منابع: ` +
      `${catalog.reserved.length + catalog.legacy.length + catalog.deprecations.length} صفحه).`,
  );
}
