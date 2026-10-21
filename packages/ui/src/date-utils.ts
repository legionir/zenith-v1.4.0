import { toPersianDigits, toLatinDigits, toJalaliParts, isValidJalali } from '@zenith/jalali';
export function pad2(n: number): string {
  return toPersianDigits(String(n).padStart(2, '0'));
}

export function parseJalaliToday(): { y: number; m: number; d: number } {
  // #146: محلی‌خوانی از @zenith/jalali — picker «امروز» کاربر را نشان می‌دهد.
  // مسیر throw (ورودی نامعتبر/خارج از بازه) همان branch قبلی را می‌دهد:
  // {y:0,m:0,d:0} تا تابع همیشه total بماند و throw نکند.
  try {
    const p = toJalaliParts(new Date(), { timeZone: 'local' });
    return { y: p.y, m: p.m, d: p.d };
  } catch {
    return { y: 1400, m: 1, d: 1 };
  }
}

export function parseJalaliString(s: string): { y: number; m: number; d: number } | null {
  // Convert Persian/Arabic digits to ASCII before parsing.
  const ascii = toLatinDigits(s);
  const m = ascii.match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const y = parseInt(m[1]!, 10);
  const mo = parseInt(m[2]!, 10);
  const d = parseInt(m[3]!, 10);
  // #146: اعتبار کامل تقویمی (روزهای ماه + کبیسه) از jalali؛ کد قدیمی تنها
  // «۳۱ روز» را چک می‌کرد و ۱۴۰۲/۱۲/۳۰ (ناموجود) را می‌پذیرفت.
  if (!isValidJalali(y, mo, d)) return null;
  return { y, m: mo, d };
}
