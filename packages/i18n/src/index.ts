// @zenith/i18n — Persian/RTL helpers (Phase 5) + v1.0.1 enhancements.
//
// #146 — توابع تقویم جلالی به @zenith/jalali (L0، SPEC §۲.۶) منتقل شدند.
// این فایل alias سازگاری نگه می‌دارد:
//   • رفتار legacy حفظ شده: رشته با ارقام فارسی، ورودی نامعتبر ⇒ ''/null،
//     تاریخ‌های ۶۲۲..۹۹۹ میلادی همان مسیر legacy (warn و '')؛
//   • از سال جلالی ≥۱۰۰۰ (بازهٔ پشتیبانی‌شدهٔ SPEC) به الگوریتم Borkowski
//     (jalali) واگذار می‌شود — دقیق‌تر و Intl-_verified؛
//   • هر alias یک‌بار ZEN-DEPR-006..015 هشدار می‌دهد (DEC-019/#58؛ حذف در 2.0).

import { deprecate } from '@zenith/errors';
import { logger } from '@zenith/logger';
import {
  toJalaliParts,
  fromJalaliParts,
  formatJalali as jalaliFormat,
  monthDays as jalaliMonthDaysNew,
  monthName as jalaliMonthNameNew,
  isLeap as jalaliIsLeap,
  compareJalali as jalaliCompare,
  addDays as jalaliAddDays,
  toPersianDigits,
} from '@zenith/jalali';

/** تبدیل اعداد انگلیسی به فارسی. */
export function toPersianNums(n: number | string): string {
  return toPersianDigits(n);
}

/** تبدیل اعداد انگلیسی به عربی. */
export function toArabicNums(n: number | string): string {
  // #64/#146: تبدیل رقم خالص است (نه عدد امنیتی) — در jalali پیاده شده.
  return String(n).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.charAt(+d));
}

function legacySupported(d: Date): boolean {
  // تاریخ‌های قبل از ۲۲ مارس ۱۶۲۱ (شروع سال جلالی ۱۰۰۰) خارج از بازهٔ
  // پشتیبانی‌شدهٔ jalali هستند؛ رفتار legacy (الگوریتم ۳۳‌سالهٔ ساده) حفظ
  // می‌شود تا هیچ خروجی قبلی تغییر نکند (DEC-028).
  return d.getFullYear() < 1622;
}

/**
 * تبدیل تاریخ میلادی به شمسی (تقویم جلالی).
 *
 * @deprecated از `@zenith/jalali` (`toJalaliParts` + `formatJalali`) استفاده کنید.
 */
export function toJalali(date: Date | string): string {
  deprecate('ZEN-DEPR-006', 'toJalali (i18n)', '@zenith/jalali formatJalali/toJalaliParts');
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  if (isNaN(d.getTime())) return '';
  if (d.getFullYear() < 622) return '';
  if (d.getFullYear() < 1600) {
    logger.warn('[Zenith i18n] toJalali: dates before 1600 CE may be inaccurate');
  }
  let py: number, pm: number, pd: number;
  if (legacySupported(d)) {
    const p = legacyParts(d);
    if (!p) {
      logger.warn(`[Zenith i18n] toJalali: invalid result for ${d.toISOString()}`);
      return '';
    }
    [py, pm, pd] = p;
  } else {
    try {
      const p = toJalaliParts(d, { timeZone: 'local' });
      [py, pm, pd] = [p.y, p.m, p.d];
    } catch {
      return '';
    }
  }
  if (py < 1 || pm < 1 || pm > 12 || pd < 1 || pd > 31) {
    logger.warn(`[Zenith i18n] toJalali: invalid result for ${d.toISOString()}`);
    return '';
  }
  return `${toPersianNums(py)}/${toPersianNums(String(pm).padStart(2, '0'))}/${toPersianNums(String(pd).padStart(2, '0'))}`;
}

/**
 * تاریخ و زمان فعلی به شمسی.
 * @deprecated از `@zenith/jalali` (`jalaliNow`) استفاده کنید.
 */
export function jalaliNow(): string {
  deprecate('ZEN-DEPR-010', 'jalaliNow (i18n)', '@zenith/jalali jalaliNow');
  return toJalali(new Date());
}

/** فرمت‌بندی عدد با جداکننده هزارگان (فارسی). */
export function formatNumber(n: number): string {
  return toPersianNums(n.toLocaleString('en-US').replace(/,/g, '٬'));
}

/** فرمت‌بندی قیمت به تومان. */
export function formatPrice(n: number): string {
  return formatNumber(n) + ' تومان';
}

/** RTL direction helper. */
// FIX (BUG-I18N-04): پارامتر اختیاری text برای تشخیص کاراکترهای RTL.
export function isRTL(text?: string): boolean {
  // FIX (v1.2.3): تشخیص RTL از سه منبع: document.dir، documentElement.dir،
  // lang (fa/ar/he/ur) و کاراکترهای RTL در متن.
  if (typeof document === 'undefined') return false;
  if (document.dir === 'rtl') return true;
  if (typeof document.documentElement !== 'undefined' && document.documentElement.dir === 'rtl')
    return true;
  if (typeof document.documentElement !== 'undefined') {
    const lang = document.documentElement.lang?.split('-')[0] || '';
    if (['fa', 'ar', 'he', 'ur'].includes(lang)) return true;
  }
  if (text) {
    const rtlChars = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    if (rtlChars.test(text)) return true;
  }
  return false;
}

// ── legacy path (#146): فقط برای تاریخ‌های قبل از بازهٔ پشتیبانی‌شدهٔ jalali ──

/** الگوریتم ۳۳‌سالهٔ سادهٔ قدیمی — فقط pre-1000 Jy (legacy). */
function legacyParts(d: Date): [number, number, number] | null {
  const gy = d.getFullYear();
  const gm = d.getMonth() + 1;
  const gd = d.getDate();
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number;
  let gyMut = gy;
  if (gyMut <= 1600) {
    jy = 0;
    gyMut -= 621;
  } else {
    jy = 979;
    gyMut -= 1600;
  }
  const gy2 = gm > 2 ? gyMut + 1 : gyMut;
  let days =
    365 * gyMut +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) -
    80 +
    gd +
    g_d_m[gm - 1]!;
  jy += 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  const jm = days < 186 ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + (days < 186 ? days % 31 : (days - 186) % 30);
  return [jy, jm, jd];
}

const JALALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
];

/**
 * استخراج بخش‌های تاریخ جلالی از یک Date میلادی.
 * @deprecated از `@zenith/jalali` (`toJalaliParts`) استفاده کنید.
 */
export function parseJalaliParts(date: Date | string): [number, number, number] | null {
  deprecate('ZEN-DEPR-008', 'parseJalaliParts (i18n)', '@zenith/jalali toJalaliParts');
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  if (isNaN(d.getTime())) return null;
  if (legacySupported(d)) {
    return legacyParts(d);
  }
  try {
    const p = toJalaliParts(d, { timeZone: 'local' });
    return [p.y, p.m, p.d];
  } catch {
    return null;
  }
}

/**
 * تبدیل جلالی به میلادی.
 * @deprecated از `@zenith/jalali` (`fromJalaliParts`) استفاده کنید.
 *
 * #146: فرمول قدیمی `fromJalali` خطای محاسباتی داشت (ژانویهٔ سال مقصد
 * ±۱ ماه و ~۶۷ سال خطای پایه در jy<1600 — خروجی‌اش هیچ‌گاه یک تاریخ جلالی
 * معتبر نبود و تست regression ۱۰۰۰..۳۰۰۰ #146 آن را رد می‌کرد). alias حالا
 * خروجی درست (Borkowski، بررسی‌شده با Intl) می‌دهد؛ هیچ مصرف‌کننده‌ای در
 * مخزن به مقادیر غلط قبلی وابسته نبود (date-picker خودش را به jalali
 * منتقل کرد — DEC-028).
 */
export function fromJalali(jy: number, jm: number, jd: number): Date {
  deprecate('ZEN-DEPR-007', 'fromJalali (i18n)', '@zenith/jalali fromJalaliParts');
  try {
    return fromJalaliParts(jy, jm, jd);
  } catch {
    // رفتار «هرگز throw نمی‌کرد» legacy حفظ می‌شود: تاریخ نامعتبر ⇒ Invalid Date
    return new Date(NaN);
  }
}

/**
 * مقایسه دو تاریخ جلالی.
 * @deprecated از `@zenith/jalali` (`compareJalali`) استفاده کنید.
 */
export function compareJalali(
  a: { y: number; m: number; d: number },
  b: { y: number; m: number; d: number },
): number {
  deprecate('ZEN-DEPR-014', 'compareJalali (i18n)', '@zenith/jalali compareJalali');
  return jalaliCompare(a, b);
}

/**
 * جمع روز به تاریخ.
 * @deprecated از `@zenith/jalali` (`addDays`) استفاده کنید.
 */
export function addDaysJalali(date: Date | string | null | undefined, days: number): Date | null {
  deprecate('ZEN-DEPR-015', 'addDaysJalali (i18n)', '@zenith/jalali addDays');
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    logger.error('[Zenith i18n] addDaysJalali: invalid date input');
    return null;
  }
  return jalaliAddDays(date, days);
}

/**
 * آیا سال جلالی کبیسه است؟
 * @deprecated از `@zenith/jalali` (`isLeap`) استفاده کنید.
 */
export function isJalaliLeap(jy: number): boolean {
  deprecate('ZEN-DEPR-013', 'isJalaliLeap (i18n)', '@zenith/jalali isLeap');
  try {
    return jalaliIsLeap(jy);
  } catch {
    return false;
  }
}

/**
 * تعداد روزهای ماه جلالی.
 * @deprecated از `@zenith/jalali` (`monthDays`) استفاده کنید.
 */
export function jalaliMonthDays(jy: number, jm: number): number {
  deprecate('ZEN-DEPR-011', 'jalaliMonthDays (i18n)', '@zenith/jalali monthDays');
  try {
    return jalaliMonthDaysNew(jy, jm);
  } catch {
    return 0;
  }
}

/**
 * فرمت قابل‌تنظیم تاریخ جلالی.
 * @deprecated از `@zenith/jalali` (`formatJalali`) استفاده کنید.
 */
export function formatJalali(date: Date | string, fmt: string = 'YYYY/MM/DD'): string {
  deprecate('ZEN-DEPR-009', 'formatJalali (i18n)', '@zenith/jalali formatJalali');
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  if (isNaN(d.getTime())) return '';
  const p = legacySupported(d) ? legacyParts(d) : null;
  if (legacySupported(d)) {
    if (!p) return '';
    const [jy, jm, jd] = p;
    if (jy < 1) return '';
    return fmt
      .replace(/\bYYYY\b/g, toPersianNums(jy))
      .replace(/\bMMMM\b/g, JALALI_MONTH_NAMES[jm - 1] || '')
      .replace(/\bMM\b/g, toPersianNums(String(jm).padStart(2, '0')))
      .replace(/\bDD\b/g, toPersianNums(String(jd).padStart(2, '0')))
      .replace(/\bYY\b/g, toPersianNums(String(jy).slice(-2)));
  }
  try {
    return jalaliFormat(d, fmt, { timeZone: 'local', digits: 'persian' });
  } catch {
    // legacy هرگز throw نمی‌کرد؛ قالب نامعتبر ⇒ ''
    return '';
  }
}

/**
 * نام ماه جلالی.
 * @deprecated از `@zenith/jalali` (`monthName`) استفاده کنید.
 */
export function jalaliMonthName(jm: number): string {
  deprecate('ZEN-DEPR-012', 'jalaliMonthName (i18n)', '@zenith/jalali monthName');
  try {
    return jalaliMonthNameNew(jm);
  } catch {
    return '';
  }
}

// ── #100: Comprehensive RTL, Logical Direction & Bidirectional Intl Helpers ──

export const RTL_LOCALES: readonly string[] = /* @__PURE__ */ Object.freeze([
  'fa',
  'ar',
  'he',
  'ur',
  'ckb',
  'ps',
  'sd',
  'ug',
  'yi',
  'dv',
]);

export const DEFAULTS = /* @__PURE__ */ Object.freeze({
  locale: 'fa-IR',
  direction: 'rtl' as 'rtl' | 'ltr',
  currency: 'IRT',
});

const RTL_STRONG_CHAR_RE = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LTR_STRONG_CHAR_RE = /[A-Za-z\u00C0-\u02B8\u0370-\u052F]/;

/**
 * #100: تشخیص جهت متن بر اساس اولین کاراکتر قوی یونیکد (UAX #9 `dir="auto"`).
 */
export function detectTextDirection(text: string): 'rtl' | 'ltr' | 'auto' {
  for (const ch of text) {
    if (RTL_STRONG_CHAR_RE.test(ch)) return 'rtl';
    if (LTR_STRONG_CHAR_RE.test(ch)) return 'ltr';
  }
  return 'auto';
}

/**
 * #100: تشخیص جهت زبان/locale یا متن (`'rtl' | 'ltr'`).
 */
export function getDirection(localeOrText?: string): 'rtl' | 'ltr' {
  if (localeOrText) {
    const trimmed = localeOrText.trim();
    const baseLang = trimmed.split(/[-_]/)[0]?.toLowerCase() ?? '';
    if (RTL_LOCALES.includes(baseLang)) return 'rtl';
    if (/^[a-z]{2,3}(?:[-_][a-z0-9]{2,8})*$/i.test(trimmed)) return 'ltr';
    const detected = detectTextDirection(trimmed);
    if (detected !== 'auto') return detected;
  }
  return isRTL(localeOrText) ? 'rtl' : 'ltr';
}

/**
 * #100: اعمال `lang` و `dir` روی `document.documentElement` برای همگام‌سازی کامل RTL/LTR.
 */
export function applyDocumentDirection(locale: string, doc?: Document): 'rtl' | 'ltr' {
  const dir = getDirection(locale);
  const targetDoc = doc ?? (typeof document !== 'undefined' ? document : undefined);
  if (targetDoc?.documentElement) {
    targetDoc.documentElement.lang = locale;
    targetDoc.documentElement.dir = dir;
  }
  return dir;
}

/**
 * #100: ایزوله‌سازی متن دوجهته با کاراکترهای استاندارد Unicode Bidi Isolates
 * (`U+2066 LRI`، `U+2067 RLI`، `U+2068 FSI` و `U+2069 PDI`) برای جلوگیری از
 * به‌هم‌ریختگی ترتیب اعداد، شماره تلفن، URL، قیمت و کد لاتین در متن فارسی/عربی.
 */
export function isolateBidi(text: string, dir: 'rtl' | 'ltr' | 'auto' = 'auto'): string {
  const prefix = dir === 'ltr' ? '\u2066' : dir === 'rtl' ? '\u2067' : '\u2068';
  return `${prefix}${text}\u2069`;
}

/**
 * #100: فرمت‌بندی عدد بر اساس `Intl.NumberFormat` و locale (با پشتیبانی از ارقام بومی و منفی دوجهته).
 */
export function formatLocaleNumber(
  value: number,
  locale: string = DEFAULTS.locale,
  options?: Intl.NumberFormatOptions,
): string {
  return new Intl.NumberFormat(locale, options).format(value);
}

/**
 * #100: فرمت‌بندی واحد پول دوجهته (`IRT`/تومان، `IRR`/ریال، `USD`، `EUR`، `SAR` و ...).
 */
export function formatCurrency(
  value: number,
  locale: string = DEFAULTS.locale,
  currency: string = DEFAULTS.currency,
  options?: Intl.NumberFormatOptions,
): string {
  if (currency.toUpperCase() === 'IRT') {
    const formatted = new Intl.NumberFormat(locale, {
      maximumFractionDigits: 0,
      ...options,
    }).format(value);
    return locale.toLowerCase().startsWith('fa') ? `${formatted} تومان` : `${formatted} IRT`;
  }
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    ...options,
  }).format(value);
}

/**
 * #100: فرمت‌بندی زمان نسبی (`۳ روز پیش`، `in 2 hours` و ...) با `Intl.RelativeTimeFormat`.
 */
export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale: string = DEFAULTS.locale,
  options: Intl.RelativeTimeFormatOptions = { numeric: 'auto' },
): string {
  return new Intl.RelativeTimeFormat(locale, options).format(value, unit);
}

/**
 * #100: فرمت‌بندی تاریخ و ساعت بر اساس `Intl.DateTimeFormat` (در `fa-IR` به‌طور پیش‌فرض تقویم شمسی).
 */
export function formatDateTime(
  date: Date | number,
  locale: string = DEFAULTS.locale,
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat(locale, options).format(date);
}

/**
 * #100: فرمت‌بندی لیست بومی (`علی، سارا و رضا` / `A, B, and C`) با `Intl.ListFormat`.
 */
export function formatList(
  items: readonly string[],
  locale: string = DEFAULTS.locale,
  options?: Intl.ListFormatOptions,
): string {
  return new Intl.ListFormat(locale, options).format(items);
}

/**
 * #100: محاسبهٔ گام حرکت افقی کلیدهای جهت‌نما (`ArrowLeft` / `ArrowRight`)
 * مطابق WAI-ARIA APG در محیط‌های LTR و RTL.
 */
export function resolveHorizontalStep(key: string, dir: 'rtl' | 'ltr' = 'ltr'): -1 | 0 | 1 {
  if (key === 'ArrowRight') return dir === 'rtl' ? -1 : 1;
  if (key === 'ArrowLeft') return dir === 'rtl' ? 1 : -1;
  return 0;
}

/**
 * #100: نگاشت ویژگی‌های فیزیکی CSS به ویژگی‌های منطقی (CSS Logical Properties).
 */
export const LOGICAL_CSS_MAP: Readonly<Record<string, string>> = /* @__PURE__ */ Object.freeze({
  'margin-left': 'margin-inline-start',
  'margin-right': 'margin-inline-end',
  'padding-left': 'padding-inline-start',
  'padding-right': 'padding-inline-end',
  'border-left': 'border-inline-start',
  'border-right': 'border-inline-end',
  'border-left-width': 'border-inline-start-width',
  'border-right-width': 'border-inline-end-width',
  'border-left-color': 'border-inline-start-color',
  'border-right-color': 'border-inline-end-color',
  left: 'inset-inline-start',
  right: 'inset-inline-end',
});

/**
 * #100: تبدیل خودکار استایل‌های فیزیکی افقی (`margin-left`, `padding-right`, `left`, `text-align: left/right`)
 * به معادل‌های CSS Logical Properties برای سازگاری کامل با RTL/LTR.
 */
export function toLogicalCss(cssText: string): string {
  let out = cssText;
  for (const [physical, logical] of Object.entries(LOGICAL_CSS_MAP)) {
    const re = new RegExp(`(^|[;\\s{])${physical}(\\s*:)`, 'gi');
    out = out.replace(re, `$1${logical}$2`);
  }
  out = out
    .replace(/text-align\s*:\s*left\b/gi, 'text-align: start')
    .replace(/text-align\s*:\s*right\b/gi, 'text-align: end');
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// #150 — Reactive I18n Engine (createI18n، ICU-subset، plugin، useI18n، detect)
// ═══════════════════════════════════════════════════════════════════════════
//
// پیاده‌سازی موتور در ماژول‌های جدا: icu.ts (قالب), core.ts (createI18n و
// plugin و detectFromSources), options.ts (schema پیش‌فرض‌ها), types.ts
// (رسوم API). این بخش فقط آن‌ها را با نام‌های عمومی spec بازصادر می‌کند.

export { createI18n, i18nPlugin, useI18n, bindI18nToApp, __resetActiveI18n } from './core';
export {
  i18nOptionsSchema,
  resolveI18nOptions,
  I18N_DEFAULTS,
  languageOf,
  regionOf,
} from './options';
export { formatTemplate, icuInvalid } from './icu';
export type { FormatHooks } from './icu';
export type {
  I18n,
  I18nOptions,
  I18nParams,
  Messages,
  MissingStrategy,
  DetectSource,
  CalendarName,
  NumberingSystem,
  DetectContext,
  TCallOptions,
} from './types';

/** detectLocale آزاد SPEC §۳.۱: (opts, ctx?) ⇒ locale یا undefined. */
import { detectFromSources } from './core';
import { resolveI18nOptions as resolveI18nOptionsForDetect } from './options';
export function detectLocale(
  opts: I18nOptionsDetect = {},
  ctx?: import('./types').DetectContext,
): string | undefined {
  const resolved = resolveI18nOptionsForDetect(opts);
  return detectFromSources(resolved, ctx);
}
import type { I18nOptions as I18nOptionsDetect } from './types';
