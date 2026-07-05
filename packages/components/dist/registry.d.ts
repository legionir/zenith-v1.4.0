/**
 * قالب یک کامپوننت.
 *
 * ما فقط HTMLTemplateElement را نگه می‌داریم چون:
 *   - content آن در DocumentFragment است (در DOM فعلی نیست).
 *   - هر بار که کامپوننت استفاده می‌شود، content.cloneNode(true) یک کپی
 *     تازه به ما می‌دهد که می‌توانیم بدون تأثیر روی قالب اصلی، آن را
 *     تغییر دهیم (پر کردن slotها، اضافه کردن Props و …).
 */
export interface ComponentDefinition {
    /** نام کامپوننت (lowercase). مثلا "app-product-card". */
    name: string;
    /** قالب HTML کامپوننت. */
    template: HTMLTemplateElement;
}
export declare const componentRegistry: Map<string, HTMLTemplateElement>;
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
export declare function registerComponent(name: string, template: HTMLTemplateElement): void;
/**
 * حذف یک کامپوننت از Registry.
 */
export declare function unregisterComponent(name: string): boolean;
/**
 * دریافت قالب یک کامپوننت.
 *
 * @returns قالب یا `undefined` اگر ثبت نشده باشد.
 */
export declare function getComponent(name: string): HTMLTemplateElement | undefined;
/**
 * بررسی اینکه آیا یک تگ به‌عنوان کامپوننت ثبت شده است.
 *
 * این تابع توسط walker استفاده می‌شود تا تشخیص دهد آیا تگ فعلی (مثلا
 * <app-product-card>) یک کامپوننت است یا یک تگ HTML معمولی.
 */
export declare function isComponent(name: string): boolean;
/**
 * پاکسازی کل Registry (فقط برای تست‌ها و teardown کامل).
 *
 * ⚠️ در Production استفاده نکنید.
 */
export declare function clearComponents(): void;
//# sourceMappingURL=registry.d.ts.map