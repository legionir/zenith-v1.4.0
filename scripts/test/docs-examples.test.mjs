// @vitest-environment node
//
// #106 — اجرای مثال‌های علامت‌خوردهٔ مستندات در CI:
//   ۱) همهٔ بلوک‌های ```` ```ts test ```` باید کامپایل شوند (گیت tsc؛
//      scripts/check-docs-examples.mjs) — شکستن API یک مثال، CI را قرمز می‌کند.
//   ۲) بلوک‌های `test-run`/`test-dom` علاوه بر آن **اجرا** می‌شوند: هر مثال به
//      یک ماژول موقت در `.docexamples/` نوشته و با dynamic import در vitest
//      (aliasهای src؛ بدون نیاز به dist) بارگذاری می‌شود. `test-dom` با
//      docblock `@vitest-environment jsdom` اجرا می‌گردد.
//   ۳) پروب منفی: یک مثال عمداً شکسته باید توسط gate گرفته شود.
import { describe, it, expect, afterAll } from 'vitest';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  extractDocExamples,
  moduleNameFor,
  runtimeHeader,
} from '../../scripts/lib/docs-examples.mjs';
import { checkDocExamples } from '../../scripts/check-docs-examples.mjs';

const ROOT = process.cwd();
const TEMP_DIR = join(ROOT, '.docexamples');

afterAll(() => {
  rmSync(TEMP_DIR, { recursive: true, force: true });
});

const examples = extractDocExamples(ROOT);

describe('#106 documentation examples', () => {
  it('finds marked examples and every marker is well-formed', () => {
    expect(examples.length).toBeGreaterThanOrEqual(10);
    for (const example of examples) {
      expect(['test', 'test-run', 'test-dom']).toContain(example.mode);
      expect(example.code.trim().length).toBeGreaterThan(0);
      expect(example.rel.endsWith('.md')).toBe(true);
      expect(example.line).toBeGreaterThan(0);
    }
    const runnable = examples.filter((e) => e.mode === 'test-run' || e.mode === 'test-dom');
    expect(runnable.length).toBeGreaterThanOrEqual(2);
  });

  it('compiles every marked example (gate: check-docs-examples.mjs)', () => {
    const { checked, failed } = checkDocExamples(ROOT);
    expect(failed, failed.map((f) => `${f.id}\n${f.diagnostics}`).join('\n')).toEqual([]);
    expect(checked).toBeGreaterThanOrEqual(10);
  });

  it('the gate reports a broken example instead of passing silently', () => {
    const broken = [
      {
        file: join(ROOT, 'docs/COOKBOOK.md'),
        rel: 'docs/COOKBOOK.md',
        line: 1,
        lang: 'ts',
        mode: 'test',
        title: 'negative probe',
        code: "import { notAnApiOfZenith } from '@zenith/state';\nexport const x = notAnApiOfZenith;",
        id: 'docs/COOKBOOK.md#L1',
      },
    ];
    const { failed, checked } = checkDocExamples(ROOT, { examples: broken });
    expect(checked).toBe(1);
    expect(failed.length).toBe(1);
    expect(failed[0].id).toBe('docs/COOKBOOK.md#L1');
    expect(failed[0].diagnostics).toContain('notAnApiOfZenith');
  });

  it('executes every test-run example (test-dom examples run in docs-examples-dom.test.mjs)', async () => {
    const runnable = examples.filter((e) => e.mode === 'test-run');
    expect(runnable.length).toBeGreaterThan(0);

    mkdirSync(TEMP_DIR, { recursive: true });
    const loaded = [];
    try {
      for (const example of runnable) {
        const file = join(TEMP_DIR, moduleNameFor(example));
        writeFileSync(
          file,
          `${runtimeHeader(example)}// ${example.rel}:${example.line}\nexport {};\n\n${example.code}\n`,
        );
        const mod = await import(/* @vite-ignore */ pathToFileURL(file).href);
        expect(Object.keys(mod).length, `module for ${example.id} was not loaded`).toBeGreaterThan(
          0,
        );
        loaded.push(example.id);
      }
    } finally {
      rmSync(TEMP_DIR, { recursive: true, force: true });
    }
    expect(loaded.length).toBe(runnable.length);
  });
});
