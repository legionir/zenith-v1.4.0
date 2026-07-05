/**
 * یک وابستگی به یک Signal.
 */
export interface Dependency {
    /** نام Signal در state (بدون $). */
    signal: string;
    /** مسیر پراپرتی‌ها (مثل ['user', 'name']). */
    path: string[];
    /** آیا از bracket notation استفاده شده؟ */
    computed: boolean;
}
/**
 * استخراج وابستگی‌های یک Expression.
 *
 * @param expr رشته‌ی Expression (مثل "$user.name + $count").
 * @returns لیست وابستگی‌ها.
 */
export declare function extractDependencies(expr: string): Dependency[];
/**
 * استخراج وابستگی‌های چند Expression همزمان.
 *
 * @param expressions لیست Expression ها.
 * @returns لیست وابستگی‌های یکپارچه (بدون تکرار).
 */
export declare function extractAllDependencies(expressions: string[]): Dependency[];
/**
 * ساخت یک Dependency Graph از لیست Expression ها.
 *
 * @param expressions Map از نام به Expression.
 * @returns Map از نام به وابستگی‌ها.
 */
export declare function buildDependencyGraph(expressions: Record<string, string>): Record<string, Dependency[]>;
/**
 * بررسی اینکه آیا دو مجموعه وابستگی اشتراک دارند.
 *
 * @param deps1 مجموعه اول.
 * @param deps2 مجموعه دوم.
 * @returns true اگر اشتراک دارند.
 */
export declare function hasOverlap(deps1: Dependency[], deps2: Dependency[]): boolean;
