// #167 — قرارداد codemod: فیxture قبل/بعد هر transform، idempotency، دمو، runner.
import { describe, it, expect } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CodemodError } from '../src/index';
import { runCodemods, transformText } from '../src/index';
import type { TransformId } from '../src/index';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = (id: string, which: 'before' | 'after'): string =>
  readFileSync(join(here, 'fixtures', `${id}.${which}.ts`), 'utf8');

const IDS: TransformId[] = [
  'destroy-to-dispose',
  'process-to-bind',
  'clear-to-reset',
  'form-unify',
  'error-class',
  'console-to-logger',
  'cache-unify',
  'i18n-jalali',
  'runtime-imports',
];

describe('@zenith/codemod fixtures (#167)', () => {
  it('exposes nine separately-runnable transforms', () => {
    expect(IDS.length).toBe(9);
  });

  it('destroy-to-dispose rewrites tracked .destroy() and ignores the rest', () => {
    const result = transformText('a.ts', fixture('destroy-to-dispose', 'before'), [
      'destroy-to-dispose',
    ]);
    expect(result.text).toBe(fixture('destroy-to-dispose', 'after'));
    expect(result.applied).toEqual(['destroy-to-dispose']);
    expect(result.manual).toEqual([]);
  });

  it('process-to-bind is manual-only with a recipe', () => {
    const result = transformText('a.ts', fixture('process-to-bind', 'before'), ['process-to-bind']);
    expect(result.text).toBe(fixture('process-to-bind', 'after'));
    expect(result.applied).toEqual([]);
    expect(result.manual.length).toBe(1);
    expect(result.manual[0]).toMatchObject({ line: 4, transform: 'process-to-bind' });
    expect(result.manual[0]!.message).toContain('bindTrack');
  });

  it('clear-to-reset migrates test files and flags production files', () => {
    const testResult = transformText('x.test.ts', fixture('clear-to-reset', 'before'), [
      'clear-to-reset',
    ]);
    expect(testResult.text).toBe(fixture('clear-to-reset', 'after'));
    expect(testResult.applied).toEqual(['clear-to-reset']);
    expect(testResult.manual).toEqual([]);

    const prodResult = transformText('src/x.ts', fixture('clear-to-reset', 'before'), [
      'clear-to-reset',
    ]);
    expect(prodResult.text).toBe(fixture('clear-to-reset', 'before'));
    expect(prodResult.manual.length).toBe(1);
    expect(prodResult.manual[0]!.message).toContain('resetForTesting');
  });

  it('form-unify rewrites creators to createForm', () => {
    const result = transformText('a.ts', fixture('form-unify', 'before'), ['form-unify']);
    expect(result.text).toBe(fixture('form-unify', 'after'));
    expect(result.applied).toEqual(['form-unify']);
    expect(result.manual).toEqual([]);
  });

  it('error-class preserves message and flags the placeholder code', () => {
    const result = transformText('a.ts', fixture('error-class', 'before'), ['error-class']);
    expect(result.text).toBe(fixture('error-class', 'after'));
    expect(result.applied).toEqual(['error-class']);
    expect(result.manual.length).toBe(1);
    expect(result.manual[0]).toMatchObject({ line: 3, transform: 'error-class' });
    expect(result.manual[0]!.message).toContain('ZEN-xxxx');
  });

  it('console-to-logger rewrites single-arg calls and flags the rest', () => {
    const result = transformText('a.ts', fixture('console-to-logger', 'before'), [
      'console-to-logger',
    ]);
    expect(result.text).toBe(fixture('console-to-logger', 'after'));
    expect(result.applied).toEqual(['console-to-logger']);
    expect(result.manual.length).toBe(1);
    expect(result.manual[0]).toMatchObject({ line: 3, transform: 'console-to-logger' });
  });

  it('cache-unify renames the registry helper and flags hand-rolled caches', () => {
    const result = transformText('a.ts', fixture('cache-unify', 'before'), ['cache-unify']);
    expect(result.text).toBe(fixture('cache-unify', 'after'));
    expect(result.applied).toEqual(['cache-unify']);
    expect(result.manual.length).toBe(1);
    expect(result.manual[0]).toMatchObject({ line: 3, transform: 'cache-unify' });
    expect(result.manual[0]!.message).toContain('createCache');
  });

  it('i18n-jalali moves imports with renames and behavioral notes', () => {
    const result = transformText('a.ts', fixture('i18n-jalali', 'before'), ['i18n-jalali']);
    expect(result.text).toBe(fixture('i18n-jalali', 'after'));
    expect(result.applied).toEqual(['i18n-jalali']);
    expect(result.manual.length).toBe(1);
    expect(result.manual[0]).toMatchObject({ line: 1, transform: 'i18n-jalali' });
  });

  it('runtime-imports splits origins and flags runtime-owned names', () => {
    const result = transformText('a.ts', fixture('runtime-imports', 'before'), ['runtime-imports']);
    expect(result.text).toBe(fixture('runtime-imports', 'after'));
    expect(result.applied).toEqual(['runtime-imports']);
    expect(result.manual.length).toBe(1);
    expect(result.manual[0]!.message).toContain('Zen');
  });

  it('every after-fixture is idempotent (second run = no change)', () => {
    for (const id of IDS) {
      const after = fixture(id, 'after');
      const rerun = transformText('x.test.ts', after, [id]);
      expect(rerun.text, `${id} idempotency`).toBe(after);
    }
  });

  it('leaves invalid syntax untouched with a manual item per transform', () => {
    const bad = 'export function broken( {';
    const result = transformText('bad.ts', bad);
    expect(result.text).toBe(bad);
    expect(result.applied).toEqual([]);
    expect(result.manual.length).toBe(IDS.length);
  });

  it('rejects unknown transform ids', () => {
    expect(() => transformText('a.ts', '', ['nope' as TransformId])).toThrow(CodemodError);
  });
});

describe('@zenith/codemod demo migration (#167)', () => {
  const before = readFileSync(join(here, 'demo', 'legacy-app.before.ts'), 'utf8');
  const migrated = readFileSync(join(here, 'demo', 'legacy-app.migrated.ts'), 'utf8');

  it('migrates the legacy demo to the committed output', () => {
    const result = transformText('demo/legacy-app.test.ts', before);
    expect(result.text).toBe(migrated);
    expect(result.applied).toEqual([
      'destroy-to-dispose',
      'clear-to-reset',
      'form-unify',
      'error-class',
      'console-to-logger',
      'i18n-jalali',
      'runtime-imports',
    ]);
    expect(result.manual.length).toBe(2);
    expect(result.manual.map((item) => item.transform).sort()).toEqual([
      'error-class',
      'i18n-jalali',
    ]);
  });

  it('the migrated demo is stable (full-run idempotency)', () => {
    const rerun = transformText('demo/legacy-app.test.ts', migrated);
    expect(rerun.text).toBe(migrated);
  });
});

describe('@zenith/codemod runner (#167)', () => {
  it('dry-runs by default and writes with write:true (JSON-serializable report)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zenith-codemod-'));
    try {
      writeFileSync(join(dir, 'a.ts'), fixture('form-unify', 'before'), 'utf8');
      writeFileSync(join(dir, 'b.ts'), 'export const x = 1;\n', 'utf8');

      const dry = runCodemods({ root: dir });
      expect(dry.changedCount).toBe(1);
      expect(dry.checkFailed).toBe(true);
      expect(dry.files.length).toBe(2);
      expect(readFileSync(join(dir, 'a.ts'), 'utf8')).toBe(fixture('form-unify', 'before'));
      // گزارش باید دقیقاً همان چیزی باشد که `--report json` چاپ می‌کند.
      expect(JSON.parse(JSON.stringify(dry))).toEqual(dry);

      const written = runCodemods({ root: dir, write: true, transforms: ['form-unify'] });
      expect(written.changedCount).toBe(1);
      expect(readFileSync(join(dir, 'a.ts'), 'utf8')).toBe(fixture('form-unify', 'after'));

      const clean = runCodemods({ root: dir });
      expect(clean.checkFailed).toBe(false);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
