import { zenForInvalidSyntaxError } from '@zenith/errors';
/** Parsed loop operands. @internal */
export interface ParsedForSyntax {
  /** نام متغیر آیتم (مثلاً "item"). */
  itemName: string;
  /** نام متغیر ایندکس (مثلاً "index"). پیش‌فرض "index". */
  indexName: string;
  /** Expression ارزیابی‌شده برای گرفتن آرایه (مثلاً "$items"). */
  listExpr: string;
}

/** Preserve supported legacy list syntax. @internal */
export function parseForSyntax(expr: string): ParsedForSyntax {
  const match = expr.match(
    /^\(?\s*([a-zA-Z_$][\w$]*)\s*(?:,\s*([a-zA-Z_$][\w$]*)\s*)?\)?\s+in\s+(.+)$/,
  );
  if (!match) {
    // FEATURE (v1.0.0): پیام خطای بهبودیافته با مثال.
    throw zenForInvalidSyntaxError(expr);
  }
  return {
    itemName: match[1]!,
    indexName: match[2] || 'index',
    listExpr: match[3]!.trim(),
  };
}
