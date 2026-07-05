# Zenith DevTools Extension

> Phase 2 — Real Developer Tools

افزونه‌ی Chrome/Firefox برای بازرسی State، Component Tree، Timeline تغییرات، و Effect Viewer در فریم‌ورک Zenith.

## نصب

1. Chrome را باز کنید و به `chrome://extensions/` بروید.
2. "Developer mode" را در بالا-راست فعال کنید.
3. روی "Load unpacked" کلیک کنید.
4. پوشه‌ی `packages/devtools-extension` را انتخاب کنید.

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
├── manifest.json          — Manifest V3
├── popup.html             — UI با 4 tab
├── popup.js               — منطق popup (render همه‌ی panels)
├── content.js             — content script (ارتباط با window.__ZENITH__)
├── background.js          — service worker + DevTools panel creation
├── devtools.html          — DevTools panel entry
├── devtools-panel.js      — ایجاد Zenith tab در DevTools
└── icons/                 — آیکون‌ها
```
