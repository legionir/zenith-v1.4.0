# Zenith DevTools Extension

> Phase 2 — Real Developer Tools

افزونه‌ی Chrome/Firefox برای بازرسی State، Component Tree، Timeline تغییرات، و Effect Viewer در فریم‌ورک Zenith.

## نصب

1. Chrome را باز کنید و به `chrome://extensions/` بروید.
2. "Developer mode" را در بالا-راست فعال کنید.
3. روی "Load unpacked" کلیک کنید.
4. پوشه‌ی `tools/devtools-extension` را انتخاب کنید.

## ۴ پنل DevTools

### ۱. Signal Inspector

- لیست تمام Signal های فعال
- مقدار فعلی هر Signal (با JSON formatting)
- تعداد subscribers هر Signal
- Auto-refresh هر ۲ ثانیه

### ۲. Timeline

- تاریخچه‌ی تغییرات State (آخرین ۲۰ تغییر)
- مقدار قبلی → مقدار جدید
- timestamp هر تغییر
- نام Signal (اگر نام‌گذاری شده)

### ۳. Component Tree

- لیست تمام کامپوننت‌های ثبت‌شده
- تعداد استفاده‌ی هر کامپوننت در DOM
- نمایش `<component-name>` با syntax highlighting

### ۴. Effect Viewer

- لیست Effect های فعال و disposed
- وابستگی‌های هر Effect
- وضعیت (Active/Disposed)
- source شناسایی (اگر موجود باشد)

## Controls

- **↻ Refresh** — به‌روزرسانی دستی اطلاعات
- **Clear All** — پاکسازی Timeline و داده‌های DevTools

## DevTools Panel

علاوه بر popup، یک tab اختصاصی "Zenith" در Chrome DevTools هم اضافه می‌شود
(View → Developer → Inspect → Zenith tab).

## فایل‌ها

```
devtools-extension/
├── manifest.json          — Manifest V3 (JSON استاندارد، بدون کامنت)
├── message-schema.js      — اعتبارسنجی/پاک‌سازی پیام‌ها و دادهٔ ورودی (#67)
├── popup.html             — UI با 4 tab (با سیاست CSP سخت‌گیرانه)
├── popup.js               — منطق popup (render همه‌ی panels، بدون innerHTML)
├── graph-viewer.html      — نمایشگر گراف وابستگی (بدون اسکریپت inline)
├── graph-viewer.js        — منطق نمایشگر گراف وابستگی
├── content.js             — content script (ارتباط با window.__ZENITH__)
├── background.js          — service worker + DevTools panel creation
├── devtools.html          — DevTools panel entry
└── devtools-panel.js      — ایجاد Zenith tab در DevTools
```

## امنیت و سطوح دسترسی (#8)

- **دسترسی حداقلی (`activeTab` + `optional_host_permissions`):** افزونه به‌صورت پیش‌فرض دسترسی سراسری (`host_permissions` روی `<all_urls>`) درخواست نمی‌کند؛ بازرسی تب فعلی با `activeTab` و `chrome.scripting.executeScript` انجام می‌شود و دسترسی به دامنه‌های `http://*/*` و `https://*/*` در `optional_host_permissions` قرار دارد تا فقط با تأیید صریح کاربر فعال شود (`BUG-DEVTEXT-01`, `BUG-DEVTEXT-08`, `IMP-DEVTEXT-05`).
- **سیاست CSP (`content_security_policy`):** تمام صفحات افزونه (`popup.html`، `devtools.html`، `graph-viewer.html`) تحت سیاست `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'` اجرا می‌شوند و هیچ اسکریپت inline در HTML وجود ندارد.
- **اعتبارسنجی پیام و داده (#67):** `message-schema.js` پیش از هر مصرف، ورودی‌های غیرقابل‌اعتماد را بررسی می‌کند:
  - پیام‌های `chrome.runtime.onMessage` فقط با allowlist نوع (`ZENITH_CHECK`/`ZENITH_REFRESH`/`ZENITH_CLEAR`/`ZENITH_NOTIFICATION`) و فقط از فرستندهٔ خود افزونه (`isTrustedSender`) پذیرفته می‌شوند؛ هر چیز دیگری **بی‌صدا نادیده** گرفته می‌شود.
  - payload گراف (`window.__ZENITH_GRAPH_DATA__`، hook، یا `?data=`) و پاسخ بازرسی با schema سخت‌گیرانه پالایش می‌شوند (سقف تعداد/طول، حذف کلیدهای ناامن مثل `__proto__`، حذف یال‌های معلق) و در صورت ناسازگاری رندر انجام **نمی‌شود**.
  - هیچ مسیری از `innerHTML` برای دادهٔ ورودی استفاده نمی‌کند؛ popup و graph-viewer با `textContent`/DOM API رندر می‌شوند (تست: `scripts/test/devtools-message-schema.test.mjs`).

