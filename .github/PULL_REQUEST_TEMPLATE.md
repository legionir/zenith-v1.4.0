<!--
#85 (STD): قالب PR — چک‌لیست انطباق با قرارداد API و کیفیت.
فصل‌های docs/API-CONVENTIONS.md و AGENT-INSTRUCTIONS.md مرجعند.
-->

## توضیح تغییر

<!-- خلاصهٔ یک‌خطی + زمینه (issue لینک‌شده). -->

Closes #

## نوع تغییر

- [ ] 🐛 رفع باگ
- [ ] ✨ قابلیت جدید
- [ ] 📝 مستندات
- [ ] 🔧 ابزار/CI/چرخهٔ انتشار
- [ ] 💥 تغییر ناسازگار (بازبینی-versioning لازم)

## چک‌لیست انطباق با قرارداد API

- [ ] API مطابق `docs/API-CONVENTIONS.md` است: options-object (§1)، نامی کامل‌خوانا (§3)، sanitize/validate ورودی (§4) و TSDoc کامل.
- [ ] برای هر `*Options` جدید، `DEFAULTS` منجمد همراه TSDoc `@default` گذاشته شده (`npm run check:defaults` سبز).
- [ ] خطاها از مدل واحد `ZenithError`/کدهای ZEN-#### پیروی می‌کنند؛ بدون `console.*` جدید (خطاهای error-hygiene سبز).
- [ ] پروتکل cleanup: ایجاد منابع جدید `dispose()`/`Cleanup` برمی‌گرداند (`check:cleanup` سبز).
- [ ] بدون `any` در API عمومی (`check:public-any`).
- [ ] برای رفتار جدید تست نوشته‌ام و test suite کامل سبز است (`npm run ci`).

## یادداشت برای بازبین

<!-- خطرناک/غیربدیعی‌ها: تغییری که ممکن است همه‌جی اثر بگذارد. -->
