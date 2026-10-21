// packages/errors/src/error-deprecate.ts
//
// تابع deprecate و ریست هشدارها — استخراج مکانیکی از core.ts بدون تغییر
// رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { printToHost } from './print';


// ─────────────────────────────────────────────────────────────
// Deprecation Warnings (#47, #58)
// ─────────────────────────────────────────────────────────────

/**
 * هشدار deprecation یک‌باره برای یک API قدیمی (مطابق سیاست #58: هشدار
 * یک‌باره با کد ZEN-DEPR-xxx، حذف فقط در major بعدی).
 *
 * - فقط در dev فعال است (تا زمانی که `globalThis.__ZENITH_DEV__ === false`
 *   تنظیم نشده باشد) — الگوی یکسان با ZEN-404 در auth (#62).
 * - به‌ازای هر `code` حداکثر یک‌بار لاگ می‌شود (Set سراسری).
 *
 * @param code کد ZEN-DEPR-xxx
 * @param oldName نام API قدیمی
 * @param replacement نام/API جایگزین
 * @param hint راهنمای اضافی اختیاری
 */
/** @public */
export function deprecate(code: string, oldName: string, replacement: string, hint?: string): void {
  if (typeof globalThis !== 'undefined' && Reflect.get(globalThis, '__ZENITH_DEV__') === false) return;
  if (warnedDeprecations.has(code)) return;
  warnedDeprecations.add(code);
  // Diagnostics are dependency-inverted through the installed logger transport.
  printToHost(
    'warning',
    `[Zenith] ${code}: \`${oldName}\` is deprecated and will be removed in the next major ` +
      `version. Use \`${replacement}\` instead.` +
      (hint ? ` ${hint}` : ''),
  );
}

const warnedDeprecations = new Set<string>();

/**
 * پاک‌سازی وضعیت «یک‌بار» هشدارها — فقط برای تست.
 */
/** @public */
export function resetDeprecationWarnings(): void {
  warnedDeprecations.clear();
}