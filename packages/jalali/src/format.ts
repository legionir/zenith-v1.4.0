// #146 — فرمت/پارس رشتهٔ تاریخ جلالی و تبدیل‌های رقم.
// نشانه‌های قالب (SPEC §۲.۶): YYYY YY MMMM MMM MM M DD D dddd ddd HH mm ss.
// قالب نامعتبر ⇒ ZEN-1302؛ رشتهٔ غیرتاریخی/تاریخ ناموجود ⇒ ZEN-1303.

import { createReservedError } from '@zenith/errors';
import { mergeOptions } from '@zenith/shared';
import { jalCal, j2d } from './core';
import { toJalaliParts } from './calendar';
import {
  DEFAULTS,
  MONTH_NAMES_EN,
  MONTH_NAMES_FA,
  WEEKDAY_NAMES_EN,
  WEEKDAY_NAMES_FA,
  WEEKDAY_SHORT_EN,
  WEEKDAY_SHORT_FA,
  type JalaliOptions,
  type JalaliParts,
} from './types';

/** رقم‌های لاتین → فارسی. */
export function toPersianDigits(v: number | string): string {
  return String(v).replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.charAt(Number(d)));
}

/** رقم‌های لاتین → عربی. */
export function toArabicDigits(v: number | string): string {
  return String(v).replace(/[0-9]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.charAt(Number(d)));
}

/** رقم‌های فارسی/عربی → لاتین (نرمال‌سازی ورودی). */
export function toLatinDigits(v: number | string): string {
  return String(v)
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

function applyDigits(s: string, mode: 'latin' | 'persian' | 'arabic'): string {
  if (mode === 'persian') return toPersianDigits(s);
  if (mode === 'arabic') return toArabicDigits(s);
  return s;
}

/** نام ماه جلالی (۱..۱۲). */
export function monthName(
  jm: number,
  options?: { locale?: 'fa' | 'en'; style?: 'long' | 'short' },
): string {
  const locale = options?.locale ?? DEFAULTS.locale;
  const style = options?.style ?? 'long';
  if (!Number.isInteger(jm) || jm < 1 || jm > 12) {
    throw createReservedError('ZEN-1303', { details: { jm } });
  }
  const full = (locale === 'en' ? MONTH_NAMES_EN : MONTH_NAMES_FA)[jm - 1]!;
  if (style === 'short' && locale === 'en') return full.slice(0, 3);
  return full; // نام‌های فارسی به‌طور طبیعی کوتاه‌اند
}

/** نام روز هفته؛ ایندکس ۰ = شنبه (قرارداد تقویم ایرانی). */
export function weekdayName(
  i: number,
  options?: { locale?: 'fa' | 'en'; style?: 'long' | 'short' },
): string {
  const locale = options?.locale ?? DEFAULTS.locale;
  const style = options?.style ?? 'long';
  if (!Number.isInteger(i) || i < 0 || i > 6) {
    throw createReservedError('ZEN-1303', { details: { weekday: i } });
  }
  if (style === 'short') return (locale === 'en' ? WEEKDAY_SHORT_EN : WEEKDAY_SHORT_FA)[i]!;
  return (locale === 'en' ? WEEKDAY_NAMES_EN : WEEKDAY_NAMES_FA)[i]!;
}

/** ایندکس روز هفته (۰=شنبه) از JDN. JDN 2451545 (=2000-01-01) شنبه بود ⇒ (jdn+2)%7. */
export function weekdayIndexFromJdn(jdn: number): number {
  return (((jdn + 2) % 7) + 7) % 7;
}

// توکن‌های SPEC؛ اسکن با اولویت طولانی‌ترین (تا MMMM به MM تقسیم نشود).
const TOKENS = [
  'YYYY',
  'YY',
  'MMMM',
  'MMM',
  'MM',
  'M',
  'dddd',
  'ddd',
  'DD',
  'D',
  'HH',
  'mm',
  'ss',
] as const;
const TOKEN_AT = (rest: string): (typeof TOKENS)[number] | null => {
  for (const t of TOKENS) if (rest.startsWith(t)) return t;
  return null;
};

/** اعتبارسنجی قالب: توکن‌های SPEC + جداکنندهٔ نشانه‌ای/فاصله. بقیه ⇒ ZEN-1302. */
function scanFormat(fmt: string): Array<{ token: string } | { literal: string }> {
  const out: Array<{ token: string } | { literal: string }> = [];
  let rest = fmt;
  while (rest.length > 0) {
    const t = TOKEN_AT(rest);
    if (t) {
      out.push({ token: t });
      rest = rest.slice(t.length);
      continue;
    }
    const m = /^[^A-Za-z]+/.exec(rest);
    if (!m) throw createReservedError('ZEN-1302', { details: { fmt, at: rest.slice(0, 4) } });
    out.push({ literal: m[0] });
    rest = rest.slice(m[0].length);
  }
  return out;
}

/**
 * فرمت‌بندی تاریخ جلالی.
 *
 * @param date Date/رشتهٔ میلادی یا اجزای جلالی
 * @param fmt قالب (پیش‌فرض `YYYY/MM/DD`)
 * @param options رقم/locale/منطقهٔ زمانی
 * @throws ZEN-1302 قالب نامعتبر؛ ZEN-1301 خارج از بازه؛ ZEN-1303 ورودی نامعتبر
 */
export function formatJalali(
  date: Date | string | JalaliParts,
  fmt: string = 'YYYY/MM/DD',
  options?: JalaliOptions,
): string {
  const partsList = scanFormat(fmt);
  const opts = mergeOptions(DEFAULTS as JalaliOptions, options);
  const asDate = date instanceof Date ? date : typeof date === 'string' ? new Date(date) : null;
  const parts: JalaliParts = asDate !== null ? toJalaliParts(asDate, opts) : (date as JalaliParts);
  const jdn = j2d(parts.y, parts.m, parts.d);
  const weekday = weekdayIndexFromJdn(jdn);
  const hms = timeFields(asDate, opts);
  const pad = (n: number, w = 2): string => String(n).padStart(w, '0');
  let out = '';
  for (const item of partsList) {
    if ('literal' in item) {
      out += item.literal;
      continue;
    }
    switch (item.token) {
      case 'YYYY':
        out += pad(parts.y, 4);
        break;
      case 'YY':
        out += pad(parts.y % 100);
        break;
      case 'MMMM':
        out += monthName(parts.m, { locale: opts.locale });
        break;
      case 'MMM':
        out += monthName(parts.m, { locale: opts.locale, style: 'short' });
        break;
      case 'MM':
        out += pad(parts.m);
        break;
      case 'M':
        out += String(parts.m);
        break;
      case 'dddd':
        out += weekdayName(weekday, { locale: opts.locale });
        break;
      case 'ddd':
        out += weekdayName(weekday, { locale: opts.locale, style: 'short' });
        break;
      case 'DD':
        out += pad(parts.d);
        break;
      case 'D':
        out += String(parts.d);
        break;
      case 'HH':
        out += pad(hms.h);
        break;
      case 'mm':
        out += pad(hms.mi);
        break;
      case 'ss':
        out += pad(hms.s);
        break;
    }
  }
  return applyDigits(out, opts.digits ?? DEFAULTS.digits);
}

function timeFields(date: Date | null, opts: JalaliOptions): { h: number; mi: number; s: number } {
  if (!date || isNaN(date.getTime())) return { h: 0, mi: 0, s: 0 };
  const tz = opts.timeZone ?? DEFAULTS.timeZone;
  if (tz === 'utc')
    return { h: date.getUTCHours(), mi: date.getUTCMinutes(), s: date.getUTCSeconds() };
  if (tz === 'local') return { h: date.getHours(), mi: date.getMinutes(), s: date.getSeconds() };
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const g: Record<string, string> = {};
  for (const p of parts) g[p.type] = p.value;
  return { h: Number(g.hour) % 24, mi: Number(g.minute), s: Number(g.second) };
}

/**
 * پارس رشتهٔ جلالی. ارقام فارسی/عربی/لاتین و جداکننده‌های `/ - . ، ؛` پذیرفته
 * می‌شوند. با `fmt`، ترتیب و جداکننده‌ها باید دقیقاً بخوان بخورند (ناسازگاری ⇒
 * ZEN-1302). توکن‌های نامی/زمانی در پارس پشتیبانی نمی‌شوند (ZEN-1302).
 */
export function parseJalali(str: string, fmt?: string, options?: JalaliOptions): JalaliParts {
  const opts = mergeOptions(DEFAULTS as JalaliOptions, options);
  const ascii = toLatinDigits(str.trim());
  let y: number, m: number, d: number;
  if (fmt !== undefined) {
    let reSrc = '^';
    let iy = -1;
    let im = -1;
    let id = -1;
    let groups = 0;
    for (const item of scanFormat(fmt)) {
      if ('literal' in item) {
        reSrc += item.literal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        continue;
      }
      const t = item.token;
      if (t === 'YYYY' || t === 'YY' || t === 'MM' || t === 'M' || t === 'DD' || t === 'D') {
        reSrc += '(\\d{1,4})';
        groups += 1;
        if (t.startsWith('Y')) iy = groups;
        else if (t === 'MM' || t === 'M') im = groups;
        else id = groups;
      } else {
        // MMMM/MMM/dddd/ddd/HH/mm/ss در پارس معنای عددی ندارند
        throw createReservedError('ZEN-1302', { details: { fmt, token: t } });
      }
    }
    reSrc += '$';
    const mm = new RegExp(reSrc).exec(ascii);
    if (!mm || iy < 0 || im < 0 || id < 0) {
      throw createReservedError('ZEN-1302', { details: { str, fmt } });
    }
    y = Number(mm[iy]);
    m = Number(mm[im]);
    d = Number(mm[id]);
  } else {
    const mm = /^(\d{1,4})\s*[/\-.,؛،]\s*(\d{1,2})\s*[/\-.,؛،]\s*(\d{1,2})$/.exec(ascii);
    if (!mm) throw createReservedError('ZEN-1303', { details: { str } });
    y = Number(mm[1]);
    m = Number(mm[2]);
    d = Number(mm[3]);
  }
  const range = opts.range ?? DEFAULTS.range;
  if (!Number.isInteger(y) || y < range.min || y > range.max) {
    throw createReservedError('ZEN-1301', { details: { jy: y } });
  }
  if (!existsDate(y, m, d)) {
    throw createReservedError('ZEN-1303', { details: { y, m, d } });
  }
  return { y, m, d };
}

function existsDate(y: number, m: number, d: number): boolean {
  if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) return false;
  if (m < 1 || m > 12 || d < 1) return false;
  if (y < -61 || y > 3177) return false;
  const md = m <= 6 ? 31 : m <= 11 ? 30 : jalCal(y).leap === 0 ? 30 : 29;
  return d <= md;
}
