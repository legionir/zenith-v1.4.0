// scripts/lib/error-catalog.mjs
//
// #112 — منبع واحد برای خواندنِ کاتالوگ خطاها از `packages/errors/src/core.ts`
// بدون نیاز به build. مصرف‌کننده‌ها:
//   - scripts/generate-error-docs.mjs (صفحهٔ هر کد + docs/ERROR-CODES.md)
//   - scripts/check-error-docs.mjs    (گیت CI: صفحه برای هر کد + نبود drift)
//   - scripts/test/error-docs-pages.test.mjs
//
// پارس متنی است (نه import) چون هستهٔ errors یک فایل TS با وابستگی‌های
// رانتایم است و اسکریپت‌های ابزار نباید به build وابسته شوند (الگوی
// scripts/generate-error-docs.mjs در #102).

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** رشتهٔ تک‌کوتیشن با پشتیبانی الحاق (`'a' + 'b'`). */
export function readStringLiteral(input, startIndex) {
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

/** بلاک `{ ... }` متناظر با اولین `{` بعد از keyIndex (با شمارش عمق). */
export function extractBlock(text, keyIndex) {
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

/** مقدار یک فیلد رشته‌ای داخل بدنهٔ بلاک (`field: 'value'`). */
export function field(body, name) {
  const m = body.match(new RegExp(`${name}:\\s*`));
  if (!m) return null;
  return readStringLiteral(body, (m.index ?? 0) + m[0].length)?.value ?? null;
}

/** دستهٔ خطا از پیشوند کد سه‌رقمی (بازه‌های core.ts §ساختار کدها). */
export const LEGACY_PREFIX_CATEGORY = {
  0: 'Expression',
  1: 'Runtime',
  2: 'Resource',
  3: 'SSR',
  4: 'Security',
  5: 'Compiler',
  6: 'Router',
  7: 'Form / Validation',
  8: 'Component',
  9: 'Internal',
};

/**
 * کاتالوگ کامل خطاها را از `packages/errors/src/core.ts` می‌خواند.
 *
 * @param {string} [root] ریشهٔ مخزن
 * @returns {{
 *   sourcePath: string,
 *   reserved: Array<{code: string, domain: string, category: string, fa: string, faSuggestion: string, en: string|null, enSuggestion: string|null}>,
 *   legacy: Array<{code: string, category: string, en: string|null, key: string|null}>,
 *   deprecations: Array<{code: string, api: string, replacement: string, removedIn: string}>,
 *   ranges: Array<{domain: string, from: number, to: number}>,
 * }}
 */
export function loadErrorCatalog(root = process.cwd()) {
  const sourcePath = join(root, 'packages/errors/src/core.ts');
  const src = readFileSync(sourcePath, 'utf8');

  const reservedStart = src.indexOf('export const RESERVED_ERROR_CODES');
  const enStart = src.indexOf('export const ERROR_MESSAGES_EN');
  const legacyEnStart = src.indexOf('export const LEGACY_ERROR_MESSAGES_EN');
  const deprecationStart = src.indexOf('export const DEPRECATION_CODES');
  if (reservedStart === -1 || enStart === -1 || legacyEnStart === -1) {
    throw new Error('[errors] ساختار core.ts برای پارس کاتالوگ شناسایی نشد (#112).');
  }
  const reservedText = src.slice(reservedStart, enStart);
  const enText = src.slice(enStart, legacyEnStart);
  const legacyEnText = src.slice(
    legacyEnStart,
    deprecationStart === -1 ? src.length : deprecationStart,
  );
  const deprecationText =
    deprecationStart === -1
      ? ''
      : src.slice(deprecationStart, src.indexOf('\n};', deprecationStart));

  // ── ۱) کاتالوگ ۴رقمی ──
  const reserved = [];
  const keyRe = /'(ZEN-[0-9]{4})':\s*{/g;
  let km;
  while ((km = keyRe.exec(reservedText)) !== null) {
    const block = extractBlock(reservedText, km.index);
    if (!block) continue;
    reserved.push({
      code: km[1],
      domain: field(block.body, 'domain') ?? '',
      category: field(block.body, 'category') ?? '',
      fa: field(block.body, 'message') ?? '',
      faSuggestion: field(block.body, 'suggestion') ?? '',
      en: null,
      enSuggestion: null,
    });
  }

  // ── ۲) پیام‌های انگلیسی ۴رقمی ──
  const enMap = new Map();
  {
    const re = /'(ZEN-[A-Z0-9-]+)':\s*{/g;
    let m;
    while ((m = re.exec(enText)) !== null) {
      const block = extractBlock(enText, m.index);
      if (!block) continue;
      enMap.set(m[1], {
        message: field(block.body, 'message'),
        suggestion: field(block.body, 'suggestion'),
      });
    }
  }
  for (const entry of reserved) {
    const en = enMap.get(entry.code);
    entry.en = en?.message ?? null;
    entry.enSuggestion = en?.suggestion ?? null;
  }

  // ── ۳) کدهای سه‌رقمی کلاسیک (enum + توضیح استاتیک en) ──
  const enumStart = src.indexOf('export const ErrorCode = {');
  const enumEnd = src.indexOf('};', enumStart);
  const enumText = src.slice(enumStart, enumEnd);
  const legacy = [];
  {
    const re = /([A-Za-z0-9_]+):\s*'(ZEN-[0-9]{3})'/g;
    let m;
    while ((m = re.exec(enumText)) !== null) {
      legacy.push({ code: m[2], key: m[1], category: '', en: null });
    }
  }
  {
    const re2 = /'(ZEN-[0-9]{3})':\s*/g;
    let m2;
    while ((m2 = re2.exec(legacyEnText)) !== null) {
      const lit = readStringLiteral(legacyEnText, m2.index + m2[0].length);
      const entry = legacy.find((l) => l.code === m2[1]);
      if (entry && lit) entry.en = lit.value;
    }
  }
  for (const entry of legacy) {
    const prefix = entry.code.slice(4, 5);
    entry.category = LEGACY_PREFIX_CATEGORY[prefix] ?? 'Internal';
  }

  // ── ۴) کدهای deprecation ──
  const deprecations = [];
  {
    const re = /'(ZEN-DEPR-[0-9]{3})':\s*\{/g;
    let m;
    while ((m = re.exec(deprecationText)) !== null) {
      const block = extractBlock(deprecationText, m.index);
      if (!block) continue;
      deprecations.push({
        code: m[1],
        api: field(block.body, 'api') ?? '',
        replacement: field(block.body, 'replacement') ?? '',
        removedIn: field(block.body, 'removedIn') ?? '',
      });
    }
  }

  // ── ۵) جدول بازه‌ها (برای اعتبارسنجی دامنه) ──
  const ranges = [];
  {
    const rangesStart = src.indexOf('export const ERROR_CODE_RANGES');
    const rangesEnd = src.indexOf('] as const;', rangesStart);
    const text = rangesStart === -1 ? '' : src.slice(rangesStart, rangesEnd);
    const re = /\{\s*domain:\s*'([^']+)',\s*from:\s*(\d+),\s*to:\s*(\d+)\s*\}/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      ranges.push({ domain: m[1], from: Number(m[2]), to: Number(m[3]) });
    }
  }

  return { sourcePath, reserved, legacy, deprecations, ranges };
}

/** فهرست همهٔ کدهایی که باید صفحهٔ مستندات داشته باشند (#112). */
export function allDocumentedCodes(catalog) {
  return [
    ...catalog.reserved.map((e) => e.code),
    ...catalog.legacy.map((e) => e.code),
    ...catalog.deprecations.map((e) => e.code),
  ];
}
