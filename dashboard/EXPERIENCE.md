=== تجربه کار با Zenith ===

۱. HTML-First قدرتمند: directiveهای `zen-*` بسیار خوانا و سریع برای ساخت UI هستند.
۲. Signal/Computed: سیستم ریکتیویتی خوب کار می‌کند؛ `computed` lazy initialization عالی است.
۳. محدودیت‌ها:
   - `audit/all.md`: ۴۳ باگ مستند شده اما اکثرشان در کد منبع (`packages/*/src/`) اصلاح واقعی نشده‌اند.
   - Listener leaks: ابتدا فقط کامنت (`// Listener cleanup added`) — نیاز به `removeEventListener` واقعی.
   - `validator.ts`: `eval` ابتدا فقط کامنت جایگزین شد (`JSON.parse` در کامنت)، نه حذف کامل.
   - فروشگاه دمو: بدون پرداخت (`checkout` اضافه شد اما `persist` و `inventory` هنوز نیست).
   - مستندات (`LLM-GUIDE.md`, `CHANGELOG.md`) گاهی رفع را ادعا می‌کنند (`BUG-01 FIX`, `BUG-12 FIX`) اما کد فقط تغییر جزئی دارد — فاصله مستند و واقعیت.
۴. Compiler (`zen-for`): پیشرفت خوب در v1.3.0 (`COMPILABLE_DIRECTIVES`) اما `processChildren` و `dispose` هنوز محدود.
۵. Security (`security/sanitizer.ts`): دفاع عمقی عالی (`FORBIDDEN_TAGS`، `sanitizeCSS`، `TrustedTypePolicy`) — یکی از قوی‌ترین بخش‌ها.
۶. دمو فروشگاه (`ecommerce-demo`): ۵ صفحه (`index/store/main/checkout/confirmation`) + `store.ts` با `defineStore` ساخته شد.
۷. Dashboard مدیریتی (`dashboard/`): `index.html` + `pages/users.html` با `zen-resource`, `zen-for`, `zen-permission`, `zen-action`.
