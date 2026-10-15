// scripts/lib/error-docs.mjs
//
// #102 (I18N) + #112 (DX) — سازندهٔ محتوای مستندات خطاها:
//   • docs/ERROR-CODES.md  (جدول یکجا + انتخاب زبان پیام)
//   • docs/errors/<CODE>.md برای **هر** کد کاتالوگ (۴رقمی رزورشده، سه‌رقمی
//     کلاسیک و ZEN-DEPR) با «علت / نمونهٔ کد خطادار / رفع»
//   • docs/errors/README.md (فهرست)
//
// بدون وابستگی به build (پارس متنی core.ts). مصرف‌کننده‌ها:
//   scripts/generate-error-docs.mjs (نوشتن) و scripts/check-error-docs.mjs (گیت CI).

import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadErrorCatalog } from './error-catalog.mjs';
import { CODE_SAMPLES, DOMAIN_SAMPLES, LEGACY_GUIDANCE } from './error-doc-samples.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const errorsDir = join(root, 'docs/errors');
export const indexPath = join(errorsDir, 'README.md');
export const legacyTablePath = join(root, 'docs/ERROR-CODES.md');

export const catalog = loadErrorCatalog(root);

// ─────────────────────────────────────────────────────────────
// ۱) docs/ERROR-CODES.md (فهرست یکجا — #102)
// ─────────────────────────────────────────────────────────────

const md = [];
md.push('# کدهای خطای Zenith (ZEN-####)');
md.push('');
md.push('> این فایل به‌صورت خودکار از `packages/errors/src/core.ts` تولید می‌شود (#102).');
md.push('> برای تولید مجدد: `node scripts/generate-error-docs.mjs` (drift check: `--check`).');
md.push('> صفحهٔ مستقل هر کد (علت، نمونهٔ خطا، رفع): [`docs/errors/`](./errors/README.md) — #112.');
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
md.push('| کد | دامنه | دسته | پیام (FA) | Message (EN) | راه‌حل (suggestion) | مستندات |');
md.push('|---|---|---|---|---|---|---|');
for (const e of catalog.reserved) {
  const cell = (v) => String(v ?? '').replace(/\|/g, '\\|');
  md.push(
    `| \`${e.code}\` | ${e.domain} | ${e.category} | ${cell(e.fa)} | ${cell(e.en)} | ${cell(
      e.faSuggestion,
    )} | [صفحه](${relativeLivePath(e.code)}) |`,
  );
}
md.push('');
md.push('## کدهای ۳رقمی (کلاسیک — renumber نمی‌شوند)');
md.push('');
md.push('| کد | دسته | توضیح (EN) | مستندات |');
md.push('|---|---|---|---|');
for (const e of catalog.legacy) {
  md.push(
    `| \`${e.code}\` | ${e.category} | ${e.en ?? ''} | [صفحه](${relativeLivePath(e.code)}) |`,
  );
}
md.push('');
md.push('## کدهای deprecation (ZEN-DEPR-###)');
md.push('');
md.push('| کد | API قدیمی | جایگزین | حذف در | مستندات |');
md.push('|---|---|---|---|---|');
for (const e of catalog.deprecations) {
  md.push(
    `| \`${e.code}\` | \`${e.api}\` | \`${e.replacement}\` | ${e.removedIn} | [صفحه](${relativeLivePath(e.code)}) |`,
  );
}
md.push('');
md.push('## قوانین `zenith check` (CLI)');
md.push('');
md.push(
  'قوانین امنیت/کیفیت `zenith check` در بازهٔ `ZEN-9000..9899` هستند (جایگزین شناسه‌های قدیمی Z001..Z820 در #102).',
);
md.push('');
md.push('---');
md.push('');
md.push(
  'لینک آنلاین هر کد: `https://zenith.dev/errors/<code>` (همان `docsUrl` روی `ZenithError`).',
);
md.push('');

/** مسیر نسبی صفحهٔ محلی از دید `docs/ERROR-CODES.md`. */
function relativeLivePath(code) {
  return `./errors/${code}.md`;
}

// ─────────────────────────────────────────────────────────────
// ۲) صفحهٔ مستقل هر کد — docs/errors/<CODE>.md (#112)
// ─────────────────────────────────────────────────────────────

/** صفحهٔ یک کد ۴رقمی رزورشده. */
function reservedPage(entry) {
  const sample = CODE_SAMPLES[entry.code] ?? DOMAIN_SAMPLES[entry.domain] ?? '';
  const lines = [
    `# ${entry.code}`,
    '',
    `> دامنه: **${entry.domain}** • دسته: **${entry.category}** • لینک آنلاین: ${onlineUrl(entry.code)}`,
    '',
    '## علت',
    '',
    entry.fa,
    '',
    `_EN:_ ${entry.en ?? '—'}`,
    '',
    '## نمونهٔ کد خطادار',
    '',
    '```ts',
    sample,
    '```',
    '',
    '## رفع',
    '',
    entry.faSuggestion,
    '',
    `_EN:_ ${entry.enSuggestion ?? '—'}`,
    '',
    '## نمونهٔ دسترسی به این کد',
    '',
    '```ts',
    "import { createReservedError, errorDocsUrl } from '@zenith/errors';",
    '',
    `const err = createReservedError('${entry.code}');`,
    'err.code;     // ' + `'${entry.code}'`,
    'err.docsUrl;  // ' + `'${onlineUrl(entry.code)}'`,
    '```',
    '',
    '---',
    '',
    `[فهرست کدها](./README.md) • [docsUrl](${onlineUrl(entry.code)}) = \`errorDocsUrl('${entry.code}')\``,
    '',
  ];
  return lines.join('\n');
}

/** صفحهٔ یک کد سه‌رقمی کلاسیک. */
function legacyPage(entry) {
  const prefix = entry.code.slice(4, 5);
  const guidance = LEGACY_GUIDANCE[Number(prefix)] ?? LEGACY_GUIDANCE[9];
  const lines = [
    `# ${entry.code}`,
    '',
    `> دسته: **${entry.category}** • کد کلاسیک (سه‌رقمی؛ renumber نمی‌شود — DEC-020) • لینک آنلاین: ${onlineUrl(entry.code)}`,
    '',
    '## علت',
    '',
    entry.en ?? '—',
    '',
    entry.key ? `ثابت کاتالوگ: \`ErrorCode.${entry.key}\`` : '',
    '',
    '## نمونهٔ کد خطادار',
    '',
    '```ts',
    `import { ErrorCode } from '@zenith/errors';`,
    '',
    `// هرجای کد که این شرط رخ دهد با کد ${entry.code} گزارش/پرتاب می‌شود`,
    `const code = ErrorCode.${entry.key ?? 'INTERNAL_UNKNOWN'}; // '${entry.code}'`,
    '```',
    '',
    '## رفع',
    '',
    guidance,
    '',
    '---',
    '',
    `[فهرست کدها](./README.md) • [docsUrl](${onlineUrl(entry.code)}) = \`errorDocsUrl('${entry.code}')\``,
    '',
  ];
  return lines.join('\n').replace(/\n{3,}/g, '\n\n');
}

/** صفحهٔ یک کد deprecation. */
function deprecationPage(entry) {
  const lines = [
    `# ${entry.code}`,
    '',
    `> هشدار deprecation • حذف در نسخهٔ **${entry.removedIn}** (DEC-026) • لینک آنلاین: ${onlineUrl(entry.code)}`,
    '',
    '## علت',
    '',
    `API قدیمی \`${entry.api}\` فراخوانی شده است. این نام در نسخهٔ ${entry.removedIn} حذف می‌شود.`,
    '',
    '## نمونهٔ کد خطادار',
    '',
    '```ts',
    `import { ${entry.api.match(/^[A-Za-z0-9_$]+/)?.[0] ?? 'legacyApi'} } from '@zenith/…'; // ❌ منسوخ`,
    '```',
    '',
    '## رفع',
    '',
    `از \`${entry.replacement}\` استفاده کنید.`,
    '',
    '```ts',
    entry.replacement,
    '```',
    '',
    '---',
    '',
    `[فهرست کدها](./README.md) • [docsUrl](${onlineUrl(entry.code)}) = \`errorDocsUrl('${entry.code}')\``,
    '',
  ];
  return lines.join('\n');
}

function onlineUrl(code) {
  return `https://zenith.dev/errors/${code}`;
}

const pages = new Map();
for (const entry of catalog.reserved) pages.set(entry.code, reservedPage(entry));
for (const entry of catalog.legacy) pages.set(entry.code, legacyPage(entry));
for (const entry of catalog.deprecations) pages.set(entry.code, deprecationPage(entry));

// ─────────────────────────────────────────────────────────────
// ۳) فهرست docs/errors/README.md
// ─────────────────────────────────────────────────────────────

const index = [];
index.push('# فهرست صفحهٔ خطاهای Zenith (#112)');
index.push('');
index.push('> این پوشه به‌صورت خودکار تولید می‌شود:');
index.push(
  '> `node scripts/generate-error-docs.mjs` — گیت تازگی: `node scripts/check-error-docs.mjs`.',
);
index.push('');
index.push(
  `هر کد خطا یک صفحه با **علت**، **نمونهٔ کد خطادار** و **رفع** دارد. ` +
    `\`ZenithError.docsUrl\` همیشه با \`errorDocsUrl(code)\` پر می‌شود و چاپ خطا آن را نشان می‌دهد.`,
);
index.push('');
index.push(`| کد | دسته/دامنه | صفحه |`);
index.push('|---|---|---|');
for (const e of catalog.reserved) {
  index.push(`| \`${e.code}\` | ${e.domain} | [${e.code}](./${e.code}.md) |`);
}
for (const e of catalog.legacy) {
  index.push(`| \`${e.code}\` | ${e.category} (کلاسیک) | [${e.code}](./${e.code}.md) |`);
}
for (const e of catalog.deprecations) {
  index.push(
    `| \`${e.code}\` | deprecation → \`${e.replacement}\` | [${e.code}](./${e.code}.md) |`,
  );
}
index.push('');
index.push('## منابع مرتبط');
index.push('');
index.push('- [docs/ERROR-CODES.md](../ERROR-CODES.md) — جدول یکجا + انتخاب زبان پیام');
index.push('- [docs/ERROR-REPORTING.md](../ERROR-REPORTING.md) — مسیر گزارش خطای زمان اجرا (hub)');
index.push('- [docs/DEPRECATION-POLICY.md](../DEPRECATION-POLICY.md) — سیاست حذف در ۲.۰');
index.push('');
const indexOutput = index.join('\n');
const errorOutput = md.join('\n');

/**
 * محتوای کاملِ مستندات خطا را می‌سازد (بدون نوشتن روی دیسک).
 *
 * @param {string} [rootDir] ریشهٔ مخزن (برای مسیرهای نسبی)
 * @returns {{files: Map<string, string>, counts: {reserved: number, legacy: number, deprecations: number}}}
 *   کلید `files` = مسیر نسبی به ریشهٔ مخزن.
 */
export function buildErrorDocs(rootDir = root) {
  const files = new Map();
  for (const [code, body] of pages) {
    files.set(join('docs/errors', `${code}.md`), body);
  }
  files.set(join('docs/errors', 'README.md'), indexOutput);
  files.set('docs/ERROR-CODES.md', errorOutput);
  void rootDir;
  return {
    files,
    counts: {
      reserved: catalog.reserved.length,
      legacy: catalog.legacy.length,
      deprecations: catalog.deprecations.length,
    },
  };
}

/** نام همهٔ کدهایی که صفحه دارند (برای تست/CI). */
export function documentedCodes() {
  return [...pages.keys()];
}
