#!/usr/bin/env node
// scripts/check-docs-examples.mjs
//
// #106 — گیت CI مثال‌های مستندات: هر بلوک علامت‌خورده باید **کامپایل** شود و
// با تغییر API که مثال را می‌شکند، CI قرمز می‌شود.
//
//   ```ts test      → typecheck
//   ```ts test-run  → typecheck (اجرا در تست vitest انجام می‌شود، #106)
//   ```ts test-dom  → typecheck (اجرا با jsdom در تست vitest)
//
// پیاده‌سازی: هر مثال TS در پروژهٔ موقت `.docexamples/` کنار یک tsconfig تولید
// می‌شود که `@zenith/*` را مستقیماً به `packages/*/src` نگاشت می‌کند (همان
// قرارداد `scripts/typecheck-all.mjs`؛ بدون نیاز به dist) و با tsc --noEmit
// بررسی می‌شود. خطاها با آدرس «فایل:خط» مثال گزارش می‌شوند.
//
// اجرا: node scripts/check-docs-examples.mjs   (npm run check:docs-examples)

import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { spawnNode } from './lib/proc.mjs';
import { extractDocExamples, moduleNameFor } from './lib/docs-examples.mjs';

const requireFromHere = createRequire(import.meta.url);
const TSC_PATH = requireFromHere.resolve('typescript/bin/tsc');

export const DOC_EXAMPLES_DIR = '.docexamples';

/** tsconfig موقتِ مثال‌ها: resolve به src همهٔ پکیج‌ها (مثل #26). */
export function examplesTsconfig() {
  return {
    compilerOptions: {
      target: 'ES2022',
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      moduleResolution: 'bundler',
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      resolveJsonModule: true,
      types: ['node'],
      paths: {
        '@zenith/*': ['../packages/*/src/index.ts'],
        '@zenith/service-worker/sw': ['../packages/service-worker/src/sw.ts'],
        '@zenith/schema/zod': ['../packages/schema/src/zod.ts'],
        '@zenith/schema/json-schema': ['../packages/schema/src/json-schema.ts'],
        '@zenith/schema/attr': ['../packages/schema/src/attr.ts'],
        '@zenith/storage/signal': ['../packages/storage/src/signal.ts'],
        zenith: ['../packages/zenith/src/index.ts'],
        'zenith/core': ['../packages/zenith/src/core.ts'],
        'zenith/ssr': ['../packages/zenith/src/ssr.ts'],
        'zenith/testing': ['../packages/zenith/src/testing.ts'],
        'zenith/browser': ['../packages/zenith/src/browser.ts'],
      },
    },
    include: ['./*.ts'],
  };
}

/**
 * مثال‌ها را روی دیسک می‌نویسد و با tsc کامپایل می‌کند.
 *
 * @param {string} root ریشهٔ مخزن
 * @param {{examples?: Array<object>, keep?: boolean}} [opts]
 * @returns {{checked: number, failed: Array<{id: string, diagnostics: string}>, output: string}}
 */
export function checkDocExamples(root = process.cwd(), opts = {}) {
  const dir = join(root, DOC_EXAMPLES_DIR);
  const examples = (opts.examples ?? extractDocExamples(root)).filter(
    (e) => e.lang === 'ts' || e.lang === 'tsx' || e.lang === 'typescript',
  );
  const failed = [];

  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });

  if (examples.length === 0) {
    return { checked: 0, failed: [], output: 'no marked examples' };
  }

  const byModule = new Map();
  for (const example of examples) {
    const name = moduleNameFor(example);
    byModule.set(name, example);
    // هر مثال ماژول مستقل است؛ `export {}` جلوی خطای «global scope» را می‌گیرد.
    writeFileSync(
      join(dir, name),
      `// ${example.rel}:${example.line}\nexport {};\n\n${example.code}\n`,
    );
  }
  writeFileSync(join(dir, 'tsconfig.json'), JSON.stringify(examplesTsconfig(), null, 2));

  const result = spawnNode(TSC_PATH, ['-p', join(dir, 'tsconfig.json'), '--pretty', 'false'], {
    cwd: root,
    encoding: 'utf8',
  });
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;

  // خطاهای tsc را به مثال مربوطه نسبت می‌دهیم.
  const perFile = new Map();
  for (const line of output.split('\n')) {
    const m = new RegExp(`${DOC_EXAMPLES_DIR}[\\\\/]([^\\\\/()]+\\.ts)`).exec(line);
    if (!m) continue;
    const name = m[1];
    if (name === 'tsconfig.json') continue;
    const list = perFile.get(name) ?? [];
    list.push(line.trim());
    perFile.set(name, list);
  }
  for (const [name, diagnostics] of perFile) {
    const example = byModule.get(name);
    failed.push({ id: example?.id ?? name, diagnostics: diagnostics.join('\n') });
  }
  if (result.status !== 0 && failed.length === 0) {
    failed.push({ id: '(tsc)', diagnostics: output.trim() });
  }

  if (!opts.keep) rmSync(dir, { recursive: true, force: true });
  return { checked: examples.length, failed, output };
}

/** مثال‌های HTML علامت‌خورده: باید فنس html با محتوای غیرخالی باشند. */
export function checkHtmlExamples(root = process.cwd()) {
  return extractDocExamples(root)
    .filter((e) => e.mode === 'test' && (e.lang === 'html' || e.lang === 'markup'))
    .map((e) => ({ id: e.id, ok: e.code.trim().length > 0 && /<\w/.test(e.code) }));
}

// فقط وقتی مستقیم اجرا شود (برای تست‌پذیری).
if (process.argv[1] && process.argv[1].endsWith('check-docs-examples.mjs')) {
  const root = process.cwd();
  const { checked, failed } = checkDocExamples(root);
  if (checked === 0) {
    console.error(
      '❌ هیچ مثال علامت‌خورده‌ای پیدا نشد — فنس‌های ` ```ts test ` را در مستندات علامت بزنید (#106).',
    );
    process.exit(1);
  }
  const html = checkHtmlExamples(root).filter((h) => !h.ok);
  if (failed.length || html.length) {
    for (const f of failed) console.error(`❌ ${f.id}\n${f.diagnostics}\n`);
    for (const h of html) console.error(`❌ ${h.id}: مثال HTML خالی است\n`);
    console.error(`❌ ${failed.length + html.length} مثال شکسته است (از ${checked} مثال).`);
    process.exit(1);
  }
  console.log(`✅ ${checked} مثال مستندات کامپایل شد (doc-example gate #106).`);
  // پوشهٔ موقت هرگز باقی نمی‌ماند (Cleanup).
  rmSync(join(root, DOC_EXAMPLES_DIR), { recursive: true, force: true });
}
