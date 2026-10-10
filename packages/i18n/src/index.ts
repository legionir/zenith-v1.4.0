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
