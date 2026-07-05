/**
 * پردازش دایرکتیو zen-html روی یک عنصر.
 *
 * این تابع:
 *   1) Expression را در context ارزیابی می‌کند.
 *   2) مقدار را به رشته تبدیل می‌کند.
 *   3) رشته را با Sanitizer پاکسازی می‌کند.
 *   4) HTML پاکسازی‌شده را در innerHTML عنصر قرار می‌دهد.
 *
 * هر بار که مقدار Expression تغییر کند، این فرآیند دوباره انجام می‌شود.
 *
 * @param el      عنصر HTML.
 * @param expr    رشته‌ی Expression.
 * @param context آبجکت Context (برای Expression Engine).
 * @returns تابع Dispose برای پاکسازی Effect.
 */
export declare function processHtml(el: HTMLElement, expr: string, context: Record<string, any>): () => void;
//# sourceMappingURL=html.d.ts.map