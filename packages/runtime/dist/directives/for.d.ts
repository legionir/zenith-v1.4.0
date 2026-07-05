/**
 * پردازش دایرکتیو zen-for روی یک عنصر.
 *
 * @param el            عنصر HTML که zen-for روی آن است.
 * @param expr          رشته‌ی expression از `zen-for`.
 * @param context       Context والد (شامل getter های `$user` و …).
 * @param processChildren callback که برای هر آیتم تازه ساخته‌شده فراخوانی
 *                       می‌شود تا فرزندانش با context محلی walk شوند.
 *                      امضای آن: (node, localContext, disposes) => void
 * @returns تابع Dispose برای پاکسازی کل zen-for (effect اصلی + همه‌ی آیتم‌ها).
 */
export declare function processFor(el: HTMLElement, expr: string, context: Record<string, any>, processChildren: (node: HTMLElement, localContext: Record<string, any>, disposes: (() => void)[]) => void): () => void;
//# sourceMappingURL=for.d.ts.map