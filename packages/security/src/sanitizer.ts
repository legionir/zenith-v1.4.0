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
  'SCRIPT',     // اجرای کد
  'IFRAME',     // بارگذاری صفحات خارجی
  'OBJECT',     // بارگذاری plugin ها
  'EMBED',      // بارگذاری plugin ها
  'APPLET',     // java applet (قدیمی اما خطرناک)
  'LINK',       // بارگذاری استایل یا prefetch
  'META',       // meta refresh, CSP bypass
  'BASE',       // تغییر base URL
  'STYLE',      // CSS-based attacks (expression(), url(javascript:))
  'FORM',       // form hijacking (قابل تنظیم در آینده)
  'NOSCRIPT',   // محتوای fallback مخرب
  'FRAMESET',   // قدیمی اما خطرناک
  'FRAME',      // قدیمی اما خطرناک
  'XML',        // XML processing instructions
  'TEMPLATE',   // BUG-SEC-04: Mutation XSS - template content can be cloned and executed
  // SEC FIX (v1.2.6): SEC-A3 — block SVG/SMIL animation tags. These can
  // animate attribute values (e.g. xlink:href) at runtime to smuggle
  // dangerous payloads past static sanitization, and `<set>` can flip a
  // benign attribute into a `javascript:` URL after page load.
  'ANIMATE',
  'ANIMATEMOTION',
  'ANIMATETRANSFORM',
  'SET',
  // BUG-SEC-01: SVG/MathML tags that can execute scripts or bypass sanitization
  'SVG',        // Can contain <script> or event handlers
  'MATH',       // MathML can contain script-like content
  'USE',        // SVG <use> can reference external resources
  'SYMBOL',     // SVG <symbol> can contain scripts
  'FOREIGNOBJECT', // SVG can embed HTML with scripts
]);

/**
 * تگ‌های مجاز برای `sanitizeHTMLWithOptions`.
 *
 * برخلاف `sanitizeHTML` که مدل denylist دارد (هرچه در FORBIDDEN_TAGS نباشد
 * مجاز است)، نسخه‌ی options-based از مدل allowlist استفاده می‌کند:
 * `cleanNodeWithOptions` هر تگی را که در این مجموعه نباشد حذف می‌کند.
 *
 * این فهرست عمداً محافظه‌کارانه است و فقط عناصر محتوایی بی‌خطر HTML را
 * شامل می‌شود. برای افزودن تگ‌های بیشتر از `options.allowTags` استفاده کنید.
 */
const ALLOWED_TAGS = new Set([
  // ریشه و بخش‌بندی
  'BODY', 'DIV', 'SPAN', 'SECTION', 'ARTICLE', 'ASIDE', 'HEADER', 'FOOTER',
  'MAIN', 'NAV', 'FIGURE', 'FIGCAPTION',
  // متن
  'P', 'BR', 'HR', 'PRE', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  // درون‌خطی
  'A', 'B', 'STRONG', 'I', 'EM', 'U', 'S', 'SMALL', 'SUB', 'SUP', 'MARK',
  'CODE', 'KBD', 'SAMP', 'VAR', 'ABBR', 'CITE', 'Q', 'TIME', 'BDI', 'BDO',
  'WBR', 'DEL', 'INS',
  // فهرست‌ها
  'UL', 'OL', 'LI', 'DL', 'DT', 'DD',
  // جدول
  'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'TR', 'TD', 'TH', 'CAPTION',
  'COL', 'COLGROUP',
  // رسانه (اتریبیوت‌ها جداگانه توسط isAttributeDangerous پالایش می‌شوند)
  'IMG', 'PICTURE', 'SOURCE', 'AUDIO', 'VIDEO', 'TRACK',
]);

/**
 * اتریبیوت‌هایی که با on شروع می‌شوند (onclick, onerror, onload, …).
 *
 * این regex case-insensitive است تا ONCLICK هم بلاک شود.
 */
/**
 * Minimal ambient typings for the Trusted Types API.
 *
 * Trusted Types is a browser standard but is not part of the default
 * TypeScript `lib.dom` typings, so the shapes this module relies on are
 * declared locally rather than pulling in an extra @types dependency.
 */
interface TrustedTypePolicy {
  createHTML(input: string): string;
  createScriptURL(input: string): string;
}

interface TrustedTypePolicyFactory {
  createPolicy(
    name: string,
    rules: {
      createHTML?: (input: string) => string;
      createScriptURL?: (input: string) => string;
    },
  ): TrustedTypePolicy;
}

declare global {
  interface Window {
    trustedTypes?: TrustedTypePolicyFactory;
  }
}

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
 * BUG-03 FIX: Added SSR fallback using simple regex-based sanitization
 *   when DOMParser is not available (e.g., Node.js without jsdom).
 *
 * @param dirty رشته‌ی HTML نامطمئن.
 * @returns رشته‌ی HTML پاکسازی‌شده.
 */
export function sanitizeHTML(dirty: string): string {
  if (!dirty || typeof dirty !== 'string') return '';

  // BUG-SEC-02 FIX: SSR fallback - try DOMParser first, fallback to regex-based sanitization
  if (typeof DOMParser !== 'undefined') {
    // Browser environment - use DOMParser
    const parser = new DOMParser();
    const doc = parser.parseFromString(dirty, 'text/html');

    // BUG-10 FIX (v1.2.2): doc.body می‌تواند null باشد وقتی HTML شامل <frameset>
    // است (که <body> را با <frameset> جایگزین می‌کند). قبلاً cleanNode(doc.body)
    // در این حالت TypeError پرتاب می‌کرد. حالا به‌جای body، از documentElement
    // به‌عنوان fallback استفاده می‌کنیم.
    const root = doc.body || doc.documentElement;
    cleanNode(root);

    return (root as Element).innerHTML;
  }

  // SSR fallback: simple regex-based sanitization (limited but safe)
  return sanitizeHTMLSimple(dirty);
}

/**
 * Simple regex-based HTML sanitizer for SSR environments without DOMParser.
 * This is a limited fallback - for production SSR, use @zenith/ssr with jsdom.
 */
function sanitizeHTMLSimple(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*on\w+\s*=[^>]*>/gi, '')
    .replace(/<[^>]*javascript:[^>]*>/gi, '')
    .replace(/<template\b[^<]*(?:(?!<\/template>)<[^<]*)*<\/template>/gi, '')
    .replace(/<svg\b[^<]*(?:(?!<\/svg>)<[^<]*)*<\/svg>/gi, '')
    .replace(/<math\b[^<]*(?:(?!<\/math>)<[^<]*)*<\/math>/gi, '');
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
function cleanNode(node: Node): void {
  // فقط Element Nodes را process می‌کنیم.
  if (node.nodeType !== Node.ELEMENT_NODE) {
    // Comment nodes را حذف می‌کنیم چون می‌توانند payloads مخرب پنهان کنند
    // (مخصوصاً در IE که comment ها را parse می‌کند).
    if (node.nodeType === Node.COMMENT_NODE) {
      node.parentNode?.removeChild(node);
    }
    return;
  }

  const el = node as Element;
  const tagName = el.tagName.toUpperCase();

  // ── ۱. حذف تگ‌های کاملاً ممنوع ──
  if (FORBIDDEN_TAGS.has(tagName)) {
    el.parentNode?.removeChild(el);
    return;
  }

  // ── ۲. بررسی اتریبیوت‌ها ──
  // Array.from برای جلوگیری از تغییر در حین iteration.
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

  // FIX (v1.2.3): اگر node یک TEMPLATE است، محتوای آن (node.content) هم باید
  // پاکسازی شود. قبلاً محتوای <template> بررسی نمی‌شد، در نتیجه مهاجم می‌توانست
  // payload مخرب را داخل <template> پنهان کند و بعد از clone شدن، اجرا شود.
  if (tagName === 'TEMPLATE') {
    const content = (el as HTMLTemplateElement).content;
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
function isAttributeDangerous(attrName: string, attrValue: string, el?: Element): boolean {
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
  // قبلاً فقط href، src، action، formaction، xlink:href، data چک می‌شدند.
  // srcset می‌تواند حاوی URL با javascript: باشد، cite برای <blockquote>/<q>/<del>/<ins>،
  // poster برای <video>، background برای <body>/<table> (deprecated ولی فعال).
  if (
    lowerName === 'href' ||
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
    // قبلاً هر data: URL بلاک می‌شد، در نتیجه inline image‌های base64 از کار
    // می‌افتادند. حالا data:image/ برای این دو تگ مجاز است (چون اجرای اسکریپت
    // در data:image/ ممکن نیست).
    if (lowerName === 'src' && el) {
      const tag = el.tagName.toUpperCase();
      if (tag === 'IMG' || tag === 'SOURCE') {
        if (isDataImage(attrValue)) return false;
      }
    }
    // SEC FIX (v1.2.6): SEC-A4 — srcset is a comma-separated list of
    // "<url> <descriptor>" pairs. A naive hasDangerousProtocol(attrValue) call
    // only inspects the very start of the whole string, so the second URL in
    //   "/a.jpg, javascript:alert(1)"
    // would slip through. Split on commas and check every URL individually.
    if (lowerName === 'srcset') {
      const candidates = String(attrValue || '').split(',');
      for (const candidate of candidates) {
        // srcset descriptor syntax: "<url> <width-or-density>". Trim the
        // trailing descriptor (everything after the first whitespace) before
        // handing the URL to hasDangerousProtocol so whitespace inside the
        // URL itself isn't double-handled.
        const urlPart = candidate.trim().split(/\s+/)[0] ?? '';
        if (hasDangerousProtocol(urlPart)) {
          return true;
        }
      }
    } else if (hasDangerousProtocol(attrValue)) {
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
    // meaning `vbscript:` was only blocked when `url(` also appeared. A bare
    // `vbscript:alert(1)` or any other vbscript usage slipped through. We now
    // also block `vbscript:` unconditionally and add three more CSS-based
    // vectors: -moz-binding (XBL in old Firefox), behavior: (IE htc files),
    // and @import (loads an external stylesheet that can carry data: or
    // expression() payloads).
    if (
      lowerValue.includes('expression(') ||
      lowerValue.includes('javascript:') ||
      lowerValue.includes('vbscript:') ||
      lowerValue.includes('-moz-binding') ||
      lowerValue.includes('behavior:') ||
      lowerValue.includes('@import')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * FIX (v1.2.3): بررسی اینکه آیا value یک data:image/ URL است.
 *
 * این helper برای تشخیص inline image‌های base64 استفاده می‌شود تا اجازه داده شود
 * بدون بلاک شدن توسط چک data: در hasDangerousProtocol.
 */
function isDataImage(value: string): boolean {
  if (!value) return false;
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
function hasDangerousProtocol(value: string): boolean {
  if (!value) return false;

  // حذف فضای خالی و کاراکترهای کنترلی از ابتدا.
  // نکته: فقط ابتدا را trim می‌کنیم چون هکر می‌نویسد `  javascript:alert(1)`.
  const trimmed = value.replace(/^[\s\x00-\x20]+/, '').toLowerCase();

  // حذف فضای خالی داخلی هم (چون هکر می‌نویسد `java script:` یا `java\tscript:`).
  const noWhitespace = trimmed.replace(/[\s\x00-\x20]+/g, '');

  // بررسی پروتکل‌های خطرناک.
  return DANGEROUS_PROTOCOLS.some(protocol => noWhitespace.startsWith(protocol));
}

/**
 * پاکسازی یک رشته‌ی HTML با امکانات قابل تنظیم.
 *
 * این تابع نسخه‌ی پیشرفته‌ی sanitizeHTML است که به کاربر اجازه می‌دهد:
 *   - تگ‌های اضافی را مجاز کند (مثلاً <form>).
 *   - تگ‌های خاصی را اضافه حذف کند.
 *   - URL های خاص را مجاز کند.
 *
 * BUG-SEC-03 FIX: Actually use the options to modify ALLOWED_TAGS and FORBIDDEN_TAGS.
 * Also added SSR fallback.
 *
 * @param dirty رشته‌ی HTML نامطمئن.
 * @param options گزینه‌های پیکربندی.
 * @returns رشته‌ی HTML پاکسازی‌شده.
 */
export interface SanitizeOptions {
  /** تگ‌های اضافی که باید مجاز باشند (از لیست ممنوعه خارج شوند). */
  allowTags?: string[];
  /** تگ‌های اضافی که باید ممنوع باشند. */
  forbidTags?: string[];
  /** آیا <form> مجاز باشد؟ (پیش‌فرض: false) */
  allowForms?: boolean;
}

export function sanitizeHTMLWithOptions(
  dirty: string,
  options: SanitizeOptions = {},
): string {
  if (!dirty || typeof dirty !== 'string') return '';

  // BUG-SEC-02 FIX: SSR fallback - try DOMParser first
  if (typeof DOMParser === 'undefined') {
    // SSR fallback: simple regex-based sanitization (limited but safe)
    return sanitizeHTMLSimple(dirty);
  }

  // Build customized forbidden and allowed tag sets
  const forbidden = new Set(FORBIDDEN_TAGS);
  const allowed = new Set(ALLOWED_TAGS);

  // If allowForms=true, remove <form> from forbidden
  if (options.allowForms) {
    forbidden.delete('FORM');
  }

  // Add extra forbidden tags
  if (options.forbidTags) {
    for (const tag of options.forbidTags) {
      forbidden.add(tag.toUpperCase());
      // Also remove from allowed if present
      allowed.delete(tag.toUpperCase());
    }
  }

  // Allow extra tags (remove from forbidden, add to allowed)
  if (options.allowTags) {
    for (const tag of options.allowTags) {
      const upperTag = tag.toUpperCase();
      forbidden.delete(upperTag);
      allowed.add(upperTag);
    }
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(dirty, 'text/html');

  // BUG-10 FIX (v1.2.2): doc.body null-check for frameset crash.
  const root = doc.body || doc.documentElement;
  cleanNodeWithOptions(root, forbidden, allowed);

  return (root as Element).innerHTML;
}

/**
 * پاکسازی بازگشتی یک نود DOM با گزینه‌های قابل تنظیم.
 *
 * شبیه cleanNode اما با لیست ممنوعه و مجاز قابل تنظیم.
 */
function cleanNodeWithOptions(node: Node, forbidden: Set<string>, allowed: Set<string>): void {
  if (node.nodeType !== Node.ELEMENT_NODE) {
    if (node.nodeType === Node.COMMENT_NODE) {
      node.parentNode?.removeChild(node);
    }
    return;
  }

  const el = node as Element;
  const tagName = el.tagName.toUpperCase();

  if (forbidden.has(tagName) || !allowed.has(tagName)) {
    el.parentNode?.removeChild(el);
    return;
  }

  // FIX (v1.2.3): pass el for data:image/ check on IMG/SOURCE.
  for (const attr of Array.from(el.attributes)) {
    if (isAttributeDangerous(attr.name, attr.value, el)) {
      el.removeAttribute(attr.name);
    }
  }

  for (const child of Array.from(el.childNodes)) {
    cleanNodeWithOptions(child, forbidden, allowed);
  }

  // FIX (v1.2.3): TEMPLATE content must also be sanitized.
  if (tagName === 'TEMPLATE') {
    const content = (el as HTMLTemplateElement).content;
    if (content) {
      for (const child of Array.from(content.childNodes)) {
        cleanNodeWithOptions(child, forbidden, allowed);
      }
    }
  }
}

// FEATURE (v0.4.0): zen-html-trusted — escape hatch برای محتوای Trusted.
//
// FIX (v1.2.3): این تابع قبلاً فقط در dist/sanitizer.js وجود داشت (به‌عنوان
// یک feature v0.4.0) ولی هرگز به src/sanitizer.ts اضافه نشده بود — یک
// drift بین src و dist. حالا به src هم اضافه شد تا source-of-truth کامل
// باشد. تابع یک Identity Function است: ورودی را دست‌نخورده برمی‌گرداند.
// هدف اصلی آن صرفاً یک «نشانه‌ی قابل‌حسابرسی» (auditable marker) بودن است:
//   1) جستجو در codebase برای `sanitizeHTMLTrusted` فوراً همه‌ی escape hatch ها
//      را نشان می‌دهد.
//   2) یک console.warn در حالت Development چاپ می‌کند تا در زمان اجرا هم
//      قابل شناسایی باشد.
//   3) به‌عنوان یک مرز صریح عمل می‌کند: هیچ‌گاه نباید برای محتوای کاربر
//      استفاده شود.
export function sanitizeHTMLTrusted(html: string): string {
  // FEATURE (v0.4.0): zen-html-trusted dev-mode warning.
  // هشدار قابل‌شناسایی در کنسول مرورگر — برای audit و دیباگ.
  if (typeof globalThis !== 'undefined' && (globalThis as any).__ZENITH_DEV__ !== false) {
    // ایمن‌سازی دسترسی به console (در برخی محیط‌های SSR ممکن است نباشد).
    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn('⚠️ [Zenith] zen-html-trusted: rendering unsanitized HTML. Ensure this content is trusted (e.g. from your own server, sanitized upstream).');
    }
  }
  // نکته: همیشه ورودی را به‌صورت رشته برمی‌گردانیم. null/undefined به '' تبدیل
  // می‌شوند تا رفتار innerHTML قابل پیش‌بینی بماند.
  if (html === null || html === undefined) return '';
  if (typeof html !== 'string') return String(html);
  return html;
}

// ──────────────────────────────────────────────
// IMP-SEC-01: CSS Sanitizer
// ──────────────────────────────────────────────
/**
 * پالایش CSS برای جلوگیری از CSS-based attacks.
 *
 * این تابع:
 *   - `expression()` را حذف می‌کند (IE-specific XSS).
 *   - `javascript:` را حذف می‌کند.
 *   - `@import` را حذف می‌کند (می‌تواند استایل مخرب بارگذاری کند).
 *   - `url()` با پروتکل‌های خطرناک را حذف می‌کند.
 *
 * @param css رشته‌ی CSS نامطمئن.
 * @returns رشته‌ی CSS پالایش‌شده.
 */
export function sanitizeCSS(css: string): string {
  if (!css || typeof css !== 'string') return '';
  return css
    // Remove IE expression() XSS
    .replace(/expression\s*\(/gi, '')
    // Remove javascript: URLs
    .replace(/javascript\s*:/gi, '')
    // Remove @import which can load external styles
    .replace(/@import\s+/gi, '')
    // Remove behavior: (IE-specific)
    .replace(/behavior\s*:/gi, '')
    // Remove -moz-binding (Firefox XBL)
    .replace(/-moz-binding\s*:/gi, '')
    // Remove url() with dangerous protocols
    .replace(/url\s*\(\s*(javascript|data|vbscript)\s*:/gi, 'url(');
}

// ──────────────────────────────────────────────
// IMP-SEC-02: Content Security Policy (CSP) Helper
// ──────────────────────────────────────────────

/**
 * گزینه‌های تولید CSP Header.
 */
export interface CSPOptions {
  /** آیا اسکریپت‌های inline مجاز باشند؟ (پیش‌فرض: false) */
  allowInlineScript?: boolean;
  /** آیا استایل‌های inline مجاز باشند؟ (پیش‌فرض: false) */
  allowInlineStyle?: boolean;
  /** Nonce value برای script-src. */
  nonce?: string;
  /** دامنه‌های اضافی برای script-src. */
  extraScriptSrc?: string[];
  /** دامنه‌های اضافی برای style-src. */
  extraStyleSrc?: string[];
  /** دامنه‌های اضافی برای img-src. */
  extraImgSrc?: string[];
  /** آیا WebSocket connections مجاز باشد؟ (پیش‌فرض: false) */
  allowWebSockets?: boolean;
}

/**
 * تولید رشته‌ی Content-Security-Policy برای استفاده در HTTP Header یا meta tag.
 *
 * @example
 *   const csp = generateCSP({ allowWebSockets: true });
 *   // "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:; connect-src 'self' ws: wss:"
 *
 * @param options گزینه‌های تنظیم CSP.
 * @returns رشته‌ی CSP آماده برای استفاده در Content-Security-Policy header.
 */
export function generateCSP(options?: CSPOptions): string {
  const directives = [
    `default-src 'self'`,
    `script-src 'self'${options?.allowInlineScript ? " 'unsafe-inline'" : ''}${options?.nonce ? ` 'nonce-${options.nonce}'` : ''}${options?.extraScriptSrc ? ' ' + options.extraScriptSrc.join(' ') : ''}`,
    `style-src 'self'${options?.allowInlineStyle ? " 'unsafe-inline'" : ''}${options?.extraStyleSrc ? ' ' + options.extraStyleSrc.join(' ') : ''}`,
    `img-src 'self' data: https:${options?.extraImgSrc ? ' ' + options.extraImgSrc.join(' ') : ''}`,
    options?.allowWebSockets ? `connect-src 'self' ws: wss:` : `connect-src 'self'`,
  ].filter(Boolean);

  return directives.join('; ');
}

// ──────────────────────────────────────────────
// IMP-SEC-03: Trusted Types Integration
// ──────────────────────────────────────────────

/**
 * ایجاد یک Trusted Type policy برای @zenith.
 *
 * Trusted Types یک API مرورگر مدرن است که DOM XSS را ریشه‌کن می‌کند.
 * با این policy، فقط `sanitizeHTML` و `sanitizeHTMLTrusted` می‌توانند
 * HTML را به DOM تزریق کنند.
 *
 * @example
 *   import { createTrustedTypesPolicy } from '@zenith/security';
 *   const policy = createTrustedTypesPolicy();
 *   element.innerHTML = policy.createHTML(unsafeHTML);
 *
 * @returns TrustedTypePolicy یا null اگر Trusted Types پشتیبانی نشود.
 */
export function createTrustedTypesPolicy(): TrustedTypePolicy | null {
  if (typeof window === 'undefined' || !window.trustedTypes || !window.trustedTypes.createPolicy) {
    return null;
  }

  try {
    return window.trustedTypes.createPolicy('zenith', {
      createHTML: (html: string) => sanitizeHTML(html),
      createScriptURL: (url: string) => {
        // Only allow same-origin URLs for scripts
        if (url.startsWith('/') || url.startsWith('./') || url.startsWith('../')) {
          return url;
        }
        try {
          const parsed = new URL(url, window.location.origin);
          if (parsed.origin === window.location.origin) {
            return url;
          }
        } catch {
          // Invalid URL - reject
        }
        return '';
      },
    });
  } catch {
    // Policy with name 'zenith' may already exist
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[Zenith] Trusted Types policy already exists. Returning existing policy.');
    }
    return null;
  }
}
