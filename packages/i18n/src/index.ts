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
    console.warn('[Zenith i18n] toJalali: dates before 1600 CE may be inaccurate');
  }
  let py: number, pm: number, pd: number;
  if (legacySupported(d)) {
    const p = legacyParts(d);
    if (!p) {
      console.warn(`[Zenith i18n] toJalali: invalid result for ${d.toISOString()}`);
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
    console.warn(`[Zenith i18n] toJalali: invalid result for ${d.toISOString()}`);
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
    console.error('[Zenith i18n] addDaysJalali: invalid date input');
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
// #150 — Reactive I18n Engine (createI18n, ICU plural/select/number, i18nPlugin, useI18n, detectLocale)
// ═══════════════════════════════════════════════════════════════════════════

const ZENITH_READABLE_SYM = Symbol.for('zenith.readable');

export interface I18nReadonlySignal<T> {
  readonly [ZENITH_READABLE_SYM]: true;
  get(): T;
  peek(): T;
  subscribe(fn: (value: T) => void): () => void;
}

export interface I18nSignal<T> extends I18nReadonlySignal<T> {
  set(value: T): void;
}

function createLocalSignal<T>(initial: T): I18nSignal<T> {
  let current = initial;
  const subs = new Set<(value: T) => void>();
  return {
    [ZENITH_READABLE_SYM]: true,
    get() {
      return current;
    },
    peek() {
      return current;
    },
    set(next: T) {
      if (Object.is(current, next)) return;
      current = next;
      for (const fn of [...subs]) fn(current);
    },
    subscribe(fn: (value: T) => void) {
      subs.add(fn);
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        subs.delete(fn);
      };
    },
  };
}

export interface I18nMessages {
  [key: string]: string | number | I18nMessages;
}

export interface I18nOptions {
  locale?: string;
  fallbackLocale?: string;
  messages?: Record<string, I18nMessages>;
  loadMessages?: (locale: string) => Promise<I18nMessages>;
}

export interface TranslateOptions {
  locale?: string;
  default?: string;
  count?: number;
}

export interface I18n {
  readonly locale: I18nSignal<string>;
  readonly dir: I18nReadonlySignal<'rtl' | 'ltr'>;
  t(key: string, params?: Record<string, unknown>, options?: TranslateOptions): string;
  te(key: string, locale?: string): boolean;
  tm(key: string, locale?: string): unknown;
  n(value: number, options?: Intl.NumberFormatOptions, locale?: string): string;
  d(value: Date | number, options?: Intl.DateTimeFormatOptions, locale?: string): string;
  rt(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    options?: Intl.RelativeTimeFormatOptions,
    locale?: string,
  ): string;
  list(items: readonly string[], options?: Intl.ListFormatOptions, locale?: string): string;
  setLocale(locale: string): Promise<void>;
  addMessages(locale: string, messages: I18nMessages): () => void;
  availableLocales(): string[];
  dispose(): void;
  [Symbol.dispose]?: () => void;
}

function lookupPath(obj: I18nMessages | undefined, path: string): unknown {
  if (!obj) return undefined;
  if (path in obj) return obj[path];
  return path
    .split('.')
    .reduce<I18nMessages | string | number | undefined>(
      (acc, part) =>
        acc != null && typeof acc === 'object'
          ? ((acc as Record<string, unknown>)[part] as I18nMessages | string | number | undefined)
          : undefined,
      obj,
    );
}

function formatIcuMessage(
  template: string,
  params: Record<string, unknown>,
  locale: string,
  resolveKey: (k: string) => string,
): string {
  // 1. Linked messages `@:other.key`
  let out = template.replace(/@:([a-zA-Z0-9_.-]+)/g, (_m, linkedKey: string) =>
    resolveKey(linkedKey),
  );

  // 2. ICU `{var, plural, =0{...} one{# ...} other{# ...}}` and `{var, select, a{...} other{...}}`
  const icuBlockRe = /\{(\w+)\s*,\s*(plural|select)\s*,\s*((?:[^{}]|\{[^{}]*\})+)\}/g;
  out = out.replace(icuBlockRe, (_full, varName: string, kind: string, branchesRaw: string) => {
    const rawVal = params[varName];
    const branchMap = new Map<string, string>();
    const branchRe = /(=?\w+)\s*\{([^{}]*)\}/g;
    let match: RegExpExecArray | null;
    while ((match = branchRe.exec(branchesRaw)) !== null) {
      branchMap.set(match[1]!, match[2]!);
    }

    if (kind === 'plural') {
      const num = Number(rawVal ?? 0);
      const exactKey = `=${num}`;
      let chosen = branchMap.get(exactKey);
      if (chosen === undefined) {
        let rule = 'other';
        try {
          rule = new Intl.PluralRules(locale).select(num);
        } catch {
          rule = num === 1 ? 'one' : 'other';
        }
        chosen = branchMap.get(rule) ?? branchMap.get('other') ?? '';
      }
      const numFormatted = locale.startsWith('fa') ? toPersianNums(num) : String(num);
      return chosen.replace(/#/g, numFormatted);
    }

    const selKey = String(rawVal ?? 'other');
    return branchMap.get(selKey) ?? branchMap.get('other') ?? '';
  });

  // 3. ICU `{var, number, currency}` or `{var, number}`
  out = out.replace(
    /\{(\w+)\s*,\s*number(?:\s*,\s*(\w+))?\}/g,
    (_full, varName: string, style?: string) => {
      const num = Number(params[varName] ?? 0);
      if (style === 'currency') {
        return formatCurrency(num, locale.startsWith('fa') ? 'IRR' : 'USD', locale);
      }
      return new Intl.NumberFormat(locale).format(num);
    },
  );

  // 4. Simple `{var}` interpolation
  out = out.replace(/\{(\w+)\}/g, (_m, varName: string) => {
    const val = params[varName];
    return val === undefined || val === null ? `{${varName}}` : String(val);
  });

  return out;
}

let _activeI18n: I18n | null = null;

/**
 * #150: ساخت نمونهٔ چندزبانگی واکنشی با پشتیبانی از ICU (`plural`/`select`/`number`)،
 * بارگذاری تنبل پیام‌ها (`loadMessages`) و جهت خودکار (`dir`).
 */
export function createI18n(options: I18nOptions = {}): I18n {
  const initialLocale = options.locale ?? DEFAULTS.locale;
  const fallbackLocale = options.fallbackLocale ?? 'en';
  const catalog = new Map<string, I18nMessages>();
  if (options.messages) {
    for (const [loc, msgs] of Object.entries(options.messages)) {
      catalog.set(loc, { ...msgs });
    }
  }

  const localeSig = createLocalSignal<string>(initialLocale);
  const dirSig = createLocalSignal<'rtl' | 'ltr'>(getDirection(initialLocale));
  const unsubLocale = localeSig.subscribe((loc) => {
    dirSig.set(getDirection(loc));
  });

  const tm = (key: string, localeOverride?: string): unknown => {
    const loc = localeOverride ?? localeSig.get();
    const direct = lookupPath(catalog.get(loc), key);
    if (direct !== undefined) return direct;
    const baseLang = loc.split('-')[0]!;
    if (baseLang !== loc) {
      const baseMatch = lookupPath(catalog.get(baseLang), key);
      if (baseMatch !== undefined) return baseMatch;
    }
    if (fallbackLocale && fallbackLocale !== loc) {
      return lookupPath(catalog.get(fallbackLocale), key);
    }
    return undefined;
  };

  const te = (key: string, localeOverride?: string): boolean => {
    return tm(key, localeOverride) !== undefined;
  };

  const t = (
    key: string,
    params: Record<string, unknown> = {},
    tOpts: TranslateOptions = {},
  ): string => {
    const loc = tOpts.locale ?? localeSig.get();
    const mergedParams = tOpts.count !== undefined ? { count: tOpts.count, ...params } : params;
    const raw = tm(key, loc);
    if (typeof raw !== 'string') {
      return tOpts.default ?? key;
    }
    return formatIcuMessage(raw, mergedParams, loc, (linked) => t(linked, mergedParams, tOpts));
  };

  const instance: I18n = {
    locale: localeSig,
    dir: dirSig,
    t,
    te,
    tm,
    n: (val, opts, loc) => new Intl.NumberFormat(loc ?? localeSig.get(), opts).format(val),
    d: (val, opts, loc) => formatDateTime(val, loc ?? localeSig.get(), opts),
    rt: (val, unit, opts, loc) => formatRelativeTime(val, unit, loc ?? localeSig.get(), opts),
    list: (items, opts, loc) => formatList(items, loc ?? localeSig.get(), opts),
    async setLocale(nextLocale: string): Promise<void> {
      if (!catalog.has(nextLocale) && typeof options.loadMessages === 'function') {
        const loaded = await options.loadMessages(nextLocale);
        catalog.set(nextLocale, { ...loaded });
      }
      localeSig.set(nextLocale);
    },
    addMessages(locale: string, messages: I18nMessages): () => void {
      const prev = catalog.get(locale) ?? {};
      catalog.set(locale, { ...prev, ...messages });
      let removed = false;
      return () => {
        if (removed) return;
        removed = true;
        const current = catalog.get(locale);
        if (current) {
          const currentRec = current as Record<string, unknown>;
          for (const k of Object.keys(messages)) {
            if (k in prev) currentRec[k] = prev[k];
            else delete currentRec[k];
          }
        }
      };
    },
    availableLocales(): string[] {
      return Array.from(catalog.keys());
    },
    dispose(): void {
      unsubLocale();
      if (_activeI18n === instance) {
        _activeI18n = null;
      }
    },
  };

  const disposeSym: unknown =
    typeof Symbol !== 'undefined' && 'dispose' in Symbol
      ? (Symbol as unknown as { dispose: symbol }).dispose
      : undefined;
  if (typeof disposeSym === 'symbol') {
    Object.assign(instance, { [disposeSym]: () => instance.dispose() });
  }

  _activeI18n = instance;
  return instance;
}

/**
 * #150: دریافت نمونهٔ فعال `I18n`.
 */
export function useI18n(): I18n {
  if (!_activeI18n) {
    _activeI18n = createI18n();
  }
  return _activeI18n;
}

/**
 * #150: پلاگین رسمی چندزبانگی برای `app.use(i18nPlugin(options))`.
 */
export function i18nPlugin(options: I18nOptions = {}) {
  return {
    name: 'zenith:i18n',
    setup(app: { provide?: (key: string | symbol, value: unknown) => void }) {
      const i18n = createI18n(options);
      app?.provide?.('zenith:i18n', i18n);
      return () => i18n.dispose();
    },
  };
}

/**
 * #150: تشخیص خودکار locale از query، cookie یا زبان مرورگر.
 */
export function detectLocale(
  options: {
    query?: string;
    cookie?: string;
    navigatorLanguages?: readonly string[];
    defaultLocale?: string;
    detectKey?: string;
  } = {},
): string {
  const key = options.detectKey ?? 'lang';
  if (options.query) {
    const params = new URLSearchParams(options.query.replace(/^\?/, ''));
    const q = params.get(key);
    if (q) return q;
  }
  if (options.cookie) {
    const match = options.cookie.match(new RegExp(`(?:^|;\\s*)${key}=([^;]+)`));
    if (match?.[1]) return decodeURIComponent(match[1]);
  }
  const navLangs =
    options.navigatorLanguages ??
    (typeof navigator !== 'undefined' && Array.isArray(navigator.languages)
      ? navigator.languages
      : []);
  if (navLangs.length > 0 && navLangs[0]) {
    return navLangs[0];
  }
  return options.defaultLocale ?? DEFAULTS.locale;
}
