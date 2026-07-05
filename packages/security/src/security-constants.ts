// packages/security/src/security-constants.ts
//
// ثابت‌های مشترک امنیتی برای استفاده در سراسر فریم‌ورک.
//
// IMP-SEC-04: Shared security constants that can be imported by other packages
// (e.g., runtime/directives/html, runtime/directives/html-trusted, SSR)
// without importing the full sanitization logic.
//
// استفاده:
//   import { FORBIDDEN_TAGS, ALLOWED_TAGS, FORBIDDEN_ATTRS, ... } from '@zenith/security/shared';
//
// در packages.json، مسیر `@zenith/security/shared` باید به exports اضافه شود:
//   "./shared": {
//     "import": "./dist/security-constants.js",
//     "types": "./dist/security-constants.d.ts"
//   }

/**
 * تگ‌های HTML که به‌طور پیش‌فرض مجاز هستند.
 * این لیست بر اساس رویکرد allowlist-based است: هر تگی که در این لیست نباشد، حذف می‌شود.
 */
export const ALLOWED_TAGS = new Set([
  // ساختار پایه
  'A', 'ABBR', 'ADDRESS', 'AREA', 'ARTICLE', 'ASIDE',
  'B', 'BDI', 'BDO', 'BLOCKQUOTE', 'BR',
  'CAPTION', 'CITE', 'CODE', 'COL', 'COLGROUP',
  'DATA', 'DATALIST', 'DD', 'DEL', 'DETAILS', 'DFN', 'DIALOG', 'DIV', 'DL', 'DT',
  'EM',
  'FIELDSET', 'FIGCAPTION', 'FIGURE', 'FOOTER',
  'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HGROUP', 'HR',
  'I', 'IMG', 'INPUT', 'INS',
  'KBD',
  'LABEL', 'LEGEND', 'LI',
  'MAIN', 'MAP', 'MARK', 'MENU', 'METER',
  'NAV',
  'OL', 'OPTGROUP', 'OPTION', 'OUTPUT',
  'P', 'PICTURE', 'PRE', 'PROGRESS',
  'Q',
  'RP', 'RT', 'RUBY',
  'S', 'SAMP', 'SECTION', 'SELECT', 'SLOT', 'SMALL', 'SOURCE', 'SPAN', 'STRONG', 'SUB', 'SUMMARY', 'SUP',
  'TABLE', 'TBODY', 'TD', 'TEXTAREA', 'TFOOT', 'TH', 'THEAD', 'TIME', 'TR',
  'U', 'UL',
  'VAR',
  'WBR',
]);

/**
 * تگ‌های ممنوعه (کاملاً حذف می‌شوند).
 */
export const FORBIDDEN_TAGS = new Set([
  'SCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'APPLET',
  'LINK', 'META', 'BASE', 'STYLE', 'FORM',
  'NOSCRIPT', 'FRAMESET', 'FRAME', 'XML',
  'TEMPLATE',
  'ANIMATE', 'ANIMATEMOTION', 'ANIMATETRANSFORM', 'SET',
  'SVG', 'MATH', 'USE', 'SYMBOL', 'FOREIGNOBJECT',
]);

/**
 * ویژگی‌های ممنوعه (همیشه حذف می‌شوند).
 */
export const FORBIDDEN_ATTRS = new Set([
  'onabort', 'onafterprint', 'onautocomplete', 'onautocompleteerror',
  'onblur', 'oncancel', 'oncanplay', 'oncanplaythrough', 'onchange',
  'onclick', 'onclose', 'oncontextmenu', 'oncuechange', 'ondblclick',
  'ondrag', 'ondragend', 'ondragenter', 'ondragleave', 'ondragover',
  'ondragstart', 'ondrop', 'ondurationchange', 'onemptied', 'onended',
  'onerror', 'onfocus', 'onhashchange', 'oninput', 'oninvalid',
  'onkeydown', 'onkeypress', 'onkeyup', 'onload', 'onloadeddata',
  'onloadedmetadata', 'onloadstart', 'onmessage', 'onmousedown',
  'onmouseenter', 'onmouseleave', 'onmousemove', 'onmouseout',
  'onmouseover', 'onmouseup', 'onmousewheel', 'onoffline', 'ononline',
  'onpagehide', 'onpageshow', 'onpause', 'onplay', 'onplaying',
  'onpopstate', 'onprogress', 'onratechange', 'onreset', 'onresize',
  'onscroll', 'onsearch', 'onseeked', 'onseeking', 'onselect',
  'onshow', 'onstalled', 'onstorage', 'onsubmit', 'onsuspend',
  'ontimeupdate', 'ontoggle', 'onunhandledrejection', 'onunload',
  'onvolumechange', 'onwaiting', 'onwheel',
]);

/**
 * ویژگی‌هایی که فقط با مقادیر خاص مجاز هستند.
 */
export const SAFE_URL_PATTERNS = [
  /^https?:\/\//i,
  /^\/\//i,
  /^\//i,
  /^#/i,
  /^mailto:/i,
  /^tel:/i,
];

/**
 * بررسی اینکه آیا یک attribute event handler است.
 */
export function isEventAttribute(name: string): boolean {
  return /^on\w+$/.test(name.toLowerCase());
}

/**
 * بررسی اینکه آیا یک URL safe است.
 */
export function isSafeUrl(url: string): boolean {
  if (!url) return true;
  return SAFE_URL_PATTERNS.some((pattern) => pattern.test(url));
}
