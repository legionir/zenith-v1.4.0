/**
 * پردازش کامل یک DOM root با State داده‌شده.
 *
 * این تابع نقطه‌ی ورود اصلی Runtime است.
 *
 * @param root عنصر ریشه که باید process شود.
 * @param state آبجکت State (شامل Signalها، Services، و ...).
 */
export declare function processDOM(root: HTMLElement, state: Record<string, any>): void;
/**
 * FEATURE (v0.4.0): پیاده‌سازی سبک‌وزنِ processDOM برای استفاده‌ی per-clone
 * در zen-for کامپایل‌شده و سایر کاربردهایی که نیاز به bind کردن یک زیردرخت
 * دارند بدون re-init کردنِ Event Delegation سراسری یا reset کردن Resource
 * Registry.
 *
 * مورد استفاده‌ی اصلی: processChildren callback در zen-for کامپایل‌شده.
 * برخلاف processDOM، این تابع یک تابع teardown برمی‌گرداند که compiler-
 * generated کدِ zen-for آن را در `__entry.dispose` ذخیره و هنگام removal
 * آیتم صدا می‌زند تا Effectهای فرزندان clone پاکسازی شوند.
 *
 * @param root  عنصر ریشه‌ی زیردرخت.
 * @param state آبجکت State (شامل Signalهای محلی).
 * @returns تابع teardown که تمام Effectهای ایجادشده را dispose می‌کند.
 */
export declare function walkAndBind(root: HTMLElement, state: Record<string, any>): () => void;
/**
 * FEATURE (v0.6.0): امضای handler یک custom directive.
 *
 * @param el         عنصر HTML (تگ سفارشی مثل <zen-resource-view>).
 * @param configAttr مقدار attribute پیکربندی (مثلاً مقدار `config` یا `action`).
 * @param context    Context والد (شامل getterهای `$user` و ...).
 * @param state      آبجکت State اصلی (شامل Signalها و Services).
 * @returns تابع Dispose برای پاکسازی Effectها و listenerها.
 */
export declare type CustomDirectiveHandler = (
  el: HTMLElement,
  configAttr: string | null,
  context: Record<string, any>,
  state: Record<string, any>,
) => () => void;
/**
 * FEATURE (v0.6.0): ثبت یک custom directive برای یک تگ سفارشی.
 *
 * @param tagName       نام تگ (case-insensitive). مثلاً `'zen-resource-view'`.
 * @param handler       تابع پردازشگر.
 * @param attributeName نام attributeای که به‌عنوان `configAttr` استخراج می‌شود.
 *                     پیش‌فرض `'config'`.
 */
export declare function registerCustomDirective(
  tagName: string,
  handler: CustomDirectiveHandler,
  attributeName?: string,
): void;
/**
 * FEATURE (v0.6.0): حذف یک custom directive از registry.
 *
 * @param tagName نام تگ.
 * @returns true اگر حذف شد، false اگر وجود نداشت.
 */
export declare function unregisterCustomDirective(tagName: string): boolean;
/**
 * FEATURE (v0.6.0): پاکسازی کل registry (فقط برای تست‌ها و teardown کامل).
 */
export declare function clearCustomDirectives(): void;
/**
 * FEATURE (v0.6.0): دریافت handler یک custom directive (برای دیباگ و DevTools).
 *
 * @param tagName نام تگ.
 * @returns handler یا undefined.
 */
export declare function getCustomDirective(tagName: string): CustomDirectiveHandler | undefined;
//# sourceMappingURL=walker.d.ts.map