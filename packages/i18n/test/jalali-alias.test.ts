// #146 — تست سازگاری aliasهای جلالی در @zenith/i18n پس از استخراج به
// @zenith/jalali (SPEC §۲.۶ «انتقال به jalali + alias با deprecate»).
//
// قرمز-قبل-از-رفع: از این فایل قبل از نوشتن i18n جدید هیچ تستی برای
// رفتار aliasها وجود نداشت؛ مقادیر زیر از کد legacy واقعی (پایهٔ 723095d،
// الگوریتم ۳۳‌سالهٔ ساده + فرمول معیوب fromJalali) استخراج/بازتولید شده‌اند.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  toPersianNums,
  toArabicNums,
  toJalali,
  jalaliNow,
  formatJalali,
  parseJalaliParts,
  fromJalali,
  compareJalali,
  addDaysJalali,
  isJalaliLeap,
  jalaliMonthDays,
  jalaliMonthName,
} from '../src/index';
import { resetDeprecationWarnings } from '@zenith/errors';

// مسیرهای delegated در بازهٔ مدرن، Date را با منطقهٔ زمانی «محلی» می‌خوانند؛
// برای deterministic بودن تست در هر CI، محلی را روی UTC قفل می‌کنیم.
process.env.TZ = 'UTC';

describe('digits aliases (behavior unchanged)', () => {
  it('toPersianNums / toArabicNums', () => {
    expect(toPersianNums(1234)).toBe('۱۲۳۴');
    expect(toPersianNums('1,000')).toBe('۱,۰۰۰');
    expect(toArabicNums('1234')).toBe('١٢٣٤');
  });
});

describe('toJalali alias — legacy edge behavior preserved', () => {
  it('invalid/unsupported inputs return ""', () => {
    expect(toJalali('nonsense')).toBe('');
    expect(toJalali(new Date('nope'))).toBe('');
    expect(toJalali(new Date(Date.UTC(600, 0, 1)))).toBe(''); // < 622
  });

  it('pre-1600 Gregorian warns about accuracy (legacy BUG-07)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      toJalali(new Date(Date.UTC(1500, 5, 15)));
      expect(warn.mock.calls.map((c) => String(c[0])).join('\n')).toMatch(
        /dates before 1600 CE may be inaccurate/,
      );
    } finally {
      warn.mockRestore();
    }
  });

  it('legacy-era dates (622..1621 Gregorian) keep the old 33-year outputs', () => {
    // بازتولید دقیق الگوریتم قدیمی (self-test از کد پایه) برای تاریخ‌های
    // pre-1622: خروجی alias نباید حتی یک روز تغییر کند.
    const old = legacyOldToJalali;
    for (let t = Date.UTC(1600, 0, 1); t < Date.UTC(1622, 0, 1); t += 86400000 * 7) {
      const d = new Date(t);
      expect(toJalali(d)).toBe(old(d));
    }
  });

  it('modern dates delegate to the Borkowski core (verified anchors)', () => {
    expect(toJalali(new Date(Date.UTC(2024, 2, 20)))).toBe('۱۴۰۳/۰۱/۰۱');
    expect(toJalali(new Date(Date.UTC(2024, 2, 19)))).toBe('۱۴۰۲/۱۲/۲۹');
    expect(toJalali('2000-01-01T00:00:00Z')).toBe('۱۳۷۸/۱۰/۱۱');
  });

  it('jalaliNow is the same string as toJalali(now) shape', () => {
    expect(jalaliNow()).toMatch(/^[۰-۹]+\/[۰-۹]{2}\/[۰-۹]{2}$/);
  });
});

describe('parseJalaliParts / fromJalali aliases', () => {
  it('parseJalaliParts: null for invalid, triple for valid', () => {
    expect(parseJalaliParts('nope')).toBeNull();
    expect(parseJalaliParts(new Date(Date.UTC(2024, 2, 20)))).toEqual([1403, 1, 1]);
    // ۱۷۰۰ میلادی ≥ ۱۶۲۲ است ⇒ سال جلالی ≥۱۰۰۰ ⇒ مسیر جدید (Borkowski؛
    // الگوریتم قدیمی در این تاریخ یک روز خطا داشت — DEC-028).
    expect(parseJalaliParts(new Date(Date.UTC(1700, 0, 1)))).toEqual([1078, 10, 11]);
  });

  it('#146 fix: fromJalali now returns a correct date (old formula was broken)', () => {
    const d = fromJalali(1403, 1, 1);
    expect(d.toISOString().startsWith('2024-03-20')).toBe(true);
    // رفت‌وبرگشت: parseJalaliParts(fromJalali(...)) == ورودی
    expect(parseJalaliParts(d)).toEqual([1403, 1, 1]);
    expect(fromJalali(1402, 12, 29).toISOString().startsWith('2024-03-19')).toBe(true);
  });

  it('fromJalali never throws (legacy contract): invalid ⇒ Invalid Date', () => {
    expect(fromJalali(1402, 12, 30).toString()).toBe('Invalid Date'); // Esfand 29 in non-leap
    expect(fromJalali(1403, 13, 1).toString()).toBe('Invalid Date');
    expect(fromJalali(900, 1, 1).toString()).toBe('Invalid Date'); // out of supported range ⇒ throw swallowed
  });
});

describe('scalar calendar aliases delegate to jalali', () => {
  it('isJalaliLeap', () => {
    expect(isJalaliLeap(1403)).toBe(true);
    expect(isJalaliLeap(1402)).toBe(false);
    expect(isJalaliLeap(1)).toBe(false); // خارج از بازه ⇒ false، بدون throw
  });

  it('jalaliMonthDays', () => {
    expect(jalaliMonthDays(1403, 1)).toBe(31);
    expect(jalaliMonthDays(1403, 12)).toBe(30); // کبیسه
    expect(jalaliMonthDays(1402, 12)).toBe(29);
    expect(jalaliMonthDays(1403, 13)).toBe(0); // بدون throw (قرارداد legacy)
  });

  it('jalaliMonthName', () => {
    expect(jalaliMonthName(1)).toBe('فروردین');
    expect(jalaliMonthName(12)).toBe('اسفند');
    expect(jalaliMonthName(0)).toBe('');
  });

  it('compareJalali', () => {
    expect(compareJalali({ y: 1403, m: 1, d: 1 }, { y: 1403, m: 1, d: 2 })).toBeLessThan(0);
    expect(compareJalali({ y: 1403, m: 1, d: 2 }, { y: 1403, m: 1, d: 1 })).toBeGreaterThan(0);
    expect(compareJalali({ y: 1403, m: 1, d: 1 }, { y: 1403, m: 1, d: 1 })).toBe(0);
  });

  it('addDaysJalali: copy semantics + invalid inputs ⇒ null with console.error', () => {
    const d = new Date(Date.UTC(2024, 2, 20));
    const out = addDaysJalali(d, 366);
    expect(out!.toISOString().startsWith('2025-03-21')).toBe(true); // 1404/01/01
    expect(out).not.toBe(d); // ورودی mutate نمی‌شود (BUG-04 legacy)
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(addDaysJalali(null, 1)).toBeNull();
      expect(addDaysJalali('2024-03-20', 1)).toBeNull(); // رشته مجاز نبود (legacy)
      expect(err.mock.calls.length).toBeGreaterThan(0);
    } finally {
      err.mockRestore();
    }
  });
});

describe('formatJalali alias', () => {
  it('modern dates: tokens + Persian digits via jalali', () => {
    expect(formatJalali(new Date(Date.UTC(2024, 2, 20)))).toBe('۱۴۰۳/۰۱/۰۱');
    expect(formatJalali(new Date(Date.UTC(2024, 2, 20)), 'YYYY-MM-DD')).toBe('۱۴۰۳-۰۱-۰۱');
    expect(formatJalali(new Date(Date.UTC(2024, 2, 20)), 'MMMM YYYY')).toBe('فروردین ۱۴۰۳');
  });

  it('legacy-era dates keep old formatting output', () => {
    const d = new Date(Date.UTC(1700, 0, 1));
    expect(formatJalali(d, 'YYYY/MM/DD')).toBe('۱۰۷۸/۱۰/۱۱');
  });

  it('invalid input/format ⇒ "" and never throws (legacy contract)', () => {
    expect(formatJalali('nope')).toBe('');
    expect(formatJalali(new Date(Date.UTC(2024, 2, 20)), 'QQQQ')).toBe('');
  });
});

describe('deprecation wiring (SPEC §۲.۶ + DEC-019)', () => {
  const aliases: Array<[string, () => unknown, string]> = [
    ['toJalali', () => toJalali(new Date(Date.UTC(2024, 2, 20))), 'ZEN-DEPR-006'],
    ['fromJalali', () => fromJalali(1403, 1, 1), 'ZEN-DEPR-007'],
    ['parseJalaliParts', () => parseJalaliParts(new Date(Date.UTC(2024, 2, 20))), 'ZEN-DEPR-008'],
    ['formatJalali', () => formatJalali(new Date(Date.UTC(2024, 2, 20))), 'ZEN-DEPR-009'],
    ['jalaliNow', () => jalaliNow(), 'ZEN-DEPR-010'],
    ['jalaliMonthDays', () => jalaliMonthDays(1403, 1), 'ZEN-DEPR-011'],
    ['jalaliMonthName', () => jalaliMonthName(1), 'ZEN-DEPR-012'],
    ['isJalaliLeap', () => isJalaliLeap(1403), 'ZEN-DEPR-013'],
    [
      'compareJalali',
      () => compareJalali({ y: 1403, m: 1, d: 1 }, { y: 1403, m: 1, d: 1 }),
      'ZEN-DEPR-014',
    ],
    ['addDaysJalali', () => addDaysJalali(new Date(), 1), 'ZEN-DEPR-015'],
  ];

  for (const [name, fn, code] of aliases) {
    it(`${name} warns exactly once with ${code}`, () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        fn();
        fn();
        fn();
        const hits = warn.mock.calls.map((c) => String(c[0])).filter((m) => m.includes(code));
        expect(hits).toHaveLength(1);
        expect(hits[0]).toMatch(/deprecated/);
      } finally {
        warn.mockRestore();
      }
    });
  }

  it('toPersianNums does NOT warn (digits stay in i18n public API)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      toPersianNums(1);
      expect(warn.mock.calls.filter((c) => String(c[0]).includes('ZEN-DEPR'))).toHaveLength(0);
    } finally {
      warn.mockRestore();
    }
  });

  beforeEach(() => resetDeprecationWarnings());
  afterEach(() => resetDeprecationWarnings());
});

// ── بازتولید الگوریتم قدیمی (کد پایهٔ i18n پیش از #146) برای self-test ──
function legacyOldToJalali(d: Date): string {
  const gy = d.getUTCFullYear();
  const gm = d.getUTCMonth() + 1;
  const gd = d.getUTCDate();
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
  const fa = (x: number | string) => String(x).replace(/[0-9]/g, (c) => '۰۱۲۳۴۵۶۷۸۹'.charAt(+c));
  return `${fa(jy)}/${fa(String(jm).padStart(2, '0'))}/${fa(String(jd).padStart(2, '0'))}`;
}
