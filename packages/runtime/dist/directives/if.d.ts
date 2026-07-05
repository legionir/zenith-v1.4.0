/**
 * پردازش دایرکتیو zen-if روی یک عنصر.
 *
 * @param el عنصر HTML (که باید zen-if داشته باشد).
 * @param expr رشته‌ی Expression شرط.
 * @param context آبجکت Context.
 * @param manageChildren تابعی برای mount/unmount فرزندان.
 *        این تابع یک آرایه از dispose functions برمی‌گرداند.
 * @returns تابع Dispose برای پاکسازی خود دایرکتیو.
 */
export declare function processIf(el: HTMLElement, expr: string, context: Record<string, any>, manageChildren: () => (() => void)[]): () => void;
//# sourceMappingURL=if.d.ts.map