// packages/expressions/src/token.ts
//
// توکن‌های lexer (TokenType/Token + جدول punctuator) — استخراج مکانیکی از
// lexer.ts بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).


/**
 * نوع هر Token در خروجی Lexer.
 *
 * چرا enum به جای string union؟
 *   - Performance: مقایسه‌ی عددی در Parser سریع‌تر است.
 *   - Memory: V8 در حالت استفاده از enum، type narrowing بهتری انجام می‌دهد.
 *
 * سطح پایین — خانهٔ canonical ‏`@zenith/expressions/internal` است. @internal
 */
export enum TokenType {
  Number,
  String,
  Identifier,
  Punctuator,
  EOF,
}

/**
 * ساختار یک Token.
 *
 * فیلدهای start و end برای Error Reporting دقیق به کار می‌روند
 * (مثلاً "Error at position 12-15: Unexpected ')'").
 *
 * سطح پایین — خانهٔ canonical ‏`@zenith/expressions/internal` است. @internal
 */
export type Token = { start: number; end: number } & (
  | { type: TokenType.Number; value: number }
  | { type: TokenType.String | TokenType.Identifier | TokenType.Punctuator; value: string }
  | { type: TokenType.EOF; value: null }
);

/**
 * لیست تمام عملگرها و علائم نگارشی پشتیبانی‌شده.
 *
 * ترتیب در اینجا مهم نیست چون SORTED_PUNCTUATORS در زمان بارگذاری ماژول
 * به ترتیب طول نزولی مرتب می‌شود تا Greedy Matching درست کار کند.
 *
 * چرا ترتیب طول نزولی؟
 *   وقتی به "===" می‌رسیم، ابتدا باید "===" را match کنیم نه "==" را.
 *   اگر "==" اول match شود، "=" باقی می‌ماند که معنا ندارد.
 */
export const PUNCTUATORS = [
  '+',
  '-',
  '*',
  '/',
  '%',
  '??',
  '?.',
  '=>',
  '==',
  '===',
  '!=',
  '!==',
  '<',
  '>',
  '<=',
  '>=',
  '&&',
  '||',
  '!',
  '?',
  ':',
  '.',
  ',',
  '(',
  ')',
  '[',
  ']',
  '{',
  '}',
];

// Pre-sort برای جلوگیری از sort در هر iteration حلقه
export const SORTED_PUNCTUATORS = [...PUNCTUATORS].sort((a, b) => b.length - a.length);