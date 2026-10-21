// @zenith/i18n — Persian/RTL helpers (Phase 5) + v1.0.1 enhancements.
//
// #146 — توابع تقویم جلالی به @zenith/jalali (L0، SPEC §۲.۶) منتقل شدند.
// این فایل alias سازگاری نگه می‌دارد:
//   • رفتار legacy حفظ شده: رشته با ارقام فارسی، ورودی نامعتبر ⇒ ''/null،
//     تاریخ‌های ۶۲۲..۹۹۹ میلادی همان مسیر legacy (warn و '')؛
//   • از سال جلالی ≥۱۰۰۰ (بازهٔ پشتیبانی‌شدهٔ SPEC) به الگوریتم Borkowski
//     (jalali) واگذار می‌شود — دقیق‌تر و Intl-_verified؛
//   • هر alias یک‌بار ZEN-DEPR-006..015 هشدار می‌دهد (DEC-019/#58؛ حذف در 2.0).


import { detectFromSources } from './core';
import { resolveI18nOptions as resolveI18nOptionsForDetect } from './options';
import type { I18nOptions as I18nOptionsDetect } from './types';

/** @public */
export {
  toPersianNums,
  toArabicNums,
  toJalali,
  jalaliNow,
  formatNumber,
  formatPrice,
  isRTL,
  parseJalaliParts,
  fromJalali,
  compareJalali,
  addDaysJalali,
  isJalaliLeap,
  jalaliMonthDays,
  formatJalali,
  jalaliMonthName,
} from './jalali-compat';
/** @public */
export {
  RTL_LOCALES,
  detectTextDirection,
  getDirection,
  applyDocumentDirection,
  isolateBidi,
  resolveHorizontalStep,
  LOGICAL_CSS_MAP,
  toLogicalCss,
} from './direction';

/** @public */
export { DEFAULTS } from './defaults';
/** @public */
export { formatLocaleNumber, formatCurrency, formatRelativeTime, formatDateTime, formatList } from './formatters';
/** @public */
export type { LocaleFormatOptions, CurrencyFormatOptions } from './formatters';
// ═══════════════════════════════════════════════════════════════════════════
// #150 — Reactive I18n Engine (createI18n، ICU-subset، plugin، useI18n، detect)
// ═══════════════════════════════════════════════════════════════════════════
//
// پیاده‌سازی موتور در ماژول‌های جدا: icu.ts (قالب), core.ts (createI18n و
// plugin و detectFromSources), options.ts (schema پیش‌فرض‌ها), types.ts
// (رسوم API). این بخش فقط آن‌ها را با نام‌های عمومی spec بازصادر می‌کند.

/** @public */
export {
  createI18n,
  i18nPlugin,
  useI18n,
  bindI18nToApp,
  readSsrI18nData,
  clearSsrI18nData,
} from './core';

/** Test-only module-level reset. @internal */
export { __resetActiveI18n } from './core';
/** @public */
export {
  i18nOptionsSchema,
  resolveI18nOptions,
  I18N_DEFAULTS,
  languageOf,
  regionOf,
} from './options';
/** @public */
export { formatTemplate, icuInvalid } from './icu';
/** @public */
export type { FormatHooks } from './icu';
/** @public */
export { createI18nDirectives, i18nStateGlobals, escapeHtmlStrict } from './directives';
/** @public */
export type {
  I18nDirectiveDefinition,
  I18nDirectiveBindContext,
  I18nDirectiveOptions,
} from './directives';
/** @public */
export type {
  I18n,
  I18nOptions,
  I18nParams,
  Messages,
  SsrI18nData,
  MissingStrategy,
  DetectSource,
  CalendarName,
  NumberingSystem,
  DetectContext,
  TCallOptions,
} from './types';
/** detectLocale آزاد SPEC §۳.۱: (opts, ctx?) ⇒ locale یا undefined. @public */
export function detectLocale(
  opts: I18nOptionsDetect = {},
  ctx?: import('./types').DetectContext,
): string | undefined {
  const resolved = resolveI18nOptionsForDetect(opts);
  return detectFromSources(resolved, ctx);
}
