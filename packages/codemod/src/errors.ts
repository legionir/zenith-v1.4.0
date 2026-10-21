// packages/codemod/src/errors.ts — خطای codemod (#167)
//
// عمداً خارج از کاتالوگ ZEN: مثل `CliFailure` در CLI، خطای ابزار توسعه است
// (فایل/خط + پیام قابل‌اقدام) نه خطای زمان‌اجرای برنامه؛ ثبت تصمیم در changeset.

/** @public خطای مهلک codemod (I/O یا پیکربندی؛ خطای سینتکس فایل مهلک نیست). */
export class CodemodError extends Error {
  /** فایل مرتبط (در صورت وجود). */
  readonly file?: string;
  constructor(message: string, file?: string) {
    super(file ? `${message} (${file})` : message);
    this.name = 'CodemodError';
    this.file = file;
  }
}
