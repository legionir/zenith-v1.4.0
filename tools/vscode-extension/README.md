# Zenith VSCode Extension

> Phase 2 — Developer Experience

افزونه‌ی VSCode برای فریم‌ورک Zenith با syntax highlighting، autocomplete، validation، و code snippets.

## نصب

1. پوشه‌ی `tools/vscode-extension` را در VSCode باز کنید.
2. `npm install` را اجرا کنید.
3. `F5` را بزنید تا Extension Host باز شود.
4. در پنجره‌ی جدید، فایل‌های HTML را باز کنید.

## قابلیت‌ها

### Syntax Highlighting

- تمام `zen-*` directives با رنگ متمایز نمایش داده می‌شوند.
- `$variable` references در attribute values هایلایت می‌شوند.
- `prop:*` attributes متمایز هستند.

### Autocomplete

- تایپ `zen` در HTML، لیست همه‌ی directives را نشان می‌دهد.
- هر directive با snippet کامل (با placeholders) درج می‌شود.
- Component و Router tags هم در autocomplete موجودند.

### Hover Hints

- نشانگر را روی هر `zen-*` directive ببرید تا توضیحات و مثال نمایش داده شود.

### Validation

- Template literals با `${}` → هشدار "use concatenation"
- دسترسی به `window`, `document`, `eval` → هشدار "forbidden"
- دسترسی به `__proto__`, `constructor` → هشدار "forbidden"
- syntax غلط `zen-for` → هشدار
- modifier ناشناخته در `zen-action` → هشدار

### Snippets

| Trigger       | Description              |
| ------------- | ------------------------ |
| `zcomp`       | Component definition     |
| `ztext`       | zen-text                 |
| `zif`         | zen-if                   |
| `zfor`        | zen-for                  |
| `zmodel`      | zen-model                |
| `zbind`       | zen-bind                 |
| `zaction`     | zen-action               |
| `zaction-mod` | zen-action with modifier |
| `zfetch`      | zen-fetch                |
| `zlink`       | zen-link                 |
| `zrouter`     | zen-router               |
| `zresource`   | zen-resource             |
| `zperm`       | zen-permission           |
| `zrole`       | zen-role                 |
| `zerror`      | zen-error                |
| `zvalidate`   | zen-validate             |
| `zpage`       | Page template            |
| `zmain`       | main.ts boilerplate      |

### Commands

- `Zenith: Create Component` — ساخت کامپوننت جدید
- `Zenith: Create Page` — ساخت صفحه‌ی جدید
- `Zenith: Create Action` — ساخت action جدید

## امنیت webview (#67)

پنل «Zenith DevTools» یک `WebviewPanel` با `enableScripts: true` است، پس مثل هر
سطح وب دیگری سخت‌گیرانه مهار شده است (`src/webview.ts`):

- **CSP با nonce:** در هر بار ساخت پنل یک nonce تازه (`createNonce()` — ۱۶ بایت
  تصادفی رمزنگارانه) ساخته می‌شود و `<meta http-equiv="Content-Security-Policy">`
  با `default-src 'none'; script-src 'nonce-…'; style-src 'nonce-…'; img-src ${webview.cspSource} data:; connect-src 'none'; base-uri 'none'; form-action 'none'`
  تزریق می‌شود؛ استایل ایستا در `<style nonce>` و نمایش/پنهان‌سازی پویا با
  خاصیت DOM (`el.style.display`) انجام می‌شود — هیچ `'unsafe-inline'` در هیچ
  directive نیست. هیچ `<script src>` بیرونی، هیچ inline handler (`onclick=`) و هیچ
  `eval`/`new Function` در پنل وجود ندارد. `localResourceRoots` هم عمداً خالی است
  تا webview به فایل‌های local دسترسی نداشته باشد.
- **اعتبارسنجی پیام (allowlist):** هر پیام ورودی از webview با
  `validateWebviewMessage()` بررسی می‌شود — فقط `{ type: 'refresh' }` و
  `{ type: 'connect' }` پذیرفته می‌شوند و هر چیز دیگری (نوع ناشناخته، payload
  غیرشیء، شیء آلوده به `__proto__`) بی‌صدا نادیده گرفته می‌شود.
- **رندر بدون `innerHTML`:** `DEVTOOLS_CLIENT_SCRIPT` فقط با `createElement`،
  `textContent` و `replaceChildren` رندر می‌کند و پیام‌های سمت host را خودش دوباره
  اعتبارسنجی می‌کند (`isDevToolsHostMessage`). داده‌ی خروجی host با
  `buildDevToolsData()` سقف‌دار و متن‌محور می‌شود.
- تست: [`test/webview.test.ts`](./test/webview.test.ts) (CSP، nonce، allowlist، نبود `innerHTML`).
