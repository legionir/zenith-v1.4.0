// packages/codemod/src/parse.ts — تجزیهٔ TypeScript بدون resolve (#167)
//
// همان الگوی `migrateSource` در CLI: برنامهٔ بدون lib/resolve + checker فقط
// برای نمادهای محلی (binding-aware)؛ سینتکس نامعتبر = skip فایل + مورد manual
// (مهلک نیست تا بقیهٔ فایل‌ها مهاجرت شوند).
import ts from 'typescript';
import type { ManualItem, TransformId } from './types';

/** @public خروجی تجزیهٔ یک فایل. */
export interface ParsedFile {
  readonly source: ts.SourceFile;
  readonly checker: ts.TypeChecker;
}

/**
 * تجزیه + ساخت checker محلی. در صورت سینتکس نامعتبر null برمی‌گرداند تا
 * فراخواننده مورد manual ثبت کند (الگوی CLI `upgrade`).
 *
 * @public
 */
export function parseSource(
  text: string,
  filename: string,
): ParsedFile | null {
  const scriptKind = filename.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : filename.endsWith('.jsx')
      ? ts.ScriptKind.JSX
      : /\.[cm]?js$/.test(filename)
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, scriptKind);
  const host = ts.createCompilerHost({
    noLib: true,
    noResolve: true,
    allowJs: true,
    target: ts.ScriptTarget.Latest,
  });
  host.getSourceFile = (name) => (name === filename ? source : undefined);
  const program = ts.createProgram(
    [filename],
    { noLib: true, noResolve: true, allowJs: true, target: ts.ScriptTarget.Latest },
    host,
  );
  if (program.getSyntacticDiagnostics(source).length > 0) return null;
  return { source, checker: program.getTypeChecker() };
}

/**
 * مورد manual استاندارد «سینتکس نامعتبر» (خط ۱؛ کل فایل).
 *
 * @public
 */
export function syntaxManualItem(file: string, transform: TransformId): ManualItem {
  return {
    file,
    line: 1,
    transform,
    message: `Cannot safely migrate invalid syntax in ${file}. Fix syntax before upgrade.`,
  };
}
