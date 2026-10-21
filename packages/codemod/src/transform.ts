// packages/codemod/src/transform.ts — قرارداد یک transform (#167)
import ts from 'typescript';
import type { ManualItem, TransformId } from './types';
import type { TextEdit } from './edits';

/** @public ورودی اجرای یک transform روی یک فایل. */
export interface TransformContext {
  /** مسیر فایل (نسبی به root اجرا؛ برای manualها). */
  readonly file: string;
  /** متن اصلی فایل. */
  readonly text: string;
  /** AST ریشه. */
  readonly source: ts.SourceFile;
  /** checker محلی (binding-aware؛ بدون resolve). */
  readonly checker: ts.TypeChecker;
}

/** @public خروجی اجرای یک transform روی یک فایل. */
export interface TransformOutput {
  /** ویرایش‌های متنی (نباید هم‌پوشان باشند). */
  readonly edits: readonly TextEdit[];
  /** موارد بازبینی دستی. */
  readonly manual: readonly ManualItem[];
  /** توصیف‌های تغییری که اعمال شد (برای گزارش فایل). */
  readonly changes: readonly string[];
}

/** @public یک transform جداگانه‌اجراشونده (SPEC §۴.۷). */
export interface Transform {
  readonly id: TransformId;
  readonly description: string;
  run(ctx: TransformContext): TransformOutput;
}
