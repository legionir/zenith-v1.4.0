# DEC-027: حداقل Node همان `18.19` می‌ماند؛ ESM-first با CJS فقط برای ابزارها

- وضعیت: پذیرفته‌شده • ۲۰۲۶-۱۰-۱۰ • issueهای مرتبط: #175 (main)، #14/DEC-007 (engines فعلی)، #20 (Node 18 EOL)، SPEC §۰.۶

## زمینه

`NEW-PACKAGES-SPEC.md` ریسک ۸: «`Node` حداقل (۱۸٫۱۹ یا ۲۰) و dual ESM/CJS». مخزن امروز در ریشه و ۳۵ پکیج `engines: >=18.19` دارد (#14، گیت `scripts/test/engines.test.mjs`) و exports شرطی `import`+`require` (`.cjs` build). نکتهٔ تقویمی: Node 18 در ۲۰۲۵-۰۴ EOL شد؛ امروز ۲۰۲۶-۱۰ است.

## گزینه‌ها

- **الف) bump به ۲۰** — شکستن سازگاری برای مصرف‌کنندهٔ مستقر روی Node 18 بدون نیاز فنی؛ هر feature 20-only (globalThis.crypto مطمئن، `require(esm)`) امروز مصرف نشده. ❌ (برای 1.x)
- **ب) حفظ `>=18.19` تا `2.0.0`؛ bump به `>=20.19` فقط با major ۲ (هم‌زمان با DEC-026 حذف‌ها)، با اعلام قبلی در CHANGELOG و README**. ✅
- **ج) حذف کامل CJS (ESM-only)** — ابزارهایی که در اکوسیستم CJS (jest قدیمی، scss-loaderهای سازمانی) مصرف می‌شوند می‌شکنند؛ SPEC خود «CJS برای ابزارها» را نگه داشته. ❌

## تصمیم و دلیل

گزینهٔ ب برای floors و قرارداد موجود برای format:
- **Floor:** همان #14/DEC-007 (`18.19`) — هیچ تست/قید فنی در مخزن bump را ایجاب نمی‌کند؛ §4.3 دستورالعمل (سازگاری رو به عقب مقدم). EOL بودن Node 18 یک ریسک پشتیبانی است نه فنی؛ با اعلام در README و جدول #59 مدیریت می‌شود و در ۲.۰ برداشته می‌شود.
- **Format:** SPEC §۰.۶ — ESM اولویت؛ `require` export فقط برای پکیج‌های tooling (`cli`, `vite-plugin`, `unplugin-*`, `codemod`, `create-zenith`, `eslint-plugin`, `language-server`؛ اینها امروز dual‌اند و بیلد `.cjs` می‌سازند). پکیج‌های جدید runtime/L2 از ابتدا **ESM-only** با `exports` شرطی بدون `require` (publint #74 این را چک می‌کند)؛ دلیلهای فنی: top-level await در بعضی مسیرها، tree-shaking دقیق‌تر، و حذف دمسیرگیِ بیلد از ۳۴ پکیج غیرابزاری در ۲.۰ (#20).

## پیامدها

- تست engines موجود (#14) بدون تغییر سبز می‌ماند؛ در ۲.۰ با یک PR bump و اعلام قبلی در README/CHANGELOG انجام می‌شود.
- `.size-limit`/build بدون تغییر؛ پکیج‌های جدید wave 2 با `format: module` و بدون `.cjs` متولد می‌شوند.
- #20 (cleanup) جدول سازگاری Node را در README به‌روز می‌کند؛ #80–#85 release notes شرط bump ۲.۰ را pre-flight checklist می‌کنند.
