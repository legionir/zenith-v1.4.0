// packages/shared/src/assert.ts
//
// #141 — invariant با خطای ساختارمند (SPEC §۰.۴ + catalog رزورشدهٔ #171).
// کد اختصاصی `shared` برای آرگومان نامعتبر: ZEN-1090 (بازهٔ schema/options،
// دامنهٔ shared در DEC-020). پیام اختصاصی صداکننده جلوی متن عمومی catalog
// قرار می‌گیرد تا خطا در console قابل‌تشخیص باشد.

import { ZenithError, RESERVED_ERROR_CODES } from '@zenith/errors';

const CODE = 'ZEN-1090';

/** امضای assertion تابع (SPEC §۲.۱: `asserts cond`). */
export type InvariantFn = (
  cond: unknown,
  message: string,
  opts?: { details?: Record<string, unknown>; cause?: unknown },
) => asserts cond;

/**
 * اگر `cond` falsy باشد `ZenithError` با کد ZEN-1090 پرتاب می‌کند.
 *
 * @param cond شرطی که باید برقرار باشد.
 * @param message پیام فارسی اختصاصی (حداقل یک کاراکتر غیر فاصله).
 * @param opts `details` برای diagnostics و `cause` برای زنجیرهٔ خطا.
 * @throws {ZenithError} ZEN-1090 — آرگومان نامعتبر.
 */
export const invariant: InvariantFn = (cond, message, opts) => {
  if (cond) return;
  const meta = RESERVED_ERROR_CODES[CODE];
  if (!meta) {
    // هرگز نباید رخ دهد (گیت #171 catalog را قفل کرده) — اما fail-fast.
    throw new Error(`[shared] کد ${CODE} در catalog #171 یافت نشد.`);
  }
  const text = typeof message === 'string' ? message.trim() : '';
  if (text === '') {
    throw new ZenithError({
      code: CODE,
      category: meta.category,
      message: `[${CODE}] ${meta.message} (پیام اختصاصی برای invariant داده نشد.)`,
      suggestion: 'به آرگومان دوم invariant یک پیام فارسی کامل بدهید.',
      docsUrl: `https://zenith.dev/errors/${CODE}`,
    });
  }
  throw new ZenithError({
    code: CODE,
    category: meta.category,
    message: `[${CODE}] ${text}`,
    suggestion: meta.suggestion,
    docsUrl: `https://zenith.dev/errors/${CODE}`,
    details: opts?.details,
    cause: opts?.cause,
  });
};
