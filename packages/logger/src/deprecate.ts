// packages/logger/src/deprecate.ts
//
// #143 — deprecate()/warnOnce سراسری (SPEC §۲.۳).
//
// کدهای ZEN-DEPR-xxx از رجیستری `errors` (DEC-019/#47 — «منبع واحد صادق»)
// خوانده می‌شوند: اگر `oldName` در DEPRECATION_CODES ثبت شده باشد همان کد
// مصرف می‌شود؛ ثبت‌نشده ⇒ کد پیش‌کنج `ZEN-DEPR-999` (اشاره به #47 برای ثبت
// رسمی). کد در *متن* هشدار می‌آید (این warn یک ZenithError نیست که فیلد
// code داشته باشد) و از scope فرزند `zen:deprecate` گزارش می‌شود.
//
// «یک‌بار» بودن: ست ماژولی به‌ازای هر کد — همان سیاست errors.deprecate
// (که legacy می‌ماند و در #39 به این مسیر مهاجرت می‌کند). سکوت prod دقیقاً
// شرط `__ZENITH_DEV__ === false` است (الگوی #47/#62).
import { DEPRECATION_CODES } from '@zenith/errors';
import { logger } from './default';
import type { Logger } from './types';

const warnedCodes = new Set<string>();
const warnedKeys = new Set<string>();

export interface OnceOptions {
  logger?: Logger;
}

export function deprecate(
  oldName: string,
  newName: string,
  since: string,
  opts?: OnceOptions,
): void {
  if (globalThis.__ZENITH_DEV__ === false) return;
  const code =
    Object.entries(DEPRECATION_CODES).find(([, m]) => m.api === oldName)?.[0] ?? 'ZEN-DEPR-999';
  if (warnedCodes.has(code)) return;
  warnedCodes.add(code);
  (opts?.logger ?? logger)
    .child('deprecate')
    .warn(
      `[${code}] \`${oldName}\` is deprecated since ${since}, removed in 2.0; use \`${newName}\`.`,
    );
}

/**
 * هشدار یک‌باره به‌ازای هر `key` (سراسری). برای fallbackها و پیام‌های
 * «فقط یک‌بار دیده شود».
 */
export function warnOnce(key: string, msg: string, opts?: OnceOptions): void {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  (opts?.logger ?? logger).warn(msg);
}

/**
 * پاک‌سازی ست‌های «یک‌بار» — export می‌شود چون تست‌ها و ابزارهای dev (مثل
 * hot-reload) باید بتوانند dedupe را ریست کنند. مصرف‌کنندهٔ برنامه هرگز
 * لازم ندارد؛ SPEC آن را در API عمومی نمی‌شمارد ولی حذف‌کردنش گران‌تر از
 * نگه‌داشتنش است (tree-shaking آن را از bundle نهایی کاربر بیرون می‌گذارد).
 */
export function resetOnceWarnings(): void {
  warnedCodes.clear();
  warnedKeys.clear();
}
