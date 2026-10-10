// #146 — هستهٔ الگوریتم جلالی (Borkowski 33-year arithmetic cycle).
//
// مرجع الگوریتم: The Calendar Committee / Borkowski (jalaali-js) — همان الگوریتمی
// که ICU (Intl تقویم persian) برای بازهٔ ۱۲۰۱..۱۵۰۰ استفاده می‌کند؛ تست
// `jalali.test.ts` ۱۲۰٬۰۰۰ تاریخ تصادفی را مستقیماً با `Intl.DateTimeFormat
// (u-ca-persian)` مقایسه می‌کند (معیار پذیرش #146). خارج از آن بازه Intl از
// چرخهٔ astronomical استفاده می‌کند و الگوریتم حسابی مرجع قطعی خود ماست
// (DEC-028).
//
// قوانین لایه: فقط errors + shared (گیت layering.test.ts). بدون timer، بدون
// window/document، خالص و deterministic (ورود Date/عدد، خروجی Date/ساختار).

import { createReservedError } from '@zenith/errors';

/** تقسیم صحیح (truncate) — قرارداد jalaali-js با `~~`. */
export const idiv = (a: number, b: number): number => ~~(a / b);
/** پیمانهٔ هم‌علامت با مقسوم‌علیه (floor-mod) — قرارداد jalaali-js. */
export const imod = (a: number, b: number): number => a - ~~(a / b) * b;

/** سال‌های شروع چرخهٔ ۳۳‌سالهٔ کبیسه‌گذاری (Borkowski). */
export const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
  2456, 3178,
] as const;

/** بیشینهٔ سال جلالی که جدول BREAKS پوشش می‌دهد. */
export const ALGO_MAX_YEAR = 3177;

function leapFromCycle(jump: number, n: number): number {
  let adj = n;
  if (jump - n < 6) adj = n - jump + idiv(jump + 4, 33) * 33;
  let leap = imod(imod(adj + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return leap;
}

interface JalCalResult {
  /** کد وضعیت کبیسه: ۰ یعنی کبیسه. */
  leap: number;
  /** سال میلادی متناظر با ابتدای چرخه. */
  gy: number;
  /** روز مارس (میلادی) که فروردین ۱ در آن می‌افتد. */
  march: number;
}

/** سال جلالی باید در بازهٔ جدول باشد؛ وگرنه الگوریتم تعریف‌شده نیست. */
function assertAlgoRange(jy: number): void {
  if (!Number.isFinite(jy) || jy < BREAKS[0]! || jy > ALGO_MAX_YEAR) {
    throw createReservedError('ZEN-1301', {
      details: { jy, supported: [BREAKS[0], ALGO_MAX_YEAR] },
    });
  }
}

/** چرخه + نقطهٔ بهاری سال جلالی `jy`. */
export function jalCal(jy: number): JalCalResult {
  assertAlgoRange(jy);
  const gy = jy + 621;
  let leapJ = -14;
  let jp: number = BREAKS[0]!;
  let jump = 0;
  for (let i = 1; i < BREAKS.length; i++) {
    const jm = BREAKS[i]!;
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + idiv(jump, 33) * 8 + idiv(imod(jump, 33), 4);
    jp = jm;
  }
  const n = jy - jp;
  leapJ = leapJ + idiv(n, 33) * 8 + idiv(imod(n, 33) + 3, 4);
  if (imod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = idiv(gy, 4) - idiv((idiv(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  return { leap: leapFromCycle(jump, n), gy, march };
}

/** Julian Day Number از تاریخ میلادی (registry روز؛ قرارداد jalaali-js). */
export function g2d(gy: number, gm: number, gd: number): number {
  let d =
    idiv((gy + idiv(gm - 8, 6) + 100100) * 1461, 4) +
    idiv(153 * imod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - idiv(idiv(gy + 100100 + idiv(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

/** وارونهٔ g2d. */
export function d2g(jdn: number): { gy: number; gm: number; gd: number } {
  let j = 4 * jdn + 139361631;
  j = j + idiv(idiv(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = idiv(imod(j, 1461), 4) * 5 + 308;
  const gm = imod(idiv(i, 153), 12) + 1;
  return {
    gy: idiv(j, 1461) - 100100 + idiv(8 - gm, 6),
    gm,
    gd: idiv(imod(i, 153), 5) + 1,
  };
}

/** JDN از تاریخ جلالی. */
export function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - idiv(jm, 7) * (jm - 7) + jd - 1;
}

/** JDN → جلالی (کلamp سال برای لبهٔ پایینی جدول). */
export function d2j(jdn: number): { y: number; m: number; d: number } {
  const gy = d2g(jdn).gy;
  let jy = Math.min(gy - 621, ALGO_MAX_YEAR);
  const r = jalCal(jy);
  const jdn1f = g2d(r.gy, 3, r.march);
  let k = jdn - jdn1f;
  if (k >= 0) {
    if (k <= 185) return { y: jy, m: 1 + idiv(k, 31), d: imod(k, 31) + 1 };
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { y: jy, m: 7 + idiv(k, 30), d: imod(k, 30) + 1 };
}

/** JDN یک Date (با فیلدهای داده‌شدهٔ میلادی) بدون فرض منطقهٔ زمانی. */
export function dateToJdn(gy: number, gm: number, gd: number): number {
  return g2d(gy, gm, gd);
}

/** JDN → Date در نیمه‌شب UTC (سازگار با رفتار legacy از i18n). */
export function jdnToUtcDate(jdn: number): Date {
  return new Date((jdn - 2440588) * 86400000);
}
