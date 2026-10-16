#!/usr/bin/env node
/**
 * DEC index generator — `docs/decisions/README.md` (#108/#112، AGENT-INSTRUCTIONS §4).
 *
 * چرا اسکریپت و نه نوشتن دستی؟ شمارهٔ بعدی، شمارش و لینک‌ها باید همیشه با پوشهٔ
 * `docs/decisions/` هم‌گام باشند؛ فهرست دست‌نویس در عمل عقب می‌ماند (همان
 * درسی که در #112 برای صفحات کد خطا گرفته شد).
 *
 *   node scripts/generate-dec-index.mjs           # بازتولید فهرست
 *   node scripts/generate-dec-index.mjs --check   # فقط بررسی هم‌گامی (CI)
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEC_DIR = join(ROOT, 'docs', 'decisions');
const INDEX_FILE = join(DEC_DIR, 'README.md');

/** `# DEC-007 — حداقل Node…` یا `# DEC-007: حداقل Node…` → { num, title }. */
export function parseDecisionHeader(firstLine) {
  const m = /^#\s*(DEC-\d{3})\s*[:—–-]\s*(.+)$/.exec(firstLine.trim());
  if (m) return { num: m[1], title: m[2].trim() };
  return { num: null, title: firstLine.trim() };
}

/** همهٔ ردیف‌های فهرست از روی فایل‌های پوشه (مرتب بر اساس شماره). */
export function collectDecisionRows(decDir = DEC_DIR) {
  const files = readdirSync(decDir)
    .filter((f) => /^DEC-\d{3}-.*\.md$/.test(f))
    .sort();
  return files.map((file) => {
    const first = readFileSync(join(decDir, file), 'utf8').split('\n', 1)[0];
    const { num, title } = parseDecisionHeader(first);
    return { file, num: num ?? file.slice(0, 7), title };
  });
}

/** متن کامل فهرست (خروجی همان چیزی است که در `docs/decisions/README.md` می‌نشیند). */
export function buildDecisionIndex(decDir = DEC_DIR) {
  const rows = collectDecisionRows(decDir);
  const lines = [
    '# فهرست تصمیم‌های معماری (DEC index)',
    '',
    'این فهرست **خودکار** از روی نام و تیتر فایل‌های `docs/decisions/DEC-*.md` ساخته می‌شود:',
    '`node scripts/generate-dec-index.mjs` برای بازتولید و `npm run check:dec-index` برای اطمینان از',
    'هم‌گامیِ فهرست با پوشه (هر دو در CI از طریق `scripts/test/rfc-decisions.test.mjs`).',
    '',
    `آخرین شماره: **${rows.at(-1)?.num ?? '—'}** — تعداد تصمیم‌ها: **${rows.length}** (بدون شمارهٔ تکراری).`,
    '',
    '| # | فایل | عنوان |',
    '|---|------|-------|',
    ...rows.map((r) => `| ${r.num} | [\`${r.file}\`](./${r.file}) | ${r.title} |`),
    '',
    '## قواعد ثبت',
    '',
    '1. شماره بعدی = بزرگ‌ترین شمارهٔ موجود + ۱؛ شمارهٔ تکراری خطاست',
    '   (`scripts/test/rfc-decisions.test.mjs`).',
    '2. قالب: تیتر `# DEC-NNN: …` و بخش‌های `## زمینه`، `## گزینه‌ها`،',
    '   `## تصمیم و دلیل`، `## پیامدها` (+ لینک issueهای تحت‌تأثیر).',
    '3. تصمیم‌های جزئی در پیام کامیت کافی است؛ فقط تصمیم معماری/قرارداد DEC می‌گیرد',
    '   (AGENT-INSTRUCTIONS §4).',
    '4. هر DEC جدید باید در این فهرست دیده شود و در `docs/progress/PROGRESS.md`',
    '   شرح داده شود.',
    '',
  ];
  return lines.join('\n');
}

/** نوشتن یا بررسی فهرست. */
export function generateDecIndex({
  checkOnly = false,
  decDir = DEC_DIR,
  indexFile = INDEX_FILE,
} = {}) {
  const expected = buildDecisionIndex(decDir);
  if (checkOnly) {
    let actual = null;
    try {
      actual = readFileSync(indexFile, 'utf8');
    } catch {
      throw new Error(
        'docs/decisions/README.md (فهرست DEC) وجود ندارد — npm run dec:index را اجرا کنید.',
      );
    }
    return { rows: collectDecisionRows(decDir), stale: actual !== expected };
  }
  writeFileSync(indexFile, expected, 'utf8');
  return { rows: collectDecisionRows(decDir), stale: false };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const checkOnly = process.argv.includes('--check');
  const { rows, stale } = generateDecIndex({ checkOnly });
  if (checkOnly) {
    if (stale) {
      console.error(
        '❌ docs/decisions/README.md با پوشهٔ decisions هم‌گام نیست — `node scripts/generate-dec-index.mjs` را اجرا کنید.',
      );
      process.exit(1);
    }
    console.log(`✅ DEC index up to date: ${rows.length} تصمیم (آخرین: ${rows.at(-1)?.num}).`);
  } else {
    console.log(`✅ DEC index بازتولید شد: ${rows.length} تصمیم (آخرین: ${rows.at(-1)?.num}).`);
  }
}
