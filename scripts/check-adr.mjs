#!/usr/bin/env node
// scripts/check-adr.mjs
//
// #108 — گیت ADRها (MADR):
//   • هر ADR شمارهٔ یکتا و ترتیبی (0001…) دارد و نام فایل با شماره/عنوان می‌خواند.
//   • بخش‌های اجباری MADR حاضرند: Status، Context and Problem Statement،
//     Decision Drivers، Considered Options، Decision Outcome، Consequences.
//   • Status یکی از مقادیر مجاز است و ADRهای Superseded به ADR موجود اشاره می‌کنند.
//   • هر ADR دست‌کم به یک DEC موجود در docs/decisions/ لینک می‌دهد (پیوند تصمیم↔ADR)
//     و همهٔ لینک‌های نسبی داخل ADRها به فایل موجود اشاره می‌کنند.
//   • فهرست ADRها در docs/adr/README.md بین نشانه‌های ADR-INDEX از خود فایل‌ها
//     تولید می‌شود (گیت تازگی؛ `--write` برای تولید).
//
// اجرا:  node scripts/check-adr.mjs [--write]

import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ADR_DIR = 'docs/adr';
export const INDEX_START = '<!-- ADR-INDEX:START -->';
export const INDEX_END = '<!-- ADR-INDEX:END -->';
export const MIN_ADRS = 10;

const REQUIRED_SECTIONS = [
  '## Context and Problem Statement',
  '## Decision Drivers',
  '## Considered Options',
  '## Decision Outcome',
  '### Consequences',
  '## Links',
];

const VALID_STATUS =
  /^- \*\*Status:\*\* (Accepted|Proposed|Deprecated|Rejected|Superseded by ADR-\d{4})\b/m;

/** ADRهای روی دیسک، مرتب‌شده بر اساس شماره. */
export function listAdrs(root = process.cwd()) {
  const dir = join(root, ADR_DIR);
  return readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && /^\d{4}-.+\.md$/.test(d.name) && d.name !== '0000-template.md')
    .map((d) => {
      const file = join(dir, d.name);
      const text = readFileSync(file, 'utf8');
      const m = /^(\d{4})-(.+)\.md$/.exec(d.name);
      return { file, name: d.name, number: Number(m[1]), slug: m[2], text };
    })
    .sort((a, b) => a.number - b.number);
}

/** عنوان H1 یک ADR ("# ADR-0001: …"). */
export function titleOf(adr) {
  return (/^#\s+(.+)$/m.exec(adr.text)?.[1] ?? `ADR-${String(adr.number).padStart(4, '0')}`).trim();
}

/** یک ردیف جدول فهرست برای ADR. */
export function indexRow(adr) {
  const num = String(adr.number).padStart(4, '0');
  const title = titleOf(adr).replace(/^ADR-\d{4}:\s*/, '');
  const status = /^- \*\*Status:\*\* (\w[^\n]*)$/m.exec(adr.text)?.[1]?.trim() ?? '—';
  return `| [ADR-${num}](./${adr.name}) | ${title} | ${status} |`;
}

/** جدول فهرست تولیدشده از ADRها. */
export function renderIndex(adrs) {
  const rows = ['| ADR | عنوان | وضعیت |', '|---|---|---|', ...adrs.map(indexRow)];
  return `${INDEX_START}\n${rows.join('\n')}\n${INDEX_END}`;
}

/** لینک‌های نسبی markdown داخل متن. */
function relativeLinks(text) {
  return [...text.matchAll(/\]\((\.{1,2}\/[^)#\s]+)\)/g)].map((m) => m[1]);
}

/**
 * اعتبارسنجی ADRها.
 *
 * @param {string} root
 * @returns {{problems: string[], adrs: Array<object>}}
 */
export function auditAdrs(root = process.cwd()) {
  const problems = [];
  const adrs = listAdrs(root);

  if (adrs.length < MIN_ADRS) {
    problems.push(`only ${adrs.length} ADRs (need >= ${MIN_ADRS}, #108)`);
  }

  adrs.forEach((adr, i) => {
    const expected = i + 1;
    if (adr.number !== expected) {
      problems.push(`${adr.name}: expected number ${String(expected).padStart(4, '0')}`);
    }
    for (const section of REQUIRED_SECTIONS) {
      if (!adr.text.includes(section)) problems.push(`${adr.name}: missing "${section}"`);
    }
    if (!VALID_STATUS.test(adr.text))
      problems.push(`${adr.name}: invalid or missing **Status:** line`);
    if (!/^#\s+ADR-\d{4}:/m.test(adr.text))
      problems.push(`${adr.name}: H1 must be "# ADR-NNNN: <title>"`);

    // پیوند تصمیم↔ADR: دست‌کم یک DEC موجود.
    const decLinks = relativeLinks(adr.text).filter((l) => l.includes('decisions/DEC-'));
    if (decLinks.length === 0) problems.push(`${adr.name}: no link to docs/decisions/DEC-*.md`);
    for (const link of decLinks) {
      if (!existsSync(resolve(dirname(adr.file), link.split('#')[0]))) {
        problems.push(`${adr.name}: broken DEC link ${link}`);
      }
    }
    for (const link of relativeLinks(adr.text)) {
      const target = resolve(dirname(adr.file), link.split('#')[0]);
      if (!existsSync(target)) problems.push(`${adr.name}: broken relative link ${link}`);
    }
    if (adr.text.split('\n').length < 25) problems.push(`${adr.name}: too short to be useful`);
  });

  // فهرست تازه؟
  const indexFile = join(root, ADR_DIR, 'README.md');
  if (!existsSync(indexFile)) {
    problems.push(`${ADR_DIR}/README.md is missing`);
  } else {
    const text = readFileSync(indexFile, 'utf8');
    const start = text.indexOf(INDEX_START);
    const end = text.indexOf(INDEX_END);
    if (start === -1 || end === -1) {
      problems.push(`${ADR_DIR}/README.md is missing the ${INDEX_START} … ${INDEX_END} block`);
    } else if (text.slice(start, end + INDEX_END.length) !== renderIndex(adrs)) {
      problems.push(
        `${ADR_DIR}/README.md index is stale (run: node scripts/check-adr.mjs --write)`,
      );
    }
  }

  return { problems, adrs };
}

/** جدول فهرست را در README جای‌گذاری می‌کند (منبع یکتا: خود فایل‌های ADR). */
export function writeIndex(root = process.cwd()) {
  const adrs = listAdrs(root);
  const indexFile = join(root, ADR_DIR, 'README.md');
  const text = readFileSync(indexFile, 'utf8');
  const start = text.indexOf(INDEX_START);
  const end = text.indexOf(INDEX_END);
  const next = `${text.slice(0, start)}${renderIndex(adrs)}${text.slice(end + INDEX_END.length)}`;
  writeFileSync(indexFile, next);
  return adrs.length;
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) {
  const root = process.cwd();
  if (process.argv.includes('--write')) {
    const count = writeIndex(root);
    console.log(`✅ فهرست ADR نوشته شد (${count} مورد).`);
  } else {
    const { problems, adrs } = auditAdrs(root);
    if (problems.length) {
      console.error(
        `❌ ADRها معتبر نیستند (${problems.length} مورد):\n` +
          problems.map((p) => `   • ${p}`).join('\n'),
      );
      process.exit(1);
    }
    console.log(
      `✅ ${adrs.length} ADR معتبر (MADR: وضعیت/زمینه/گزینه‌ها/تصمیم/پیامد + پیوند DEC + فهرست تازه).`,
    );
  }
}
