// packages/components/src/processor.ts
//
// پردازشگر کامپوننت‌ها — قلب فاز ۶.
//
// این فایل یک تگ سفارشی (مثل <app-product-card>) را به این شکل پردازش می‌کند:
//   1) قالب را از Registry می‌گیرد و clone می‌کند.
//   2) Props را از attribute های تگ جمع‌آوری می‌کند.
//   3) Slotها را با محتوای داخل تگ پر می‌کند.
//   4) Context محلی کامپوننت را می‌سازد (ارث‌بری از parent + Props).
//   5) محتوای کامپوننت را با Context محلی walk می‌کند.
//
// ── Props ──
// دو نوع attribute روی تگ کامپوننت داریم:
//   1) prop:<name>="<expr>"  → یک Expression که در parentContext ارزیابی می‌شود.
//                              نتیجه به‌صورت `$<name>` در Context محلی قرار می‌گیرد.
//   2) <name>="literal"      → یک رشته‌ی ثابت. به‌صورت `$<name>` در Context محلی قرار می‌گیرد.
//
// مثال:
//   <app-product-card prop:id="product.id" prop:name="product.name" theme="dark">
//   → در Context محلی کامپوننت:
//       $id   = parentContext.$product.id   (از ارزیابی expression)
//       $name = parentContext.$product.name (از ارزیابی expression)
//       $theme = "dark"                     (literal string)
//
// ── Slots ──
//   - <slot></slot>               → slot پیش‌فرض (محتوای بدون `slot` attribute).
//   - <slot name="actions"></slot> → slot نام‌گذاری شده.
//   - محتوای داخل تگ کامپوننت با `slot="actions"` به این slot می‌رود.
//
// ── Context ارث‌بری ──
//   Context محلی با `Object.create(parentContext)` ساخته می‌شود تا:
//     - تمام getter های والد (مثل `$user`, `$product` از zen-for) در دسترس باشند.
//     - Props جدید به‌صورت `$name` روی Context محلی override شوند.
//     - هیچ کپی سطحی انجام نشود (getter های reactive حفظ می‌شوند).
import { compileExpression } from '@zenith/expressions';
import { getComponent } from './registry.js';
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
function normalizePropName(name) {
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
function buildComponentContext(el, parentContext) {
    // ساخت Context با ارث‌بری از parent.
    // Object.create(parentContext) یک prototype chain می‌سازد که تمام getter های
    // والد (مثل `$product` از zen-for یا `$user` از createContext) را در دسترس
    // نگه می‌دارد.
    const localContext = Object.create(parentContext);
    for (const attr of Array.from(el.attributes)) {
        const attrName = attr.name;
        const attrValue = attr.value;
        // ── حالت ۱: prop:<name>="<expr>" → Expression ──
        // ارزیابی در parentContext (نه localContext، چون Props باید در محیط والد
        // ارزیابی شوند — مثلا `product.id` به `$product` از zen-for اشاره می‌کند).
        if (attrName.startsWith(PROP_PREFIX)) {
            const rawPropName = attrName.slice(PROP_PREFIX.length);
            if (rawPropName.length === 0) {
                console.warn(`[Zenith] Empty prop name on <${el.tagName.toLowerCase()}>`);
                continue;
            }
            // نام prop را همانطور که هست استفاده می‌کنیم (HTML آن را lowercase کرده).
            // کاربر باید در template هم همان نام را استفاده کند.
            const propName = normalizePropName(rawPropName);
            // FEATURE (v1.0.0): compile-once — expr فقط یک‌بار parse می‌شود و closure
            // در getter ذخیره می‌شود.
            const expr = attrValue;
            const evalFn = compileExpression(expr);
            Object.defineProperty(localContext, `$${propName}`, {
                get: () => {
                    try {
                        return evalFn(parentContext);
                    }
                    catch (err) {
                        console.warn(`[Zenith] Failed to evaluate prop "${propName}"="${expr}" on ` +
                            `<${el.tagName.toLowerCase()}>: ${err.message}.`);
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
        if (attrName.startsWith('zen-'))
            continue;
        // ── حالت ۲: <name>="literal" → literal string ──
        // attribute های معمولی به‌عنوان literal string به Context محلی اضافه می‌شوند.
        // این برای مقادیر ثابت مثل `theme="dark"` یا `variant="primary"` مفید است.
        const propName = normalizePropName(attrName);
        localContext[`$${propName}`] = attrValue;
    }
    return localContext;
}
/**
 * پر کردن slotهای داخل قالب کامپوننت با محتوای تگ کامپوننت.
 *
 * الگوریتم:
 *   1) محتوای داخل تگ کامپوننت را به دو گروه تقسیم می‌کنیم:
 *        - عناصر با `slot="name"` → برای slot نام‌گذاری شده.
 *        - سایر عناصر → برای slot پیش‌فرض.
 *   2) داخل قالب کامپوننت، تمام <slot> را پیدا می‌کنیم.
 *   3) هر <slot> را با محتوای مربوطه جایگزین می‌کنیم.
 *
 * نکته‌ی مهم: محتوای slot باید به همان Context والد متروج شود، نه Context
 * محلی کامپوننت. این منطق در `processChildren` callback پیاده‌سازی می‌شود
 * (walker والد آن را فراخوانی می‌کند).
 *
 * @param content      DocumentFragment کلون‌شده از قالب کامپوننت.
 * @param slotContents محتوای slotها (از buildSlotContents).
 */
function fillSlots(content, slotContents) {
    const slots = content.querySelectorAll('slot');
    // اگر هیچ slotی در قالب نبود، چیزی برای پر کردن نیست.
    if (slots.length === 0)
        return;
    slots.forEach((slotEl) => {
        const slotName = slotEl.getAttribute('name') || 'default';
        const replacements = slotContents.get(slotName) || [];
        if (replacements.length > 0) {
            const parent = slotEl.parentNode;
            if (!parent) {
                console.warn('[Zenith] <slot> has no parent node — cannot fill.');
                return;
            }
            // درج محتوا قبل از <slot>، به ترتیب.
            for (const rep of replacements) {
                parent.insertBefore(rep, slotEl);
            }
        }
        // حذف تگ <slot> (چه پر شد، چه نشد).
        slotEl.remove();
    });
}
/**
 * جمع‌آوری محتوای slot از داخل تگ کامپوننت.
 *
 * این تابع فرزندان تگ کامپوننت را به دو دسته تقسیم می‌کند:
 *   - عناصر با `slot="name"` → لیست برای slot نام‌گذاری شده.
 *   - سایر عناصر → لیست برای slot پیش‌فرض.
 *
 * نکته: این تابع فرزندان را از تگ کامپوننت جدا (detach) نمی‌کند — این کار
 * بعداً توسط insertBefore در fillSlots انجام می‌شود (وقتی به parent جدید
 * منتقل می‌شوند، خودکار از parent قبلی detach می‌شوند).
 *
 * @param el تگ کامپوننت.
 * @returns Map از نام slot به آرایه‌ی عناصر.
 */
function buildSlotContents(el) {
    const slotContents = new Map();
    // مقدار اولیه برای slot پیش‌فرض (حتی اگر خالی باشد).
    slotContents.set('default', []);
    for (const child of Array.from(el.children)) {
        const slotName = child.getAttribute('slot') || 'default';
        if (!slotContents.has(slotName)) {
            slotContents.set(slotName, []);
        }
        slotContents.get(slotName).push(child);
    }
    return slotContents;
}
/**
 * پردازش یک تگ کامپوننت سفارشی.
 *
 * این تابع نقطه‌ی ورود اصلی سیستم کامپوننت‌هاست. توسط walker فراخوانی
 * می‌شود وقتی به تگی می‌رسد که در Registry ثبت شده است.
 *
 * مراحل:
 *   1) قالب را از Registry می‌گیرد. اگر نبود، return (نادیده گرفته می‌شود).
 *   2) Context محلی را با ارث‌بری از parentContext و افزودن Props می‌سازد.
 *   3) محتوای slot را از داخل تگ جمع‌آوری می‌کند.
 *   4) قالب را clone کرده و slotها را پر می‌کند.
 *   5) محتوای تگ کامپوننت را با محتوای قالب جایگزین می‌کند.
 *   6) فرزندان کامپوننت را با Context محلی walk می‌کند (به‌جز slot content
 *      که با Context والد walk می‌شود).
 *
 * @param el              تگ کامپوننت.
 * @param parentContext   Context والد.
 * @param processChildren callback برای walk فرزندان.
 *                        امضا: (node, context, disposes, isSlotContent) => void
 *                        - isSlotContent=true: محتوا با parentContext walk می‌شود.
 *                        - isSlotContent=false: محتوا با localContext walk می‌شود.
 * @param disposes        آرایه‌ی dispose functions (برای Memory Leak Prevention).
 */
export function processComponent(el, parentContext, processChildren, disposes) {
    const tagName = el.tagName.toLowerCase();
    const template = getComponent(tagName);
    if (!template) {
        // اگر کامپوننت ثبت نشده بود، چیزی برای پردازش نیست.
        // walker هم که این تابع را فراخوانی کرده، return می‌کند.
        return;
    }
    // ── ۱. ساخت Context محلی (ارث‌بری از والد + Props) ──
    const localContext = buildComponentContext(el, parentContext);
    // ── ۲. جمع‌آوری محتوای slot از داخل تگ کامپوننت ──
    // این کار را قبل از clone و clear کردن innerHTML انجام می‌دهیم چون بعد از
    // آن، فرزندان از بین می‌روند.
    const slotContents = buildSlotContents(el);
    // برای هر فرزند slot، یک flag ذخیره می‌کنیم تا بعداً بتوانیم تشخیص دهیم
    // با کدام Context باید walk شوند (parent برای slot content، local برای
    // محتوای خود قالب).
    const slotNodes = new Set();
    for (const nodes of slotContents.values()) {
        for (const node of nodes)
            slotNodes.add(node);
    }
    // ── ۳. کلون کردن محتوای قالب ──
    const content = template.content.cloneNode(true);
    // ── ۴. پر کردن slotها ──
    fillSlots(content, slotContents);
    // ── ۵. جایگزینی محتوای تگ کامپوننت با محتوای قالب ──
    // ابتدا innerHTML را خالی می‌کنیم (اگر محتوای slot نبود، حذف می‌شود).
    // سپس محتوای قالب را درج می‌کنیم.
    el.innerHTML = '';
    el.appendChild(content);
    // ── ۶. Walk فرزندان با Context مناسب ──
    // دو نوع فرزند داریم:
    //   a) فرزندان قالب کامپوننت → با localContext (شامل Props) walk می‌شوند.
    //   b) فرزندان slot content → با parentContext (Context محل استفاده) walk می‌شوند.
    //
    // این تفکیک مهم است چون اگر slot content با localContext walk شود،
    // به Props دسترسی دارد که منطقی نیست (Props فقط برای قالب کامپوننت هستند).
    // slot content باید در محیطی که کامپوننت استفاده شده، ارزیابی شود.
    for (const child of Array.from(el.children)) {
        const childEl = child;
        const isSlot = slotNodes.has(childEl);
        processChildren(childEl, isSlot ? parentContext : localContext, disposes, isSlot);
    }
}
//# sourceMappingURL=processor.js.map