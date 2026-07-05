import { ASTNode } from './parser';
/**
 * کامپایل یک Expression به AST.
 *
 * مراحل:
 *   1) اگر در Cache هست، برگردان (LRU touch).
 *   2) وگرنه، parse کن، validate کن، cache کن، برگردان.
 *
 * @param expression رشته‌ی Expression.
 * @returns درخت AST.
 * @throws Error در صورت شکست syntax یا validation.
 */
export declare function compile(expression: string): ASTNode;
/**
 * پاک کردن Cache (برای استفاده در تست‌ها یا بعد از تغییرات بزرگ).
 */
export declare function clearCache(): void;
/**
 * فقط برای Debug: تعداد Expressionهای Cache شده.
 */
export declare function getCacheSize(): number;
//# sourceMappingURL=cache.d.ts.map