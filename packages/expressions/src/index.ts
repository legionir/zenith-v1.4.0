// packages/expressions/src/index.ts
//
// نقطه‌ی ورود عمومی پکیج `@zenith/expressions`.
//
// استفاده‌ی معمول (کاربران فریم‌ورک):
//   import { evaluateExpression } from '@zenith/expressions';
//   const result = evaluateExpression('$user.age > 18', context);
//
// استفاده‌ی پیشرفته (توسعه‌دهندگان فریم‌ورک):
//   import { compile, evaluate, ASTNode } from '@zenith/expressions';
//   const ast = compile('$user.name'); // یک‌بار parse
//   const value1 = evaluate(ast, ctx); // چندین بار evaluate

// ── API سطح بالا: ساده‌ترین راه استفاده ──

import { compile } from './cache';
import { evaluate } from './evaluator';
import { ASTNode } from './parser';

/**
 * ارزیابی یک Expression رشته‌ای در برابر یک Context.
 *
 * این تابع:
 *   1) Expression را compile (parse + validate + cache) می‌کند.
 *   2) AST حاصل را در Context ارزیابی می‌کند.
 *
 * @param expr رشته‌ی Expression.
 * @param context آبجکت Context.
 * @returns نتیجه‌ی ارزیابی.
 *
 * @example
 *   evaluateExpression('$user.age > 18', { $user: { age: 25 } })
 *   // → true
 */
export function evaluateExpression(expr: string, context: object): any {
  const ast = compile(expr);
  return evaluate(ast, context);
}

// ── API سطح بالا (v1.0.0): compile-once برای استفاده در Effectهای پرتکرار ──

/**
 * FEATURE (v1.0.0): کامپایل یک‌بار Expression و برگرداندن یک closure آماده‌ی ارزیابی.
 *
 * این تابع برای Hot Path ها طراحی شده است — یعنی directive processor هایی که
 * Expression را داخل effect فراخوانی می‌کنند و effect ممکن است هزاران بار re-run شود.
 *
 * تفاوت با `evaluateExpression`:
 *   - `evaluateExpression(expr, ctx)` در هر فراخوانی، `compile(expr)` را صدا می‌زند که
 *     شامل `cache.has()` + `cache.get()` + `cache.delete()` + `cache.set()` (LRU touch)
 *     است. این overhead در Effectهای پرتکرار قابل توجه می‌شود.
 *   - `compileExpression(expr)` فقط یک‌بار `compile(expr)` را صدا می‌زند و AST را در
 *     closure ذخیره می‌کند. closure برگردانده‌شده فقط `evaluate(ast, ctx)` را اجرا
 *     می‌کند — یعنی صفر Map operation در Hot Path.
 *
 * استفاده‌ی معمول در directive processor:
 *   ```ts
 *   const evalFn = compileExpression(expr);  // یک‌بار در setup
 *   const dispose = effect(() => {
 *     const value = evalFn(context);          // فقط evaluate — بدون compile overhead
 *     el.textContent = String(value);
 *   });
 *   ```
 *
 * امنیت: همانند `compile`، validation قبل از cache انجام می‌شود. اگر Expression
 * نامعتبر باشد، `compile` خطا پرتاب می‌کند و این تابع هرگز closure برنمی‌گرداند.
 *
 * @param expr رشته‌ی Expression.
 * @returns تابعی که با گرفتن Context، نتیجه‌ی ارزیابی را برمی‌گرداند.
 *
 * @example
 *   const fn = compileExpression('$user.age > 18');
 *   fn({ $user: { age: 25 } }) // → true
 *   fn({ $user: { age: 15 } }) // → false
 */
export function compileExpression(expr: string): (context: object) => any {
  const ast = compile(expr);
  return (context: object) => evaluate(ast, context);
}

// ── API سطح پایین: برای استفاده‌های پیشرفته ──

/**
 * کامپایل یک Expression به AST (با caching داخلی).
 *
 * اگر همان Expression قبلاً compile شده باشد، AST کش شده برگردانده می‌شود.
 */
export { compile };

/**
 * ارزیابی یک AST از پیش ساخته‌شده.
 *
 * وقتی می‌خواهید یک Expression را چندین بار روی Contextهای مختلف اجرا کنید،
 * بهتر است ابتدا compile کنید و سپس evaluate را چندین بار صدا بزنید.
 */
export { evaluate };

/**
 * نوع ASTNode برای Type Safety در کدهای خارجی.
 */
export type { ASTNode };

// ── Utility exports ──

/**
 * پاک کردن Cache داخلی.
 *
 * در حالت عادی نیازی به فراخوانی این تابع نیست، ولی در تست‌ها
 * یا بعد از تغییرات بزرگ در Expressionهای template ممکن است مفید باشد.
 */
export { clearCache } from './cache';

/**
 * تعداد Expressionهای Cache شده (فقط برای Debug).
 */
export { getCacheSize, configureCache, getCacheStats } from './cache';

/**
 * Validator سطح پایین — در حالت عادی نباید مستقیماً استفاده شود.
 * (به طور خودکار توسط `compile` فراخوانی می‌شود.)
 */
export { validate } from './validator';

// ── Internal modules (برای توسعه‌دهندگان فریم‌ورک) ──

/**
 * Lexer سطح پایین — در حالت عادی نباید مستقیماً استفاده شود.
 */
export { lex, TokenType } from './lexer';
export type { Token } from './lexer';

/**
 * Parser سطح پایین — در حالت عادی نباید مستقیماً استفاده شود.
 */
export { Parser } from './parser';
