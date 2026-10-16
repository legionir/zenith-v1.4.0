# مدل تهدید امنیتی Zenith (`#60` — Threat Model)

این سند مدل تهدید رسمی فریم‌ورک Zenith را بر پایهٔ متدولوژی **STRIDE** برای هر ۶ سطح حملهٔ اصلی، مرزهای اعتماد (Trust Boundaries)، کنترل‌های پیاده‌سازی‌شده در کد و تست‌های خودکار متناظر مستند می‌کند.

---

## ۱. دارایی‌ها، مهاجمان و مرزهای اعتماد

### دارایی‌های حساس (Assets)
1. **زمینهٔ اجرای مرورگر (DOM & JS Execution Context)**: جلوگیری از اجرای کد دلخواه (XSS) و سرقت نشست.
2. **توکن‌های احراز هویت و مجوزها (`accessToken`, `refreshToken`, RBAC)**: حفاظت در برابر سرقت توکن، CSRF و ارتقای سطح دسترسی.
3. **حافظه و Context رندر سرور (SSR Request Context)**: جلوگیری از نشت وضعیت (State Bleed) میان درخواست‌های هم‌زمان کاربران مختلف و محافظت در برابر DoS.
4. **کش آفلاین و Service Worker (`CacheStorage`)**: جلوگیری از مسموم‌سازی کش (Cache Poisoning) و قفل شدن کلاینت روی باندل معیوب.
5. **گذرگاه پیام DevTools (`window.postMessage` / Extension Bridge)**: جلوگیری از نشت اطلاعات حساس (PII) یا دستکاری سیگنال‌ها توسط صفحات ثالث.

### مرزهای اعتماد (Trust Boundaries)
- **TB-1**: قالب‌های HTML و عبارت‌های دایرکتیو (`zen-text`, `zen-bind`, `zen-if`, `zen-on`) در برابر داده‌های ورودی کاربر.
- **TB-2**: تزریق مستقیم HTML/CSS (`zen-html`, `zen-html-trusted`, `sanitizeHTML`, `sanitizeCSS`) در برابر DOM مرورگر.
- **TB-3**: مرز شبکه و ذخیره‌گاه کلاینت در `@zenith/auth` و `@zenith/http`.
- **TB-4**: مرز ایزولاسیون درخواست‌های هم‌زمان در `@zenith/ssr` (`renderToString`, `renderToStream`).
- **TB-5**: مرز کش و چرخهٔ عمر Service Worker در `@zenith/service-worker`.
- **TB-6**: مرز ارتباطی صفحهٔ وب و افزونهٔ مرورگر در `@zenith/devtools` و `packages/devtools-extension`.

---

## ۲. ماتریس تهدیدهای STRIDE به تفکیک ۶ سطح

### سطح ۱: سندباکس عبارت‌ها (`@zenith/expressions`)
| دستهٔ STRIDE | تهدید | کنترل پیاده‌سازی‌شده در کد | تست متناظر |
|---|---|---|---|
| **Tampering / Elevation of Privilege** | آلودگی پروتوتایپ و فرار از سندباکس از طریق `__proto__`, `constructor`, `prototype` | مسدودسازی در زمان کامپایل و اجرا در [`packages/expressions/src/validator.ts`](../../packages/expressions/src/validator.ts) و [`packages/expressions/src/evaluator.ts`](../../packages/expressions/src/evaluator.ts) (`FORBIDDEN_PROPERTIES`, `SEC-A10`) | [`packages/expressions/test/fuzz-security.test.ts`](../../packages/expressions/test/fuzz-security.test.ts) |
| **Elevation of Privilege** | دسترسی به متغیرهای سراسری خطرناک (`window`, `document`, `eval`, `Function`, `globalThis`) | لیست سیاه `FORBIDDEN_GLOBALS` در [`packages/expressions/src/validator.ts`](../../packages/expressions/src/validator.ts) و ارزیابی بدون `new Function`/`eval` | [`packages/expressions/test/expressions-eval.test.ts`](../../packages/expressions/test/expressions-eval.test.ts) |
| **Denial of Service** | عبارت‌های بازگشتی عمیق یا بسیار طولانی | محدودیت عمق AST و طول عبارت در [`packages/expressions/src/parser.ts`](../../packages/expressions/src/parser.ts) | [`packages/expressions/test/parser-eof.test.ts`](../../packages/expressions/test/parser-eof.test.ts) |

### سطح ۲: پالایشگر HTML/CSS/URL و Trusted Types (`@zenith/security`, `zen-html`, `zen-html-trusted`)
| دستهٔ STRIDE | تهدید | کنترل پیاده‌سازی‌شده در کد | تست متناظر |
|---|---|---|---|
| **Tampering / Spoofing (XSS)** | تزریق تگ‌های `<script>`, `<svg onload>`, `onerror` و پروتکل‌های `javascript:` / `data:text/html` | پالایش مبتنی بر allowlist در [`packages/security/src/sanitizer.ts`](../../packages/security/src/sanitizer.ts) (`sanitizeHTML`, `sanitizeCSS`, `SEC-A3`, `SEC-A4`) | [`packages/security/test/xss-corpus.test.ts`](../../packages/security/test/xss-corpus.test.ts) |
| **Elevation of Privilege** | دور زدن پالایشگر از طریق DOM sinks یا عدم تطابق با Trusted Types | پشتیبانی از `createTrustedTypesPolicy()`، `setSafeInnerHTML()` و تولید هدر CSP بدون `unsafe-eval`/`unsafe-inline` در [`packages/security/src/sanitizer.ts`](../../packages/security/src/sanitizer.ts) (`#63`) | [`packages/security/test/strict-csp-trusted-types.test.ts`](../../packages/security/test/strict-csp-trusted-types.test.ts) |
| **Repudiation / Misuse** | استفادهٔ ناخواسته از `zen-html-trusted` برای دادهٔ کاربر | جداسازی صریح دایرکتیو [`packages/runtime/src/directives/html-trusted.ts`](../../packages/runtime/src/directives/html-trusted.ts) و هشدار امنیتی مستند | [`packages/runtime/test/directives-dom.test.ts`](../../packages/runtime/test/directives-dom.test.ts) |

### سطح ۳: رندر سمت سرور و سریال‌سازی وضعیت (`@zenith/ssr`)
| دستهٔ STRIDE | تهدید | کنترل پیاده‌سازی‌شده در کد | تست متناظر |
|---|---|---|---|
| **Information Disclosure** | نشت سیگنال‌ها، 스토رها یا تگ‌های `<head>` بین دو درخواست هم‌زمان کاربران مختلف (Cross-Request State Bleed) | ایزولاسیون کامل کانتکست با `AsyncLocalStorage` و کانتکست صریح per-request در [`packages/ssr/src/dom-context.ts`](../../packages/ssr/src/dom-context.ts) (`#92`) | [`packages/ssr/test/concurrent-isolation.test.ts`](../../packages/ssr/test/concurrent-isolation.test.ts) |
| **Tampering (SSR XSS)** | تزریق `</script>` در JSON وضعیت اولیهٔ هیدراتاسیون | Escape کردن کاراکترهای `<`, `>`, `&`, `\u2028`, `\u2029` در [`packages/ssr/src/render.ts`](../../packages/ssr/src/render.ts) (`SEC-A1`) | [`packages/ssr/test/ssr-dom.test.ts`](../../packages/ssr/test/ssr-dom.test.ts) |
| **Denial of Service** | رندر بی‌پایان یا بلاتکلیف ماندن استریم SSR | پشتیبانی از `AbortSignal` و `timeout` در [`packages/ssr/src/render.ts`](../../packages/ssr/src/render.ts) | [`packages/ssr/test/stream-flush-abort.test.ts`](../../packages/ssr/test/stream-flush-abort.test.ts) |

### سطح ۴: احراز هویت و مجوزها (`@zenith/auth`, `@zenith/permission`)
| دستهٔ STRIDE | تهدید | کنترل پیاده‌سازی‌شده در کد | تست متناظر |
|---|---|---|---|
| **Information Disclosure** | سرقت توکن‌ها از `localStorage` در صورت بروز XSS | ذخیره‌سازی پیش‌فرض در حافظه (`memoryStorage`) و هشدار `ZEN-404` هنگام استفاده از `localStorage` در [`packages/auth/src/auth.ts`](../../packages/auth/src/auth.ts) (`#62`, `SEC-A8`) | [`packages/auth/test/auth-storage.test.ts`](../../packages/auth/test/auth-storage.test.ts) |
| **Spoofing / Tampering** | جعل زمان انقضای JWT یا Race Condition در تمدید توکن هم‌زمان | اعتبارسنجی ساختار JWT، mutex تمدید توکن و پاک‌سازی کامل هنگام خروج در [`packages/auth/src/auth.ts`](../../packages/auth/src/auth.ts) (`SEC-A9`, `SEC-A13`) | [`packages/auth/test/auth-security.test.ts`](../../packages/auth/test/auth-security.test.ts) |
| **Elevation of Privilege** | اتکای صرف به `zen-permission` در سمت کلاینت | مستندسازی صریح و پاک‌سازی کامل گره DOM در [`packages/permission/src/directive.ts`](../../packages/permission/src/directive.ts) (`SEC-A5`, `SEC-A12`) | [`packages/permission/test/permission.test.ts`](../../packages/permission/test/permission.test.ts) |

### سطح ۵: کش آفلاین و Service Worker (`@zenith/service-worker`)
| دستهٔ STRIDE | تهدید | کنترل پیاده‌سازی‌شده در کد | تست متناظر |
|---|---|---|---|
| **Tampering (Cache Poisoning)** | کش شدن پاسخ‌های خطا یا درخواست‌های غیر `GET` | کش کردن صرفاً درخواست‌های `GET` با `response.ok === true` و پیشوند نسخه‌دار `zenith-v{cacheVersion}-*` در [`packages/service-worker/src/sw.ts`](../../packages/service-worker/src/sw.ts) | [`packages/service-worker/test/sw-listeners.test.ts`](../../packages/service-worker/test/sw-listeners.test.ts) |
| **Denial of Service (Stale SW Lock-in)** | قفل شدن کاربران روی نسخهٔ معیوب Service Worker | حذف خودکار کش‌های قدیمی در `activate`، تابع `unregisterSW({ clearCaches: true })` و Kill Switch اضطراری `setupKillSwitchSW()` / [`packages/service-worker/sw-kill.js`](../../packages/service-worker/sw-kill.js) (`#96`) | [`packages/service-worker/test/upgrade-killswitch.test.ts`](../../packages/service-worker/test/upgrade-killswitch.test.ts) |

### سطح ۶: افزونهٔ DevTools و پلاگین‌ها (`packages/devtools-extension`, `@zenith/devtools-core`, `@zenith/error-boundary`)
| دستهٔ STRIDE | تهدید | کنترل پیاده‌سازی‌شده در کد | تست متناظر |
|---|---|---|---|
| **Information Disclosure** | نشت توکن‌ها، رمزهای عبور و ایمیل‌ها به DevTools یا گزارش‌دهنده‌های خطای خارجی | پالایش خودکار کلیدهای حساس (`redact`) در [`packages/devtools-core/src/index.ts`](../../packages/devtools-core/src/index.ts) و `redactPIIValue()` در [`packages/error-boundary/src/boundary.ts`](../../packages/error-boundary/src/boundary.ts) (`#93`) | [`packages/error-boundary/test/external-reporter.test.ts`](../../packages/error-boundary/test/external-reporter.test.ts) |
| **Elevation of Privilege** | دسترسی بیش‌ازحد افزونهٔ مرورگر به تمام سایت‌ها یا اجرای اسکریپت inline | حذف `<all_urls>` و `tabs` از [`packages/devtools-extension/manifest.json`](../../packages/devtools-extension/manifest.json) و اعمال CSP `script-src 'self'; object-src 'none'` (`#8`) | [`scripts/test/devtools-extension.test.mjs`](../../scripts/test/devtools-extension.test.mjs) |
| **Tampering / Spoofing (پیام‌های جعلی)** | صفحهٔ بازدیدشده پیام `chrome.runtime` جعلی می‌فرستد تا popup را وادار به رندر دادهٔ خودش کند یا با `innerHTML` اسکریپت اجرا کند | Allowlist سخت‌گیرانه در [`packages/devtools-extension/message-schema.js`](../../packages/devtools-extension/message-schema.js): plain object، نوع مجاز (`ZENITH_CHECK/REFRESH/CLEAR/NOTIFICATION`)، بدون کلید ناامن (`__proto__`/`constructor`), سقف طول، فرستندهٔ معتبر (`isTrustedSender`) و پاک‌سازی کامل payload گراف/بازرسی؛ popup و graph-viewer **صفر `innerHTML`** (رندر فقط با `textContent`/DOM API) (`#67`) | [`scripts/test/devtools-message-schema.test.mjs`](../../scripts/test/devtools-message-schema.test.mjs) |
| **Cross-Site Scripting (webview در VS Code)** | اسکریپت inline در `getDevToolsHtml` یا تزریق دادهٔ صفحهٔ میزبان از طریق `onclick=`/`innerHTML` | webview با nonce تازه در هر panel، CSP `default-src 'none'; script-src 'nonce-…'` ساخته‌شده از `webview.cspSource` و بدون `localResourceRoots`؛ اسکریپت سمت webview پیام‌های host را دوباره اعتبارسنجی می‌کند و فقط با `textContent` رندر می‌کند (`#67`) | [`packages/vscode-extension/test/webview.test.ts`](../../packages/vscode-extension/test/webview.test.ts) |

---

## ۳. ریسک‌های پذیرفته‌شده (Accepted Risks)

1. **`zen-html-trusted` و `sanitizeHTMLTrusted`**: این APIها به‌طور عمدی ورودی را بدون پالایش عبور می‌دهند و صرفاً برای محتوای کاملاً مورد اعتماد تولیدشده در سرور (مانند خروجی Markdown از پیش sanitizeشده) طراحی شده‌اند. مسئولیت عدم پاس دادن ورودی خام کاربر به آن‌ها بر عهدهٔ توسعه‌دهندهٔ برنامه است.
2. **کنترل دسترسی سمت کلاینت (`@zenith/permission`)**: مخفی‌سازی عناصر UI در مرورگر یک لایهٔ UX است و جایگزین بررسی مجوز (Authorization) در API سمت سرور نمی‌شود.
3. **پشتیبانی از مرورگرهای بدون Trusted Types بومی**: در موتورهایی که هنوز `window.trustedTypes` را پیاده‌سازی نکرده‌اند (مانند نسخه‌های فعلی Firefox/WebKit)، امنیت تزریق HTML بر پالایشگر DOM/رشتهٔ `@zenith/security` متکی است.
