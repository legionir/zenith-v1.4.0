# بررسی Scope و نام پکیج‌ها در npm (#77 — NPM Scope & Naming Audit)

## ۱. وضعیت استعلام از رجیستری npm (`https://registry.npmjs.org`)

بررسی وضعیت نام‌های هدف برای انتشار عمومی:

| نام پکیج / Scope | وضعیت در `registry.npmjs.org` | توضیح و تصمیم |
|---|---|---|
| `@zenith/*` (مانند `@zenith/state`, `@zenith/runtime`) | `HTTP 404` (هیچ پکیجی تحت `@zenith/*` منتشر نشده) | نیازمند ثبت/تأیید مالکیت سازمان `zenith` در npmjs.com توسط مالک پروژه (با 2FA اجباری و حداقل ۲ مالک). |
| `zenith` (پکیج چتر L5) | `HTTP 200` (قبلاً در npm ثبت شده است) | در صورتی که اکانت مالک `zenith` در npm متعلق به تیم نباشد، پکیج چتر تحت `@zenith/core-umbrella` یا `@zenithjs/zenith` منتشر می‌شود. |
| `create-zenith` | `HTTP 200` (قبلاً در npm ثبت شده است) | در صورت عدم مالکیت، از `@zenith/create` (`npm create @zenith`) استفاده می‌شود که نیازی به نام بدون اسکوپ `create-zenith` ندارد. |
| `unplugin-zenith` | `HTTP 404` (آزاد) | قابل رزرو مستقیم در npm. |
| `@zenithjs/*` (اسکوپ جایگزین) | `HTTP 404` (آزاد) | اسکوپ جایگزین در صورت عدم دسترسی به سازمان `@zenith` در npm. |

---

## ۲. طرح نام‌گذاری نهایی و برنامهٔ مهاجرت خودکار (Fallback Plan)

1. **طرح اول (پیش‌فرض مخزن):**
   - تمامی پکیج‌های لایه‌های `L0` تا `L4` و ابزارها: `@zenith/<slug>`
   - پکیج چتر `L5`: `zenith` (یا `@zenith/zenith` در صورت تعارض نام بدون اسکوپ)
   - افزونهٔ VS Code: `zenith-vscode` (منتشرشده در VS Code Marketplace، نه npm)
2. **طرح جایگزین (در صورت گرفته بودن سازمان `@zenith` در npm):**
   - اسکریپت `scripts/check-npm-scope.mjs` قابلیت بررسی یکپارچگی نام‌ها و پیش‌نمایش تغییر اسکوپ (`node scripts/check-npm-scope.mjs --plan-scope=@zenithjs`) را فراهم می‌کند تا در یک دستور، نام تمامی پکیج‌ها و وابستگی‌های متقابل `@zenith/*` به اسکوپ جایگزین نگاشت شوند.

---

## ۳. اعتبارسنجی خودکار در مخزن

```bash
node scripts/check-npm-scope.mjs
```

مراحل دستی باقی‌مانده برای مالک مخزن (ثبت سازمان در npmjs.com و فعال‌سازی 2FA) در [`docs/MANUAL-STEPS.md`](../MANUAL-STEPS.md) ثبت شده است.
