import { jalaliMonthDays, formatJalali } from '@zenith/i18n';

export function days(jy: number, jm: number): number {
  return jalaliMonthDays(jy, jm);
}

export function label(d: Date): string {
  return formatJalali(d);
}
