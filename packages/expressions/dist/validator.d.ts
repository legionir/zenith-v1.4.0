import { ASTNode } from './parser';
/**
 * اعتبارسنجی امنیتی یک AST.
 *
 * این تابع به صورت بازگشتی تمام نودهای AST را بررسی می‌کند و
 * در صورت یافتن هر گونه دسترسی ممنوعه، خطا پرتاب می‌کند.
 *
 * @throws Error اگر دسترسی ممنوعه‌ای یافت شود.
 */
export declare function validate(node: ASTNode): void;
//# sourceMappingURL=validator.d.ts.map