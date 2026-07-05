// @zenith/i18n — Persian/RTL helpers (Phase 5) + v1.0.1 enhancements.
export function toPersianNums(n) {
    return String(n).replace(/[0-9]/g, d => '۰۱۲۳۴۵۶۷۸۹'.charAt(+d));
}
export function toArabicNums(n) {
    return String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'.charAt(+d));
}
export function toJalali(date) {
    const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
    if (isNaN(d.getTime())) return '';
    if (d.getFullYear() < 1600) {
        console.warn('[Zenith i18n] toJalali: dates before 1600 CE may be inaccurate');
    }
    const gy = d.getFullYear();
    const gm = d.getMonth() + 1;
    const gd = d.getDate();
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy;
    let gyMut = gy;
    if (gyMut <= 1600) { jy = 0; gyMut -= 621; }
    else { jy = 979; gyMut -= 1600; }
    const gy2 = (gm > 2) ? (gyMut + 1) : gyMut;
    let days = (365 * gyMut) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053); days %= 12053;
    jy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    if (jy < 1 || jm < 1 || jm > 12 || jd < 1 || jd > 31) {
        console.warn(`[Zenith i18n] toJalali: invalid result for ${d.toISOString()}`);
        return '';
    }
    return `${toPersianNums(jy)}/${toPersianNums(jm.toString().padStart(2, '0'))}/${toPersianNums(jd.toString().padStart(2, '0'))}`;
}
export function jalaliNow() { return toJalali(new Date()); }
export function formatNumber(n) { return toPersianNums(n.toLocaleString('en-US').replace(/,/g, '٬')); }
export function formatPrice(n) { return formatNumber(n) + ' تومان'; }
export function isRTL() {
    // FIX (v1.2.3): تشخیص RTL با سه منبع — document.dir، documentElement.dir،
    // و lang attribute یکی از زبان‌های fa/ar/he/ur.
    if (typeof document === 'undefined') return false;
    if (document.dir === 'rtl') return true;
    if (typeof document.documentElement !== 'undefined'
        && document.documentElement.dir === 'rtl') return true;
    if (typeof document.documentElement !== 'undefined') {
        const lang = document.documentElement.lang?.split('-')[0] || '';
        if (['fa', 'ar', 'he', 'ur'].includes(lang)) return true;
    }
    return false;
}

// IMPROVEMENT-02 (v1.0.1): API کامل تقویم جلالی
const JALALI_MONTH_NAMES = ['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];

export function parseJalaliParts(date) {
    const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
    // FIX (v1.2.3): در صورت ورودی نامعتبر، null برگردان (نه [0, 0, 0]).
    if (isNaN(d.getTime())) return null;
    const gy = d.getFullYear(); const gm = d.getMonth() + 1; const gd = d.getDate();
    const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    let jy; let gyMut = gy;
    if (gyMut <= 1600) { jy = 0; gyMut -= 621; } else { jy = 979; gyMut -= 1600; }
    const gy2 = (gm > 2) ? (gyMut + 1) : gyMut;
    let days = (365 * gyMut) + Math.floor((gy2 + 3) / 4) - Math.floor((gy2 + 99) / 100) + Math.floor((gy2 + 399) / 400) - 80 + gd + g_d_m[gm - 1];
    jy += 33 * Math.floor(days / 12053); days %= 12053;
    jy += 4 * Math.floor(days / 1461); days %= 1461;
    if (days > 365) { jy += Math.floor((days - 1) / 365); days = (days - 1) % 365; }
    const jm = (days < 186) ? 1 + Math.floor(days / 31) : 7 + Math.floor((days - 186) / 30);
    const jd = 1 + ((days < 186) ? (days % 31) : ((days - 186) % 30));
    return [jy, jm, jd];
}

export function fromJalali(jy, jm, jd) {
    jy += 1595;
    let days = -355779 + 365 * jy + Math.floor((jy + 3) / 4) - Math.floor((jy + 99) / 100) + Math.floor((jy + 199) / 400);
    jy -= 1595;
    if (jm <= 6) days += (jm - 1) * 31; else days += (jm - 7) * 30 + 186;
    days += jd;
    const ms = (days - 2440588) * 86400000;
    return new Date(ms);
}

export function compareJalali(a, b) {
    if (a.y !== b.y) return a.y - b.y;
    if (a.m !== b.m) return a.m - b.m;
    return a.d - b.d;
}

export function addDaysJalali(date, days) {
    // FIX (v1.2.3): در branch غیر-string، همان Date ورودی را mutate کن (نه new Date).
    const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
}

export function isJalaliLeap(jy) {
    const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
    let jp = breaks[0]; let jump = 0;
    for (let i = 1; i < breaks.length; i++) {
        const jm = breaks[i];
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

export function jalaliMonthDays(jy, jm) {
    if (jm <= 6) return 31;
    if (jm <= 11) return 30;
    return isJalaliLeap(jy) ? 30 : 29;
}

export function formatJalali(date, fmt = 'YYYY/MM/DD') {
    const d = typeof date === 'string' ? new Date(date) : new Date(date.getTime());
    if (isNaN(d.getTime())) return '';
    const [jy, jm, jd] = parseJalaliParts(d) ?? [0, 0, 0];
    if (jy < 1) return '';
    // BUG-5 FIX (v1.2.2): MMMM must be replaced BEFORE MM to avoid corruption.
    return fmt
        .replace('MMMM', JALALI_MONTH_NAMES[jm - 1] || '')
        .replace('YYYY', toPersianNums(jy))
        .replace('MM', toPersianNums(String(jm).padStart(2, '0')))
        .replace('DD', toPersianNums(String(jd).padStart(2, '0')))
        .replace('YY', toPersianNums(String(jy).slice(-2)));
}

export function jalaliMonthName(jm) {
    return JALALI_MONTH_NAMES[jm - 1] || '';
}
