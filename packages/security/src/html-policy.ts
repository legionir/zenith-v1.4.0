/** Preserve the sanitizer policy independently of optional shared-policy APIs. */
/** @internal */
export const FORBIDDEN_TAGS = new Set([
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
  'TEMPLATE', // BUG-SEC-04: Mutation XSS - template content can be cloned and executed
  // SEC FIX (v1.2.6): SEC-A3 — block SVG/SMIL animation tags. These can
  // animate attribute values (e.g. xlink:href) at runtime to smuggle
  // dangerous payloads past static sanitization, and `<set>` can flip a
  // benign attribute into a `javascript:` URL after page load.
  'ANIMATE',
  'ANIMATEMOTION',
  'ANIMATETRANSFORM',
  'SET',
  // BUG-SEC-01: SVG/MathML tags that can execute scripts or bypass sanitization
  'SVG', // Can contain <script> or event handlers
  'MATH', // MathML can contain script-like content
  'USE', // SVG <use> can reference external resources
  'SYMBOL', // SVG <symbol> can contain scripts
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
/** @internal */
export const ALLOWED_TAGS = new Set([
  // ریشه و بخش‌بندی
  'BODY',
  'DIV',
  'SPAN',
  'SECTION',
  'ARTICLE',
  'ASIDE',
  'HEADER',
  'FOOTER',
  'MAIN',
  'NAV',
  'FIGURE',
  'FIGCAPTION',
  // متن
  'P',
  'BR',
  'HR',
  'PRE',
  'BLOCKQUOTE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  // درون‌خطی
  'A',
  'B',
  'STRONG',
  'I',
  'EM',
  'U',
  'S',
  'SMALL',
  'SUB',
  'SUP',
  'MARK',
  'CODE',
  'KBD',
  'SAMP',
  'VAR',
  'ABBR',
  'CITE',
  'Q',
  'TIME',
  'BDI',
  'BDO',
  'WBR',
  'DEL',
  'INS',
  // فهرست‌ها
  'UL',
  'OL',
  'LI',
  'DL',
  'DT',
  'DD',
  // جدول
  'TABLE',
  'THEAD',
  'TBODY',
  'TFOOT',
  'TR',
  'TD',
  'TH',
  'CAPTION',
  'COL',
  'COLGROUP',
  // رسانه (اتریبیوت‌ها جداگانه توسط isAttributeDangerous پالایش می‌شوند)
  'IMG',
  'PICTURE',
  'SOURCE',
  'AUDIO',
  'VIDEO',
  'TRACK',
]);


/** @internal */
export const EVENT_ATTR_REGEX = /^on/i;

/** @internal */
export const DANGEROUS_PROTOCOLS = ['javascript:', 'vbscript:', 'data:'];

/** @internal */
export const FORBIDDEN_ATTR_NAMES = ['__proto__', 'constructor', 'prototype'];
