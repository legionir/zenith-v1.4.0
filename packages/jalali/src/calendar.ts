// #146 — تبدیل‌های تاریخ: toJalaliParts / fromJalaliParts / isValidJalali /
// isLeap / monthDays / compareJalali / jalaliNow و حساب‌های add*/diffDays.
//
// رفتار مرز (SPEC §۲.۶): خارج از بازه ⇒ ZEN-1301 throw (نه هشدار و نتیجهٔ غلط
// — این همان انحراف عمدی از legacy i18n است؛ DEC-028). تاریخ ناموجود ⇒ ZEN-1303.

import { createReservedError } from '@zenith/errors';
import { mergeOptions } from '@zenith/shared';
import { d2j, d2g, j2d, jalCal, jdnToUtcDate, g2d } from './core';
import { DEFAULTS, type JalaliOptions, type JalaliParts } from './types';

function assertParts(parts: JalaliParts): void {
  if (
    !Number.isInteger(parts.y) ||
    !Number.isInteger(parts.m) ||
    !Number.isInteger(parts.d) ||
    parts.m < 1 ||
    parts.m > 12 ||
    parts.d < 1 ||
    parts.d > monthDays(parts.y, parts.m)
  ) {
    throw createReservedError('ZEN-1303', { details: { ...parts } });
  }
}

function assertRange(y: number, opts: JalaliOptions): void {
  const range = opts.range ?? DEFAULTS.range;
  if (!Number.isFinite(y) || y < range.min || y > range.max) {
    throw createReservedError('ZEN-1301', {
      details: { jy: y, min: range.min, max: range.max },
    });
  }
}

/** فیلدهای میلادی یک Date در منطقهٔ زمانی خواسته‌شده (بدون mutate کردن ورودی). */
function gregorianFields(
  date: Date,
  timeZone: JalaliOptions['timeZone'],
): { gy: number; gm: number; gd: number } {
  if (isNaN(date.getTime())) {
    throw createReservedError('ZEN-1303', { details: { input: 'Invalid Date' } });
  }
  if (timeZone === 'utc' || timeZone === undefined) {
    return { gy: date.getUTCFullYear(), gm: date.getUTCMonth() + 1, gd: date.getUTCDate() };
  }
  if (timeZone === 'local') {
    return { gy: date.getFullYear(), gm: date.getMonth() + 1, gd: date.getDate() };
  }
  // رشتهٔ IANA — deterministic فقط اگر منطقهٔ زمانی معتبر باشد (SSR: صریح پاس دهید).
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const g: Record<string, string> = {};
    for (const p of parts) g[p.type] = p.value;
    return { gy: Number(g.year), gm: Number(g.month), gd: Number(g.day) };
  } catch (e) {
    throw createReservedError('ZEN-1303', {
      details: { timeZone },
      cause: e,
    });
  }
}

function toDate(input: Date | string): Date {
  if (input instanceof Date) return input;
  const d = new Date(input);
  if (isNaN(d.getTime())) {
    throw createReservedError('ZEN-1303', { details: { input } });
  }
  return d;
}

/** آیا سال جلالی کبیسه است؟ (Borkowski: کد چرخه ۰ ⇒ کبیسه) */
export function isLeap(jy: number): boolean {
  assertAlgo(jy);
  return jalCal(jy).leap === 0;
}

function assertAlgo(jy: number): void {
  // سال‌های خارج از جدول BREAKS تعریف‌شده نیستند (core ZEN-1301 را از jalCal می‌گیرد).
  if (!Number.isInteger(jy)) {
    throw createReservedError('ZEN-1303', { details: { jy } });
  }
}

/** تعداد روزهای ماه جلالی `jm` در سال `jy`. */
export function monthDays(jy: number, jm: number): number {
  if (!Number.isInteger(jm) || jm < 1 || jm > 12) {
    throw createReservedError('ZEN-1303', { details: { jy, jm } });
  }
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeap(jy) ? 30 : 29;
}

/** آیا `(y, m, d)` یک تاریخ واقعی جلالی است (بدون throw)؟ */
export function isValidJalali(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > 12 || d < 1) return false;
  if (y < -61 || y > 3177) return false;
  return d <= monthDays(y, m);
}

/**
 * تبدیل Date/رشتهٔ ISO به اجزای جلالی.
 *
 * @param input ورودی Date یا رشتهٔ تاریخ (ساخت Date می‌شود)
 * @param options گزینه‌های منطقهٔ زمانی/بازه (پیش‌فرض UTC، ۱۰۰۰..۳۰۰۰)
 * @throws ZEN-1303 ورودی نامعتبر؛ ZEN-1301 خارج از بازه
 */
export function toJalaliParts(input: Date | string, options?: JalaliOptions): JalaliParts {
  const opts = mergeOptions(DEFAULTS as JalaliOptions, options);
  const date = toDate(input);
  const { gy, gm, gd } = gregorianFields(date, opts.timeZone);
  const parts = d2j(g2d(gy, gm, gd));
  assertRange(parts.y, opts);
  assertParts(parts);
  if (opts.useIntl && typeof Intl !== 'undefined') {
    // راستی‌آزمایی best-effort؛ اگر Intl مخالف بود خطای محیط (نه داده) است.
    try {
      const fmt = new Intl.DateTimeFormat('en-u-ca-persian', {
        timeZone: 'UTC',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      if (fmt.resolvedOptions().calendar === 'persian') {
        const g: Record<string, string> = {};
        for (const p of fmt.formatToParts(new Date(Date.UTC(gy, gm - 1, gd)))) g[p.type] = p.value;
        if (g.year && Number(g.year) !== parts.y) {
          throw createReservedError('ZEN-1301', {
            details: { jy: parts.y, intlYear: g.year, note: 'outside Intl/ICU agreement range' },
          });
        }
      }
    } catch (e) {
      if (e instanceof Error && e.name === 'ZenithError') throw e;
      // Intl نامعتبر/غیرقابل‌استفاده ⇒ بدون بررسی ادامه بده (الگوریتم مرجع است).
    }
  }
  return parts;
}

/**
 * تبدیل اجزای جلالی به Date (نیمه‌شب UTC — سازگار با legacy `fromJalali`).
 * @throws ZEN-1303 تاریخ ناموجود؛ ZEN-1301 خارج از بازه
 */
export function fromJalaliParts(y: number, m: number, d: number, options?: JalaliOptions): Date {
  const opts = mergeOptions(DEFAULTS as JalaliOptions, options);
  assertRange(y, opts);
  assertParts({ y, m, d });
  return jdnToUtcDate(j2d(y, m, d));
}

/** میلادیِ اجزای جلالی (بخش‌های خالص؛ بدون ساخت Date). */
export function jalaliToGregorian(
  y: number,
  m: number,
  d: number,
): { gy: number; gm: number; gd: number } {
  assertParts({ y, m, d });
  return d2g(j2d(y, m, d));
}

/** اجزای میلادی → اجزای جلالی. */
export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliParts {
  return d2j(g2d(gy, gm, gd));
}

/** مقایسهٔ دو تاریخ جلالی: <0، 0، >0. */
export function compareJalali(a: JalaliParts, b: JalaliParts): number {
  if (a.y !== b.y) return a.y - b.y;
  if (a.m !== b.m) return a.m - b.m;
  return a.d - b.d;
}

/** تعداد روزهای کامل بین دو تاریخ (b − a؛ Date یا JalaliParts). */
export function diffDays(a: Date | JalaliParts, b: Date | JalaliParts): number {
  const jdn = (x: Date | JalaliParts): number =>
    x instanceof Date
      ? g2d(x.getUTCFullYear(), x.getUTCMonth() + 1, x.getUTCDate())
      : j2d(x.y, x.m, x.d);
  return jdn(b) - jdn(a);
}

/** جمع روز روی Date (کپی؛ ورودی mutate نمی‌شود — BUG-04 legacy حفظ شد). */
export function addDays(date: Date, days: number): Date {
  if (!Number.isInteger(days)) {
    throw createReservedError('ZEN-1303', { details: { days } });
  }
  const d = new Date(date.getTime());
  if (isNaN(d.getTime()))
    throw createReservedError('ZEN-1303', { details: { input: 'Invalid Date' } });
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/** جمع ماه جلالی با clamp به پایان ماه مقصد. */
export function addMonths(from: JalaliParts, months: number): JalaliParts {
  if (!Number.isInteger(months)) throw createReservedError('ZEN-1303', { details: { months } });
  assertParts(from);
  const total = from.y * 12 + (from.m - 1) + months;
  const y = Math.floor(total / 12);
  const m = mod12(total) + 1;
  const d = Math.min(from.d, monthDays(y, m));
  assertParts({ y, m, d });
  return { y, m, d };
}

/** جمع سال جلالی با clamp اسفند ۳۰ در سال مقصد غیرکبیسه. */
export function addYears(from: JalaliParts, years: number): JalaliParts {
  return addMonths(from, years * 12);
}

function mod12(n: number): number {
  return ((n % 12) + 12) % 12;
}

/** تاریخ جلالی «اکنون» با clock قابل‌تزریق (پیش‌فرض `() => new Date()`). */
export function jalaliNow(options?: JalaliOptions): JalaliParts {
  // clock تابع است و در DEFAULTS نیست؛ mergeOptions آن را حذف می‌کند، پس
  // مستقیم از options خوانده می‌شود (تست deterministic، دستورالعمل §۷).
  const opts = mergeOptions(DEFAULTS as JalaliOptions, options);
  const clock = options?.clock ?? ((): Date => new Date());
  return toJalaliParts(clock(), opts);
}
