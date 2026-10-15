// @vitest-environment jsdom
//
// #106 — اجرای مثال‌های `test-dom` مستندات. فایل جداگانه است چون محیط vitest
// per-file است: docblock بالا کل این فایل را jsdom می‌کند و مثال‌هایی که به
// `document` نیاز دارند اینجا بارگذاری/اجرا می‌شوند. گیت کامپایل مشترک در
// scripts/test/docs-examples.test.mjs و scripts/check-docs-examples.mjs است.
import { describe, it, expect, afterAll } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractDocExamples, moduleNameFor } from '../../scripts/lib/docs-examples.mjs';

const ROOT = process.cwd();
const TEMP_DIR = join(ROOT, '.docexamples');

afterAll(() => {
  rmSync(TEMP_DIR, { recursive: true, force: true });
});

describe('#106 jsdom documentation examples', () => {
  it('executes every test-dom example', async () => {
    const examples = extractDocExamples(ROOT).filter((e) => e.mode === 'test-dom');
    expect(examples.length).toBeGreaterThan(0);

    mkdirSync(TEMP_DIR, { recursive: true });
    const loaded = [];
    try {
      for (const example of examples) {
        const file = join(TEMP_DIR, moduleNameFor(example));
        writeFileSync(file, `// ${example.rel}:${example.line}\nexport {};\n\n${example.code}\n`);
        const mod = await import(/* @vite-ignore */ pathToFileURL(file).href);
        expect(Object.keys(mod).length, `module for ${example.id} was not loaded`).toBeGreaterThan(
          0,
        );
        loaded.push(example.id);
      }
    } finally {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    expect(loaded.length).toBe(examples.length);
  });
});
