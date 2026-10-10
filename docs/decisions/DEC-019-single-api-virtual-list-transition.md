# DEC-019: تثبیت یک API برای virtual-list و transition؛ wrapper + ZEN-DEPR به‌جای حذف

- وضعیت: پذیرفته‌شده • ۲۰۲۶-۱۰-۱۰ • issueهای مرتبط: #47 (main)، #58 (سیاست deprecation)، #28/#91 (تست‌های DOM/SSR آتی)

## زمینه

`AUDIT.md`/`ARCHITECTURE.md` §۹ و issue #47 سه مورد «دو مسیر موازی» را گزارش می‌کردند:

1. `virtual-list`: `controller.ts` (`createVirtualList`) در کنار `virtual-list.ts` (`processVirtualList`) — هر کدام حلقهٔ کامل مجازی‌سازی، اندازه‌گیری و spacer مستقل با دو مجموعه باگ متفاوت (باگ‌های #17/#19 فقط در controller رفع شده بودند).
2. `transition`: `transition.ts` (کلاس‌محور) و `animate.ts` (WAAPI) و داخل `transition.ts` هم دو موتور (CSS-class و WAAPI-first) برای enter/leave.
3. `suspense`: `createSuspense` در کنار `processSuspense` و `createSuspenseContext` موقعیتی.

معیار پذیرش #47: هر قابلیت فقط یک مسیر پیاده‌سازی؛ API قدیمی صرفاً wrapper با هشدار deprecation یک‌باره `ZEN-DEPR-xxx`؛ تست هر دو API سبز.

## گزینه‌ها

- **الف) حذف API قدیمی** — سازگاری رو به عقب را می‌شکند؛ خلاف بند ۴.۳ دستورالعمل و سیاست #58. ❌
- **ب) wrapper روی موتور مبنا + `deprecate()`** (alias + هشدار یک‌باره، حذف در major بعدی). ✅
- **ج) ادغام فیزیکی در یک فایل** — تغییر نام API عمومی را می‌شکند و diff بزرگ بی‌فایده. ❌

## تصمیم و دلیل

1. **virtual-list** — موتور مبنا `createVirtualList` است. `processVirtualList` به wrapper تبدیل شد: attributeهای zen-* را به options ترجمه می‌کند، template را clone و context `$item`/`$index` را وصل می‌کند، و disposeهای per-item را با `registerVirtualListNodeDisposes` به موتور می‌سپارد. به موتور چند hook افزوده شد (`getState`، `onItemUpdated`، `onNodeRemoved`، اجرای disposeهای ثبت‌شده پیش از حذف نود) تا رفتار قابل‌مشاهدهٔ wrapper حفظ شود.
   - حالت خاص SSR: موتور به DOM واقعی نیاز دارد؛ wrapper در نبود `document` همهٔ آیتم‌ها را بدون مجازی‌سازی رندر می‌کند (رفتار قبلی حفظ شد — این «رندر کامل سرور» است، نه دومین پیاده‌سازی مجازی‌سازی).
   - `zen-dynamic-heights` روی measurements موتور مبنا (ResizeObserver با کلید پایدار) سوار شد؛ با `itemChanged` #17 و `untrack` #19 سازگار است.
2. **transition** — موتور مبنا `createTransition` (کلاس‌محور) است. دو موتور داخل `transition.ts` (WAAPI-first و CSS-class) حذف و `enterTransition`/`leaveTransition`/`animateGroup` wrapper شدند. `animate.ts` (`zenAnimate`/`zen-animate`) **حفظ** شد: طبق `ARCHITECTURE.md` و `NEW-PACKAGES-SPEC.md` قابلیت مجزایی با مسئولیت متفاوت (keyframes جاوااسکریپتی بدون CSS) است، نه پیاده‌سازی موازی transition کلاس‌محور؛ اسناد #47 هم آن را directive جدا می‌شناشد.
3. **suspense** — بررسی شد و **تغییر نمی‌کند**: `createSuspense` خودش wrapper روی `createSuspenseContext` است و `processSuspense` همان context را مصرف می‌کند؛ یک هسته وجود دارد. آرگومان‌های موقعیتی `createSuspenseContext(timeoutMs, onSettle)` موضوع #55 است.
4. **زیرساخت هشدار** — `deprecate(code, old, replacement, hint?)` + `resetDeprecationWarnings()` در `@zenith/errors` (یک‌بار به‌ازای کد، خاموش با `__ZENITH_DEV__ === false` — همان الگوی ZEN-404 در #62). بازهٔ کامل `ZEN-DEPR-xxx` و شماره‌های ۰۰۱–۰۰۴ در #171 ثبت/بازبینی می‌شود. کدها: DEPR-001 `processVirtualList`، DEPR-002 `enterTransition`، DEPR-003 `leaveTransition`، DEPR-004 `animateGroup`.
5. **مصرف‌کنندهٔ داخلی** — `runtime/directives/if.ts` از enter/leave deprecated استفاده می‌کرد و باعث می‌شد هشدار ZEN-DEPR در برنامهٔ کاربر دیده شود؛ روی `createTransition` مهاجرت کرد (run.cancel + controller.dispose برای semantics قبلی). دموها و fixtureها نیز به API مبنا منتقل شدند.

## پیامدها

- دو حلقهٔ مجازی‌سازی و چهار موتور transition به یکی تقلیل یافت؛ باگ‌های بعدی یک‌جا رفع می‌شوند.
- API عمومی v1.4 دست‌نخورده ماند (wrapperها exportها و signatureهایشان را نگه داشتند؛ `VirtualListConfig`/`VirtualRange`/`VirtualListController` همچنان exportند).
- تست‌های جدید: `packages/errors/test/deprecate.test.ts` (۴)، `packages/transition/test/transition-deprecation.test.ts` (۶)، `packages/virtual-list/test/process-virtual-list-deprecation.test.ts` (۵)، `packages/runtime/test/if-transition-deprecation.test.ts` (۲) — همه red-before-fix.
- حذف نهایی wrapperها در major بعدی (۲.۰) طبق سیاست #58؛ تا آن زمان فقط هشدار.
- e2e transition fixture به `@zenith/errors` importmap نیاز پیدا کرد (transition dist الآن آن را import می‌کند) — اضافه شد.
