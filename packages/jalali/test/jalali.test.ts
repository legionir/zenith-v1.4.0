// #146 — @zenith/jalali: تقویم جلالی خالص L0 (SPEC §۲.۶).
// قرمز قبل از پیاده‌سازی: import از '../src/index' تا زمان existence شکست می‌خورد.
import { describe, it, expect } from 'vitest';
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
} from '../src/index';

describe('toJalaliParts / fromJalaliParts (Borkowski, SPEC §۲.۶)', () => {
  it('known anchors (UTC day)', () => {
    expect(toJalaliParts(new Date(Date.UTC(2024, 2, 20)))).toEqual({ y: 1403, m: 1, d: 1 });
    expect(toJalaliParts(new Date(Date.UTC(2024, 2, 19)))).toEqual({ y: 1402, m: 12, d: 29 });
    expect(toJalaliParts(new Date(Date.UTC(2025, 2, 21)))).toEqual({ y: 1404, m: 1, d: 1 });
    expect(toJalaliParts(new Date(Date.UTC(2000, 0, 1)))).toEqual({ y: 1378, m: 10, d: 11 });
  });

  it('accepts ISO strings and uses UTC fields when timeZone=utc (deterministic SSR)', () => {
    const p = toJalaliParts('2024-03-20T12:34:56Z', { timeZone: 'utc' });
    expect(p).toEqual({ y: 1403, m: 1, d: 1 });
  });

  it('fromJalaliParts roundtrips', () => {
    const d = fromJalaliParts(1403, 1, 1);
    expect(d.toISOString().startsWith('2024-03-20')).toBe(true);
    expect(toJalaliParts(d)).toEqual({ y: 1403, m: 1, d: 1 });
  });

  it('invalid Date input throws ZEN-1303', () => {
    try {
      toJalaliParts(new Date('nope'));
      expect.unreachable();
    } catch (e) {
      expect((e as Error).name).toBe('ZenithError');
      expect((e as { code?: string }).code).toBe('ZEN-1303');
    }
  });

  it('throws ZEN-1301 outside supported range and honors custom range option', () => {
    try {
      toJalaliParts(new Date(Date.UTC(800, 5, 5))); // jalali ~180 — below 1000
      expect.unreachable();
    } catch (e) {
      expect((e as { code?: string }).code).toBe('ZEN-1301');
    }
    expect(() =>
      // سال جلالی ~۲۰۷۹ ⇒ خارج از range سفارشی ۱۰۰۰..۲۰۰۰
      toJalaliParts(new Date(Date.UTC(2700, 0, 1)), { range: { min: 1000, max: 2000 } }),
    ).toThrow();
    // بازهٔ پیش‌فرض ۱۰۰۰..۳۰۰۰ هجری شمسی (SPEC §۲.۶): سال جلالی ۹۹۹ خطا، ۱۰۰۰ سالم.
    expect(() => toJalaliParts(fromJalaliParts(999, 12, 1))).toThrowError(/ZEN-1301/);
    expect(toJalaliParts(fromJalaliParts(1000, 1, 1))).toEqual({ y: 1000, m: 1, d: 1 });
    expect(toJalaliParts(fromJalaliParts(3000, 1, 1))).toEqual({ y: 3000, m: 1, d: 1 });
  });
});

describe('roundtrip Date ↔ Jalali ۱۰۰۰..۳۰۰۰ (acceptance #146)', () => {
  it('every 3rd day forward-and-back is exact, deterministic PRNG sample within range', () => {
    // نمونهٔ قطعی ۳۰٬۰۰۰ نقطه از کل بازه + اسکن سیستماتیک هر ۳ روز.
    let seed = 146;
    const rnd = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 4294967296;
    };
    const first = fromJalaliParts(1000, 1, 1).getTime();
    const last = fromJalaliParts(3000, 12, 29).getTime();
    for (let t = first; t <= last; t += 3 * 86400000) {
      const d = new Date(t);
      const p = toJalaliParts(d);
      const back = fromJalaliParts(p.y, p.m, p.d);
      expect(back.getTime()).toBe(t);
    }
    for (let i = 0; i < 30000; i++) {
      // اسنپ به نیمه‌شب UTC؛ toJalaliParts از «روز» میلادی استفاده می‌کند.
      const t = Math.round((first + rnd() * (last - first)) / 86400000) * 86400000;
      const d = new Date(t);
      const p = toJalaliParts(d);
      expect(fromJalaliParts(p.y, p.m, p.d).getTime()).toBe(t);
    }
  });
});

describe('isLeap / monthDays / isValidJalali', () => {
  it('known leap years 1399 & 1403 (acceptance) and non-leap 1402/1404', () => {
    expect(isLeap(1399)).toBe(true);
    expect(isLeap(1403)).toBe(true);
    expect(isLeap(1402)).toBe(false);
    expect(isLeap(1404)).toBe(false);
    expect(isLeap(1395)).toBe(true);
  });

  it('every month length: 1-6=31, 7-11=30, 12=29/30', () => {
    for (const jy of [1399, 1400, 1403, 1404]) {
      for (let m = 1; m <= 6; m++) expect(monthDays(jy, m), `${jy}/${m}`).toBe(31);
      for (let m = 7; m <= 11; m++) expect(monthDays(jy, m), `${jy}/${m}`).toBe(30);
      expect(monthDays(jy, 12), `${jy}/12`).toBe(isLeap(jy) ? 30 : 29);
    }
  });

  it('leap-year total days = 366, common = 365', () => {
    // 1402 (غیرکبیسه) ۳۶۵ روز؛ 1403 (کبیسه) ۳۶۶ روز
    expect(diffDays(fromJalaliParts(1402, 1, 1), fromJalaliParts(1403, 1, 1))).toBe(365);
    expect(diffDays(fromJalaliParts(1403, 1, 1), fromJalaliParts(1404, 1, 1))).toBe(366);
  });

  it('isValidJalali rejects impossible dates (15/12/30 در سال غیرکبیسه)', () => {
    expect(isValidJalali(1402, 12, 29)).toBe(true);
    expect(isValidJalali(1402, 12, 30)).toBe(false);
    expect(isValidJalali(1403, 12, 30)).toBe(true);
    expect(isValidJalali(1403, 7, 31)).toBe(false);
    expect(isValidJalali(1403, 13, 1)).toBe(false);
    expect(isValidJalali(1403.5, 1, 1)).toBe(false);
  });

  it('fromJalaliParts throws ZEN-1303 for nonexistent dates', () => {
    try {
      fromJalaliParts(1402, 12, 30);
      expect.unreachable();
    } catch (e) {
      expect((e as { code?: string }).code).toBe('ZEN-1303');
    }
  });
});

describe('formatJalali (SPEC tokens)', () => {
  const d = new Date(Date.UTC(2024, 6, 15)); // 1403-04-25 — دوشنبه
  it('all tokens', () => {
    expect(formatJalali(d, 'YYYY/MM/DD', { timeZone: 'utc' })).toBe('1403/04/25');
    expect(formatJalali(d, 'YY-M-D', { timeZone: 'utc' })).toBe('03-4-25');
    expect(formatJalali(d, 'MMMM', { timeZone: 'utc' })).toBe('تیر');
    expect(formatJalali(d, 'MMM', { timeZone: 'utc' })).toBe('تیر');
    expect(formatJalali(d, 'dddd', { timeZone: 'utc' })).toBe('دوشنبه');
    expect(formatJalali(d, 'ddd', { timeZone: 'utc' })).toBe('د');
    const t = new Date(Date.UTC(2024, 6, 15, 13, 4, 9));
    expect(formatJalali(t, 'HH:mm:ss', { timeZone: 'utc' })).toBe('13:04:09');
  });
  it('digits option', () => {
    expect(formatJalali(d, 'YYYY/MM/DD', { timeZone: 'utc', digits: 'persian' })).toBe(
      '۱۴۰۳/۰۴/۲۵',
    );
    expect(formatJalali(d, 'YYYY/MM/DD', { timeZone: 'utc', digits: 'arabic' })).toBe('١٤٠٣/٠٤/٢٥');
    expect(formatJalali(d, 'YYYY/MM/DD', { timeZone: 'utc', digits: 'latin' })).toBe('1403/04/25');
  });
  it('invalid format token throws ZEN-1302', () => {
    try {
      formatJalali(d, 'YYYZ');
      expect.unreachable();
    } catch (e) {
      expect((e as { code?: string }).code).toBe('ZEN-1302');
    }
  });
});

describe('parseJalali', () => {
  it('parses canonical and persian digits with separators', () => {
    expect(parseJalali('1403/04/25')).toEqual({ y: 1403, m: 4, d: 25 });
    expect(parseJalali('۱۴۰۳-۰۴-۲۵')).toEqual({ y: 1403, m: 4, d: 25 });
    expect(parseJalali('١٤٠٣.٠٤.٢٥')).toEqual({ y: 1403, m: 4, d: 25 });
  });
  it('invalid string throws ZEN-1303; nonexistent date throws ZEN-1303', () => {
    expect(() => parseJalali('hello')).toThrowError(/ZEN-1303|تاریخ نامعتبر/);
    expect(() => parseJalali('1402/12/30')).toThrowError(/ZEN-1303|تاریخ نامعتبر/);
  });
  it('format mismatch throws ZEN-1302', () => {
    expect(() => parseJalali('1403/04/25', 'YYYY-MM-DD')).toThrowError(/ZEN-1302/);
  });
});

describe('arithmetic helpers', () => {
  it('addDays crosses months/years correctly (UTC day semantics)', () => {
    const d = new Date(Date.UTC(2024, 2, 20)); // 1403-01-01
    expect(toJalaliParts(addDays(d, -1))).toEqual({ y: 1402, m: 12, d: 29 });
    expect(toJalaliParts(addDays(d, 366))).toEqual({ y: 1404, m: 1, d: 1 });
  });
  it('addMonths clamps to month end (1403/12/30 +1m = 1404/12/29… در ماه ۳۰‌روزه clamp)', () => {
    // ماه‌های ۱..۶ همه ۳۱ روزه‌اند؛ clamp در ماه‌های ۷..۱۲ معنادار است.
    expect(addMonths({ y: 1403, m: 6, d: 31 }, 1)).toEqual({ y: 1403, m: 7, d: 30 });
    expect(addMonths({ y: 1402, m: 12, d: 29 }, 1)).toEqual({ y: 1403, m: 1, d: 29 });
    expect(addMonths({ y: 1403, m: 1, d: 15 }, -1)).toEqual({ y: 1402, m: 12, d: 15 });
  });
  it('addYears clamps Esfand 30 in non-leap target', () => {
    expect(addYears({ y: 1403, m: 12, d: 30 }, 1)).toEqual({ y: 1404, m: 12, d: 29 });
    expect(addYears({ y: 1403, m: 1, d: 1 }, -4)).toEqual({ y: 1399, m: 1, d: 1 });
  });
  it('diffDays symmetric and exact', () => {
    const a = new Date(Date.UTC(2024, 0, 1));
    const b = new Date(Date.UTC(2024, 0, 31));
    expect(diffDays(a, b)).toBe(30);
    expect(diffDays(b, a)).toBe(-30);
  });
});

describe('compareJalali / names / now', () => {
  it('compareJalali ordering', () => {
    expect(compareJalali({ y: 1402, m: 12, d: 30 }, { y: 1403, m: 1, d: 1 })).toBeLessThan(0);
    expect(compareJalali({ y: 1403, m: 1, d: 2 }, { y: 1403, m: 1, d: 1 })).toBeGreaterThan(0);
    expect(compareJalali({ y: 1403, m: 1, d: 1 }, { y: 1403, m: 1, d: 1 })).toBe(0);
  });
  it('monthName/weekdayName full and short, fa/en locale', () => {
    expect(monthName(1)).toBe('فروردین');
    expect(monthName(12)).toBe('اسفند');
    expect(monthName(1, { locale: 'en' })).toBe('Farvardin');
    expect(weekdayName(0)).toBe('شنبه');
    expect(weekdayName(6)).toBe('جمعه');
    expect(weekdayName(0, { style: 'short' })).toBe('ش');
    expect(weekdayName(3)).toBe('سه‌شنبه');
    expect(weekdayName(4)).toBe('چهارشنبه');
  });
  it('jalaliNow is deterministic with injected clock', () => {
    expect(jalaliNow({ clock: () => new Date(Date.UTC(2024, 2, 20)), timeZone: 'utc' })).toEqual({
      y: 1403,
      m: 1,
      d: 1,
    });
  });
});

describe('digit converters', () => {
  it('persian/arabic/latin', () => {
    expect(toPersianDigits('abc123')).toBe('abc۱۲۳');
    expect(toArabicDigits(456)).toBe('٤٥٦');
    expect(toLatinDigits('۱۴۰۳/٠٤/25')).toBe('1403/04/25');
  });
});

describe('useIntl agreement (acceptance: ≥۱۰۰٬۰۰۰ تاریخ تصادفی)', () => {
  it('Borkowski core equals Intl persian calendar over 120000 deterministic samples in 1201..1500', () => {
    // مقایسه فقط در بازه‌ای که Intl (Borkowski 33-year arithmetic cycle) و الگوریتم
    // مشترک‌الاصول‌اند؛ خارج از آن Intl از Astronomical استفاده می‌کند (DEC ثبت‌شده).
    if (typeof Intl === 'undefined' || !Intl.DateTimeFormat) return;
    let ok = false;
    try {
      const probe = new Intl.DateTimeFormat('en-u-ca-persian', { timeZone: 'UTC' });
      ok = probe.resolvedOptions().calendar === 'persian';
    } catch {
      ok = false;
    }
    if (!ok) return; // Node بدون full-icu: از Intl رد می‌شویم (الگوریتم خالص مرجع است)
    const fmt = new Intl.DateTimeFormat('en-u-ca-persian', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    let seed = 1461;
    const rnd = () => {
      seed ^= seed << 13;
      seed ^= seed >>> 17;
      seed ^= seed << 5;
      return (seed >>> 0) / 4294967296;
    };
    const lo = fromJalaliParts(1201, 1, 1).getTime();
    const hi = fromJalaliParts(1500, 12, 29).getTime();
    for (let i = 0; i < 120000; i++) {
      const t = Math.round(lo + rnd() * (hi - lo));
      const d = new Date(t);
      const parts = fmt.formatToParts(d).reduce<Record<string, string>>((acc, x) => {
        acc[x.type] = x.value;
        return acc;
      }, {});
      const p = toJalaliParts(d);
      expect(p.y).toBe(Number(parts.year));
      expect(p.m).toBe(Number(parts.month));
      expect(p.d).toBe(Number(parts.day));
    }
  });
});
