// packages/errors/src/reserved-codes.ts
//
// کاتالوگ کدهای رزروشدهٔ ۴رقمی: ادغام دو نیمهٔ verbatim با spread (ترتیب
// کلیدها عین literal اصل است) — بخش #40 (code-first: نوشته‌شده، اجرا نشده).

import type { ErrorCategory } from './error-kinds';
import { RESERVED_ERROR_CODES_A } from './reserved-codes-a';
import { RESERVED_ERROR_CODES_B } from './reserved-codes-b';

/** @public */
export interface ReservedErrorMeta {
  domain: string;
  category: ErrorCategory;
  message: string;
  suggestion: string;
}

/**
 * کاتالوگ کدهای رزورشدهٔ ۴رقمی (بندهای پکیج‌ها در NEW-PACKAGES-SPEC).
 * پکیج‌های جدید همین‌ها را مصرف می‌کنند (#141–#149، موج ۴)؛ افزودن کد جدید
 * فقط با بازهٔ درست و تست یکتایی/#171 مجاز است.
 */

/** @public */
export const RESERVED_ERROR_CODES: Readonly<Record<string, ReservedErrorMeta>> = {
  ...RESERVED_ERROR_CODES_A,
  ...RESERVED_ERROR_CODES_B,
};
