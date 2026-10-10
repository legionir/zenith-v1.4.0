// #146 — @zenith/jalali (SPEC §۲.۶): تقویم جلالی خالص L0 — استخراج از i18n.
//
// قوانین لایه (گیت: test/layering.test.ts):
//   • وابستگی فقط errors + shared؛ بدون DOM/timer در import-time (env-import).
//   • الگوریتم Borkowski (چرخهٔ حسابی ۳۳‌ساله) — همان اصول ICU در بازهٔ
//     ۱۲۰۱..۱۵۰۰؛ ۱۲۰٬۰۰۰ تاریخ تصادفی با Intl مقایسه می‌شود (jalali.test.ts).
//   • خروجی deterministic در SSR: پیش‌فرض timeZone='utc' (DEC-028).
//   • خارج از بازه ⇒ ZEN-1301 throw (رفتار SPEC؛ legacy i18n هشدار و '' می‌داد).

export type { JalaliParts, JalaliOptions, JalaliNameStyle, JalaliTimeZone } from './types';
export {
  DEFAULTS,
  MONTH_NAMES_FA,
  MONTH_NAMES_EN,
  WEEKDAY_NAMES_FA,
  WEEKDAY_NAMES_EN,
  WEEKDAY_SHORT_FA,
  WEEKDAY_SHORT_EN,
} from './types';

export {
  toJalaliParts,
  fromJalaliParts,
  jalaliToGregorian,
  gregorianToJalali,
  compareJalali,
  isValidJalali,
  isLeap,
  monthDays,
  diffDays,
  addDays,
  addMonths,
  addYears,
  jalaliNow,
} from './calendar';

export {
  formatJalali,
  parseJalali,
  monthName,
  weekdayName,
  weekdayIndexFromJdn,
  toPersianDigits,
  toArabicDigits,
  toLatinDigits,
} from './format';
