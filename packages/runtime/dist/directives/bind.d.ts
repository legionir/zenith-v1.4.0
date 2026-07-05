/**
 * پردازش دایرکتیو zen-bind روی یک عنصر.
 *
 * @param el عنصر HTML.
 * @param attrName نام Attribute (بدون پیشوند `zen-bind:`).
 * @param expr رشته‌ی Expression.
 * @param context آبجکت Context.
 * @returns تابع Dispose برای پاکسازی.
 */
export declare function processBind(el: HTMLElement, attrName: string, expr: string, context: Record<string, any>): () => void;
//# sourceMappingURL=bind.d.ts.map