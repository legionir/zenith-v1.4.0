import { monthDays, formatJalali } from '@zenith/jalali';

export function days(jy: number, jm: number): number {
  return monthDays(jy, jm);
}

export function label(d: Date): string {
  return formatJalali(d);
}
