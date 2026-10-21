// packages/schema/src/attr.ts
//
// #120 — خواندن attributeهای JSON از یک مسیر مشترک (زیرمسیر `@zenith/schema/attr`).
//
// چرا زیرمسیر؟ باندل اصلی `@zenith/schema` بودجهٔ سختِ ≤4KB gzip دارد (#142) و
// منطق attribute فقط برای پکیج‌هایی لازم است که دایرکتیو/attribute می‌خوانند
// (runtime-core، i18n، charts، crud، ssr، error-boundary). الگوی همان چیزی است
// که برای `@zenith/schema/zod` و `@zenith/schema/json-schema` استفاده شده.
//
// دو تابع:
//   • parseConfigAttr: در `./validate` است و strict می‌ماند (ZEN-1003 ⇒ throw).
//   • parseJsonAttr  : tolerant — attribute غایب/JSON خراب ⇒ fallback + onError.
//   • parseJsonValue : تبدیل مقدار خام attribute به literal (bool/number/JSON).

import { createReservedError, type ZenithError } from '@zenith/errors';
import { safeValidate } from './validate';
import type { Schema } from './s';

/**
 * گزینه‌های `parseJsonAttr` — خواندن tolerant مقدار JSON یک attribute (#120).
 * @public
 */
export interface ParseJsonAttrOptions<T> {
  /** مقداری که در صورت نبود/خالی‌بودن attribute یا JSON خراب برگردانده می‌شود. */
  fallback: T;
  /**
   * اعتبارسنجی مقدار parse‌شده با schema (اختیاری)؛ عدم تطابق ⇒ ZEN-1001 و
   * برگشت به `fallback` (بدون throw — رندر نباید بشکند).
   */
  schema?: Schema<T>;
  /**
   * گیرندهٔ خطای ZEN (برای هشدار dev / `logger.warn`)؛ پیش‌فرض: بی‌اثر.
   * خود schema هیچ‌جا لاگ نمی‌کند (سیاست L0 — گیت لاگ).
   */
  onError?: (error: ZenithError) => void;
}

/**
 * #120 — خواندن *tolerant* مقدار JSON یک attribute: همهٔ binderهای دایرکتیو که
 * نمی‌توانند رندر را بشکنند از این تابع استفاده می‌کنند (به‌جای `JSON.parse`
 * پراکنده). attribute غایب/خالی ⇒ `fallback` بدون خطا؛ JSON خراب ⇒ ZEN-1003 به
 * `onError` و برگشت `fallback`؛ عدم تطابق schema ⇒ ZEN-1001 و برگشت `fallback`.
 *
 * @param el عنصری که attribute روی آن است.
 * @param attr نام attribute (مثل `zen-chart-options`).
 * @param options `{ fallback, schema?, onError? }`.
 * @returns مقدار parse‌شده یا `fallback`.
 * @public
 */
export function parseJsonAttr<T>(el: Element, attr: string, options: ParseJsonAttrOptions<T>): T {
  const raw = el.getAttribute(attr);
  if (raw === null || raw.trim() === '') return options.fallback;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    options.onError?.(createReservedError('ZEN-1003', { details: { attr, value: raw }, cause: e }));
    return options.fallback;
  }
  if (options.schema) {
    const result = safeValidate<T>(options.schema, parsed, { name: attr, coerce: true });
    if (!result.ok) {
      options.onError?.(
        createReservedError('ZEN-1001', {
          details: { attr, issues: result.issues },
        }),
      );
      return options.fallback;
    }
    return result.value;
  }
  return parsed as T;
}

/**
 * #120 — تبدیل یک *مقدار خام* attribute به مقدار JS: `true/false/null/undefined`
 * عدد، سپس `{…}`/`[…]` با JSON، در غیر این صورت همان رشته.
 *
 * tolerant است (JSON خراب ⇒ رشتهٔ اصلی؛ خطا فقط به `onError`) و برای attribute
 * های coercion‌شده (مثل propهای `<zen-*>` در SSR) استفاده می‌شود.
 * @public
 */
export function parseJsonValue<T = unknown>(
  raw: string | null,
  options: { onError?: (error: ZenithError) => void } = {},
): T | string | null {
  if (raw === null) return null;
  const trimmed = raw.trim();
  if (trimmed === 'true') return true as unknown as T;
  if (trimmed === 'false') return false as unknown as T;
  if (trimmed === 'null') return null;
  if (trimmed === 'undefined') return undefined as unknown as T;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const num = Number(trimmed);
    if (!Number.isNaN(num)) return num as unknown as T;
  }
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed) as T;
    } catch (e) {
      options.onError?.(createReservedError('ZEN-1003', { details: { value: raw }, cause: e }));
      return raw;
    }
  }
  return raw;
}

// `parseConfigAttr` (strict) هم از همین زیرمسیر بازصادر می‌شود تا مصرف‌کننده‌ها
// یک نقطهٔ ورود برای «خواندن attribute» داشته باشند.
/** @public */
export { parseConfigAttr } from './validate';
