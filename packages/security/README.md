# @zenith/security

> Phase 9 — HTML Sanitizer and Security Layer

پکیج `@zenith/security` خط دفاعی فریم‌ورک Zenith را در برابر حملات XSS
(Cross-Site Scripting) فراهم می‌کند. این پکیج از `DOMParser` (که هیچ
اسکریپتی را اجرا نمی‌کند) برای parse کردن HTML استفاده می‌کند و تگ‌ها و
اتریبیوت‌های خطرناک را حذف می‌کند.

## استفاده

```typescript
import { sanitizeHTML } from '@zenith/security';

const dirty = `
  <h3>عنوان امن</h3>
  <script>alert('XSS!');</script>
  <img src="x" onerror="alert('XSS!')">
  <a href="javascript:alert('XSS!')">click</a>
`;

const clean = sanitizeHTML(dirty);
// clean = '<h3>عنوان امن</h3><img src="x"><a>click</a>'
```

## حملاتی که بلاک می‌شوند

| حمله | مثال | نتیجه |
|------|------|-------|
| `<script>` | `<script>alert(1)</script>` | حذف کامل |
| `<iframe>` | `<iframe src="evil.com">` | حذف کامل |
| Event handlers | `<img onerror="...">` | حذف attribute |
| `javascript:` | `<a href="javascript:...">` | حذف href |
| `vbscript:` | `<a href="vbscript:...">` | حذف href |
| `data:` URL | `<a href="data:...">` | حذف href |
| `style` با `expression()` | `<div style="...expression(...)">` | حذف attribute |
| Prototype Pollution | `<div __proto__="...">` | حذف attribute |
| Comment payloads | `<!-- <script>...--> -->` | حذف comment |

## تگ‌های ممنوعه (پیش‌فرض)

```
SCRIPT, IFRAME, OBJECT, EMBED, APPLET, LINK, META, BASE, STYLE, FORM,
NOSCRIPT, FRAMESET, FRAME, XML
```

## API

### `sanitizeHTML(dirty: string): string`

پاکسازی یک رشته‌ی HTML با تنظیمات پیش‌فرض.

```typescript
const clean = sanitizeHTML(dirty);
```

### `sanitizeHTMLWithOptions(dirty, options)`

پاکسازی با گزینه‌های قابل تنظیم.

```typescript
import { sanitizeHTMLWithOptions } from '@zenith/security';

const clean = sanitizeHTMLWithOptions(dirty, {
  allowForms: true,           // اجازه دادن به <form>
  allowTags: ['style'],       // اجازه دادن به تگ‌های اضافی
  forbidTags: ['div'],        // ممنوع کردن تگ‌های اضافی
});
```

#### `SanitizeOptions`

| گزینه | نوع | توضیح |
|-------|-----|-------|
| `allowTags` | `string[]` | تگ‌های اضافی که باید مجاز باشند |
| `forbidTags` | `string[]` | تگ‌های اضافی که باید ممنوع باشند |
| `allowForms` | `boolean` | آیا `<form>` مجاز باشد؟ (پیش‌فرض: `false`) |

## Design Notes

### چرا DOMParser؟

`DOMParser` برخلاف `innerHTML` هیچ اسکریپتی را اجرا نمی‌کند. این یک ویژگی
ذاتی DOMParser است که آن را برای sanitization ایمن می‌کند. وقتی HTML را
با `parseFromString` parse می‌کنیم، تگ‌های `<script>` در DOM قرار
می‌گیرند اما اجرا نمی‌شوند — ما سپس آن‌ها را حذف می‌کنیم.

### چرا Comment nodes حذف می‌شوند؟

Comment nodes می‌توانند payloads مخرب پنهان کنند. به‌خصوص در IE قدیمی،
comment ها به‌صورت متفاوتی parse می‌شدند و می‌توانستند منجر به XSS شوند.
برای ایمنی کامل، comment nodes را حذف می‌کنیم.

### چرا `style` ممنوع است؟

CSS می‌تواند حاوی `expression()` (در IE قدیمی) یا `url(javascript:...)`
باشد. این می‌تواند منجر به اجرای کد شود. به همین دلیل، `<style>` tags
کاملاً ممنوع هستند و `style` attribute با بررسی اضافی همراه است.

### چرا `data:` URLs ممنوع هستند؟

`data:` URLs می‌توانند حاوی HTML یا JavaScript باشند. مثلاً:
`<a href="data:text/html,<script>alert(1)</script>">`. در برخی مرورگرها،
کلیک روی این لینک می‌تواند منجر به اجرای کد شود.

### Defense in Depth

این Sanitizer یک لایه‌ی دفاعی است، نه تنها لایه. همیشه باید:

1. **روی سرور هم HTML را sanitize کنید** — کلاینت قابل اعتماد نیست.
2. **از Content-Security-Policy (CSP) استفاده کنید** — جلوگیری از اجرای
   اسکریپت‌های غیرمجاز.
3. **ورودی کاربر را قبل از ذخیره اعتبارسنجی کنید** — جلوگیری بهتر از درمان است.
4. **از HTTPOnly cookies استفاده کنید** — محافظت در صورت XSS.

### محدودیت‌ها

- این Sanitizer در برابر **Mutation XSS (mXSS)** کاملاً ایمن نیست. mXSS
  حملاتی هستند که در حین re-serialization تغییر می‌کنند. برای ایمنی
  کامل، از یک کتابخانه‌ی تخصصی مثل DOMPurify استفاده کنید.
- در محیط‌های بدون DOM (مثل Node.js بدون jsdom)، `DOMParser` موجود نیست.
  در این موارد، باید یک polyfill یا کتابخانه‌ی server-side استفاده کنید.
