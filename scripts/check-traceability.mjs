#!/usr/bin/env node
/**
 * #12 — Traceability Gate:
 * Ensures every BUG-*, IMP-*, and SEC-* claim in `packages/<pkg>/src/**`
 * is recorded in `docs/TRACEABILITY.md` with a valid source file and
 * an existing test file, and that no broken references to `audit/all.md`
 * exist in `packages/` or `docs/`.
 */
import { readdirSync, readFileSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const TAG_REGEX = /\b(BUG-(?:[A-Z]+-)?\d+|IMP-(?:[A-Z]+-)?\d+|SEC-[A-Z0-9-]+)\b/g;

function walkFiles(dir, predicate, out = []) {
  if (!existsSync(dir)) return out;
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (err) {
    // #82/#172: پوشهٔ گذرای scaffold موازی ممکن است وسط walk محو شود.
    if (err && err.code === 'ENOENT') return out;
    throw err;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let st;
    try {
      st = statSync(full);
    } catch (err) {
      if (err && err.code === 'ENOENT') continue;
      throw err;
    }
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry === 'out') continue;
      walkFiles(full, predicate, out);
    } else if (predicate(full)) {
      out.push(full);
    }
  }
  return out;
}

export function collectSourceClaims(rootDir = process.cwd()) {
  const packagesDir = join(rootDir, 'packages');
  const srcFiles = walkFiles(packagesDir, (p) => p.includes('/src/') && /\.(ts|js|mjs)$/.test(p));

  /** @type {Map<string, { sources: Set<string>; tests: Set<string> }>} */
  const claims = new Map();

  for (const file of srcFiles) {
    const rel = relative(rootDir, file).replace(/\\/g, '/');
    const pkgSlug = rel.split('/')[1];
    const testDir = join(packagesDir, pkgSlug, 'test');
    const pkgTests = existsSync(testDir)
      ? readdirSync(testDir)
          .filter((f) => /\.test\.(ts|mjs|js)$/.test(f))
          .sort()
          .map((f) => `packages/${pkgSlug}/test/${f}`)
      : [];

    // #82/#172: به‌موازات اجرای workerهای vitest، تست scaffold دریکتوری موقت
    // packages/tmp-scaffold-verify می‌سازد و در همان لحظه پاک می‌کند؛ فایلِ
    // لیست‌شده ممکن است میان walk و read از بین برود (ENOENT). نادیده‌گیری امن است:
    // فایل گذرا بخشی از حقیقت مخزن نیست.
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch (err) {
      if (err && err.code === 'ENOENT') continue;
      throw err;
    }
    for (const match of content.matchAll(TAG_REGEX)) {
      const id = match[1];
      if (!claims.has(id)) {
        claims.set(id, { sources: new Set(), tests: new Set() });
      }
      const entry = claims.get(id);
      entry.sources.add(rel);
      for (const t of pkgTests) {
        entry.tests.add(t);
      }
    }
  }

  return claims;
}

export function generateTraceabilityMarkdown(rootDir = process.cwd()) {
  const claims = collectSourceClaims(rootDir);
  const sortedIds = [...claims.keys()].sort((a, b) => a.localeCompare(b));

  const lines = [
    '# جدول ردیابی ادعاهای رفع باگ و بهبود (#12 — Traceability Matrix)',
    '',
    'این سند نگاشت تمام شناسه‌های `BUG-*`، `IMP-*` و `SEC-*` موجود در کد منبع (`packages/*/src/**`) به فایل‌های پیاده‌سازی و فایل‌های تست متناظر را ثبت می‌کند و در CI توسط `scripts/check-traceability.mjs` اعتبارسنجی می‌شود.',
    '',
    '| شناسه (ID) | فایل(های) منبع | فایل(های) تست پوشش‌دهنده |',
    '|---|---|---|',
  ];

  for (const id of sortedIds) {
    const entry = claims.get(id);
    const sources = [...entry.sources]
      .sort()
      .map((s) => `\`${s}\``)
      .join(', ');
    const tests = [...entry.tests]
      .sort()
      .map((t) => `\`${t}\``)
      .join(', ');
    lines.push(`| \`${id}\` | ${sources} | ${tests} |`);
  }

  lines.push('');
  return lines.join('\n');
}

export function checkTraceability(rootDir = process.cwd()) {
  const errors = [];
  const tracePath = join(rootDir, 'docs', 'TRACEABILITY.md');

  if (!existsSync(tracePath)) {
    errors.push('Missing docs/TRACEABILITY.md');
    return { ok: false, errors, count: 0 };
  }

  const traceContent = readFileSync(tracePath, 'utf8');
  const claims = collectSourceClaims(rootDir);

  // Parse rows in docs/TRACEABILITY.md
  const tableRows = new Map();
  for (const line of traceContent.split('\n')) {
    const m = line.match(/^\|\s*`([^`]+)`\s*\|\s*([^|]+)\|\s*([^|]+)\|/);
    if (m) {
      const id = m[1].trim();
      const srcFiles = [...m[2].matchAll(/`([^`]+)`/g)].map((x) => x[1]);
      const testFiles = [...m[3].matchAll(/`([^`]+)`/g)].map((x) => x[1]);
      tableRows.set(id, { srcFiles, testFiles });
    }
  }

  for (const [id, entry] of claims.entries()) {
    if (entry.tests.size === 0) {
      errors.push(`${id}: package has no test files covering ${[...entry.sources].join(', ')}`);
    }
    const row = tableRows.get(id);
    if (!row) {
      errors.push(`${id}: missing from docs/TRACEABILITY.md`);
      continue;
    }
    if (row.testFiles.length === 0) {
      errors.push(`${id}: row in docs/TRACEABILITY.md has no test files listed`);
    }
    for (const tf of row.testFiles) {
      if (!existsSync(join(rootDir, tf))) {
        errors.push(`${id}: referenced test file does not exist: ${tf}`);
      }
    }
    for (const sf of row.srcFiles) {
      if (!existsSync(join(rootDir, sf))) {
        errors.push(`${id}: referenced source file does not exist: ${sf}`);
      }
    }
  }

  // #31: Verify every claimed BUG-*/IMP-*/SEC-* ID is referenced inside at least one test file
  const allTestFiles = [
    ...walkFiles(
      join(rootDir, 'packages'),
      (p) => p.includes('/test/') && /\.test\.(ts|mjs|js)$/.test(p),
    ),
    ...walkFiles(join(rootDir, 'scripts', 'test'), (p) => /\.test\.(ts|mjs|js)$/.test(p)),
  ];
  const combinedTestSource = allTestFiles.map((f) => readFileSync(f, 'utf8')).join('\n');
  const untestedIds = [];
  for (const id of claims.keys()) {
    if (!combinedTestSource.includes(id)) {
      untestedIds.push(id);
      errors.push(`${id}: no regression test references identifier '${id}' (#31)`);
    }
  }

  // Ensure no broken references to audit/all.md in packages/ or docs/
  const docAndPkgFiles = [
    ...walkFiles(join(rootDir, 'docs'), (p) => /\.(md|ts|js|mjs)$/.test(p)),
    ...walkFiles(join(rootDir, 'packages'), (p) => /\.(md|ts|js|mjs)$/.test(p)),
  ];
  for (const file of docAndPkgFiles) {
    const rel = relative(rootDir, file).replace(/\\/g, '/');
    if (rel === 'docs/progress/PROGRESS.md') continue;
    // همان race تست scaffold موازی (بالاتر) — فایل گذرا را رد کن.
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch (err) {
      if (err && err.code === 'ENOENT') continue;
      throw err;
    }
    if (text.includes('audit/all.md')) {
      errors.push(`Broken reference to non-existent audit/all.md in ${rel}`);
    }
  }

  return { ok: errors.length === 0, errors, count: claims.size, untestedIds };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  if (process.argv.includes('--write')) {
    const md = generateTraceabilityMarkdown(process.cwd());
    writeFileSync(join(process.cwd(), 'docs', 'TRACEABILITY.md'), md, 'utf8');
    console.log('✅ docs/TRACEABILITY.md generated.');
  }
  const res = checkTraceability(process.cwd());
  if (!res.ok) {
    for (const err of res.errors) {
      console.error(`❌ [traceability] ${err}`);
    }
    process.exit(1);
  }
  console.log(`✅ traceability (#12): ${res.count} BUG/IMP/SEC identifiers verified.`);
}
