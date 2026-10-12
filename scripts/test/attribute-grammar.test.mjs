// #173 — تست‌های گیت attribute-grammar: تابع خالص checkAttributeGrammar با
// fixture (موارد RED) + سازگاری واقعی سند↔seed در مخزن (mعیار پذیرش #173).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { checkAttributeGrammar } from '../attribute-grammar.mjs';

/** ساخت سند حداقلی با §۱.۱..۱.۱۰ کامل و جدول §۴ داده‌شده. */
function makeDoc(tableRows) {
  const sections = ['۱.۱', '۱.۲', '۱.۳', '۱.۴', '۱.۵', '۱.۶', '۱.۷', '۱.۸', '۱.۹', '۱.۱۰']
    .map((t) => `### ${t} قاعده\n\n\`\`\`html\n<div zen-x="y"></div>\n\`\`\`\n`)
    .join('\n');
  const rows = Array.from({ length: 10 }, (_, i) => i).map((i) =>
    tableRows && tableRows[i]
      ? `| \`${tableRows[i].name}\` | attribute | runtime | expression | ${tableRows[i].opts ?? '—'} | ✅ |`
      : `| \`zen-d${i}\` | attribute | runtime | expression | — | ✅ |`,
  );
  return `# سند\n\n${sections}\n\n## ۴. جدول\n\n| directive | kind | package | نوع مقدار | گزینه‌ها/همراه (از سند) | سازگار؟ |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n`;
}

function seedWith(directives) {
  return { directives };
}

/** نام‌های جدول یک سند fixture ⇒ seed پیش‌فرض (برای ایزوله‌کردن هر تست). */
function namesInDoc(doc) {
  return [
    ...new Set(
      doc
        .split('\n')
        .filter((l) => l.startsWith('| `zen-') && /✅|⚠️/.test(l))
        .map((l) => /`([^`]+)`/.exec(l)[1]),
    ),
  ];
}

/** seed پیش‌فرض: هر نام جدول ثبت‌شده، بدون attributes. */
function defaultSeed(doc, extra = {}) {
  return seedWith(
    namesInDoc(doc).map((name) => ({ name, ...(extra[name] ? { attributes: extra[name] } : {}) })),
  );
}

describe('checkAttributeGrammar — fixtureها', () => {
  it('سند و seed سازگار ⇒ بدون خطا', () => {
    expect(
      checkAttributeGrammar(
        makeDoc(),
        seedWith(Array.from({ length: 10 }, (_, i) => ({ name: `zen-d${i}` }))),
      ),
    ).toEqual([]);
  });

  it('RED: directive جدول در seed ثبت نشده', () => {
    const errs = checkAttributeGrammar(makeDoc(), seedWith([{ name: 'zen-d0' }]));
    expect(errs.some((e) => e.includes('در seed رجیستری ثبت نشده'))).toBe(true);
  });

  it('RED: گزینه در جدول ولی نه در attributes seed (no-unknown-option)', () => {
    const doc = makeDoc([{ name: 'zen-alpha', opts: '`zen-alpha-bogus`' }]);
    const errs = checkAttributeGrammar(doc, seedWith([{ name: 'zen-alpha' }]));
    expect(errs.some((e) => e.includes('no-unknown-option') && e.includes('zen-alpha-bogus'))).toBe(
      true,
    );
  });

  it('گزینهٔ ثبت‌شده در attributes ⇒ سازگار', () => {
    const doc = makeDoc([{ name: 'zen-alpha', opts: '`zen-alpha-opt`' }]);
    expect(
      checkAttributeGrammar(doc, defaultSeed(doc, { 'zen-alpha': ['zen-alpha-opt'] })),
    ).toEqual([]);
  });

  it('ستون :param از بررسی no-unknown-option مستثناست (§۲)', () => {
    const doc = makeDoc([{ name: 'zen-alpha', opts: '` :param (`zen-bind:<attr>`)`' }]);
    expect(checkAttributeGrammar(doc, defaultSeed(doc))).toEqual([]);
  });

  it('RED: جدول کمتر از ۱۰ ردیف معتبر (نام‌های غیرkebab شمارش نمی‌شوند)', () => {
    // نام‌های d0..d9 را به dX0..dX9 (غیرkebab) تبدیل کن: هیچ‌کدام معتبر نیست ⇒ ۰ < ۱۰
    const doc = makeDoc().replace(/zen-d(\d)`/g, 'zen-X$1`');
    const errs = checkAttributeGrammar(doc, defaultSeed(doc));
    expect(errs.some((e) => e.includes('حداقل ۱۰'))).toBe(true);
  });

  it('RED: بند §۱.x بدون نمونهٔ کد', () => {
    const doc = makeDoc().replace(
      '### ۱.۵ قاعده\n\n```html\n<div zen-x="y"></div>\n```\n',
      '### ۱.۵ قاعده\n',
    );
    const errs = checkAttributeGrammar(
      doc,
      seedWith(Array.from({ length: 10 }, (_, i) => ({ name: `zen-d${i}` }))),
    );
    expect(errs.some((e) => e.includes('۱.۵') && e.includes('نمونهٔ کد'))).toBe(true);
  });

  it('RED: بند گمشده', () => {
    // حذف کامل سرفصل §۱.۹ (اگر فقط ۹→۹۹ عوض شود، زیررشتهٔ «۱.۹» باقی می‌ماند)
    const doc = makeDoc().replace('### ۱.۹ قاعده\n\n```html\n<div zen-x="y"></div>\n```\n', '');
    const errs = checkAttributeGrammar(
      doc,
      seedWith(Array.from({ length: 10 }, (_, i) => ({ name: `zen-d${i}` }))),
    );
    expect(errs.some((e) => e.includes('۱.۹') && e.includes('پیدا نشد'))).toBe(true);
  });

  it('RED: نام غیر kebab در جدول', () => {
    const doc = makeDoc([{ name: 'zen-Bad' }]);
    const errs = checkAttributeGrammar(
      doc,
      seedWith([
        { name: 'zen-Bad' },
        ...Array.from({ length: 9 }, (_, i) => ({ name: `zen-d${i + 1}` })),
      ]),
    );
    expect(errs.some((e) => e.includes('kebab-case'))).toBe(true);
  });
});

describe('سند واقعی + seed مخزن (#173 acceptance)', () => {
  const root = process.cwd();
  const doc = readFileSync(join(root, 'docs', 'ATTRIBUTE-GRAMMAR.md'), 'utf8');
  const seed = JSON.parse(
    readFileSync(join(root, 'docs', 'meta', 'zenith.meta.seed.json'), 'utf8'),
  );

  it('سند با seed سازگار است (گیت سبز)', () => {
    expect(checkAttributeGrammar(doc, seed)).toEqual([]);
  });

  it('جدول §۴ دست‌کم ۱۰ directive طبقه‌بندی دارد', () => {
    const rows = doc.split('\n').filter((l) => l.startsWith('| `zen-') && /✅|⚠️/.test(l));
    expect(new Set(rows.map((r) => /`([^`]+)`/.exec(r)[1])).size).toBeGreaterThanOrEqual(10);
  });

  it('سند هر ۱۱ قاعدهٔ §۰.۳ SPEC را پوشش می‌دهد (۱.۱..۱.۱۰ + متادیتا)', () => {
    for (const k of [
      'zen-<name>',
      'kebab-case',
      '"false"',
      '500ms',
      'never',
      'zen-state',
      '-options=',
      'zen-action:<event>.<modifier>',
      'bubbles: true',
      'data-state',
      '--zen-',
      'DirectiveMeta',
    ]) {
      expect(doc, `کلیدواژهٔ «${k}» در سند`).toContain(k);
    }
  });

  it('سند به zenith.meta.json و defineDirectiveMeta و مسیر تولید لینک می‌کند', () => {
    expect(doc).toContain('zenith.meta.json');
    expect(doc).toContain('defineDirectiveMeta');
    expect(doc).toContain('gen-zenith-meta.mjs');
    expect(doc).toContain('html.customData.json');
  });

  it('موارد ناسازگار با شمارهٔ فایل:سطر مستند شده‌اند', () => {
    expect(doc).toContain('packages/crud/src/crud.ts:203');
    expect(doc).toContain('packages/runtime/src/directives/date-picker.ts:244');
  });

  it('لینک متقابل: API-CONVENTIONS و docs/README به این سند اشاره می‌کنند', () => {
    const api = readFileSync(join(root, 'docs', 'API-CONVENTIONS.md'), 'utf8');
    const readme = readFileSync(join(root, 'docs', 'README.md'), 'utf8');
    expect(api).toContain('ATTRIBUTE-GRAMMAR.md');
    expect(readme).toContain('ATTRIBUTE-GRAMMAR.md');
  });

  it('قوانین lint مطابق سند نام‌گذاری شده‌اند (valid-directive/no-unknown-option)', () => {
    expect(doc).toContain('valid-directive');
    expect(doc).toContain('no-unknown-option');
    expect(doc).toContain('#159');
  });
});
