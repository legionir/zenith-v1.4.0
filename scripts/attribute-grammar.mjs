#!/usr/bin/env node
// #173 — گیت سازگاری گرامر attribute (docs/ATTRIBUTE-GRAMMAR.md ↔ رجیستری متادیتا).
//
// «قانون lint = سند = متادیتا» (SPEC §۰.۳): تا پیش از پیاده‌سازی قوانین
// eslint-plugin در #159، این گیت حداقلِ ماشین‌پذیر را در CI نگه می‌دارد:
//   ۱) هر directive در جدول طبقه‌بندی §۴ سند، در seed رجیستری ثبت شده باشد.
//   ۲) هر گزینهٔ `zen-<name>-<option>` یا همراه که در جدول آمده، در `attributes`
//      همان directive در seed باشد (قاعدهٔ §۱.۲/`no-unknown-option`).
//   ۳) جدول دست‌کم ۱۰ directive را طبقه‌بندی کرده باشد (معیار پذیرش #173).
//   ۴) هر قاعدهٔ §۱.۱..۱.۱۰ در سند حداقل یک نمونهٔ کد (```) داشته باشد.
//
// تابع خالص `checkAttributeGrammar(docText, seed)` export شده تا در
// scripts/test/attribute-grammar.test.mjs با fixture تست شود.

const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
const RULE_SECTIONS = ['۱.۱', '۱.۲', '۱.۳', '۱.۴', '۱.۵', '۱.۶', '۱.۷', '۱.۸', '۱.۹', '۱.۱۰'];

/** نام directive از سلول اول جدول (مثلاً `` `zen-persist` `` → 'zen-persist'). */
function cellName(cell) {
  const m = /`([^`]+)`/.exec(cell);
  return m ? m[1].trim() : cell.trim();
}

/** استخراج تمام توکن‌های `zen-…` از سلول گزینه‌ها (بدون `:param`). */
function optionTokens(cell) {
  const out = [];
  const re = /zen-[a-z0-9]+(?:-[a-z0-9]+)*/g;
  let m;
  while ((m = re.exec(cell)) !== null) out.push(m[0]);
  return out;
}

/**
 * @param {string} docText محتوای docs/ATTRIBUTE-GRAMMAR.md
 * @param {{directives: Array<{name:string; attributes?:string[]}>}} seed
 * @returns {string[]} فهرست خطا (خالی ⇒ سازگار)
 */
export function checkAttributeGrammar(docText, seed) {
  const errors = [];
  const byName = new Map((seed.directives ?? []).map((d) => [d.name, d]));

  // ── ۳) هر بند §۱.x یک نمونهٔ کد داشته باشد ──
  for (const tag of RULE_SECTIONS) {
    const start = docText.indexOf(`### ${tag} `);
    if (start === -1) {
      errors.push(`بند §${tag} در سند پیدا نشد.`);
      continue;
    }
    const next = docText.indexOf('\n### ', start + 1);
    const block = docText.slice(start, next === -1 ? docText.length : next);
    if (!block.includes('```')) errors.push(`§${tag} نمونهٔ کد (بلوک fenced) ندارد.`);
  }

  // ── جدول §۴ را خط‌به‌خط بخوان ──
  const rows = docText.split('\n').filter(
    (l) =>
      l.startsWith('| `zen-') &&
      // سرفصل/ردیف‌های TL;DR (§۰) را نادیده بگیر: جدول §۴ ستون «سازگار» دارد.
      /✅|⚠️/.test(l),
  );

  const tabledNames = [];
  for (const row of rows) {
    const cols = row.split('|').map((c) => c.trim());
    // cols[0] خالی (قبل از اولین |)، cols[1]=directive، cols[5]=گزینه‌ها
    const name = cellName(cols[1] ?? '');
    if (!name) continue;
    if (!KEBAB.test(name)) {
      errors.push(`نام «${name}» در جدول §۴ kebab-case نیست.`);
      continue;
    }
    tabledNames.push(name);
    const meta = byName.get(name);
    if (!meta) {
      errors.push(`«${name}» در جدول §۴ هست ولی در seed رجیستری ثبت نشده (#173).`);
      continue;
    }
    // گزینه‌های ستون پنجم: هر `zen-…` که خودش همان directive نیست، باید در
    // attributes ثبت‌شده باشد (قاعدهٔ no-unknown-option).
    const opts = (cols[5] ?? '').includes(':param')
      ? [] // form پارامتریک (§۲) در لیست ثابت attributes نمی‌گنجد
      : optionTokens(cols[5] ?? '');
    const attrs = new Set(meta.attributes ?? []);
    for (const opt of opts) {
      if (opt === name) continue;
      if (!attrs.has(opt)) {
        errors.push(
          `گزینهٔ «${opt}» برای «${name}» در جدول §۴ هست ولی در attributes آن در seed نیست (no-unknown-option).`,
        );
      }
    }
  }

  // ── ۳) حداقل ۱۰ directive طبقه‌بندی شده ──
  const uniq = new Set(tabledNames);
  if (uniq.size < 10) {
    errors.push(`جدول §۴ فقط ${uniq.size} directive دارد (حداقل ۱۰ لازم است).`);
  }

  return errors;
}

// ── CLI ──
const isCli = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  const { readFileSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const doc = readFileSync(join(root, 'docs', 'ATTRIBUTE-GRAMMAR.md'), 'utf8');
  const seed = JSON.parse(
    readFileSync(join(root, 'docs', 'meta', 'zenith.meta.seed.json'), 'utf8'),
  );
  const errs = checkAttributeGrammar(doc, seed);
  if (errs.length) {
    console.error('❌ attribute-grammar (#173):');
    for (const e of errs) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(
    `✅ attribute-grammar (#173): جدول §۴ با seed رجیستری سازگار؛ ${seed.directives.length} directive ثبت‌شده.`,
  );
}
