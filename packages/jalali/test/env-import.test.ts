// #146 — import در Node خالص (SSR): بدون window/document، خروجی deterministic.
import { describe, it, expect } from 'vitest';

describe('@zenith/jalali imports cleanly in Node (no DOM)', () => {
  it('barrel exports the full SPEC §۲.۶ surface', async () => {
    const mod = await import('../src/index');
    for (const name of [
      'toJalaliParts',
      'fromJalaliParts',
      'formatJalali',
      'parseJalali',
      'addDays',
      'addMonths',
      'addYears',
      'diffDays',
      'isLeap',
      'monthDays',
      'monthName',
      'weekdayName',
      'compareJalali',
      'jalaliNow',
      'isValidJalali',
      'toPersianDigits',
      'toArabicDigits',
      'toLatinDigits',
      'DEFAULTS',
    ]) {
      expect(mod as Record<string, unknown>, name).toHaveProperty(name);
    }
  });

  it('usable without window/document at all (SSR parity)', async () => {
    const { toJalaliParts, formatJalali } = await import('../src/index');
    expect(toJalaliParts(new Date(Date.UTC(2024, 2, 20)))).toEqual({ y: 1403, m: 1, d: 1 });
    expect(formatJalali('2024-03-20T00:00:00Z', 'YYYY/MM/DD')).toBe('1403/01/01');
  });

  it('DEFAULTS is deep-frozen (SPEC §۰.۲)', async () => {
    const { DEFAULTS } = await import('../src/index');
    expect(Object.isFrozen(DEFAULTS)).toBe(true);
    expect(Object.isFrozen(DEFAULTS.range)).toBe(true);
  });
});
