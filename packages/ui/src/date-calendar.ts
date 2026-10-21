import { fromJalaliParts, toJalaliParts, isValidJalali, monthDays, toLatinDigits } from '@zenith/jalali';
export type Calendar = 'jalali' | 'gregorian';
export interface CalendarDate { y: number; m: number; d: number; }
export function utcDate(y: number, m: number, d: number): Date {
  const date = new Date(0); date.setUTCFullYear(y, m - 1, d); date.setUTCHours(0, 0, 0, 0); return date;
}
export function calendarValid(calendar: Calendar, date: CalendarDate): boolean {
  if (![date.y, date.m, date.d].every(Number.isInteger)) return false;
  if (calendar === 'jalali') return isValidJalali(date.y, date.m, date.d);
  if (date.y < 1 || date.y > 9999 || date.m < 1 || date.m > 12 || date.d < 1 || date.d > 31) return false;
  const value = utcDate(date.y, date.m, date.d); return value.getUTCFullYear() === date.y && value.getUTCMonth() + 1 === date.m && value.getUTCDate() === date.d;
}
export function calendarUTC(calendar: Calendar, date: CalendarDate): Date { return calendar === 'jalali' ? fromJalaliParts(date.y, date.m, date.d) : utcDate(date.y, date.m, date.d); }
export function calendarParts(calendar: Calendar, value: Date): CalendarDate | null {
  try {
    const result = calendar === 'jalali' ? toJalaliParts(value, { timeZone: 'UTC' }) : { y: value.getUTCFullYear(), m: value.getUTCMonth() + 1, d: value.getUTCDate() };
    return calendarValid(calendar, result) ? result : null;
  } catch { return null; }
}
export function calendarDays(calendar: Calendar, y: number, m: number): number { return calendar === 'jalali' ? monthDays(y, m) : utcDate(y, m + 1, 0).getUTCDate(); }
export function dateOrder(value: CalendarDate): number { return value.y * 10000 + value.m * 100 + value.d; }
export function validDateFormat(format: string): boolean {
  const match = format.match(/^(YYYY|MM|DD)([-/.])(YYYY|MM|DD)\2(YYYY|MM|DD)$/);
  return !!match && new Set([match[1], match[3], match[4]]).size === 3;
}
// Pure, bounded locale data only: never retain a Document/request/controller.
const digitMaps = new Map<string, ReadonlyMap<string, string>>();
function normalizeDigits(value: string, locale?: string): string {
  let ascii = toLatinDigits(value.trim()).replace(/[\u200e\u200f\u061c]/g, '');
  if (!locale) return ascii;
  let digits = digitMaps.get(locale);
  if (!digits) {
    const number = new Intl.NumberFormat(locale, { useGrouping: false });
    digits = new Map<string, string>(Array.from({ length: 10 }, (_, n): [string, string] => [number.format(n), String(n)]));
    if (digitMaps.size >= 32) digitMaps.delete(digitMaps.keys().next().value!);
    digitMaps.set(locale, digits);
  }
  const lookup = digits;
  ascii = Array.from(ascii, digit => lookup.get(digit) ?? digit).join('');
  return ascii;
}
export function parseCalendarDate(value: string, calendar: Calendar, format = 'YYYY/MM/DD', locale?: string): CalendarDate | null {
  if (value.length > 64) return null;
  let ascii: string; try { ascii = normalizeDigits(value, locale); } catch { return null; }
  const parse = (pattern: string): CalendarDate | null => {
    if (!validDateFormat(pattern)) return null;
    const tokens = pattern.match(/YYYY|MM|DD/g)!;
    const expression = pattern.replace(/[/.]/g, '\\$&').replace(/YYYY|MM|DD/g, token => token === 'YYYY' ? '(\\d{1,4})' : '(\\d{1,2})');
    const match = ascii.match(new RegExp(`^${expression}$`)); if (!match) return null;
    const numbers = Object.fromEntries(tokens.map((token, index) => [token, Number(match[index + 1])]));
    const result = { y: numbers.YYYY!, m: numbers.MM!, d: numbers.DD! }; return calendarValid(calendar, result) ? result : null;
  };
  return parse(format) ?? (calendar === 'gregorian' ? parse('YYYY-MM-DD') : null);
}
export function formatCalendarDate(value: CalendarDate, format: string, locale: string): string {
  const number = (n: number, digits: number) => new Intl.NumberFormat(locale, { useGrouping: false, minimumIntegerDigits: digits }).format(n);
  return format.replace(/YYYY|MM|DD/g, token => token === 'YYYY' ? number(value.y, 4) : token === 'MM' ? number(value.m, 2) : number(value.d, 2));
}
