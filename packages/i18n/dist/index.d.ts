/** تبدیل اعداد انگلیسی به فارسی. */
export declare function toPersianNums(n: number | string): string;
/** تبدیل اعداد انگلیسی به عربی. */
export declare function toArabicNums(n: number | string): string;
/** تبدیل تاریخ میلادی به شمسی (تقویم جلالی). */
export declare function toJalali(date: Date | string): string;
/** تاریخ و زمان فعلی به شمسی. */
export declare function jalaliNow(): string;
/** فرمت‌بندی عدد با جداکننده هزارگان (فارسی). */
export declare function formatNumber(n: number): string;
/** فرمت‌بندی قیمت به تومان. */
export declare function formatPrice(n: number): string;
/** RTL direction helper. */
export declare function isRTL(): boolean;
