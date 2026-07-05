// @zenith/i18n — Persian/RTL helpers (Phase 5) + v1.0.1 enhancements.

/** تبدیل اعداد انگلیسی به فارسی. */
export function toPersianNums(n: number | string): string {
  return String(n).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'.charAt(+d));
}

/** تبدیل اعداد انگلیسی به عربی. */
export function toArabicNums(n: number | string): string {
  return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'.charAt(+d));
}

/**
 * تبدیل تاریخ میلادی به شمسی (تقویم جلالی).
 *
 * BUG-07 (v1.0.1): warning برای تاریخ‌های قبل از ۱۶۰۰ و validation خروجی.
 */
export function toJalali(date: Date | string): string {
  // FIX (v1.2.9): BUG-04 — Always copy Date to prevent mutating caller's input
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  if (isNaN(d.getTime())) return '';

  // BUG-07: guard برای تاریخ‌های قبل از ۱۶۰۰
  // FIX (BUG-I18N-01): guard برای تاریخ‌های قبل از ۶۲۲ میلادی.
  if (d.getFullYear() < 622) return '';
  if (d.getFullYear() < 1600) {
    console.warn('[Zenith i18n] toJalali: dates before 1600 CE may be inaccurate');
  }

  const gy = d.getFullYear();
  const gm = d.getMonth() + 1;
  const gd = d.getDate();

  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number;
  let gyMut = gy;
  if (gyMut <= 1600) {
    jy = 0; gyMut -= 621;
  } else {
    jy = 979; gyMut -= 1600;
  }
  const gy2 = (gm > 2) ? (gyMut + 1) : gyMut;
  let days = (365 * gyMut) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1]!;
  jy += 33 * Math.floor(days / 12053); days %= 12053;
  jy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365); days = (days - 1) % 365;
  }
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));

  // BUG-07: validation خروجی
  if (jy < 1 || jm < 1 || jm > 12 || jd < 1 || jd > 31) {
    console.warn(`[Zenith i18n] toJalali: invalid result for ${d.toISOString()}`);
    return '';
  }

  return `${toPersianNums(jy)}/${toPersianNums(jm.toString().padStart(2, '0'))}/${toPersianNums(jd.toString().padStart(2, '0'))}`;
}

/** تاریخ و زمان فعلی به شمسی. */
export function jalaliNow(): string {
  return toJalali(new Date());
}

/** فرمت‌بندی عدد با جداکننده هزارگان (فارسی). */
export function formatNumber(n: number): string {
  return toPersianNums(n.toLocaleString('en-US').replace(/,/g, '٬'));
}

/** فرمت‌بندی قیمت به تومان. */
export function formatPrice(n: number): string {
  return formatNumber(n) + ' تومان';
}

/** RTL direction helper. */
// FIX (BUG-I18N-04): پارامتر اختیاری text برای تشخیص کاراکترهای RTL.
export function isRTL(text?: string): boolean {
  // FIX (v1.2.3): تشخیص RTL بسیار محدود بود. قبلاً فقط `document.dir === 'rtl'`
  // چک می‌شد که در صفحه‌هایی با <html lang="fa"> اما بدون dir صریح، false برمی‌گشت.
  // حالا سه منبع چک می‌شوند:
  //   1) document.dir === 'rtl'
  //   2) document.documentElement.dir === 'rtl' (برای <html dir="rtl">)
  //   3) lang attribute یکی از زبان‌های RTL (fa, ar, he, ur)
  if (typeof document === 'undefined') return false;
  if (document.dir === 'rtl') return true;
  if (typeof document.documentElement !== 'undefined'
      && document.documentElement.dir === 'rtl') return true;
  if (typeof document.documentElement !== 'undefined') {
    const lang = document.documentElement.lang?.split('-')[0] || '';
    if (['fa', 'ar', 'he', 'ur'].includes(lang)) return true;
  }

  // FIX (BUG-I18N-04): تشخیص کاراکترهای RTL در متن.
  if (text) {
    const rtlChars = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
    if (rtlChars.test(text)) return true;
  }

  return false;
}

// ── IMPROVEMENT-02 (v1.0.1): API کامل تقویم جلالی ──

const JALALI_MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

/** استخراج بخش‌های تاریخ جلالی (سال، ماه، روز) از یک Date میلادی. */
// FIX (v1.2.3): return type به [number, number, number] | null تغییر کرد.
// قبلاً در صورت ورودی نامعتبر، [0, 0, 0] برمی‌گشت که برای consumerها معنای
// نامشخص داشت (۰/۰/۰ یک تاریخ معتبر در تقویم جلالی نیست). حالا null برمی‌گشتد
// تا consumerها بتوانند با `if (!parts) return;` به‌درستی آن را handle کنند.
export function parseJalaliParts(date: Date | string): [number, number, number] | null {
  // FIX (v1.2.9): BUG-04 — Always copy Date to prevent mutating caller's input
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  if (isNaN(d.getTime())) return null;

  const gy = d.getFullYear();
  const gm = d.getMonth() + 1;
  const gd = d.getDate();

  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  let jy: number;
  let gyMut = gy;
  if (gyMut <= 1600) { jy = 0; gyMut -= 621; }
  else { jy = 979; gyMut -= 1600; }
  const gy2 = (gm > 2) ? (gyMut + 1) : gyMut;
  let days = (365 * gyMut) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1]!;
  jy += 33 * Math.floor(days / 12053); days %= 12053;
  jy += 4 * Math.floor(days / 1461); days %= 1461;
  if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
  const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
  const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
  return [jy, jm, jd];
}

/** تبدیل جلالی به میلادی. */
export function fromJalali(jy: number, jm: number, jd: number): Date {
  jy += 1595;
  let days = -355779 + 365 * jy + Math.floor((jy + 3) / 4) - Math.floor((jy + 99) / 100)
    + Math.floor((jy + 199) / 400);
  jy -= 1595;
  if (jm <= 6) days += (jm - 1) * 31;
  else days += (jm - 7) * 30 + 186;
  days += jd;
  const ms = (days - 2440588) * 86400000;
  return new Date(ms);
}

/** مقایسه دو تاریخ جلالی. */
export function compareJalali(
  a: { y: number; m: number; d: number },
  b: { y: number; m: number; d: number },
): number {
  if (a.y !== b.y) return a.y - b.y;
  if (a.m !== b.m) return a.m - b.m;
  return a.d - b.d;
}

/** جمع روز به تاریخ (در میلادی کار می‌کند ولی خروجی برای جلالی مناسب است). */
// FIX (BUG-I18N-03): ورودی null/undefined مجاز است و در آن صورت null برمی‌گرداند.
export function addDaysJalali(date: Date | string | null | undefined, days: number): Date | null {
  // FIX (v1.2.3): در branch غیر-string، قبلاً `new Date(date)` صدا زده می‌شد که
  // یک کپی می‌ساخت ولی در عوض clone اصلی را mutate نمی‌کرد — یعنی caller می‌توانست
  // یک Date پاس بدهد و انتظار داشته باشد همان Date تغییر نکند. اما در عمل،
  // `new Date(date)` روی Date object یک کپی می‌ساخت (که OK بود) ولی روی عدد یا
  // رشته (که به‌عنوان string شناخته می‌شد) رفتار متفاوتی داشت. حالا فقط در صورت
  // string یک Date جدید می‌سازیم؛ در غیر این صورت همان Date ورودی را mutate
  // می‌کنیم (با فرض اینکه caller می‌خواهد همان را تغییر بدهیم).
  // FIX (BUG-I18N-03): guard برای ورودی null/undefined
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    console.error('[Zenith i18n] addDaysJalali: invalid date input');
    return null;
  }
  // FIX (v1.2.9): BUG-04 — Always copy Date to prevent mutating caller's input
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/** آیا سال جلالی کبیسه است؟ */
export function isJalaliLeap(jy: number): boolean {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  let jp = breaks[0]!;
  let jump = 0;
  for (let i = 1; i < breaks.length; i++) {
    const jm = breaks[i]!;
    jump = jm - jp;
    if (jy < jm) break;
    jp = jm;
  }
  let n = jy - jp;
  if (n < jump) {
    if (jump - n < 6) n = n - jump + Math.floor((jump + 4) / 33) * 33;
    let leap = ((n + 1) % 33 - 1) % 4;
    if (leap === -1) leap = 4;
    return leap === 0;
  }
  return false;
}

/** تعداد روزهای ماه جلالی. */
export function jalaliMonthDays(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeap(jy) ? 30 : 29;
}

/** فرمت قابل تنظیم تاریخ جلالی. */
export function formatJalali(date: Date | string, fmt: string = 'YYYY/MM/DD'): string {
  // FIX (v1.2.9): BUG-04 — Always copy Date to prevent mutating caller's input
  const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
  if (isNaN(d.getTime())) return '';
  const [jy, jm, jd] = parseJalaliParts(d) ?? [0, 0, 0];
  if (jy < 1) return '';

  // BUG-5 FIX (v1.2.2): ترتیب replace اصلاح شد. قبلاً MM قبل از MMMM
  // جایگزین می‌شد، در نتیجه MMMM با قرارگیری MM در آن خراب می‌گشت (مثلاً
  // 'فروردین' بعد از replace اول به 'فروردین' می‌شد، سپس replace دوم به‌جای
  // MM، بخشی از نام ماه را پیدا نمی‌کرد — اما بدتر از آن، در فرمت‌های
  // ترکیبی مثل 'MMMM YYYY'، توکن MM داخل MMMM با عدد ماه جایگزین می‌شد
  // و نام ماه خراب می‌گشت). راه‌حل: MMMM اول جایگزین شود، سپس YYYY، MM،
  // DD، و در نهایت YY.
  return fmt
    // FIX (BUG-I18N-02): word boundary regex برای جلوگیری از جایگزینی نادرست.
    .replace(/\bYYYY\b/g, toPersianNums(jy))
    .replace(/\bMMMM\b/g, JALALI_MONTH_NAMES[jm - 1] || '')
    .replace(/\bMM\b/g, toPersianNums(String(jm).padStart(2, '0')))
    .replace(/\bDD\b/g, toPersianNums(String(jd).padStart(2, '0')))
    .replace(/\bYY\b/g, toPersianNums(String(jy).slice(-2)));
}

/** نام ماه جلالی. */
export function jalaliMonthName(jm: number): string {
  return JALALI_MONTH_NAMES[jm - 1] || '';
}
