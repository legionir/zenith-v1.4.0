# @zenith/jalali

تقویم جلالی خالص (هجری شمسی) برای Zenith — لایهٔ L0 (SPEC §۲.۶، issue #146).

استخراج‌شده از `@zenith/i18n`؛ توابع قدیمی در i18n به‌صورت alias +
`deprecate` (ZEN-DEPR-006..015) حفظ شده‌اند و در 2.0 حذف می‌شوند (DEC-026).

## الگوریتم

چرخهٔ حسابی ۳۳‌سالهٔ Borkowski (jalaali-js) — مرجع قطعی و deterministic؛
هیچ وابستگی به `Intl`، منطقهٔ زمانی سیستم، timer یا DOM ندارد.
در تست، ۱۲۰٬۰۰۰ تاریخ تصادفی با `Intl.DateTimeFormat('u-ca-persian')`
(ICU) مقایسه می‌شوند و در بازهٔ ۱۲۰۱..۱۵۰۰ یکسان‌اند؛ رفت‌وبرگشت
`Date ↔ Jalali` برای سال‌های ۱۰۰۰..۳۰۰۰ کامل بررسی شده است.

> ICU خارج از بازهٔ ۱۲۰۱..۱۵۰۰ از چرخهٔ astronomical استفاده می‌کند؛
> جزئیات و دلیل انتخاب در `docs/decisions/DEC-028-jalali-algorithm.md`.

## API

```ts
import {
  toJalaliParts,
  fromJalaliParts,
  formatJalali,
  parseJalali,
  addDays,
  addMonths,
  addYears,
  diffDays,
  isLeap,
  monthDays,
  monthName,
  weekdayName,
  compareJalali,
  jalaliNow,
  isValidJalali,
  toPersianDigits,
  toArabicDigits,
  toLatinDigits,
  DEFAULTS,
} from '@zenith/jalali';

toJalaliParts(new Date(Date.UTC(2024, 2, 20))); // { y: 1403, m: 1, d: 1 }
formatJalali('2024-03-20T12:00:00Z', 'YYYY-MM-DD dddd'); // '1403-01-01 سه‌شنبه'
parseJalali('۱۴۰۳/۰۴/۲۵'); // { y: 1403, m: 4, d: 25 }
```

نشانه‌های قالب: `YYYY YY MMMM MMM MM M DD D dddd ddd HH mm ss`.

## گزینه‌ها (`JalaliOptions`)

| گزینه | نوع | پیش‌فرض | توضیح |
| --- | --- | --- | --- |
| `digits` | `'latin' \| 'persian' \| 'arabic'` | `'latin'` | رقم‌های خروج `formatJalali` |
| `locale` | `'fa' \| 'en'` | `'fa'` | زبان نام ماه/روز |
| `useIntl` | `boolean` | `false` | راستی‌آزمایی best-effort با Intl |
| `range` | `{min,max}` | `{min:1000,max:3000}` | بازهٔ سال جلالی مجاز |
| `timeZone` | `'utc' \| 'local' \| IANA` | `'utc'` | استخراج فیلدها (SSR deterministic) |
| `clock` | `() => Date` | `() => new Date()` | فقط برای `jalaliNow` (تزریق در تست) |

## خطاها (ZenithError، کاتالوگ #171)

- `ZEN-1301` — خارج از بازهٔ پشتیبانی‌شده (throw، نه هشدار و نتیجهٔ غلط)
- `ZEN-1302` — قالب نامعتبر
- `ZEN-1303` — تاریخ نامعتبر/ناموجود

## سازگاری

- ESM-only، Node ≥ 18.19 (DEC-027)؛ نسخهٔ تولد 1.5.0 (DEC-026).
- وابستگی فقط `@zenith/errors` + `@zenith/shared` (لایهٔ L0).
- بدون `Intl` هم کامل کار می‌کند (الگوریتم خالص)؛ `timeZone` رشتهٔ IANA
  در محیط بدون full-icu با `ZEN-1303` رد می‌شود.
- بودجهٔ حجم: ≤ ۴KB gzip (`.size-limit.json`).
