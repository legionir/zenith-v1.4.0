#!/usr/bin/env node
// scripts/generate-error-docs.mjs
//
// #102 (I18N): تولید docs/ERROR-CODES.md از کاتالوگ packages/errors/src/core.ts
// (بدون نیاز به build؛ با پارس متنی). اجرا: node scripts/generate-error-docs.mjs
// دارای حالت --check برای drift detection (CI/تست).

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const corePath = join(root, 'packages/errors/src/core.ts');
const docPath = join(root, 'docs/ERROR-CODES.md');
const checkMode = process.argv.includes('--check');

const src = readFileSync(corePath, 'utf8');

/** استخراج رشتهٔ template-literal-free از قسمت مقدار: 'a' + 'b' → 'ab'. */
function readStringLiteral(input, startIndex) {
  let i = startIndex;
  let out = '';
  for (;;) {
    while (i < input.length && /\s/.test(input[i])) i++;
    if (input[i] !== "'") return null;
    i++;
    let part = '';
    while (i < input.length && input[i] !== "'") {
      if (input[i] === '\\') {
        i++;
        part += input[i];
        i++;
        continue;
      }
      part += input[i];
      i++;
    }
    i++; // گذر از quote پایانی
    out += part;
    let j = i;
    while (j < input.length && /\s/.test(input[j])) j++;
    if (input[j] === '+') {
      i = j + 1;
      continue;
    }
    i = j;
    return { value: out, end: i };
  }
}

/** یافتن بلاک { ... } بعد از کلید با remainder-walking. */
function extractBlock(text, keyIndex) {
  const open = text.indexOf('{', keyIndex);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) return { body: text.slice(open + 1, i), end: i };
    }
  }
  return null;
}

function field(body, name) {
  const m = body.match(new RegExp(`${name}:\\s*`));
  if (!m) return null;
  return readStringLiteral(body, (m.index ?? 0) + m[0].length)?.value ?? null;
}

// ── ۱) کاتالوگ رزورشدهٔ ۴رقمی ──
const reservedStart = src.indexOf('export const RESERVED_ERROR_CODES');
const enStart = src.indexOf('export const ERROR_MESSAGES_EN');
const legacyEnStart = src.indexOf('export const LEGACY_ERROR_MESSAGES_EN');
const reservedText = src.slice(reservedStart, enStart);
const enText = src.slice(enStart, legacyEnStart);
const legacyEnText = src.slice(legacyEnStart, src.indexOf('export function getErrorMessage'));

const entries = [];
const keyRe = /'(ZEN-[0-9]{4})':\s*{/g;
let km;
while ((km = keyRe.exec(reservedText)) !== null) {
  const block = extractBlock(reservedText, km.index);
  if (!block) continue;
  entries.push({
    code: km[1],
    domain: field(block.body, 'domain'),
    category: field(block.body, 'category'),
    fa: field(block.body, 'message'),
    faSuggestion: field(block.body, 'suggestion'),
  });
}

function parseEnMap(text) {
  const map = {};
  const re = /'(ZEN-[A-Z0-9-]+)':\s*{/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const block = extractBlock(text, m.index);
    if (!block) continue;
    map[m[1]] = { message: field(block.body, 'message'), suggestion: field(block.body, 'suggestion') };
  }
  return map;
}
const enMap = parseEnMap(enText);

// کدهای سه‌رقمی: از enum ErrorCode + توضیح استاتیک en.
const enumStart = src.indexOf('export const ErrorCode = {');
const enumEnd = src.indexOf('};', enumStart);
const enumText = src.slice(enumStart, enumEnd);
const legacyCodes = [...enumText.matchAll(/'(ZEN-[0-9]{3})'/g)].map((m) => m[1]);
const legacyEnMap = {};
{
  const re2 = /'(ZEN-[0-9]{3})':\s*/g;
  let m2;
  while ((m2 = re2.exec(legacyEnText)) !== null) {
    const lit = readStringLiteral(legacyEnText, m2.index + m2[0].length);
    if (lit) legacyEnMap[m2[1]] = lit.value;
  }
}

const md = [];
md.push('# کدهای خطای Zenith (ZEN-####)');
md.push('');
md.push('> این فایل به‌صورت خودکار از `packages/errors/src/core.ts` تولید می‌شود (#102).');
md.push('> برای تولید مجدد: `node scripts/generate-error-docs.mjs` (drift check: `--check`).');
md.push('');
md.push('## انتخاب زبان پیام');
md.push('');
md.push('```ts');
md.push("import { setErrorLocale, getErrorMessage } from '@zenith/errors';");
md.push("setErrorLocale('en'); // یا 'fa' (پیش‌فرض)");
md.push("createReservedError('ZEN-1821'); // ← پیام به زبان انتخاب‌شده");
md.push('```');
md.push('');
md.push('## کدهای ۴رقمی (کاتالوگ رزورشده)');
md.push('');
md.push('| کد | دامنه | دسته | پیام (FA) | Message (EN) | راه‌حل (suggestion) |');
md.push('|---|---|---|---|---|---|');
for (const e of entries) {
  const en = enMap[e.code] ?? {};
  const cell = (v) => String(v ?? '').replace(/\|/g, '\\|');
  md.push(
    `| \`${e.code}\` | ${e.domain} | ${e.category} | ${cell(e.fa)} | ${cell(en.message)} | ${cell(e.faSuggestion)} |`,
  );
}
md.push('');
md.push('## کدهای ۳رقمی (کلاسیک — renumber نمی‌شوند)');
md.push('');
md.push('| کد | توضیح (EN) |');
md.push('|---|---|');
for (const code of legacyCodes) {
  md.push(`| \`${code}\` | ${legacyEnMap[code] ?? ''} |`);
}
md.push('');
md.push('## قوانین `zenith check` (CLI)');
md.push('');
md.push('قوانین امنیت/کیفیت `zenith check` در بازهٔ `ZEN-9000..9899` هستند (جایگزین شناسه‌های قدیمی Z001..Z820 در #102).');
md.push('');
md.push('---');
md.push('');
md.push('لینک آنلاین هر کد: `https://zenith.dev/errors/<code>`.');
md.push('');

const output = md.join('\n');

if (checkMode) {
  if (!readFileSync(docPath, 'utf8').endsWith(output.slice(-40))) {
    console.error('❌ docs/ERROR-CODES.md قدیمی است — `node scripts/generate-error-docs.mjs` اجرا کنید.');
    process.exit(1);
  }
  console.log('✅ docs/ERROR-CODES.md تازه است.');
} else {
  writeFileSync(docPath, output);
  console.log(`✅ docs/ERROR-CODES.md نوشته شد (${entries.length} کد ۴رقمی + ${legacyCodes.length} کد ۳رقمی).`);
}
