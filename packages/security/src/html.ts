import { FORBIDDEN_TAGS, ALLOWED_TAGS } from './html-policy';
import { isAttributeDangerous } from './html-attributes';

/** @public */
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

  // Historical non-DOM regex fallback; not DOM-equivalent sanitization
  return sanitizeHTMLSimple(dirty);
}

/** @public */
export function sanitizeHTMLInDocument(dirty: string, document: Document): string {
  if (!dirty || typeof dirty !== 'string') return '';
  const root = document.createElement('div'); root.innerHTML = dirty; cleanNode(root); return root.innerHTML;
}

/** @public */
export interface SanitizeOptions {
  /** تگ‌های اضافی که باید مجاز باشند (از لیست ممنوعه خارج شوند). */
  allowTags?: string[];
  /** تگ‌های اضافی که باید ممنوع باشند. */
  forbidTags?: string[];
  /** آیا <form> مجاز باشد؟ (پیش‌فرض: false) */
  allowForms?: boolean;
}

/** @public */
export function sanitizeHTMLWithOptions(dirty: string, options: SanitizeOptions = {}): string {
  if (!dirty || typeof dirty !== 'string') return '';

  // BUG-SEC-02 FIX: SSR fallback - try DOMParser first
  if (typeof DOMParser === 'undefined') {
    // Historical non-DOM regex fallback; not DOM-equivalent sanitization
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

function cleanNode(node: Node): void {
  // فقط Element Nodes را process می‌کنیم.
  if (node.nodeType !== 1) {
    // Comment nodes را حذف می‌کنیم چون می‌توانند payloads مخرب پنهان کنند
    // (مخصوصاً در IE که comment ها را parse می‌کند).
    if (node.nodeType === 8) {
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

function cleanNodeWithOptions(node: Node, forbidden: Set<string>, allowed: Set<string>): void {
  if (node.nodeType !== 1) {
    if (node.nodeType === 8) {
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
