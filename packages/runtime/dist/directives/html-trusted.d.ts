/**
 * پردازش دایرکتیو zen-html-trusted روی یک عنصر.
 *
 * این تابع:
 *   1) Expression را در context ارزیابی می‌کند.
 *   2) مقدار را به رشته تبدیل می‌کند.
 *   3) رشته را به‌صورت مستقیم (بدون پاکسازی) در innerHTML قرار می‌دهد.
 *      — فقط از طریق sanitizeHTMLTrusted عبور می‌کند که یک Identity Function
 *      است و در Dev یک console.warn چاپ می‌کند.
 *
 * هر بار که مقدار Expression تغییر کند، این فرآیند دوباره انجام می‌شود.
 *
 * @param el      عنصر HTML.
 * @param expr    رشته‌ی Expression.
 * @param context آبجکت Context (برای Expression Engine).
 * @returns تابع Dispose برای پاکسازی Effect.
 */
export declare function processHtmlTrusted(el: HTMLElement, expr: string, context: Record<string, any>): () => void;
//# sourceMappingURL=html-trusted.d.ts.map
