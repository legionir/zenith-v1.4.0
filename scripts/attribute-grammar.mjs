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
// #120 (ادامهٔ همین گیت):
//   ۵) «هیچ `JSON.parse` مستقیم روی مقدار attribute» — مقدار attribute فقط از
//      مسیر مشترک `@zenith/schema/attr` (parseConfigAttr/parseJsonAttr/parseJsonValue)
//      خوانده می‌شود؛ در غیر این صورت گیت قرمز می‌شود.
//   ۶) «جدول §۴ همهٔ directiveهای موجود را پوشش می‌دهد» — نام‌های گرفته‌شده از
//      سطح attribute واقعی کد (`ZenithAttributes` + `defineDirective({name})`)
//      باید ردیفی در جدول §۴ داشته باشند.
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

// ── #120: استخراج سطح attribute از کد ──

/**
 * نام‌های `zen-*` از اینترفیس `ZenithAttributes` (منبع حقیقت attribute سطح DOM).
 * `zen-bind:class` → `zen-bind`؛ propهای بدون پیشوند (config/action) نادیده.
 *
 * @param {string} srcText محتوای packages/runtime/src/attributes.ts
 * @returns {string[]} نام‌های یکتا و مرتب
 */
export function extractAttributeSurface(srcText) {
  const start = srcText.indexOf('export interface ZenithAttributes');
  if (start === -1) return [];
  const end = srcText.indexOf('\n}', start);
  const body = srcText.slice(start, end === -1 ? srcText.length : end);
  const names = new Set();
  for (const m of body.matchAll(/^\s*'(zen-[^']+)'\??:/gm)) {
    names.add(m[1].split(':')[0]);
  }
  for (const m of body.matchAll(/^\s*(zen-[a-z0-9-]+)\??:/gm)) {
    names.add(m[1]);
  }
  return [...names].sort();
}

/**
 * نام directiveهای ثبت‌شده در کد: `defineDirective({ name: 'zen-…' })` و
 * رجیستری‌های صریح `{ name: 'zen-…', handler }` (کامپوننت‌های اعلانی).
 *
 * @param {Array<{path: string, text: string}>} files فایل‌های src (مسیر + محتوا)
 * @returns {Array<{name: string, file: string}>}
 */
export function extractRegisteredDirectives(files) {
  const out = [];
  for (const { path, text } of files) {
    for (const m of text.matchAll(/\bname:\s*'(zen-[a-z0-9-]+)'/g)) {
      // فقط تعریف واقعی دایرکتیو: آبجکت حاویِ `bind(`/`handler:`/`priority:`/`attr:`.
      // (فهرست snippetهای افزونهٔ VS Code `snippet:` دارد و دایرکتیو نیست.)
      const start = text.lastIndexOf('{', m.index);
      const end = text.indexOf('}', m.index);
      const objectText = text.slice(start === -1 ? 0 : start, end === -1 ? text.length : end + 1);
      if (!/\bbind\s*\(|\bhandler\s*:|\bpriority\s*:|\battr\s*:/.test(objectText)) continue;
      out.push({ name: m[1], file: path });
    }
  }
  const seen = new Set();
  return out.filter((d) => (seen.has(d.name) ? false : (seen.add(d.name), true)));
}

/**
 * نام‌های `zen-*` جدول §۴ سند.
 *
 * @param {string} docText محتوای docs/ATTRIBUTE-GRAMMAR.md
 */
export function extractTabledNames(docText) {
  const names = new Set();
  for (const line of docText.split('\n')) {
    if (!line.startsWith('|')) continue;
    const cell = line.split('|')[1] ?? '';
    const m = /`(zen-[a-z0-9-]+)`/.exec(cell);
    if (m) names.add(m[1]);
  }
  return names;
}

/** سیگنال‌های «مقدار attribute» در یک expression جاوااسکریپت. */
const ATTRIBUTE_SIGNAL = /getAttribute\(|\battrs?\b|Attribute\b|\bAttr\b/;

/**
 * #120 — ممیزی `JSON.parse` روی مقدار attribute در src پکیج‌ها.
 *
 * هر `JSON.parse(...)` که آرگومانش از `getAttribute`/متغیر `*Attr*` بیاید تخلف
 * است، مگر داخل یکی از helperهای مشترک زیرمسیر `@zenith/schema/attr` باشد.
 * خطوط انتهای فایل با کامنت `attribute-json-allowlist:` معاف می‌شوند (با دلیل).
 *
 * @param {Array<{path: string, text: string}>} files
 * @returns {Array<{file: string, line: number, snippet: string}>}
 */
export function auditAttributeJsonParsing(files) {
  const violations = [];
  for (const { path, text } of files) {
    // فایل‌هایی که خودشان helper مشترک را پیاده می‌کنند مجازند.
    if (path.endsWith('packages/schema/src/attr.ts')) continue;
    if (path.endsWith('packages/schema/src/validate.ts')) continue; // parseConfigAttr
    const lines = text.split('\n');
    lines.forEach((line, i) => {
      if (!line.includes('JSON.parse')) return;
      const stripped = line.trim();
      // خطوط کامنت (JSDoc///) کد نیستند.
      if (stripped.startsWith('*') || stripped.startsWith('//') || stripped.startsWith('/*'))
        return;
      const window = lines.slice(Math.max(0, i - 3), i + 4).join(' ');
      const hasAllowlist = /attribute-json-allowlist:/.test(
        lines.slice(Math.max(0, i - 4), i + 2).join(' '),
      );
      if (hasAllowlist) return;
      if (!ATTRIBUTE_SIGNAL.test(window)) return;
      violations.push({ file: path, line: i + 1, snippet: line.trim().slice(0, 120) });
    });
  }
  return violations;
}

/**
 * #120 — پوشش جدول §۴ نسبت به سطح attribute واقعی کد + رجیستری directiveها.
 *
 * @param {string} docText سند
 * @param {string[]} surfaceNames نام‌های attribute سطح
 * @param {Array<{name: string, file: string}>} registered directiveهای ثبت‌شده
 * @param {{directives: Array<{name: string}>}} seed رجیستری متادیتا
 * @returns {string[]} خطاها
 */
export function auditDirectiveCoverage(docText, surfaceNames, registered, seed) {
  const errors = [];
  const tabled = extractTabledNames(docText);
  const seedNames = new Set((seed.directives ?? []).map((d) => d.name));
  const skip = new Set(['zen-state']); // گزینهٔ مشترک zen-fetch/zen-resource، خودش directive نیست
  for (const name of surfaceNames) {
    if (skip.has(name)) continue;
    if (!tabled.has(name)) {
      errors.push(`«${name}» در سطح attribute کد هست ولی ردیفی در جدول §۴ سند ندارد (#120).`);
    }
    if (!seedNames.has(name)) {
      errors.push(`«${name}» در سطح attribute کد هست ولی در seed متادیتا ثبت نشده (#120).`);
    }
  }
  for (const d of registered) {
    if (!tabled.has(d.name)) {
      errors.push(`directive «${d.name}» در سند نیست (${d.file}) — جدول §۴ ناقص است (#120).`);
    }
  }
  return errors;
}

// ── CLI ──
const isCli = process.argv[1] && import.meta.url === `file://${process.argv[1]}`;
if (isCli) {
  const { readFileSync, existsSync } = await import('node:fs');
  const { join, dirname } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const doc = readFileSync(join(root, 'docs', 'ATTRIBUTE-GRAMMAR.md'), 'utf8');
  const seed = JSON.parse(
    readFileSync(join(root, 'docs', 'meta', 'zenith.meta.seed.json'), 'utf8'),
  );
  const errs = checkAttributeGrammar(doc, seed);

  // #120: پوشش کامل جدول + ممنوعیت JSON.parse روی attribute.
  const { readdirSync, statSync } = await import('node:fs');
  const srcFiles = [];
  for (const pkg of readdirSync(join(root, 'packages'))) {
    const srcDir = join(root, 'packages', pkg, 'src');
    if (!existsSync(srcDir) || !statSync(srcDir).isDirectory()) continue;
    const walk = (dir) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (entry.startsWith('tmp-') || entry.startsWith('dist.')) continue;
        if (statSync(full).isDirectory()) walk(full);
        else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
          srcFiles.push({
            path: full.split('\\').join('/').split('zenith-v1.4.0/').pop(),
            text: readFileSync(full, 'utf8'),
          });
        }
      }
    };
    walk(srcDir);
  }
  const attributesSrc = readFileSync(
    join(root, 'packages', 'runtime', 'src', 'attributes.ts'),
    'utf8',
  );
  const surface = extractAttributeSurface(attributesSrc);
  const registered = extractRegisteredDirectives(srcFiles);
  errs.push(...auditDirectiveCoverage(doc, surface, registered, seed));
  for (const v of auditAttributeJsonParsing(srcFiles)) {
    errs.push(
      `JSON.parse روی مقدار attribute: ${v.file}:${v.line} — «${v.snippet}»؛ ` +
        'از parseConfigAttr/parseJsonAttr/parseJsonValue در @zenith/schema/attr استفاده کنید (#120).',
    );
  }

  if (errs.length) {
    console.error('❌ attribute-grammar (#120/#173):');
    for (const e of errs) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(
    `✅ attribute-grammar (#120/#173): جدول §۴ با seed سازگار، ${seed.directives.length} directive ثبت‌شده، ` +
      `${surface.length} نام سطح attribute و بدون JSON.parse روی attribute.`,
  );
}
