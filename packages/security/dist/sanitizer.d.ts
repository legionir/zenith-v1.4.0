/**
 * پاکسازی یک رشته‌ی HTML.
 *
 * این تابع:
 *   1) رشته را با DOMParser parse می‌کند (بدون اجرای اسکریپت).
 *   2) به‌صورت بازگشتی تمام نودها را پاکسازی می‌کند.
 *   3) خروجی را به‌صورت رشته‌ی HTML برمی‌گرداند.
 *
 * @param dirty رشته‌ی HTML نامطمئن.
 * @returns رشته‌ی HTML پاکسازی‌شده.
 */
export declare function sanitizeHTML(dirty: string): string;
/**
 * پاکسازی یک رشته‌ی HTML با امکانات قابل تنظیم.
 *
 * این تابع نسخه‌ی پیشرفته‌ی sanitizeHTML است که به کاربر اجازه می‌دهد:
 *   - تگ‌های اضافی را مجاز کند (مثلاً <form>).
 *   - تگ‌های خاصی را اضافه حذف کند.
 *   - URL های خاص را مجاز کند.
 *
 * @param dirty رشته‌ی HTML نامطمئن.
 * @param options گزینه‌های پیکربندی.
 * @returns رشته‌ی HTML پاکسازی‌شده.
 */
export interface SanitizeOptions {
    /** تگ‌های اضافی که باید مجاز باشند (از لیست ممنوعه خارج شوند). */
    allowTags?: string[];
    /** تگ‌های اضافی که باید ممنوع باشند. */
    forbidTags?: string[];
    /** آیا <form> مجاز باشد؟ (پیش‌فرض: false) */
    allowForms?: boolean;
}
export declare function sanitizeHTMLWithOptions(dirty: string, options?: SanitizeOptions): string;
// FEATURE (v0.4.0): zen-html-trusted — Identity function برای محتوای Trusted.
// ورودی را بدون تغییر برمی‌گرداند؛ فقط یک marker صریح + dev warn است.
export declare function sanitizeHTMLTrusted(html: string): string;
//# sourceMappingURL=sanitizer.d.ts.map