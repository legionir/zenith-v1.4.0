# گزارش حسابرسی پکیج `security`
**نسخه:** v1.3.0 | **بسته:** `@zenith/security`

---

## ۱. خلاصه پکیج

پکیج `security` لایه امنیتی فریم‌ورک Zenith را پیاده‌سازی می‌کند. عملکرد اصلی آن sanitization HTML با رویکرد allowlist-based (فهرست سفید تگ‌ها و ویژگی‌ها) است. همچنین توابعی برای sanitize با options خاص و یک تابع `sanitizeHTMLTrusted` (identity function) برای محتوای trust شده فراهم می‌کند.

---

## ۲. ساختار فایل‌ها

| فایل | خطوط | مسئولیت |
|------|-------|---------|
| `src/sanitizer.ts` | ~۱۵۰+ | `sanitizeHTML` – پالایش HTML |
| `src/index.ts` | ~۲۰ | export توابع |

فایل `security.ts` در این پکیج وجود ندارد و همه‌ی منطق در `sanitizer.ts` متمرکز شده است.

---

## ۳. باگ‌ها و مشکلات

### BUG-SEC-01: allowlist تگ‌ها کامل نیست و حملات XSS جدید را پوشش نمی‌دهد
- **شدت:** بالا
- **محل:** `src/sanitizer.ts`
- **شرح:** لیست تگ‌های مجاز ممکن است برخی تگ‌های جدید یا حملات XSS ناشناخته را پوشش ندهد. تگ‌های SVG و MathML می‌توانند برای XSS استفاده شوند و نیاز به بررسی دقیق دارند.
- **نحوه رفع:** افزودن بررسی تگ‌های SVG/MathML و namespace:

```typescript
const ALLOWED_TAGS = new Set([
  'a', 'abbr', 'article', 'b', 'blockquote', 'br', 'caption', 'cite',
  'code', 'col', 'colgroup', 'data', 'dd', 'del', 'details', 'dfn',
  'div', 'dl', 'dt', 'em', 'figcaption', 'figure', 'footer', 'h1', 'h2',
  'h3', 'h4', 'h5', 'h6', 'header', 'hr', 'i', 'img', 'input', 'ins',
  'kbd', 'label', 'li', 'main', 'mark', 'nav', 'ol', 'p', 'pre', 'q',
  's', 'samp', 'section', 'select', 'small', 'span', 'strong', 'sub',
  'summary', 'sup', 'table', 'tbody', 'td', 'textarea', 'tfoot', 'th',
  'thead', 'time', 'tr', 'u', 'ul', 'var',
]);

const FORBIDDEN_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'applet',
  'form', 'input', 'button', 'select', 'textarea', // handled specially
  'svg', // بررسی دقیق‌تر namespace
]);

function isEventAttribute(name: string): boolean {
  return /^on\w+$/.test(name.toLowerCase());
}

function sanitizeNode(node: Node): Node | null {
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as Element;
    const tag = el.tagName.toLowerCase();

    if (FORBIDDEN_TAGS.has(tag) || !ALLOWED_TAGS.has(tag)) {
      // انتقال محتوا (text) به بیرون
      const text = el.textContent || '';
      return document.createTextNode(text);
    }

    // پالایش ویژگی‌ها
    for (const attr of Array.from(el.attributes)) {
      if (isEventAttribute(attr.name)) {
        el.removeAttribute(attr.name);
      }
      if (attr.name.startsWith('data-') && /[<>"']/.test(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  }
  return node;
}
```

### BUG-SEC-02: `sanitizeHTML` از DOMParser استفاده می‌کند که در محیط SSR در دسترس نیست
- **شدت:** بالا
- **محل:** `src/sanitizer.ts`
- **شرح:** `sanitizeHTML` از `DOMParser` سمت مرورگر استفاده می‌کند. در محیط SSR (Node.js)، `DOMParser` وجود ندارد و این تابع با خطا مواجه می‌شود. نیاز به fallback یا استفاده از jsdom دارد.
- **نحوه رفع:**

```typescript
export function sanitizeHTML(html: string): string {
  try {
    // تلاش با DOMParser سمت مرورگر
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    return sanitizeDoc(doc);
  } catch {
    // Fallback برای SSR: استفاده از regex ساده (limited but safe)
    return sanitizeHTMLSimple(html);
  }
}

function sanitizeHTMLSimple(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]*on\w+\s*=[^>]*>/gi, '')
    .replace(/<[^>]*javascript:[^>]*>/gi, '');
}
```

### BUG-SEC-03: `sanitizeHTMLWithOptions` می‌تواند با options نامعتبر crash کند
- **شدت:** کم
- **محل:** `src/sanitizer.ts`
- **شرح:** اگر `options` شامل properties غیرمجاز یا نامعتبر باشد، تابع ممکن است crash کند یا رفتار غیرمنتظره داشته باشد.
- **نحوه رفع:** اعتبارسنجی options در ابتدا:

```typescript
export function sanitizeHTMLWithOptions(
  html: string,
  options?: SanitizeOptions,
): string {
  const opts: SanitizeOptions = {
    allowedTags: options?.allowedTags && Array.isArray(options.allowedTags)
      ? new Set(options.allowedTags)
      : DEFAULT_ALLOWED_TAGS,
    allowedAttributes: options?.allowedAttributes && Array.isArray(options.allowedAttributes)
      ? new Set(options.allowedAttributes)
      : DEFAULT_ALLOWED_ATTRS,
    allowComments: options?.allowComments ?? false,
  };

  return doSanitize(html, opts);
}
```

### BUG-SEC-04: Mutation XSS از طریق تگ‌های template
- **شدت:** متوسط
- **محل:** `src/sanitizer.ts`
- **شرح:** تگ `<template>` می‌تواند حاوی HTML دلخواه باشد که بعداً توسط JavaScript پردازش شود و ممکن است از فیلتر عبور کند.
- **نحوه رفع:** افزودن `<template>` به FORBIDDEN_TAGS:

```typescript
const FORBIDDEN_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'applet',
  'template', // جلوگیری از Mutation XSS
]);
```

---

## ۴. پیشنهادات ارتقا

### IMP-SEC-01: افزودن `sanitizeCSS` برای پالایش CSS
- **دلیل:** CSS injection می‌تواند برای data exfiltration استفاده شود.
- **پیاده‌سازی:**

```typescript
export function sanitizeCSS(css: string): string {
  return css
    .replace(/expression\s*\(/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/@import/gi, '');
}
```

### IMP-SEC-02: افزودن Content Security Policy (CSP) helper
- **دلیل:** راهنمایی برای تنظیم CSP headers.
- **پیاده‌سازی:**

```typescript
export function generateCSP(options?: CSPOptions): string {
  const directives = [
    `default-src 'self'`,
    `script-src 'self'${options?.allowInlineScript ? " 'unsafe-inline'" : ''}`,
    `style-src 'self'${options?.allowInlineStyle ? " 'unsafe-inline'" : ''}`,
    `img-src 'self' data: https:`,
    options?.nonce ? `script-src 'nonce-${options.nonce}'` : '',
  ].filter(Boolean);
  return directives.join('; ');
}
```

### IMP-SEC-03: Trusted Types پشتیبانی
- **دلیل:** جلوگیری از DOM XSS با استفاده از Trusted Types API مرورگر.
- **پیاده‌سازی:**

```typescript
if (window.trustedTypes && window.trustedTypes.createPolicy) {
  window.trustedTypes.createPolicy('zenith', {
    createHTML: (html: string) => sanitizeHTML(html),
    createScriptURL: (url: string) => { /* validation */ return url; },
  });
}
```

### IMP-SEC-04: ماژول security-constants اشتراک‌گذاری بین packages
- **دلیل:** `FORBIDDEN_PROPERTIES` در `expressions` و `security` تکراری هستند.
- **پیاده‌سازی:** انتقال به یک پکیج مشترک `@zenith/security/shared`.

---

## ۵. نکات یکپارچگی

| پکیج | نحوه تعامل | وضعیت |
|------|-----------|--------|
| **expressions** | AST validator با `FORBIDDEN_PROPERTIES` | 🟡 هم‌پوشانی (duplication) |
| **runtime/directives/html** | `zen-html` از `sanitizeHTML` استفاده می‌کند. | ✅ درست |
| **runtime/directives/html-trusted** | `zen-html-trusted` از `sanitizeHTMLTrusted` (identity) استفاده می‌کند. | ✅ درست |
| **ssr** | Sanitizer در محیط SSR کار نمی‌کند (BUG-SEC-02). | 🛑 مشکل دارد |

---

## ۶. نتیجه‌گیری کلی

پکیج `security` با رویکرد allowlist-based طراحی مناسبی دارد اما نیاز به بهبود در پشتیبانی SSR (از طریق jsdom یا regex fallback) و پوشش کامل‌تر حملات XSS (مخصوصاً template و SVG) دارد.

**امتیاز کلی: ۶.۵/۱۰** (رویکرد درست اما نیاز به SSR support و coverage کامل‌تر)
