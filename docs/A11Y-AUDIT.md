# ممیزی و استانداردهای دسترس‌پذیری WCAG 2.2 AA در Zenith (`#98`)

این سند نتایج ممیزی کامل دسترس‌پذیری (Accessibility) فریم‌ورک Zenith بر اساس معیارهای **WCAG 2.2 Level AA** و راهنمای **WAI-ARIA Authoring Practices Guide (APG) 1.2** را ثبت می‌کند.

---

## ۱. ماتریس انطباق کامپوننت‌ها و پکیج‌ها با WAI-ARIA APG و WCAG 2.2 AA

| پکیج | الگوی WAI-ARIA | ویژگی‌های ARIA و مدیریت فوکوس | کلیدهای صفحه‌کلید (LTR و RTL) | وضعیت |
|------|---------------|------------------------------|-------------------------------|-------|
| `@zenith/notifications` | Alert / Status / AlertDialog | `role="alert"` (برای `error`/`warning`)، `role="status"` (برای `info`/`success`)، `aria-live="assertive" \| "polite"`، `aria-atomic="true"`، `role="alertdialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby` | `Escape` (بستن دیالوگ)، `Tab` / `Shift+Tab` | ✅ منطبق |
| `@zenith/router` | Navigation / SPA Live Announcer | `announceRouteChange()` با ناحیهٔ `role="status" aria-live="polite" aria-atomic="true"`؛ `syncActiveRouteLinks()` با `aria-current="page"` | `Enter` روی لینک‌های مسیر | ✅ منطبق |
| `@zenith/transition` | Motion & Animation (SC 2.3.3) | `prefersReducedMotion()` با بررسی `(prefers-reduced-motion: reduce)` و صفر کردن زمان انیمیشن با حفظ استایل نهایی | — | ✅ منطبق |
| `@zenith/data-table` | Grid / Sortable Table | `aria-sort="ascending" \| "descending" \| "none"`, `scope="col"`, `aria-selected="true" \| "false"` | `Enter` / `Space` روی سرستون‌های قابل‌مرتب‌سازی | ✅ منطبق |
| `@zenith/form` | Form Validation & Error Association | پیوند خطاهای اعتبارسنجی با `aria-invalid="true"` و `aria-describedby` | `Tab`، `Shift+Tab`، `Enter` | ✅ منطبق |
| `@zenith/virtual-list` | Virtualized List | حفظ `aria-hidden="true"` روی spacer، حفظ شاخص منطقی آیتم‌ها در اسکرول | `ArrowUp` / `ArrowDown`، پشتیبانی کامل افقی RTL (`#89`) | ✅ منطبق |
| `@zenith/i18n` | Language & Bidirectional Text (SC 1.3.2, 3.1.1, 3.1.2) | `applyDocumentDirection(locale)` برای تنظیم همزمان `lang` و `dir="rtl" \| "ltr"`، `isolateBidi()` با ایزوله‌های یونیکد (`U+2066..U+2069`)، `resolveHorizontalStep()` | معکوس‌سازی خودکار `ArrowLeft`/`ArrowRight` در `dir="rtl"` | ✅ منطبق |

---

## ۲. کنتراست رنگ و رسانه (`prefers-reduced-motion` و `forced-colors`)

- **کنتراست متن عادی (SC 1.4.3)**: نسبت کنتراست تمامی توکن‌های متنی اصلی در برابر پس‌زمینه حداقل **۴.۵:۱** است.
- **کنتراست اجزای رابط کاربری و فوکوس (SC 1.4.11 و SC 2.4.11)**: حلقهٔ فوکوس (`:focus-visible`) دارای ضخامت حداقل `2px` و نسبت کنتراست ≥ **۳:۱** است و در حالت ویندوز High Contrast (`@media (forced-colors: active)`) از `outline: 2px solid Highlight` استفاده می‌کند.
- **کاهش حرکت (SC 2.3.3)**: تابع `prefersReducedMotion()` در `@zenith/transition` به صورت خودکار `window.matchMedia('(prefers-reduced-motion: reduce)')` را بررسی کرده و در صورت فعال بودن، انیمیشن‌های `zenAnimate` را بدون حرکت (`duration: 0`) به وضعیت نهایی می‌برد.

## تست خودکار axe-core در e2e (#99)

- `e2e/axe.spec.ts` با `@axe-core/playwright` (تگ‌های `wcag2a/2aa/21a/21aa/22aa`) روی دموها
  (`demos/*`، `ecommerce-demo`، `dashboard`) و fixture کامپوننت‌ها اجرا می‌شود و در CI روی
  Chromium/Firefox/WebKit است؛ گزارش HTML به‌صورت artifact `playwright-report` منتشر می‌شود.
- آستانه: هر نقض با impact برابر `serious` یا `critical` تست را می‌شکند.
- استثنا فقط در `e2e/a11y-allowlist.ts` و با دلیل مکتوب؛ فهرست عمداً خالی است.
- یک تست خودآزمون نقض عمدی (`button-name`، `image-alt`) را تزریق می‌کند تا ثابت شود گیت پوچ عبور نمی‌کند.
- هر صفحه حداقل تعداد المان رندرشده دارد تا «صفحهٔ خالی» به‌عنوان موفقیت حساب نشود.
