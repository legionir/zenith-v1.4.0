/**
 * پردازش یک تگ کامپوننت سفارشی.
 *
 * این تابع نقطه‌ی ورود اصلی سیستم کامپوننت‌هاست. توسط walker فراخوانی
 * می‌شود وقتی به تگی می‌رسد که در Registry ثبت شده است.
 *
 * مراحل:
 *   1) قالب را از Registry می‌گیرد. اگر نبود، return (نادیده گرفته می‌شود).
 *   2) Context محلی را با ارث‌بری از parentContext و افزودن Props می‌سازد.
 *   3) محتوای slot را از داخل تگ جمع‌آوری می‌کند.
 *   4) قالب را clone کرده و slotها را پر می‌کند.
 *   5) محتوای تگ کامپوننت را با محتوای قالب جایگزین می‌کند.
 *   6) فرزندان کامپوننت را با Context محلی walk می‌کند (به‌جز slot content
 *      که با Context والد walk می‌شود).
 *
 * @param el              تگ کامپوننت.
 * @param parentContext   Context والد.
 * @param processChildren callback برای walk فرزندان.
 *                        امضا: (node, context, disposes, isSlotContent) => void
 *                        - isSlotContent=true: محتوا با parentContext walk می‌شود.
 *                        - isSlotContent=false: محتوا با localContext walk می‌شود.
 * @param disposes        آرایه‌ی dispose functions (برای Memory Leak Prevention).
 */
export declare function processComponent(el: HTMLElement, parentContext: Record<string, any>, processChildren: (node: HTMLElement, context: Record<string, any>, disposes: (() => void)[], isSlotContent: boolean) => void, disposes: (() => void)[]): void;
//# sourceMappingURL=processor.d.ts.map