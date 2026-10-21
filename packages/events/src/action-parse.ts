// packages/events/src/action-parse.ts
//
// parse اکشن‌کال‌های `zen-action` و ساخت context ارزیابی — استخراج مکانیکی
// از delegation.ts بدون تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { isReadable } from '@zenith/state';


/**
 * نتیجه‌ی parsing یک Action Call.
 *
 * مثلاً `save($item, $product.id)` تبدیل می‌شود به:
 *   { name: 'save', argExprs: ['$item', '$product.id'] }
 *
 * اگر اکشن بدون parens باشد (`save`):
 *   { name: 'save', argExprs: null }
 *
 * `argExprs === null` یعنی backward-compatible: `ctx.args` برابر `undefined` است.
 * `argExprs === []` یعنی اکشن با parens خالی صدا زده شده (`save()`): `ctx.args = []`.
 */
export interface ParsedActionCall {
  name: string;
  argExprs: string[] | null;
}

/**
 * FEATURE (v1.3.0): تقسیم آرگومان‌های یک Action Call با احترام به nesting.
 *
 * این تابع یک رشته‌ی `argsStr` می‌گیرد (مثلاً `'$item, $product.id, "hello, world"'`)
 * و آن را به آرایه‌ای از expression string ها تقسیم می‌کند.
 *
 * نکته‌ی مهم: کاما داخل string ها، parentheses، brackets و braces نادیده گرفته
 * می‌شود. مثلاً `foo(a, b), bar([1, 2, 3])` به `['foo(a, b)', 'bar([1, 2, 3])']` تبدیل می‌شود.
 *
 * @param argsStr محتوای داخل پرانتز (مثلاً `'$item, $product.id'`).
 * @returns آرایه‌ای از expression string ها.
 */
function splitActionArgs(argsStr: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let inString: '"' | "'" | '`' | null = null;
  let start = 0;

  for (let i = 0; i < argsStr.length; i++) {
    const ch = argsStr[i]!;

    if (inString) {
      // escape: کاراکتر بعدی نادیده گرفته می‌شود
      if (ch === '\\') {
        i++;
        continue;
      }
      if (ch === inString) {
        inString = null;
      }
      continue;
    }

    if (ch === '"' || ch === "'" || ch === '`') {
      inString = ch;
      continue;
    }

    if (ch === '(' || ch === '[' || ch === '{') {
      depth++;
    } else if (ch === ')' || ch === ']' || ch === '}') {
      depth--;
    } else if (ch === ',' && depth === 0) {
      const arg = argsStr.slice(start, i).trim();
      if (arg.length > 0) args.push(arg);
      start = i + 1;
    }
  }

  // آخرین arg
  const last = argsStr.slice(start).trim();
  if (last.length > 0) args.push(last);

  return args;
}

/**
 * FEATURE (v1.3.0): Parsing یک Action Call string.
 *
 * مثال‌ها:
 *   `save`                  → { name: 'save', argExprs: null }
 *   `save()`                → { name: 'save', argExprs: [] }
 *   `save($item)`           → { name: 'save', argExprs: ['$item'] }
 *   `save($item, $p.id)`    → { name: 'save', argExprs: ['$item', '$p.id'] }
 *   `save($obj.method(a,b))`→ { name: 'save', argExprs: ['$obj.method(a,b)'] }
 *
 * اگر parsing ناموفق باشد (مثلاً پرانتز بسته نشده)، به‌صورت backward-compatible
 * عمل می‌کند و کل رشته را به‌عنوان نام اکشن در نظر می‌گیرد.
 *
 * @param actionAttr مقدار attribute `zen-action` یا `zen-action:<event>`.
 */
export function parseActionCall(actionAttr: string): ParsedActionCall {
  const trimmed = actionAttr.trim();
  const openParen = trimmed.indexOf('(');

  // بدون پرانتز → backward compatible
  if (openParen === -1) {
    return { name: trimmed, argExprs: null };
  }

  const name = trimmed.slice(0, openParen).trim();
  // اعتبارسنجی اولیه: نام نباید خالی باشد
  if (!name) {
    return { name: trimmed, argExprs: null };
  }

  const closeParen = trimmed.lastIndexOf(')');
  // پرانتز بسته نشده → backward compatible (کل رشته را به‌عنوان نام بگیر)
  if (closeParen === -1 || closeParen < openParen) {
    return { name: trimmed, argExprs: null };
  }

  const argsStr = trimmed.slice(openParen + 1, closeParen).trim();
  if (!argsStr) {
    return { name, argExprs: [] };
  }

  return { name, argExprs: splitActionArgs(argsStr) };
}

/**
 * FEATURE (v1.3.0): ساخت Context برای Expression Engine از State.
 *
 * این helper یک کپی سبک از منطق `createContext` در `@zenith/runtime` است.
 * ما آن را اینجا inline می‌کنیم تا circular dependency با runtime نداشته باشیم.
 *
 * اگر state item یک signal باشد (duck typing: get + set)، به یک getter تبدیل
 * می‌شود که signal.get() را صدا می‌زند. در غیر این صورت، مستقیماً در context
 * قرار می‌گیرد.
 *
 * نکته: پیشوند `$` به طور خودکار اضافه می‌شود. مثلاً `state.user` (signal)
 * به `context.$user` (getter) تبدیل می‌شود. اگر state از قبل `$` دارد (مثل
 * `state.$product`), همان نام حفظ می‌شود.
 *
 * @param state آبجکت State کاربر.
 * @returns Context قابل استفاده در evaluateExpression.
 */
export function createContextForEval(state: Record<string, unknown>): Record<string, unknown> {
  const context: Record<string, unknown> = {};
  for (const key in state) {
    const ctxKey = key.startsWith('$') ? key : `$${key}`;
    const item = state[key];
    if (isReadable(item)) {
      // Signal / Computed (#187: فقط get کافی است): به getter تبدیل می‌شود تا
      // در حین ارزیابی unwrap شود.
      Object.defineProperty(context, ctxKey, {
        get: () => item.get(),
        enumerable: true,
        configurable: true,
      });
    } else {
      // مقدار ساده یا Service — مستقیماً در Context.
      context[ctxKey] = item;
    }
  }
  return context;
}