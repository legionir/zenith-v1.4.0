// packages/expressions/src/evaluator.ts
//
// Evaluator: مرحله‌ی سوم از کامپایل Expression.
// درخت AST را در برابر یک Context (شامل Stateها، Serviceها و ...) محاسبه می‌کند.
//
// این تابع Pure است (به ازای ورودی یکسان، خروجی یکسان می‌دهد) به جز:
//   - فراخوانی توابع موجود در context (که ممکن است side effect داشته باشند).
//
// نکته‌ی امنیتی مهم:
//   هیچ‌گاه از eval() یا new Function() استفاده نمی‌شود.
//   تمام محاسبات بر اساس نوع Node در AST به صورت مستقیم انجام می‌شود.
//   این باعث می‌شود:
//     1) حملات XSS یا Code Injection غیرممکن شود.
//     2) امکان Static Analysis فراهم شود.
//     3) عملکرد بسیار بالاتر از eval باشد (بدون compile cost در runtime).

import { ASTNode } from './parser';
// FEATURE (v1.0.0): ادغام کتابخانه‌ی خطاها برای پیام‌های بهبودیافته.
import { variableNotDefinedError, securityError } from '@zenith/errors';
// FIX (v1.2.8): P1-1 — Import the shared FORBIDDEN_PROPERTIES list from
// ./security-constants so the runtime guard and the compile-time validator
// stay in sync. Previously the evaluator had its own FORBIDDEN_PROPERTIES_RT
// that drifted from the validator's list (the validator was missing
// __defineGetter__/__defineSetter__/__lookupGetter__/__lookupSetter__).
import { FORBIDDEN_PROPERTIES, isForbiddenIdentifier } from './security-constants';

// FIX (v1.2.9): BUG-02 — Move OBJECT_PROTO_BUILTINS to module level.
// Previously this Set was created inside the `case 'Identifier':` block,
// meaning it was re-allocated on every single evaluate() call. In a page
// with 1000 bindings, that's 1000 unnecessary Set allocations.
const OBJECT_PROTO_BUILTINS = new Set([
  'constructor', 'toString', 'hasOwnProperty', 'valueOf',
  'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString',
  '__proto__', '__defineGetter__', '__defineSetter__',
  '__lookupGetter__', '__lookupSetter__',
]);

/**
 * Runtime guard reference — alias of the shared FORBIDDEN_PROPERTIES list.
 *
 * SECURITY (v0.5.0):
 *   Validator فقط در زمان Compile به‌صورت استاتیک روی AST بررسی می‌کند. اما اگر
 *   دسترسی به پراپرتی با یک کلید داینامیک (متغیر) انجام شود — مثلاً
 *   `$obj[$key]` که در آن `$key` در runtime برابر `'constructor'` است —
 *   Validator نمی‌تواند مقدار runtime را پیش‌بینی کند و دسترسی عبور می‌کند.
 *
 *   این لیست به‌عنوان یک لایه‌ی دفاعی عمقی (Defense in Depth) در Evaluator
 *   عمل می‌کند: حتی اگر Validator اشتباهاً اجازه‌ی دسترسی داده باشد،
 *   Evaluator در زمان واقعیِ evaluate کردن، اگر نام پراپرتی (چه از طریق
 *   dot notation، چه bracket notation با کلید داینامیک) در این لیست باشد،
 *   خطا پرتاب می‌کند.
 *
 * FIX (v1.2.8): P1-1 — اکنون از همان FORBIDDEN_PROPERTIES مشترک استفاده
 * می‌کنیم که Validator هم از آن استفاده می‌کند. هیچ driftای بین دو لایه
 * وجود ندارد.
 */
const FORBIDDEN_PROPERTIES_RT = FORBIDDEN_PROPERTIES;

/**
 * محاسبه‌ی یک AST Node در برابر یک Context.
 *
 * @param node نود AST.
 * @param context آبجکت Context (شامل مقادیر متغیرها).
 * @returns نتیجه‌ی محاسبه.
 */
export function evaluate(node: ASTNode, context: object): any {
  switch (node.type) {
    // ───────────────────────────────────────────────
    // Literal: مقدار ثابت (مثل 42 یا "hello")
    // ───────────────────────────────────────────────
    case 'Literal':
      return node.value;

    // ───────────────────────────────────────────────
    // Identifier: دسترسی به متغیر در Context (مثل $user)
    //
    // نکته‌ی مهم: اگر context از getter استفاده کند (مثل { get $user() {...} })
    // این دسترسی به طور خودکار Dependency Tracking را فعال می‌کند
    // چون getter اجرا می‌شود و در حین اجرا، Signal.get() فراخوانی می‌شود.
    // ───────────────────────────────────────────────
    case 'Identifier': {
      // FIX (v1.2.5): Revert to `in` operator (allows prototype chain for parent
      // context — critical for zen-for child contexts built with Object.create(parent)).
      // But explicitly block Object.prototype built-in properties (toString, etc.)
      // unless the user has overridden them as own properties.
      //
      // The v1.2.4 fix used hasOwnProperty which broke prototype chain lookup:
      //   const parent = {}; Object.defineProperty(parent, '$fmt', {get:()=>1});
      //   const child = Object.create(parent);
      //   hasOwnProperty.call(child, '$fmt')  → false  ← BROKEN!
      //   '$fmt' in child                      → true   ← CORRECT!
      //
      // This fix blocks Object.prototype built-ins while preserving inherited
      // user-defined properties (getters on parent contexts, zen-for variables, etc.).
      // FIX (v1.2.9): OBJECT_PROTO_BUILTINS is now module-level (was per-call).
      const isInContext = node.name in context;
      const isOwnProp = Object.prototype.hasOwnProperty.call(context, node.name);
      const isProtoBuiltin = OBJECT_PROTO_BUILTINS.has(node.name) && !isOwnProp;
      if (!isInContext || isProtoBuiltin) {
        const availableVars = Object.keys(context).filter(k => k.startsWith('$') || !k.startsWith('__'));
        throw variableNotDefinedError(node.name, availableVars);
      }
      return (context as any)[node.name];
    }

    // ───────────────────────────────────────────────
    // MemberExpression: دسترسی به پراپرتی (a.b یا a[b])
    //
    // - اگر computed=false (یعنی a.b)، property یک Identifier است.
    // - اگر computed=true (یعنی a[b])، property یک Expression است که باید evaluate شود.
    // - اگر object null/undefined باشد، بدون خطا undefined برمی‌گردانیم
    //   (شبیه رفتار JavaScript: `null.x` در حالت strict mode خطا می‌دهد ولی
    //    ما برای راحتی در Templateها undefined برمی‌گردانیم).
    // ───────────────────────────────────────────────
    case 'MemberExpression': {
      const object = evaluate(node.object, context);

      const property = node.computed
        ? evaluate(node.property, context)
        : (node.property as { name: string }).name;

      // SECURITY (v0.5.0): runtime guard — even if validator missed it (e.g. dynamic key),
      // block access to forbidden properties at evaluation time.
      // This catches cases like `$obj[$key]` where `$key` is a variable that at
      // runtime equals `'constructor'`, `'__proto__'`, `'prototype'`,
      // `'__defineGetter__'`, or `'__defineSetter__'`. The validator can only
      // statically check literal strings (e.g. `$obj['constructor']`), so a
      // dynamic key slips through — this guard closes that escape at runtime.
      // Applies to BOTH computed (`a[expr]`) and non-computed (`a.constructor`) access.
      if (typeof property === 'string' && FORBIDDEN_PROPERTIES_RT.includes(property)) {
        // FEATURE (v1.0.0): پیام خطای امنیتی بهبودیافته با راهنمای رفع.
        throw securityError('ZEN-002', property, true);
      }

      // SECURITY (v1.4.0): additional runtime guard for forbidden identifiers
      // used as dynamic property keys — blocks cases like `$obj[eval]` or `$obj[Function]`.
      if (typeof property === 'string' && isForbiddenIdentifier(property)) {
        throw securityError('ZEN-002', property, true);
      }

      if (object == null) {
        return undefined;
      }

      return (object as any)[property];
    }

    // ───────────────────────────────────────────────
    // CallExpression: فراخوانی تابع
    //
    // دو حالت:
    //   1) $func(args)            → this = undefined
    //   2) $obj.method(args)       → this = $obj
    //
    // در حالت دوم، اگر MemberExpression باشد، thisArg را روی
    // object اصلی تنظیم می‌کنیم تا method به درستی کار کند.
    // ───────────────────────────────────────────────
    case 'CallExpression': {
      let thisArg: any = undefined;

      // اگر callee یک MemberExpression است (مثل $obj.method)،
      // thisArg باید روی $obj تنظیم شود.
      if (node.callee.type === 'MemberExpression') {
        thisArg = evaluate(node.callee.object, context);
        // BUG-17 FIX (v1.2.2): optional chaining short-circuit. اگر object
        // null/undefined باشد و callee یک MemberExpression با optional flag
        // باشد، کل فراخوانی باید undefined برگرداند (مثل JavaScript `obj?.method()`).
        // بدون این short-circuit، evaluate(node.callee) در حالت null object
        // undefined برمی‌گرداند و سپس `typeof callee !== 'function'` پرتاب
        // می‌کرد که رفتار اشتباهی برای optional chaining است.
        if (thisArg == null && (node.callee as any).optional === true) {
          return undefined;
        }
      }

      const callee = evaluate(node.callee, context);

      if (typeof callee !== 'function') {
        // FIX (B-10): بهبود پیام خطا وقتی object null/undefined است.
        if (thisArg == null) {
          const propName = (node.callee as any).property?.name || 'unknown';
          throw new Error(
            `Cannot read properties of ${thisArg === null ? 'null' : 'undefined'} (reading '${propName}').`,
          );
        }
        throw new Error(
          `Expression is not a function: tried to call '${(node.callee as any).name || node.callee.type}'.`,
        );
      }

      const args = node.args.map((arg) => evaluate(arg, context));
      return callee.apply(thisArg, args);
    }

    // ───────────────────────────────────────────────
    // BinaryExpression: عملگرهای دوتایی (+ - * / % == === != !== < > <= >=)
    //
    // نکته: `+` هم برای جمع عددی و هم برای الحاق رشته‌ای استفاده می‌شود
    // که رفتار JavaScript را دقیقاً شبیه‌سازی می‌کند (1 + "2" = "12").
    // ───────────────────────────────────────────────
    case 'BinaryExpression': {
      const left = evaluate(node.left, context);
      const right = evaluate(node.right, context);

      switch (node.operator) {
        case '+': return left + right;
        case '-': return left - right;
        case '*': return left * right;
        case '/': return left / right;
        case '%': return left % right;
        case '==': return left == right;
        case '===': return left === right;
        case '!=': return left != right;
        case '!==': return left !== right;
        case '<': return left < right;
        case '>': return left > right;
        case '<=': return left <= right;
        case '>=': return left >= right;
        default:
          throw new Error(`Unknown binary operator: '${node.operator}'`);
      }
    }

    // ───────────────────────────────────────────────
    // LogicalExpression: عملگرهای منطقی (&& ||)
    //
    // Short-circuit evaluation:
    //   - false && anything → false (right ارزیابی نمی‌شود)
    //   - true || anything  → true  (right ارزیابی نمی‌شود)
    // ───────────────────────────────────────────────
    case 'NullishCoalescing': {
      const left = evaluate(node.left, context);
      return (left === null || left === undefined) ? evaluate(node.right, context) : left;
    }

    case 'LogicalExpression': {
      const left = evaluate(node.left, context);

      if (node.operator === '&&') {
        // اگر left falsy باشد، left برمی‌گردد (بدون ارزیابی right)
        return left && evaluate(node.right, context);
      }
      if (node.operator === '||') {
        // اگر left truthy باشد، left برمی‌گردد (بدون ارزیابی right)
        return left || evaluate(node.right, context);
      }

      throw new Error(`Unknown logical operator: '${node.operator}'`);
    }

    // ───────────────────────────────────────────────
    // UnaryExpression: عملگرهای یکانی (! -)
    // ───────────────────────────────────────────────
    case 'UnaryExpression': {
      const arg = evaluate(node.argument, context);
      if (node.operator === '!') return !arg;
      if (node.operator === '-') return -arg;
      if (node.operator === '+') return +arg;
      throw new Error(`Unknown unary operator: '${node.operator}'`);
    }

    // ───────────────────────────────────────────────
    // ConditionalExpression: عملگر سه‌تایی (test ? consequent : alternate)
    //
    // اگر test truthy باشد، consequent برگردانده می‌شود، در غیر این صورت alternate.
    // فقط یکی از دو شاخه ارزیابی می‌شود (Short-circuit).
    // ───────────────────────────────────────────────
    case 'ConditionalExpression': {
      return evaluate(node.test, context)
        ? evaluate(node.consequent, context)
        : evaluate(node.alternate, context);
    }

    // ───────────────────────────────────────────────
    // ObjectExpression: { key: value, ... }
    //
    // هر property ارزیابی می‌شود و یک آبجکت جدید ساخته می‌شود.
    //
    // نکته‌ی مهم: در هر بار evaluate، یک آبجکت جدید ساخته می‌شود
    // تا Reference تغییر کند. این برای reactive systems مهم است
    // چون bind.ts با typeof === 'object' چک می‌کند و تغییرات
    // آبجکت جدید را شناسایی می‌کند.
    // ───────────────────────────────────────────────
    case 'ArrowFunction': {
      return (...args: any[]) => {
        const localCtx: Record<string, any> = Object.create(context);
        node.params.forEach((p, i) => { localCtx[p.name] = args[i]; });
        return evaluate(node.body, localCtx);
      };
    }

    case 'ArrayExpression':
      return node.elements.map(el => evaluate(el, context));

    case 'ObjectExpression': {
      const result: Record<string, any> = {};
      for (const prop of node.properties) {
        result[prop.key] = evaluate(prop.value, context);
      }
      return result;
    }

    // برای Type Safety: اگر type جدیدی به AST اضافه شد و فراموش کردیم handle کنیم
    default:
      throw new Error(`Unknown AST node type: '${(node as any).type}'`);
  }
}
