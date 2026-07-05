// packages/security/src/sanitizer.ts
//
// Sanitizer — قلب امنیتی فاز ۹.
//
// این ماژول رشته‌ی HTML را می‌گیرد، آن را توسط `DOMParser` (که هیچ
// اسکریپتی را اجرا نمی‌کند) Parse می‌کند، تگ‌ها و اتریبیوت‌های خطرناک را
// حذف می‌کند، و خروجی امن برمی‌گرداند.
//
// ── چرا DOMParser؟ ──
//   - برخلاف `innerHTML`، هیچ اسکریپتی را اجرا نمی‌کند.
//   - برخلاف `template.innerHTML`، namespace های SVG و MathML را به‌درستی هندل می‌کند.
//   - در محیط مرورگر به‌طور بومی موجود است (نباید polyfill کنیم).
//
// ── حملاتی که بلاک می‌شوند ──
//   1) <script> tags                         → حذف کامل
//   2) <iframe>, <object>, <embed>           → حذف کامل
//   3) Event handlers (onclick, onerror, …)  → حذف attribute
//   4) javascript: URL                       → حذف href/src
//   5) data: URL در برخی زمینه‌ها            → حذف href/src
//   6) <form>                                → (به‌صورت پیش‌فرض حذف، قابل تنظیم)
//   7) <style> با expression() یا url(javascript:) → حذف
//   8) <svg> با <script> داخلی               → پاکسازی فرزندان
//   9) Prototype Pollution در attribute names → حذف
//  10) Comment nodes با payloads مخرب         → حذف
//
// ── Defense in Depth ──
// این Sanitizer یک لایه‌ی دفاعی است، نه تنها لایه. همیشه باید:
//   - روی سرور هم HTML را sanitize کنید.
//   - از Content-Security-Policy (CSP) استفاده کنید.
//   - ورودی کاربر را قبل از ذخیره در دیتابیس اعتبارسنجی کنید.
/**
 * تگ‌هایی که کاملاً ممنوع هستند (حذف کامل).
 *
 * این تگ‌ها یا می‌توانند کد اجرا کنند، یا برای حملات XSS استفاده شوند.
 */
const FORBIDDEN_TAGS = new Set([
    'SCRIPT', // اجرای کد
    'IFRAME', // بارگذاری صفحات خارجی
    'OBJECT', // بارگذاری plugin ها
    'EMBED', // بارگذاری plugin ها
    'APPLET', // java applet (قدیمی اما خطرناک)
    'LINK', // بارگذاری استایل یا prefetch
    'META', // meta refresh, CSP bypass
    'BASE', // تغییر base URL
    'STYLE', // CSS-based attacks (expression(), url(javascript:))
    'FORM', // form hijacking (قابل تنظیم در آینده)
    'NOSCRIPT', // محتوای fallback مخرب
    'FRAMESET', // قدیمی اما خطرناک
    'FRAME', // قدیمی اما خطرناک
    'XML', // XML processing instructions
    // SEC FIX (v1.2.6): SEC-A3 — block SVG/SMIL animation tags. These can
    // animate attribute values (e.g. xlink:href) at runtime to smuggle
    // dangerous payloads past static sanitization, and `<set>` can flip a
    // benign attribute into a `javascript:` URL after page load.
    'ANIMATE',
    'ANIMATEMOTION',
    'ANIMATETRANSFORM',
    'SET',
]);
/**
 * اتریبیوت‌هایی که با on شروع می‌شوند (onclick, onerror, onload, …).
 *
 * این regex case-insensitive است تا ONCLICK هم بلاک شود.
 */
const EVENT_ATTR_REGEX = /^on/i;
/**
 * پروتکل‌های خطرناک در href و src.
 *
 * نکته: ما اینها را با case-insensitive و بعد از trim checking می‌کنیم.
 * همچنین فضای خالی و کاراکترهای کنترلی را هم حذف می‌کنیم چون هکر می‌نویسد
 * `java\tscript:` یا `java script:`.
 */
const DANGEROUS_PROTOCOLS = ['javascript:', 'vbscript:', 'data:'];
/**
 * پراپرتی‌های ممنوعه در attribute names (Prototype Pollution).
 */
const FORBIDDEN_ATTR_NAMES = ['__proto__', 'constructor', 'prototype'];
/**
 * پاکسازی یک رشته‌ی HTML.
 *
 * این تابع:
 *   1) رشته را با DOMParser parse می‌کند (بدون اجرای اسکریپت).
 *   2) به‌صورت بازگشتی تمام نودها را پاکسازی می‌کند.
 *   3) خروجی را به‌صورت رشته‌ی HTML برمی‌گرداند.
 *
 * @param dirty رشته‌ی HTML نامطمئن.
 * @returns رشته‌ی HTML پاکسازی‌شده.
 */
export function sanitizeHTML(dirty) {
    if (!dirty || typeof dirty !== 'string')
        return '';
    // FIX (v1.2.3): SSR guard — اگر DOMParser در دسترس نباشد، رشته‌ی خالی برگردان.
    if (typeof DOMParser === 'undefined')
        return '';
    // استفاده از DOMParser برای parse کردن HTML.
    // نکته: DOMParser اسکریپت‌ها را اجرا نمی‌کند، حتی اگر <script> در HTML باشد.
    // این یک ویژگی ذاتی DOMParser است که آن را برای sanitization ایمن می‌کند.
    const parser = new DOMParser();
    const doc = parser.parseFromString(dirty, 'text/html');
    // BUG-10 FIX (v1.2.2): doc.body می‌تواند null باشد وقتی HTML شامل <frameset>
    // است. قبلاً TypeError می‌داد. حالا از documentElement به‌عنوان fallback
    // استفاده می‌کنیم.
    const root = doc.body || doc.documentElement;
    cleanNode(root);
    return root.innerHTML;
}
/**
 * پاکسازی بازگشتی یک نود DOM.
 *
 * این تابع:
 *   1) تگ‌های ممنوع را حذف می‌کند.
 *   2) اتریبیوت‌های خطرناک را حذف می‌کند.
 *   3) فرزندان را به‌صورت بازگشتی پاکسازی می‌کند.
 *
 * @param node نودی که باید پاکسازی شود.
 */
function cleanNode(node) {
    // فقط Element Nodes را process می‌کنیم.
    if (node.nodeType !== Node.ELEMENT_NODE) {
        // Comment nodes را حذف می‌کنیم چون می‌توانند payloads مخرب پنهان کنند
        // (مخصوصاً در IE که comment ها را parse می‌کند).
        if (node.nodeType === Node.COMMENT_NODE) {
            node.parentNode?.removeChild(node);
        }
        return;
    }
    const el = node;
    const tagName = el.tagName.toUpperCase();
    // ── ۱. حذف تگ‌های کاملاً ممنوع ──
    if (FORBIDDEN_TAGS.has(tagName)) {
        el.parentNode?.removeChild(el);
        return;
    }
    // ── ۲. بررسی اتریبیوت‌ها ──
    // Array.from برای جلوگیری از تغییر در حین iteration.
    // FIX (v1.2.3): pass el برای data:image/ check روی IMG/SOURCE.
    for (const attr of Array.from(el.attributes)) {
        if (isAttributeDangerous(attr.name, attr.value, el)) {
            el.removeAttribute(attr.name);
        }
    }
    // ── ۳. پاکسازی فرزندان (به‌صورت بازگشتی) ──
    // Array.from برای جلوگیری از تغییر در حین iteration (چون ممکن است
    // فرزندی حذف شود).
    for (const child of Array.from(el.childNodes)) {
        cleanNode(child);
    }
    // FIX (v1.2.3): TEMPLATE content هم باید پاکسازی شود.
    if (tagName === 'TEMPLATE') {
        const content = el.content;
        if (content) {
            for (const child of Array.from(content.childNodes)) {
                cleanNode(child);
            }
        }
    }
}
/**
 * بررسی اینکه آیا یک اتریبیوت خطرناک است.
 *
 * @param attrName  نام اتریبیوت.
 * @param attrValue مقدار اتریبیوت.
 * @returns true اگر اتریبیوت خطرناک است و باید حذف شود.
 */
function isAttributeDangerous(attrName, attrValue, el) {
    const lowerName = attrName.toLowerCase();
    // ── ۱. Event handler ها (onclick, onerror, …) ──
    if (EVENT_ATTR_REGEX.test(lowerName)) {
        return true;
    }
    // ── ۲. Prototype Pollution در attribute name ──
    if (FORBIDDEN_ATTR_NAMES.some(name => lowerName.includes(name))) {
        return true;
    }
    // ── ۳. پروتکل‌های خطرناک در URL-bearing attribute ها ──
    // FIX (v1.2.3): srcset، cite، poster، background هم به لیست اضافه شدند.
    if (lowerName === 'href' ||
        lowerName === 'src' ||
        lowerName === 'action' ||
        lowerName === 'formaction' ||
        lowerName === 'xlink:href' ||
        lowerName === 'data' ||
        lowerName === 'srcset' ||
        lowerName === 'cite' ||
        lowerName === 'poster' ||
        lowerName === 'background'
    ) {
        // FIX (v1.2.3): اجازه‌ی `data:image/...` برای src روی <img> و <source>.
        if (lowerName === 'src' && el) {
            const tag = el.tagName.toUpperCase();
            if (tag === 'IMG' || tag === 'SOURCE') {
                if (isDataImage(attrValue))
                    return false;
            }
        }
        // SEC FIX (v1.2.6): SEC-A4 — srcset is a comma-separated list of
        // "<url> <descriptor>" pairs. A naive hasDangerousProtocol(attrValue)
        // only inspects the very start of the whole string, so the second URL
        // in `/a.jpg, javascript:alert(1)` would slip through. Split on
        // commas and check every URL individually.
        if (lowerName === 'srcset') {
            const candidates = String(attrValue || '').split(',');
            for (const candidate of candidates) {
                const urlPart = candidate.trim().split(/\s+/)[0];
                if (hasDangerousProtocol(urlPart)) {
                    return true;
                }
            }
        }
        else if (hasDangerousProtocol(attrValue)) {
            return true;
        }
    }
    // ── ۴. style attribute با payloads خطرناک ──
    // CSS می‌تواند حاوی expression() (در IE) یا url(javascript:) باشد.
    if (lowerName === 'style') {
        const lowerValue = attrValue.toLowerCase();
        // SEC FIX (v1.2.6): SEC-A3 — fix operator-precedence bug. The previous
        // expression was:
        //   lowerValue.includes('url(') && lowerValue.includes('vbscript:')
        // which (because && binds tighter than ||) was parsed as
        //   expression( || javascript: || (url( && vbscript:))
        // meaning `vbscript:` was only blocked when `url(` also appeared. A
        // bare `vbscript:alert(1)` or any other vbscript usage slipped through.
        // We now also block `vbscript:` unconditionally and add three more
        // CSS-based vectors: -moz-binding (XBL in old Firefox), behavior:
        // (IE htc files), and @import (loads an external stylesheet that can
        // carry data: or expression() payloads).
        if (lowerValue.includes('expression(') ||
            lowerValue.includes('javascript:') ||
            lowerValue.includes('vbscript:') ||
            lowerValue.includes('-moz-binding') ||
            lowerValue.includes('behavior:') ||
            lowerValue.includes('@import')) {
            return true;
        }
    }
    return false;
}
// FIX (v1.2.3): بررسی اینکه آیا value یک data:image/ URL است.
function isDataImage(value) {
    if (!value)
        return false;
    const trimmed = value.replace(/^[\s\x00-\x20]+/, '').toLowerCase();
    return trimmed.startsWith('data:image/');
}
/**
 * بررسی اینکه آیا یک مقدار URL حاوی پروتکل خطرناک است.
 *
 * این تابع:
 *   - فضای خالی و کاراکترهای کنترلی را حذف می‌کند (چون هکر می‌نویسد `java\tscript:`).
 *   - case-insensitive بررسی می‌کند.
 *   - فقط ابتدای رشته را چک می‌کند.
 *
 * @param value مقدار attribute (مثل "javascript:alert(1)").
 * @returns true اگر پروتکل خطرناک است.
 */
function hasDangerousProtocol(value) {
    if (!value)
        return false;
    // حذف فضای خالی و کاراکترهای کنترلی از ابتدا.
    // نکته: فقط ابتدا را trim می‌کنیم چون هکر می‌نویسد `  javascript:alert(1)`.
    const trimmed = value.replace(/^[\s\x00-\x20]+/, '').toLowerCase();
    // حذف فضای خالی داخلی هم (چون هکر می‌نویسد `java script:` یا `java\tscript:`).
    const noWhitespace = trimmed.replace(/[\s\x00-\x20]+/g, '');
    // بررسی پروتکل‌های خطرناک.
    return DANGEROUS_PROTOCOLS.some(protocol => noWhitespace.startsWith(protocol));
}
export function sanitizeHTMLWithOptions(dirty, options = {}) {
    if (!dirty || typeof dirty !== 'string')
        return '';
    // FIX (v1.2.3): SSR guard — برای هماهنگی با sanitizeHTML.
    if (typeof DOMParser === 'undefined')
        return '';
    // ساخت لیست ممنوعه قابل تنظیم.
    const forbidden = new Set(FORBIDDEN_TAGS);
    // اگر allowForms=true بود، <form> را از لیست ممنوعه خارج کن.
    if (options.allowForms) {
        forbidden.delete('FORM');
    }
    // اضافه کردن تگ‌های اضافی ممنوعه.
    if (options.forbidTags) {
        for (const tag of options.forbidTags) {
            forbidden.add(tag.toUpperCase());
        }
    }
    // حذف تگ‌های مجاز اضافی.
    if (options.allowTags) {
        for (const tag of options.allowTags) {
            forbidden.delete(tag.toUpperCase());
        }
    }
    const parser = new DOMParser();
    const doc = parser.parseFromString(dirty, 'text/html');
    // BUG-10 FIX (v1.2.2): doc.body null-check برای frameset crash.
    const root = doc.body || doc.documentElement;
    cleanNodeWithOptions(root, forbidden);
    return root.innerHTML;
}
/**
 * پاکسازی بازگشتی یک نود DOM با گزینه‌های قابل تنظیم.
 *
 * شبیه cleanNode اما با لیست ممنوعه قابل تنظیم.
 */
function cleanNodeWithOptions(node, forbidden) {
    if (node.nodeType !== Node.ELEMENT_NODE) {
        if (node.nodeType === Node.COMMENT_NODE) {
            node.parentNode?.removeChild(node);
        }
        return;
    }
    const el = node;
    const tagName = el.tagName.toUpperCase();
    if (forbidden.has(tagName)) {
        el.parentNode?.removeChild(el);
        return;
    }
    // FIX (v1.2.3): pass el برای data:image/ check روی IMG/SOURCE.
    for (const attr of Array.from(el.attributes)) {
        if (isAttributeDangerous(attr.name, attr.value, el)) {
            el.removeAttribute(attr.name);
        }
    }
    for (const child of Array.from(el.childNodes)) {
        cleanNodeWithOptions(child, forbidden);
    }
    // FIX (v1.2.3): TEMPLATE content هم باید پاکسازی شود.
    if (tagName === 'TEMPLATE') {
        const content = el.content;
        if (content) {
            for (const child of Array.from(content.childNodes)) {
                cleanNodeWithOptions(child, forbidden);
            }
        }
    }
}
// FEATURE (v0.4.0): zen-html-trusted — escape hatch برای محتوای Trusted.
//
// این تابع یک Identity Function است — یعنی ورودی را دست‌نخورده برمی‌گرداند.
// هدف اصلی آن صرفاً یک «نشانه‌ی قابل‌حسابرسی» (auditable marker) بودن است:
//   1) جستجو در codebase برای `sanitizeHTMLTrusted` فوراً همه‌ی escape hatch ها
//      را نشان می‌دهد.
//   2) یک console.warn در حالت Development چاپ می‌کند تا در زمان اجرا هم
//      قابل شناسایی باشد.
//   3) به‌عنوان یک مرز صریح عمل می‌کند: هیچ‌گاه نباید برای محتوای کاربر
//      استفاده شود.
//
// این یک «سوراخ امنیتی» نیست — یک مسیر شفاف و صریح است که توسعه‌دهنده
// صراحتاً opt-in کرده. در Production، `__ZENITH_DEV__ = false` قرار دهید تا
// هشدار خاموش شود.
export function sanitizeHTMLTrusted(html) {
    // FEATURE (v0.4.0): zen-html-trusted dev-mode warning.
    // هشدار قابل‌شناسایی در کنسول مرورگر — برای audit و دیباگ.
    if (typeof globalThis !== 'undefined' && globalThis.__ZENITH_DEV__ !== false) {
        // ایمن‌سازی دسترسی به console (در برخی محیط‌های SSR ممکن است نباشد).
        if (typeof console !== 'undefined' && typeof console.warn === 'function') {
            console.warn('⚠️ [Zenith] zen-html-trusted: rendering unsanitized HTML. Ensure this content is trusted (e.g. from your own server, sanitized upstream).');
        }
    }
    // نکته: همیشه ورودی را به‌صورت رشته برمی‌گردانیم. null/undefined به '' تبدیل
    // می‌شوند تا رفتار innerHTML قابل پیش‌بینی بماند.
    if (html === null || html === undefined)
        return '';
    if (typeof html !== 'string')
        return String(html);
    return html;
}
//# sourceMappingURL=sanitizer.js.map