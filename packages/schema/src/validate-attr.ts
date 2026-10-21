// packages/schema/src/validate-attr.ts
//
// parseConfigAttr (JSON از attribute) — استخراج مکانیکی از validate.ts،
// بدون تغییر رفتار (#40).

import { createReservedError } from '@zenith/errors';
import { validate } from './validate-engine';
import type { Schema } from './s';


// ── parseConfigAttr ──

/**
 * خواندن JSON از attribute element با اعتبارسنجی schema.
 * نبود attribute ⇒ فقط پیش‌فرض‌های schema (resolve({}))؛ JSON خراب ⇒ ZEN-1003.
 */
export function parseConfigAttr<T>(el: Element, attr: string, schema: Schema<T>): T {
  const raw = el.getAttribute(attr);
  if (raw === null || raw.trim() === '') {
    return validate<T>(schema, {}, { name: attr, coerce: true });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw createReservedError('ZEN-1003', {
      details: { attr, value: raw },
      cause: e,
    });
  }
  return validate<T>(schema, parsed, { name: attr, coerce: true });
}
