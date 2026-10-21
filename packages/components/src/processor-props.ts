// packages/components/src/processor-props.ts
//
// ساخت context محلی و props کامپوننت — استخراج مکانیکی از processor.ts بدون
// تغییر رفتار (#40، code-first: نوشته‌شده، اجرا نشده).

import { compileExpression } from '@zenith/expressions';
import { logger } from '@zenith/logger';


/**
 * پیشوند attribute برای Props از نوع Expression.
 *
 * مثال: `prop:title="$item.name"` → evaluateExpression("$item.name", parentContext)
 */
const PROP_PREFIX = 'prop:';

/**
 * نرمال‌سازی نام prop برای استفاده به‌عنوان Context key.
 *
 * HTML attribute names case-insensitive هستند و مرورگر (و jsdom) آن‌ها را
 * به lowercase تبدیل می‌کند. مثلا `prop:outerValue` در DOM به `prop:outervalue`
 * تبدیل می‌شود.
 *
 * راهکار: نام prop را همانطور که هست (lowercase) در Context قرار می‌دهیم.
 * کاربر باید در template هم همان نام را استفاده کند (مثلا `zen-text="$outervalue"`).
 *
 * نکته: نمی‌توانیم از kebab-case به camelCase تبدیل کنیم چون Expression Engine
 * `-` را به‌عنوان عملگر تفریق می‌شناسد. پس `prop:user-name` به `$user-name`
 * تبدیل می‌شود که در Expression Engine به `$user - name` parse می‌شود.
 *
 * برای props چندکلمه‌ای، از underscore استفاده کنید:
 *   prop:user_name → $user_name (در Expression Engine مجاز است)
 */
function normalizePropName(name: string): string {
  // نام را همانطور که هست برمی‌گردانیم (HTML آن را lowercase کرده است).
  return name;
}

/**
 * ساخت Context محلی کامپوننت.
 *
 * این تابع:
 *   1) یک آبجکت با prototype = parentContext می‌سازد (ارث‌بری کامل، حتی getter ها).
 *   2) Props را ارزیابی کرده و به‌صورت `$name` روی Context محلی قرار می‌دهد.
 *
 * نکته: Props باید اولویت بالاتر از parentContext داشته باشند. چون Context
 * محلی از Object.create(parentContext) ساخته شده، هر کلید جدید روی Context
 * محلی، کلید والد را shadow می‌کند (در prototype chain).
 *
 * @param el            تگ کامپوننت (مثل <app-product-card prop:id="product.id">).
 * @param parentContext Context والد (شامل getter های `$user`, `$product` و …).
 * @returns Context محلی کامپوننت.
 */
export function buildComponentContext(
  el: HTMLElement,
  parentContext: Record<string, unknown>,
): Record<string, unknown> {
  // ساخت Context با ارث‌بری از parent.
  // Object.create(parentContext) یک prototype chain می‌سازد که تمام getter های
  // والد (مثل `$product` از zen-for یا `$user` از createContext) را در دسترس
  // نگه می‌دارد.
  const localContext: Record<string, unknown> = Object.create(parentContext);

  for (const attr of Array.from(el.attributes)) {
    const attrName = attr.name;
    const attrValue = attr.value;

    // ── حالت ۱: prop:<name>="<expr>" → Expression ──
    // ارزیابی در parentContext (نه localContext، چون Props باید در محیط والد
    // ارزیابی شوند — مثلا `product.id` به `$product` از zen-for اشاره می‌کند).
    if (attrName.startsWith(PROP_PREFIX)) {
      const rawPropName = attrName.slice(PROP_PREFIX.length);
      if (rawPropName.length === 0) {
        logger.warn(`[Zenith] Empty prop name on <${el.tagName.toLowerCase()}>`);
        continue;
      }
      // نام prop را همانطور که هست استفاده می‌کنیم (HTML آن را lowercase کرده).
      // کاربر باید در template هم همان نام را استفاده کند.
      const propName = normalizePropName(rawPropName);

      // برای پشتیبانی از Reactivity، یک getter تعریف می‌کنیم که هر بار
      // Expression را در parentContext ارزیابی می‌کند. این یعنی اگر وابسته به
      // یک Signal باشد، آن Signal به‌صورت خودکار dependency tracking می‌شود
      // و وقتی Signal تغییر کند، effect دوباره اجرا می‌شود و prop جدید خوانده می‌شود.
      //
      // FEATURE (v1.0.0): compile-once — expr فقط یک‌بار parse می‌شود و closure
      // در getter ذخیره می‌شود. هر بار که prop خوانده می‌شود، فقط evaluate اجرا می‌شود.
      const expr = attrValue;
      const evalFn = compileExpression(expr);
      Object.defineProperty(localContext, `$${propName}`, {
        get: () => {
          try {
            return evalFn(parentContext);
          } catch (err) {
            logger.warn(
              `[Zenith] Failed to evaluate prop "${propName}"="${expr}" on ` +
                `<${el.tagName.toLowerCase()}>: ${(err as Error).message}.`,
            );
            return undefined;
          }
        },
        enumerable: true,
        configurable: true,
      });
      continue;
    }

    // ── نادیده گرفتن دایرکتیوهای zen-* ──
    // (zen-if, zen-for, zen-bind:*, zen-action, … باید توسط walker اصلی پردازش شوند،
    // نه به‌عنوان prop.)
    if (attrName.startsWith('zen-')) continue;

    // ── حالت ۲: <name>="literal" → literal string ──
    // attribute های معمولی به‌عنوان literal string به Context محلی اضافه می‌شوند.
    // این برای مقادیر ثابت مثل `theme="dark"` یا `variant="primary"` مفید است.
    const propName = normalizePropName(attrName);
    localContext[`$${propName}`] = attrValue;
  }

  return localContext;
}