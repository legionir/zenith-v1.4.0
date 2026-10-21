// packages/codemod/src/types.ts — قراردادهای عمومی codemod (#167)
//
// هر transform جدا اجرا می‌شود (SPEC §۴.۷)؛ گزارش JSON-serializable است تا
// دستور `upgrade --report json` در #109 همان را چاپ کند.

/** @public شناسهٔ یک transform (SPEC §۴.۷، جدول تبدیل‌ها). */
export type TransformId =
  | 'destroy-to-dispose'
  | 'process-to-bind'
  | 'clear-to-reset'
  | 'form-unify'
  | 'error-class'
  | 'console-to-logger'
  | 'cache-unify'
  | 'i18n-jalali'
  | 'runtime-imports';

/** @public یک مورد نیازمند بازبینی دستی (همیشه با شمارهٔ خط). */
export interface ManualItem {
  /** مسیر فایل (نسبی به root اجرا). */
  readonly file: string;
  /** شمارهٔ خط ۱-مبنا. */
  readonly line: number;
  /** transformای که مورد را تولید کرد. */
  readonly transform: TransformId;
  /** دستورالعمل اقدام برای بازبین. */
  readonly message: string;
}

/** @public نتیجهٔ اعمال transformها روی یک متن (خالص؛ بدون fs). */
export interface TextResult {
  /** متن پس از اعمال همهٔ ویرایش‌ها. */
  readonly text: string;
  /** شناسهٔ transformهایی که حداقل یک ویرایش اعمال کردند. */
  readonly applied: readonly TransformId[];
  /** موارد بازبینی دستیِ همین فایل. */
  readonly manual: readonly ManualItem[];
}

/** @public نتیجهٔ یک فایل در اجرای دیسکی. */
export interface FileResult {
  /** مسیر فایل (نسبی به root). */
  readonly path: string;
  /** آیا متن تغییر کرد؟ */
  readonly changed: boolean;
  /** شناسهٔ transformهای اعمال‌شده. */
  readonly applied: readonly TransformId[];
  /** موارد بازبینی دستیِ همین فایل. */
  readonly manual: readonly ManualItem[];
}

/** @public گزارش کامل یک اجرا (JSON-serializable؛ قرارداد `--report json`). */
export interface CodemodReport {
  /** فایل‌های اسکن‌شده (به‌ترتیب الفبا). */
  readonly files: readonly FileResult[];
  /** همهٔ موارد بازبینی دستی (به‌ترتیب فایل، خط). */
  readonly manual: readonly ManualItem[];
  /** تعداد فایل‌های تغییریافته. */
  readonly changedCount: number;
  /** برای `--check`: true یعنی تغییری لازم است (exit ≠ 0 در CLI). */
  readonly checkFailed: boolean;
}

/** @public گزینه‌های اجرای دیسکی. */
export interface RunCodemodsOptions {
  /** ریشهٔ اسکن (پیش‌فرض: cwd). */
  readonly root?: string;
  /** فایل‌های صریح (نسبی به root)؛ اگر غایب، از root اسکن می‌شود. */
  readonly files?: readonly string[];
  /** زیرمجموعهٔ transformها (پیش‌فرض: همه). */
  readonly transforms?: readonly TransformId[];
  /** نوشتن روی دیسک (پیش‌فرض false = dry-run). */
  readonly write?: boolean;
}
