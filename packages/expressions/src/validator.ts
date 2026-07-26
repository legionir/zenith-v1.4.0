// packages/expressions/src/validator.ts
//
// Validator: مرحله‌ی امنیتی کامپایل Expression.
// قبل از Cache کردن AST، آن را بررسی می‌کند تا مطمئن شویم
// هیچ دسترسی خطرناکی به منابع حساس وجود ندارد.
//
// این لایه‌ی امنیتی **جایگزین** sandbox مرورگر نیست، بلکه یک لایه‌ی
// دفاعی عمقی (Defense in Depth) است. حتی اگر Context اشتباهی
// به فریم‌ورک داده شود، این Validator از اکثر حملات رایج جلوگیری می‌کند.
//
// حملات رایج که این Validator بلاک می‌کند:
//   - window, document, globalThis, self        → دسترسی به Browser APIs
//   - eval, Function                              → Dynamic Code Execution
//   - constructor, __proto__, prototype          → Prototype Pollution
//   - arguments, caller, callee                   → Function internals

import { ASTNode } from './parser';
// FIX (v1.2.8): P1-1 — Import the shared FORBIDDEN_PROPERTIES list so the
// validator and evaluator stay in sync. Previously the validator only
// blocked [constructor, __proto__, prototype] while the evaluator blocked
// a larger list — leaving holes for __lookupGetter__/__lookupSetter__ etc.
import {
  FORBIDDEN_PROPERTIES,
  FORBIDDEN_IDENTIFIERS,
  isForbiddenIdentifier,
  sanitizeExpression,
} from './security-constants';

/**
 * لیست Identifierهای ممنوعه (legacy alias — kept for compatibility).
 *
 * اگر کاربری در Expression بنویسد `window.location.href` یا `eval(...)`،
 * این لیست بلاکش می‌کند.
 *
 * نکته‌ی امنیتی مهم (v0.4.0 — fuzzing finding):
 *   `constructor`، `__proto__` و `prototype` نیز در این لیست اضافه شدند.
 *   دلیل: اگرچه این‌ها عمدتاً به‌عنوان پراپرتی (در MemberExpression) خطرناک‌اند،
 *   اما به‌عنوان standalone Identifier هم خطرناک‌اند. چون evaluator از عملگر `in`
 *   استفاده می‌کند که در prototype chain هم جستجو می‌کند، `constructor` و
 *   `__proto__` به‌طور پیش‌فرض در هر contextی یافت می‌شوند (ارث‌بری از
 *   Object.prototype). بدون این بلاک، expression تک‌توکنی `constructor` به
 *   کاربر ارجاع به `Object` (constructor function) می‌دهد که یک sandbox escape است.
 */

/**
 * لیست پراپرتی‌های ممنوعه در MemberExpression.
 *
 * FIX (v1.2.8): P1-1 — این لیست اکنون از `./security-constants` ایمپورت
 * می‌شود تا با Evaluator هماهنگ بماند. قبلاً این دو لیست drift کرده بودند
 * و Validator فقط constructor/__proto__/prototype را بلاک می‌کرد در حالی
 * که Evaluator __defineGetter__/__defineSetter__ را هم بلاک می‌کرد —
 * که باعث می‌شد __lookupGetter__/__lookupSetter__ از Validator عبور کنند.
 *
 * این لیست بلاک می‌کند:
 *   - obj.constructor       → می‌تواند به Function prototype دسترسی پیدا کند
 *   - obj.__proto__         → می‌تواند Prototype Chain را تغییر دهد
 *   - obj.prototype         → می‌تواند به Prototype دسترسی پیدا کند
 *   - obj.__defineGetter__  → نصب getter دلخواه (sandbox escape)
 *   - obj.__defineSetter__  → نصب setter دلخواه (sandbox escape)
 *   - obj.__lookupGetter__  → نشت getter function references
 *   - obj.__lookupSetter__  → نشت setter function references
 */
// FORBIDDEN_PROPERTIES is imported above from ./security-constants.

/**
 * اعتبارسنجی امنیتی یک AST.
 *
 * این تابع به صورت بازگشتی تمام نودهای AST را بررسی می‌کند و
 * در صورت یافتن هر گونه دسترسی ممنوعه، خطا پرتاب می‌کند.
 *
 * @throws Error اگر دسترسی ممنوعه‌ای یافت شود.
 */
export function validate(node: ASTNode): void {
  switch (node.type) {
    // ───────────────────────────────────────────────
    // Identifier: بررسی نام متغیر در Context
    // ───────────────────────────────────────────────
    case 'Identifier':
      if (isForbiddenIdentifier(node.name)) {
        throw new Error(
          `Security Alert: Access to '${node.name}' is forbidden. ` +
            `This is a restricted global identifier.`,
        );
      }
      break;

    // ───────────────────────────────────────────────
    // MemberExpression: بررسی شیء و پراپرتی
    //
    // - شیء: به صورت بازگشتی validate می‌شود.
    // - اگر computed نباشد (a.b)، نام پراپرتی چک می‌شود.
    // - اگر computed باشد (a[b]):
    //     - اگر property یک Literal string باشد (مثل a['__proto__'])،
    //       مقدار آن چک می‌شود (Defense in Depth برای Prototype Pollution).
    //     - در غیر این صورت، خود expression پراپرتی بازگشتی validate می‌شود.
    //
    // نکته‌ی امنیتی مهم (فاز ۹):
    //   در حالت computed با Literal، ما می‌توانیم در زمان compile تشخیص دهیم
    //   که کاربر نوشته `obj['__proto__']` یا `obj['constructor']`. این یک
    //   حمله‌ی رایج برای Prototype Pollution است و باید بلاک شود.
    // ───────────────────────────────────────────────
    case 'MemberExpression':
      validate(node.object);

      // فقط برای dot notation (a.b) نام پراپرتی را چک می‌کنیم.
      if (!node.computed && node.property.type === 'Identifier') {
        const propertyName = node.property.name;
        if (FORBIDDEN_PROPERTIES.includes(propertyName)) {
          throw new Error(
            `Security Alert: Access to property '${propertyName}' is forbidden. ` +
              `This property can be used for prototype pollution attacks.`,
          );
        }
      }

      // برای bracket notation با Literal string (مثل a['__proto__'])،
      // مقدار string را چک می‌کنیم.
      // این حمله‌ی رایجی است که در آن هکر سعی می‌کند با bracket notation
      // از فیلتر dot notation دور بزند.
      if (node.computed && node.property.type === 'Literal') {
        const literalValue = node.property.value;
        if (typeof literalValue === 'string' && FORBIDDEN_PROPERTIES.includes(literalValue)) {
          throw new Error(
            `Security Alert: Access to property '${literalValue}' via bracket notation is forbidden. ` +
              `This property can be used for prototype pollution attacks.`,
          );
        }
      }

      // در حالت computed، خود expression پراپرتی را validate می‌کنیم
      // (این شامل Literal هم می‌شود، اما validate روی Literal no-op است).
      if (node.computed) {
        validate(node.property);
      }
      break;

    // ───────────────────────────────────────────────
    // CallExpression: فراخوانی توابع
    //
    // هم callee و هم args باید validate شوند.
    // ───────────────────────────────────────────────
    case 'CallExpression':
      validate(node.callee);
      node.args.forEach(validate);
      break;

    // ───────────────────────────────────────────────
    // BinaryExpression و LogicalExpression: دو عملوند
    // ───────────────────────────────────────────────
    case 'BinaryExpression':
    case 'LogicalExpression':
    case 'NullishCoalescing':
      validate(node.left);
      validate(node.right);
      break;

    // ───────────────────────────────────────────────
    // UnaryExpression: یک عملوند
    // ───────────────────────────────────────────────
    case 'UnaryExpression':
      validate(node.argument);
      break;

    // ───────────────────────────────────────────────
    // ConditionalExpression: سه بخش (test, consequent, alternate)
    // ───────────────────────────────────────────────
    case 'ConditionalExpression':
      validate(node.test);
      validate(node.consequent);
      validate(node.alternate);
      break;

    // ───────────────────────────────────────────────
    // ObjectExpression: { key: value, ... }
    //
    // فقط value ها validate می‌شوند. key ها string هستند
    // و نمی‌توانند expression باشند.
    // ───────────────────────────────────────────────
    case 'ArrayExpression':
      node.elements.forEach(el => validate(el));
      break;


    case 'ArrowFunction':
      node.params.forEach(p => {
        // BUG-18 FIX (v1.2.2): قبلاً فقط window/document/eval چک می‌شد. حالا
        // تمام FORBIDDEN_IDENTIFIERS چک می‌شوند تا یک arrow function نتواند
        // با shadowing یک global ممنوعه (مثل constructor، globalThis، self، ...)
        // از sandbox فرار کند. مثلاً `(constructor) => constructor.constructor('...')()`
        // می‌توانست به Function constructor دسترسی پیدا کند.
        if (isForbiddenIdentifier(p.name)) {
          throw new Error(`Security Alert: Arrow function parameter "${p.name}" shadows a forbidden global.`);
        }
      });
      validate(node.body);
      break;
    case 'ObjectExpression':
      node.properties.forEach((prop) => validate(prop.value));
      break;

    // Literal: هیچ نود فرزندی ندارد، نیازی به validate نیست
    case 'Literal':
      break;

    // Type Safety
    default:
      throw new Error(`Unknown AST node type during validation: '${(node as any).type}'`);
  }
}
