// packages/components/src/registry.ts
//
// Component Registry — ثبت و بازیابی قالب‌های کامپوننت‌ها.
//
// ایده:
//   کاربر در HTML تعریف می‌کند:
//     <zen-component name="app-product-card">
//       <template> ... </template>
//     </zen-component>
//   سپس در همان HTML از تگ <app-product-card> استفاده می‌کند.
//   در زمان Zen.start، تابع loadComponents تمام تعاریف را پیدا کرده و
//   قالب‌های (HTMLTemplateElement) آن‌ها را در این Registry ذخیره می‌کند.
//
// نکته‌ی مهم: ما از Light DOM استفاده می‌کنیم (نه Shadow DOM) چون:
//   1) Event Delegation روی document به درستی کار می‌کند.
//   2) استایل‌های global CSS روی محتوای کامپوننت اعمال می‌شوند.
//   3) ساده‌تر و سریع‌تر است.
// ── مخزن داخلی کامپوننت‌ها ──
//
// چرا Map و نه Plain Object؟
//   - کلیدها می‌توانند هر رشته‌ای باشند (حتی "__proto__").
//   - API واضح‌تر است (has/get/set/delete).
//   - در آینده می‌توانیم metadata بیشتری ذخیره کنیم.
//
// نکته (فاز ۱۰): این Map به‌صورت export شده تا DevTools بتواند آن را بازرسی کند.
export const componentRegistry = new Map();
/**
 * Type guard برای تشخیص HTMLTemplateElement.
 *
 * از instanceof استفاده نمی‌کنیم چون:
 *   - در محیط‌های غیر مرورگر (Node.js + jsdom)، HTMLTemplateElement ممکن
 *     است روی window جsdوم تعریف شده باشد اما روی global نباشد.
 *   - instanceof در چند realm (مثلاً main + iframe) هم می‌تواند false برگرداند.
 *
 * Duck typing: یک HTMLTemplateElement ویژگی `content` (DocumentFragment) دارد
 * و nodeName آن 'TEMPLATE' است.
 */
function isHTMLTemplateElement(value) {
    return (value !== null &&
        typeof value === 'object' &&
        value.nodeName === 'TEMPLATE' &&
        'content' in value);
}
/**
 * ثبت یک کامپوننت.
 *
 * نام به‌صورت خودکار lowercase می‌شود چون HTML تگ‌ها را case-insensitive می‌کند.
 * اگر کامپوننت با همین نام از قبل ثبت شده بود، بدون هشدار overwrite می‌شود
 * (این رفتار برای HMR مطلوب است).
 *
 * @param name     نام کامپوننت (مثلا "app-product-card").
 * @param template قالب HTML کامپوننت.
 */
export function registerComponent(name, template) {
    if (typeof name !== 'string' || name.length === 0) {
        throw new Error(`[Zenith] Component name must be a non-empty string. Received: ${String(name)}`);
    }
    if (!isHTMLTemplateElement(template)) {
        throw new Error(`[Zenith] Component "${name}" requires an HTMLTemplateElement.`);
    }
    componentRegistry.set(name.toLowerCase(), template);
}
/**
 * حذف یک کامپوننت از Registry.
 */
export function unregisterComponent(name) {
    return componentRegistry.delete(name.toLowerCase());
}
/**
 * دریافت قالب یک کامپوننت.
 *
 * @returns قالب یا `undefined` اگر ثبت نشده باشد.
 */
export function getComponent(name) {
    return componentRegistry.get(name.toLowerCase());
}
/**
 * بررسی اینکه آیا یک تگ به‌عنوان کامپوننت ثبت شده است.
 *
 * این تابع توسط walker استفاده می‌شود تا تشخیص دهد آیا تگ فعلی (مثلا
 * <app-product-card>) یک کامپوننت است یا یک تگ HTML معمولی.
 */
export function isComponent(name) {
    return componentRegistry.has(name.toLowerCase());
}
/**
 * پاکسازی کل Registry (فقط برای تست‌ها و teardown کامل).
 *
 * ⚠️ در Production استفاده نکنید.
 */
export function clearComponents() {
    componentRegistry.clear();
}
//# sourceMappingURL=registry.js.map