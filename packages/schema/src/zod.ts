// #142 — زیرمسیر `@zenith/schema/zod` (SPEC §۲.۲): آداپتور zod *اختیاری*.
//
// zod هرگز dependency این پکیج نیست (معیار پذیرش: «zod وابستگی اجباری نیست»)؛
// همان‌طور که form در v1 با interface دونگی (`ZodSchema`) کار می‌کرد، اینجا هم
// فقط `safeParse` دونگی می‌شود. مصرف‌کنندهٔ واقعی zod خودش را import و پاس
// می‌دهد. الگوی duck: DEC-021/#141 (بدون یال به بیرون L0).

import type { Schema } from './s';
import { s } from './s';
import type { Issue, SafeResult } from './types';

/** حداقل رابط موردنیاز از یک zod schema (zod v3/v4 safeParse). */
export interface ZodLike {
  safeParse(data: unknown): {
    success: boolean;
    data?: unknown;
    error?: { issues: Array<{ path: (string | number)[]; message: string }> };
  };
}

/**
 * تبدیل Zod schema به `Schema` قابل‌استفاده در nestهای zenith.
 * بازرس: اعتبار از خود zod (پیام‌های zod در `validateWithZod` لاگ می‌شوند؛
 * این گره boolean چک می‌کند و expected='zod schema' دارد).
 */
export function fromZod(zodSchema: ZodLike): Schema<unknown> {
  return s.custom<unknown>((v) => {
    try {
      return zodSchema.safeParse(v).success === true;
    } catch {
      return false;
    }
  }, 'zod schema');
}

function mapIssues(zodSchema: ZodLike, input: unknown): SafeResult<unknown> {
  let res: ReturnType<ZodLike['safeParse']>;
  try {
    res = zodSchema.safeParse(input);
  } catch (e) {
    return {
      ok: false,
      issues: [
        {
          path: [],
          code: 'ZEN-1001',
          expected: 'zod schema',
          received: typeof input,
          message: e instanceof Error ? e.message : String(e),
        },
      ],
    };
  }
  if (res.success) return { ok: true, value: res.data === undefined ? input : res.data };
  const issues: Issue[] = (res.error?.issues ?? []).map((i) => ({
    path: [...i.path],
    code: 'ZEN-1001' as const,
    expected: 'zod schema',
    received: String(typeof input),
    message: i.message,
  }));
  return { ok: false, issues };
}

/**
 * اعتبارسنجی ورودی با zod و نگاشت issues به قرارداد Issue zenith.
 * نسخهٔ layer-clean `form.validateWithZod` که FormStore می‌ساخت (DEC-029).
 */
export function validateWithZod(zodSchema: ZodLike, input: unknown): SafeResult<unknown> {
  return mapIssues(zodSchema, input);
}
