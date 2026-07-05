/**
 * گزینه‌های lighthouse audit.
 */
export interface LighthouseOptions {
    /** پورت برای static server (پیش‌فرض: 0 = random port). */
    port?: number;
    /** آیا در حالت CI اجرا شود (exit 1 اگر PWA score < threshold). */
    ci?: boolean;
    /** حداقل امتیاز PWA برای CI mode (پیش‌فرض: 90). */
    minScore?: number;
    /** مسیر Chrome executable (در صورت نیاز). */
    chromePath?: string;
    /** آیا خروجی verbose باشد. */
    verbose?: boolean;
}
/**
 * نتیجه‌ی lighthouse audit.
 */
export interface LighthouseResult {
    /** امتیاز PWA (0-100). */
    pwaScore: number;
    /** امتیاز Performance (0-100). */
    performanceScore: number;
    /** امتیاز Accessibility (0-100). */
    accessibilityScore: number;
    /** امتیاز Best Practices (0-100). */
    bestPracticesScore: number;
    /** امتیاز SEO (0-100). */
    seoScore: number;
    /** لیست PWA audits که failed شده‌اند. */
    failedAudits: Array<{
        id: string;
        title: string;
        description: string;
    }>;
    /** آیا audit موفق بود. */
    passed: boolean;
    /** مسیر فایل HTML report. */
    reportPath?: string;
}
/**
 * اجرای lighthouse audit روی یک پوشه.
 *
 * @param rootDir پوشه‌ای که باید audit شود (مثل dist).
 * @param options گزینه‌های audit.
 * @returns نتیجه‌ی audit.
 */
export declare function runLighthouseAudit(rootDir: string, options?: LighthouseOptions): Promise<LighthouseResult>;
/**
 * نمایش نتایج lighthouse audit.
 */
export declare function printLighthouseResult(result: LighthouseResult): void;
//# sourceMappingURL=lighthouse.d.ts.map