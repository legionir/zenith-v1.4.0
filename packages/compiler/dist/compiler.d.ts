import { type Dependency } from '@zenith/dependency-graph';
/**
 * نتیجه‌ی compile یک قالب.
 */
export interface CompiledTemplate {
    /** کد JavaScript تولیدشده. */
    code: string;
    /** وابستگی‌های استخراج‌شده. */
    dependencies: Dependency[];
    /** تعداد عناصر. */
    elementCount: number;
    /** تعداد Effect های تولیدشده. */
    effectCount: number;
    /** آیا قالب static است (هیچ Effect ندارد)؟ */
    isStatic: boolean;
    /**
     * لیست directiveهایی که compiler نتوانست compile کند و به runtime سپرده‌اند.
     * هر مورد شامل: { directive, value, elementPath }
     *
     * اگر این لیست خالی نباشد، generated module باید runtime walker را
     * پس از render() فراخوانی کند تا این directiveها پردازش شوند.
     */
    runtimeDirectives: Array<{
        directive: string;
        value: string;
        elementPath: string;
    }>;
    /**
     * Warningهای تولیدشده در حین compile (مثلاً syntax error در expression).
     */
    warnings: string[];
}
/**
 * گزینه‌های compile.
 */
export interface CompileOptions {
    /**
     * اگر true، در صورت وجود directive پشتیبانی‌نشده خطا پرتاب کند.
     * اگر false (پیش‌فرض)، warning چاپ کند و directive را به runtime بسپارد.
     */
    strict?: boolean;
}
/**
 * Compile یک رشته‌ی HTML به کد JavaScript.
 *
 * @param html رشته‌ی HTML.
 * @param options گزینه‌های compile.
 * @returns نتیجه‌ی compile (Promise در محیط Node به دلیل async jsdom import).
 */
export declare function compileTemplate(html: string, options?: CompileOptions): Promise<CompiledTemplate>;
