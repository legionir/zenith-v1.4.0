// packages/state/src/readable.ts
//
// #187 FIX: Brand برای مقادیر واکنش‌گرای «قابل‌خواندن».
//
// چرا brand لازم است؟
//   مصرف‌کننده‌ها (runtime/createContext، events/createContextForEval) با
//   duck-typing `typeof v.get === 'function' && typeof v.set === 'function'`
//   Signal را تشخیص می‌دادند. اما خروجی `computed()` (کلاس Computed) فقط
//   `get()` دارد — پس Signal شمرده نمی‌شد و به‌عنوان مقدار ساده یک‌بار در
//   context کپی (اسنپ‌شات) می‌شد: نتیجه، ناپذیرشی being computed در template.
//
// چرا instanceof نه؟
//   در monorepoها/اپلیکیشن‌هایی که بیش از یک بیلد از @zenith/state بارگذاری
//   می‌شود (مثلاً افزونه‌ها)، `instanceof Signal` می‌تواند false بدهد.
//   `Symbol.for` جهانی است و روی prototype برند می‌شود، پس از طریق زنجیرهٔ
//   prototype حتی بین بیلدهای مختلف هم کار می‌کند.
//
// سازگاری: برای آبجکت‌های plain که get+set دارند (الگوی legacy که قبلاً
// Signal فرض می‌شد) رفتار حفظ شده است — `isReadable` آن‌ها را هم می‌پذیرد.

/**
 * Symbol جهانی برند Signal/Computed. با `Symbol.for` ساخته می‌شود تا
 * بین چند instance از پکیج state هم یکسان بماند.
 */
export const ZENITH_READABLE: symbol = Symbol.for('zenith.readable');

/** هر ظرف واکنش‌گرای قابل‌خواندن حداقل یک get() دارد. */
export interface Readable<T = unknown> {
  get(): T;
}

/**
 * True اگر مقدار یک Signal/Computed (برنددار) یا یک duck-type سازگار با
 * legacy (شیء دارای get+set تابعی) باشد.
 */
export function isReadable(value: unknown): value is Readable<any> {
  if (value === null || typeof value !== 'object') return false;
  if (typeof (value as any).get !== 'function') return false;
  // brand روی prototype (Signal/Computed این پکیج)
  if ((value as any)[ZENITH_READABLE] === true) return true;
  // legacy: هر آبجکت get+set مثل قبل Signal فرض می‌شد (رفتار حفظ شود)
  return typeof (value as any).set === 'function';
}

/** True اگر مقدار نوشتنی باشد (Signal معمولی یا duck-type get+set). */
export function isWritable(value: unknown): value is Readable<any> & { set(v: any): void } {
  if (value === null || typeof value !== 'object') return false;
  return typeof (value as any).set === 'function';
}
