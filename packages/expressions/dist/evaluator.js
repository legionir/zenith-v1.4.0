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
// FIX (v1.2.8): P1-1 — Import the shared FORBIDDEN_PROPERTIES list so the
// runtime guard and the compile-time validator stay in sync. The evaluator
// previously had its own FORBIDDEN_PROPERTIES_RT that drifted from the
// validator's list (the validator was missing __defineGetter__ etc.).
import { FORBIDDEN_PROPERTIES } from './security-constants.js';
/**
 * Runtime guard reference — alias of the shared FORBIDDEN_PROPERTIES list.
 *
 * SECURITY (v0.5.0): Validator only checks statically at compile time. If a
 * property is accessed with a dynamic key (e.g. `$obj[$key]` where `$key`
 * is `'constructor'` at runtime), the validator cannot predict it. This
 * list acts as Defense in Depth: the evaluator re-checks at runtime.
 *
 * FIX (v1.2.8): P1-1 — Now uses the same shared FORBIDDEN_PROPERTIES list
 * as the validator. No drift between the two layers.
 */
const FORBIDDEN_PROPERTIES_RT = FORBIDDEN_PROPERTIES;
// FEATURE (v1.0.0): ادغام کتابخانه‌ی خطاها برای پیام‌های بهبودیافته.
import { variableNotDefinedError, securityError } from '@zenith/errors';
// FIX (v1.2.9): BUG-02 — Module-level OBJECT_PROTO_BUILTINS (was per-call).
const OBJECT_PROTO_BUILTINS = new Set([
    'constructor', 'toString', 'hasOwnProperty', 'valueOf',
    'isPrototypeOf', 'propertyIsEnumerable', 'toLocaleString',
    '__proto__', '__defineGetter__', '__defineSetter__',
    '__lookupGetter__', '__lookupSetter__',
]);
/**
 * محاسبه‌ی یک AST Node در برابر یک Context.
 *
 * @param node نود AST.
 * @param context آبجکت Context (شامل مقادیر متغیرها).
 * @returns نتیجه‌ی محاسبه.
 */
export function evaluate(node, context) {
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
            // FIX (v1.2.9): OBJECT_PROTO_BUILTINS is now module-level.
            const isInContext = node.name in context;
            const isOwnProp = Object.prototype.hasOwnProperty.call(context, node.name);
            const isProtoBuiltin = OBJECT_PROTO_BUILTINS.has(node.name) && !isOwnProp;
            if (!isInContext || isProtoBuiltin) {
                const availableVars = Object.keys(context).filter(k => k.startsWith('$') || !k.startsWith('__'));
                throw variableNotDefinedError(node.name, availableVars);
            }
            return context[node.name];
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
                : node.property.name;
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
            if (object == null) {
                return undefined;
            }
            return object[property];
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
            let thisArg = undefined;
            // اگر callee یک MemberExpression است (مثل $obj.method)،
            // thisArg باید روی $obj تنظیم شود.
            if (node.callee.type === 'MemberExpression') {
                thisArg = evaluate(node.callee.object, context);
                // BUG-17 FIX (v1.2.2): optional chaining short-circuit. اگر object
                // null/undefined باشد و callee optional flag داشته باشد، undefined برگردان.
                if (thisArg == null && node.callee.optional === true) {
                    return undefined;
                }
            }
            const callee = evaluate(node.callee, context);
            if (typeof callee !== 'function') {
                throw new Error(`Expression is not a function: tried to call '${node.callee.type}'.`);
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
            if (node.operator === '!')
                return !arg;
            if (node.operator === '-')
                return -arg;
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
            return (...args) => {
                const localCtx = Object.create(context);
                node.params.forEach((p, i) => { localCtx[p.name] = args[i]; });
                return evaluate(node.body, localCtx);
            };
        }
        case 'ArrayExpression':
            return node.elements.map(el => evaluate(el, context));
        case 'ObjectExpression': {
            const result = {};
            for (const prop of node.properties) {
                result[prop.key] = evaluate(prop.value, context);
            }
            return result;
        }
        // برای Type Safety: اگر type جدیدی به AST اضافه شد و فراموش کردیم handle کنیم
        default:
            throw new Error(`Unknown AST node type: '${node.type}'`);
    }
}
//# sourceMappingURL=evaluator.js.map