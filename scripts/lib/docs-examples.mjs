// scripts/lib/docs-examples.mjs
//
// #106 — استخراج مثال‌های اجراشدنی از مستندات.
//
// قرارداد علامت‌گذاری (info string فنس کد):
//   ```ts test        → باید **کامپایل** شود (tsc --noEmit با resolve به src)
//   ```ts test-run    → کامپایل + **اجرا** در Node (بدون DOM)
//   ```ts test-dom    → کامپایل + **اجرا** با jsdom
//   ```html test      → به‌عنوان markup معتبر در فایل fixture بررسی می‌شود
//
// فقط بلوک‌های علامت‌خورده استخراج می‌شوند؛ بقیهٔ مستندات دست‌نخورده‌اند.
// پوشه‌های تولیدشده (docs/api، docs/errors، docs/meta) اسکن نمی‌شوند.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/** پوشه‌های تولیدشده/خارجی که هرگز مثال ندارند. */
export const SKIP_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'out',
  'coverage',
  'artifacts',
  'browser-bundles',
  'demos',
  'ecommerce-demo',
  'dashboard',
  'benchmarks',
  '.tsbuild',
  '.docexamples',
  '.arena',
];

/** ریشه‌هایی که اسکن می‌شوند (README ریشه + README پکیج‌ها + docs). */
export function docFiles(root) {
  const out = [join(root, 'README.md')];
  const docsDir = join(root, 'docs');
  const walk = (dir, depth = 0) => {
    if (depth > 4) return;
    for (const dirent of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.includes(dirent.name)) continue;
      const abs = join(dir, dirent.name);
      if (dirent.isDirectory()) walk(abs, depth + 1);
      else if (dirent.name.endsWith('.md')) out.push(abs);
    }
  };
  walk(docsDir);

  const packagesDir = join(root, 'packages');
  for (const dirent of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!dirent.isDirectory()) continue;
    const readme = join(packagesDir, dirent.name, 'README.md');
    try {
      if (statSync(readme).isFile()) out.push(readme);
    } catch {
      /* پکیج بدون README */
    }
    const pkgDocs = join(packagesDir, dirent.name, 'docs');
    try {
      if (statSync(pkgDocs).isDirectory()) walk(pkgDocs);
    } catch {
      /* بدون docs */
    }
  }
  return [...new Set(out)].filter((f) => !SKIP_DIRS.some((d) => f.includes(`${sep}${d}${sep}`)));
}

const MODES = new Set(['test', 'test-run', 'test-dom']);

/**
 * همهٔ بلوک‌های علامت‌خورده را استخراج می‌کند.
 *
 * @param {string} root ریشهٔ مخزن
 * @param {{files?: string[]}} [opts]
 * @returns {Array<{file: string, rel: string, line: number, lang: string, mode: string,
 *   title: string, code: string, id: string}>}
 */
export function extractDocExamples(root, opts = {}) {
  const files = opts.files ?? docFiles(root);
  const examples = [];

  for (const file of files) {
    let text;
    try {
      text = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const lines = text.split('\n');
    let heading = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const headingMatch = /^#{1,6}\s+(.*)$/.exec(line);
      if (headingMatch) heading = headingMatch[1].trim();
      const fence = /^```([A-Za-z0-9_+-]*)\s*(.*)$/.exec(line);
      if (!fence) continue;
      const [, lang, meta] = fence;
      const tokens = meta.trim().split(/\s+/).filter(Boolean);
      const mode = tokens.find((t) => MODES.has(t));
      // بستن فنس
      let end = i + 1;
      while (end < lines.length && !/^```\s*$/.test(lines[end])) end++;
      if (!mode) {
        i = end;
        continue;
      }
      const code = lines.slice(i + 1, end).join('\n');
      const rel = relative(root, file).split(sep).join('/');
      examples.push({
        file,
        rel,
        line: i + 1,
        lang: lang || 'text',
        mode,
        title: tokens.filter((t) => !MODES.has(t)).join(' ') || heading,
        code,
        id: `${rel}#L${i + 1}`,
      });
      i = end;
    }
  }

  return examples;
}

/** نام فایل ماژول موقت برای یک مثال اجراشدنی. */
export function moduleNameFor(example) {
  const safe = example.id.replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `${safe}.ts`;
}

/** هدر لازم برای اجرای مثال در vitest (jsdom برای test-dom). */
export function runtimeHeader(example) {
  if (example.mode === 'test-dom') return '// @vitest-environment jsdom\n';
  return '';
}
