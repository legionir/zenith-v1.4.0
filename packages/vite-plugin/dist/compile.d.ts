/**
 * گزینه‌های compile.
 */
export interface CompileOptions {
    /**
     * آیا compile در build time فعال باشد؟
     * پیش‌فرض: true در build، false در dev (در dev از runtime walker استفاده می‌شود).
     */
    enabled?: boolean;
    /**
     * مسیرهای که باید compile شوند (به‌صورت glob).
     * پیش‌فرض: همه‌ی فایل‌های `.html` در root و pages/.
     */
    include?: string[];
    /**
     * مسیرهای که نباید compile شوند.
     */
    exclude?: string[];
    /**
     * آیا خطاهای warning در build به error تبدیل شوند؟
     */
    strict?: boolean;
}
/**
 * نتیجه‌ی transform یک فایل HTML.
 */
export interface TransformResult {
    /** HTML تغییر یافته (بدون directiveها، با script tag اضافه‌شده). */
    html: string;
    /** کد JavaScript تولیدشده (یا null اگر فایل directive نداشت). */
    js: string | null;
    /** نام ماژول برای import. */
    moduleName: string;
    /** تعداد directiveهای compile‌شده. */
    directiveCount: number;
    /** گزارش‌های warning. */
    warnings: string[];
}
/**
 * بررسی اینکه آیا یک فایل HTML directiveهای Zenith دارد.
 */
export declare function hasZenithDirectives(html: string): boolean;
/**
 * استخراج نام فایل ماژول از مسیر HTML.
 * مثال: src/pages/home.html → home.zenith.js
 */
export declare function getModuleName(htmlPath: string): string;
/**
 * Transform یک فایل HTML: compile directiveها به JS و حذف آن‌ها از HTML.
 *
 * @param html محتوای HTML.
 * @param htmlPath مسیر فایل (برای نام‌گذاری ماژول).
 * @param options گزینه‌های compile.
 * @returns نتیجه‌ی transform.
 */
export declare function transformHtml(html: string, htmlPath: string, options?: CompileOptions): Promise<TransformResult>;
/**
 * اعتبارسنجی فایل HTML و بازگشت لیست warningها بدون transform.
 *
 * کاربرد: در `zenith check` یا قبل از build برای بررسی زودهنگام.
 */
export declare function analyzeHtml(html: string, htmlPath?: string): {
    directiveCount: number;
    warnings: string[];
    errors: string[];
};
//# sourceMappingURL=compile.d.ts.map