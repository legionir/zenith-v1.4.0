/**
 * نوع هر Token در خروجی Lexer.
 *
 * چرا enum به جای string union؟
 *   - Performance: مقایسه‌ی عددی در Parser سریع‌تر است.
 *   - Memory: V8 در حالت استفاده از enum، type narrowing بهتری انجام می‌دهد.
 */
export declare enum TokenType {
    Number = 0,
    String = 1,
    Identifier = 2,
    Punctuator = 3,
    EOF = 4
}
/**
 * ساختار یک Token.
 *
 * فیلدهای start و end برای Error Reporting دقیق به کار می‌روند
 * (مثلاً "Error at position 12-15: Unexpected ')'").
 */
export interface Token {
    type: TokenType;
    value: any;
    start: number;
    end: number;
}
/**
 * تابع اصلی Lexer: تبدیل رشته به آرایه‌ای از Tokenها.
 *
 * مراحل برای هر کاراکتر:
 *   1) اگر فاصله است، رد شو.
 *   2) اگر `"` یا `'` است، یک String Literal بخوان.
 *   3) اگر رقم است، یک Number بخوان.
 *   4) اگر حرف یا `_` یا `$` است، یک Identifier بخوان.
 *   5) در غیر این صورت، Punctuator را match کن (greedy).
 *
 * در پایان، یک Token نوع EOF اضافه می‌شود تا Parser بداند
 * رشته تمام شده است (بدون نیاز به چک کردن length در هر مرحله).
 *
 * @param input رشته‌ی Expression.
 * @returns آرایه‌ای از Tokenها.
 */
export declare function lex(input: string): Token[];
//# sourceMappingURL=lexer.d.ts.map