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
 * @public
 */
export const ZENITH_READABLE: symbol = Symbol.for('zenith.readable');

/**
 * هر ظرف واکنش‌گرای قابل‌خواندن حداقل یک get() دارد.
 *
 * #119: این تعریف **عمداً محلی** است و از `@zenith/shared` import نمی‌شود:
 * قرارداد DEC-021/#141 هیچ یال `state → shared` نمی‌خواهد (تست
 * packages/shared/test/layering.test.ts). دو تعریف ساختاریِ هم‌معنا هستند و
 * گیت #119 آن‌ها را به‌عنوان `same-meaning` در allowlist ثبت کرده است.
 * @public
 */
export interface Readable<T = unknown> {
  get(): T;
}

/**
 * True اگر مقدار یک Signal/Computed (برنددار) یا یک duck-type سازگار با
 * legacy (شیء دارای get+set تابعی) باشد.
 * @public
 */
export function isReadable(value: unknown): value is Readable<unknown> {
  if (value === null || typeof value !== 'object') return false;
  if (typeof Reflect.get(value, 'get') !== 'function') return false;
  // brand روی prototype (Signal/Computed این پکیج)
  if (Reflect.get(value, ZENITH_READABLE) === true) return true;
  // legacy: هر آبجکت get+set مثل قبل Signal فرض می‌شد (رفتار حفظ شود)
  return typeof Reflect.get(value, 'set') === 'function';
}

/** A setter was observed, but its accepted domain is not known. @public */
export interface WritableCapability { set(value: never): unknown; }

/**
 * Detect setter capability only, without inventing a getter or a writable
 * Signal<unknown>. Unknown consumers must not pass arbitrary values; known
 * application-owned Signal<T> values retain their original typed methods.
 * Runtime detection intentionally still accepts setter-only objects.
 * @public
 */
export function isWritable(value: unknown): value is WritableCapability {
  if (value === null || typeof value !== 'object') return false;
  return typeof Reflect.get(value, 'set') === 'function';
}
