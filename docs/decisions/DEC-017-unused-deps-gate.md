# DEC-017 — گیت «وابستگی بلااستفاده»: اسکریپت هدفمند به‌جای depcheck/knip

- **تاریخ:** 2026-10-10
- **وضعیت:** پذیرفته‌شده
- **مرتبط:** Issue #45، `scripts/unused-zenith-deps.mjs`، `.github/workflows/main.yml` (job: deps)

## زمینه

#45 خواست حذف وابستگی‌های اعلام‌شدهٔ بلااستفاده + «افزودن بررسی خودکار
(depcheck/knip) به CI». بررسی مجدد جدول issue نشان داد دو مورد **stal**e است:
`auth→http` و `ssr→router/runtime` در src با `await import('@zenith/…')`
واقعاً استفاده می‌شوند (depcheck قدیمی اینها را miss می‌کرد) و دو مورد
**افزوده** شد: `permission→router` (فقط JSDoc) و `service-worker→runtime`
(فقط کامنت).

گزینه‌ها: depcheck، knip، یا اسکریپت هدفمند.

## تصمیم

اسکریپت `scripts/unused-zenith-deps.mjs` به‌عنوان گیت CI (step در job `deps` +
`npm run deps:unused` + تست واحد در `scripts/test/unused-zenith-deps.test.mjs`):

1. **فقط لبه‌های `@zenith/*`** در dependencies/devDependencies/peerDependencies
   بررسی می‌شوند؛ وابستگی‌های بیرونی (jsdom، @types/…) خارج از دامنهٔ #45اند
   (knip کل‌مخزن برای این دامنهٔ باریک، ابزار اضافی + noise در devDeps
   type-only می‌آورد).
2. «استفاده» = presence در کانتکست `import`/`export`/`require` (خط‌به‌خط روی
   خروجی state-machine حذف‌کامنت که string literalها را نمی‌خورد) — پس
   **dynamic import شمارش می‌شود** و ارجاع صرفاً کامنتی شمارش نمی‌شود.
3. چندخطی‌ها با fallback خط `from '…'` پوشش داده می‌شوند (قرارداد prettier
   repo: importهای چندتایی چندخطی با `} from '@zenith/x';`).
4. شرط پذیرش «گزارش بلااستفادهٔ صفر برای همهٔ ۳۴ پکیج» مستقیماً به‌صورت
   تست روی ریپوی واقعی اجرا می‌شود.

## پیامدها

- حذف‌ها lockfile را سبک کردند (۱۷ خط حذف‌شده در package-lock).
- اگر الگوی غیرمعمول import (مثلاً ساخت dynamic path با variable) آینده
  لازم شود، اسکریپت conservative به سمت سکوت است: path ساخته‌شدهٔ پویا را
  نمی‌بیند و ممکن است usage واقعی را «بلااستفاده» گزارش کند — آنگاه با
  manual review (مثل همین #45) رفع می‌شود؛ importهای متنی/کامنتی هرگز
  usage شمرده نمی‌شوند.
- Knip هنوز انتخاب خوبی برای #74 (publint+attw و lint بسته‌بندی کامل) است؛
  این ADR مانع افزودنش در آنجا نیست.
