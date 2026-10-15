# بستهٔ ممیزی امنیتی مستقل (#61 — Security Audit Package & Summary)

این سند دامنه، مدل تهدید ([`docs/security/threat-model.md`](threat-model.md) — `#60`)، یافته‌های رفع‌شده و دستورهای بازتولید قطعی را برای ممیزی امنیتی مستقل فریم‌ورک Zenith مستند می‌کند.

---

## ۱. دامنهٔ ممیزی (Audit Scope)

| ردیف | زیرسیستم / پکیج | فایل‌های کلیدی | سطح حمله و کنترل‌های امنیتی |
|---:|---|---|---|
| ۱ | **Sanitizer & TrustedTypes** (`@zenith/security`) | `packages/security/src/sanitizer.ts`, `security-constants.ts`, `id.ts` | پاک‌سازی HTML (`sanitizeHTML`)، مسدودسازی تگ‌های خطرناک (`script`, `iframe`, `object`, `embed`, `svg`, `math`, `template`, `noscript`)، حذف attributeهای `on*` و پروتکل‌های `javascript:` / `data:` / `vbscript:`، پاک‌سازی CSS (`sanitizeCSS`)، تولید هدرهای CSP (`generateCSP`)، و تولید شناسهٔ امن با `crypto.getRandomValues` (`secureId`, `ZEN-403`). |
| ۲ | **Expression Engine Sandbox** (`@zenith/expressions`) | `packages/expressions/src/lexer.ts`, `parser.ts`, `validator.ts`, `evaluator.ts` | تحلیل واژگانی و نحوی بدون `eval` یا `new Function`؛ مسدودسازی کامل دسترسی به `__proto__`، `prototype`، `constructor`، `window`، `document`، `globalThis`، `Function`، `eval`، `setTimeout`، `setInterval`، `fetch`؛ سقف عمق AST و طول ورودی؛ پرتاب خطای تایپ‌شدهٔ `ZenithError` روی ورودی‌های ناقص EOF (#10). |
| ۳ | **Authentication & Token Lifecycle** (`@zenith/auth`) | `packages/auth/src/auth.ts`, `docs/security/auth.md` | ذخیره‌سازی پیش‌فرض در حافظه (`memory`)، هشدار زمان توسعه `ZEN-404` برای `localStorage`/`sessionStorage`/`cookie` (#62)، قفل تک‌درخواست برای جلوگیری از race condition در refresh token (`SEC-A8`)، بررسی same-origin برای endpointها (`SEC-A9`)، و پاک‌سازی کامل در logout (`SEC-A13`). |
| ۴ | **SSR State Serialization & Route Escaping** (`@zenith/ssr`) | `packages/ssr/src/render.ts`, `hydrate.ts` | تابع `safeScriptValue` برای escape کردن `<` (`\u003c`)، `>` (`\u003e`)، `U+2028` و `U+2029` هنگام تزریق JSON در `<script>` (`SEC-A1`)؛ رد کردن مسیرهای حاوی `</`؛ و ایزوله‌سازی کامل درخواست‌های همزمان با `AsyncContextStore` (#92). |
| ۵ | **DOM Directives & CLI Boundaries** (`@zenith/runtime`, `@zenith/cli`, `@zenith/permission`) | `packages/runtime/src/directives/bind.ts`, `html.ts`, `packages/cli/src/validate-project-name.ts`, `packages/permission/src/permission.ts` | مسدودسازی `zen-bind` روی attributeهای رویداد `on*` و URLهای `javascript:` (`SEC-A2`)، اعتبارسنجی نام پروژه در CLI برای جلوگیری از Path Traversal (#7)، و `deepFreeze` روی وضعیت دسترسی‌ها پس از `freeze()` (`SEC-A7` / `BUG-PRM-01`). |

---

## ۲. خلاصهٔ یافته‌ها و وضعیت رفع (Findings Summary)

تمامی یافته‌های ممیزی داخلی و تست‌های نفوذ خودکار پیش از انتشار رفع و با تست‌های رگرسیون قفل شده‌اند:

| شناسه | شدت | شرح یافته | وضعیت | تست پوشش‌دهنده |
|---|---|---|---|---|
| `SEC-A1` | Critical | امکان خروج از تگ `</script>` در صورت وجود `</script>` یا `U+2028` در state یا route سمت سرور | ✅ رفع‌شده (`safeScriptValue` + `isRouteSafe`) | `packages/ssr/test/ssr-dom.test.ts` |
| `SEC-A2` | High | امکان تزریق `javascript:` در `zen-bind:href` یا `zen-bind:onclick` | ✅ رفع‌شده (لیست سیاه attributeهای `on*` و بررسی پروتکل URL) | `packages/runtime/test/directives-dom.test.ts` |
| `SEC-A3` / `SEC-A4` | Critical | بردارهای mXSS از طریق `<template>`, `<svg>`, `<math>`, `<noscript>` و CSS `expression()`/`url(javascript:)` | ✅ رفع‌شده (حذف کامل تگ‌های تغییرشکل‌دهندهٔ namespace و فیلتر CSS) | `packages/security/test/xss-corpus.test.ts`, `e2e/xss-corpus.spec.ts` |
| `SEC-A5`..`SEC-A7` | High | دستکاری آرایهٔ نقش‌ها/دسترسی‌ها در حافظه پس از hydration سمت کلاینت | ✅ رفع‌شده (`PermissionManager.freeze()` + `deepFreeze`) | `packages/permission/test/permission.test.ts` |
| `SEC-A8` / `SEC-A9` | High | نشت توکن به دامنهٔ خارجی یا حلقهٔ همزمان refresh token در `@zenith/auth` | ✅ رفع‌شده (بررسی origin + قفل `_refreshPromise` + هشدار `ZEN-404`) | `packages/auth/test/auth-security.test.ts` |
| `SEC-A10` | Critical | آلودگی prototype (`__proto__`, `constructor`, `prototype`) در عبارات قالب | ✅ رفع‌شده (اعتبارسنجی ایستا در `validator.ts` + چک زمان اجرا در `evaluator.ts`) | `packages/expressions/test/fuzz-security.test.ts` |
| `CLI-03` (#7) | High | Path traversal در `zenith create ../target` | ✅ رفع‌شده (`validateProjectName`) | `packages/cli/test/cli-traversal.test.ts` |
| `SEC-ID` (#64) | Medium | استفاده از `Math.random()` برای تولید شناسه | ✅ رفع‌شده (`secureId` مبتنی بر CSPRNG + قانون ESLint مسدودکنندهٔ `Math.random` در `packages/**/src`) | `packages/security/test/secure-id.test.ts` |

---

## ۳. دستورهای راستی‌آزمایی خودکار (Verification Suite)

ممیز مستقل می‌تواند کل مجموعهٔ امنیتی را با دستورهای زیر اجرا و بازتولید کند:

```bash
# ۱. بررسی یکپارچگی بستهٔ ممیزی امنیتی و قوانین ضد Math.random / ضد eval
node scripts/security-audit-check.mjs

# ۲. اجرای تست‌های واحد امنیتی (OWASP XSS corpus، CSPRNG، Auth security، CLI traversal، Fuzzing 100,000 ورودی)
npx vitest run packages/security packages/expressions packages/auth packages/cli packages/permission

# ۳. اجرای تست مرورگر واقعی Chromium (Playwright) روی ۴۴ پیلود OWASP / mXSS
npm run test:e2e
```

گام مربوط به هماهنگی با تیم ممیز بیرونی و ثبت گواهی نهایی در [`docs/MANUAL-STEPS.md`](../MANUAL-STEPS.md) درج شده است.
