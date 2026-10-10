// #146 — تایپ‌ها و DEFAULTS (SPEC §۰.۲/§۲.۶).
import { defineDefaults } from '@zenith/shared';

/** اجزای تاریخ جلالی. */
export interface JalaliParts {
  /** سال جلالی (۱۰۰۰..۳۰۰۰ پیش‌فرض). */
  y: number;
  /** ماه جلالی ۱..۱۲ (فروردین..اسفند). */
  m: number;
  /** روز ماه ۱..۳۱. */
  d: number;
}

/** سبک نام ماه/روز. */
export type JalaliNameStyle = 'long' | 'short';

/**
 * منطقهٔ زمانی استخراج فیلدهای میلادی.
 * - `'utc'` (پیش‌فرض): deterministic — خروجی سرور و کلاینت یکسان (SSR).
 * - `'local'`: فیلدهای منطبق بر منطقهٔ زمانی سیستم (رفتار legacy `new Date()`).
 * - رشتهٔ IANA (مثل `'Asia/Tehran'`): از `Intl.DateTimeFormat` استفاده می‌شود.
 */
export type JalaliTimeZone = 'utc' | 'local' | (string & {});

/** گزینه‌های مشترک (SPEC §۲.۶). */
export interface JalaliOptions {
  /** رقم‌های خروج فرمت‌شده. @default 'latin' */
  digits?: 'latin' | 'persian' | 'arabic';
  /** زبان نام‌ها. @default 'fa' */
  locale?: 'fa' | 'en';
  /**
   * راستی‌آزمایی خروجی با `Intl.DateTimeFormat(u-ca-persian)` در زمان اجرا
   * (best-effort؛ الگوریتم حسابی Borkowski مرجع قطعی است — DEC-028).
   * @default false
   */
  useIntl?: boolean;
  /** بازهٔ سال جلالی مجاز. خارج از آن `ZEN-1301`. @default {min:1000,max:3000} */
  range?: { min: number; max: number };
  /** منطقهٔ زمانی استخراج. @default 'utc' */
  timeZone?: JalaliTimeZone;
  /** ساعت قابل‌تزریق (تست deterministic؛ #7 §۷ دستورالعمل). */
  clock?: () => Date;
}

export const DEFAULTS = defineDefaults({
  digits: 'latin' as const,
  locale: 'fa' as const,
  useIntl: false,
  range: { min: 1000, max: 3000 },
  timeZone: 'utc' as JalaliTimeZone,
});

/** نام کامل ماه‌های جلالی (fa). */
export const MONTH_NAMES_FA = [
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
] as const;

/** نام کامل ماه‌ها (en، آوانگاری رایج). */
export const MONTH_NAMES_EN = [
  'Farvardin',
  'Ordibehesht',
  'Khordad',
  'Tir',
  'Mordad',
  'Shahrivar',
  'Mehr',
  'Aban',
  'Azar',
  'Dey',
  'Bahman',
  'Esfand',
] as const;

/** نام کامل روزهای هفته؛ ایندکس ۰ = شنبه. */
export const WEEKDAY_NAMES_FA = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنجشنبه',
  'جمعه',
] as const;

export const WEEKDAY_NAMES_EN = [
  'Saturday',
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
] as const;

export const WEEKDAY_SHORT_FA = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const;
export const WEEKDAY_SHORT_EN = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] as const;
