# DEC-035: «یک نام، یک معنا» در سطح عمومی پکیج‌ها (گیت AST + allowlist مستند)

- وضعیت: پذیرفته‌شده (موج ۸، #119)
- تاریخ: 2026-10-15
- مرتبط: #119 (نام‌های تکراری export)، #144 (`clearCache`→`clearHttpCache`)، #147 (رجیستری‌های devtools)، #115 (hub خطای واحد)، DEC-021 (Readable در shared)، DEC-019 (رجیستری deprecation)، DEC-026 (حذف در ۲.۰)

## زمینه

مخزن ۵۰ پکیج عمومی دارد و نام‌های export در **دو پکیج مختلف** می‌توانند معنای
متفاوت بدهند بدون اینکه هیچ گیت فعلی آن را ببیند:

- `@zenith/expressions.validate(node)` دربارهٔ **امنیت AST** بود،
  `@zenith/schema.validate(schema, input)` دربارهٔ **اعتبارسنجی داده** — یک
  نام، دو کار، همان‌طور در auto-import IDE.
- `registerCache` در `@zenith/devtools-core` (رجیستری **پنل**) و
  `@zenith/cache` (رجیستری **کش واقعی**)؛ همین برای `registerStore`
  (`@zenith/store`)، `registerSignal`/`recordStateChange`
  (`@zenith/devtools` در برابر `@zenith/devtools-core`).
- `prefersReducedMotion` و `secureId` **دو پیاده‌سازی نزدیک‌به‌یکسان** در دو
  پکیج داشتند (نشت منطق، خطر واگرایی).
- `deprecate` در `@zenith/errors` (کد رجیستری + نام) و `@zenith/logger`
  (نام + since) دو امضای مختلف داشت.

هیچ‌کدام از گیت‌های موجود (cleanup-hygiene، error-hygiene، attribute-grammar،
`check-unique-type-names`) سطح export *نام‌ها* را به‌صورت cross-package
نمی‌سنجید. `check-unique-type-names` فقط **نوع‌ها** را می‌بیند و نام‌های
مقداری/تابعی را نه.

## گزینه‌ها

- **الف) ممیزی دستی و مستندسازی** — بدون گیت برمی‌گردد؛ تجربهٔ موج‌های قبل نشان
  داد مستندات بدون اجرا دوام نمی‌آورد. ❌
- **ب) تغییر نام کامل و بدون alias** — شکنندهٔ semver (DEC-026 اجازه نمی‌دهد در
  minor بشکنیم). ❌
- **ج) گیت AST روی سطح عمومی + rename با alias `@deprecated` + allowlist
  مستدل** ✅

## تصمیم

1. **قاعده:** یک نام export عمومی نباید در دو پکیج **دو معنا** داشته باشد.
   تخلف = نامی که در ≥۲ پکیج `origin: local` و `tag: public` دارد و در allowlist
   نیست.
2. **facadeها تخلف نیستند:** re-export از پکیج دیگر (`zenith` → بقیه) معنای
   واقعی را در پکیج مبدأ دارد؛ `scripts/lib/public-exports.mjs` منشأ هر نام را با
   AST TypeScript و پیمایش `export *` حل می‌کند.
3. **aliasها تخلف نیستند:** نام قدیمی با JSDoc `@deprecated` +
   `deprecate('ZEN-DEPR-0xx', …)` علامت می‌خورد و در ۲.۰ می‌رود (DEC-026).
4. **استثنا فقط با دلیل نوشته‌شده** در `scripts/unique-export-names.allowlist.json`
   با `status` ∈ {`same-meaning`، `layered`، `convention`} و `reason` اجباری؛
   ردیف **بی‌استفاده** هم خطا است تا فهرست واقعی بماند (وگرنه allowlist به
   زامبی تبدیل می‌شود).
5. **اجرا:** `npm run check:unique-exports` در job `deps` + تست
   `scripts/test/unique-export-names.test.mjs` (شامل probe منفی روی workspace
   مصنوعی در tmpdir).
6. **اصلاح‌های همین موج** (ZEN-DEPR-042..046 و 049..051):
   `registerDevtoolsCache`/`registerDevtoolsStore`، `registerPanelSignal`/
   `recordPanelStateChange`، `invalidateFetchCache`، `validateAst`
   (`@zenith/expressions`)، `warnDeprecated` (`@zenith/logger`)، `mockFetch`
   (`@zenith/testing`)؛ و یکتاسازی منبع `prefersReducedMotion` و `secureId` در
   `@zenith/shared` و نوع `Readable` در `@zenith/shared`.

## پیامدها

- مصرف‌کننده‌های نام‌های قدیمی یک هشدار یک‌بارهٔ `ZEN-DEPR-0xx` می‌بینند و در
  ۲.۰ باید مهاجرت کنند (فهرست در `docs/ERROR-CODES.md`).
- افزایش وابستگی: `security`/`state`/`transition` به `@zenith/shared` (L0→L0،
  بدون چرخه؛ `security → logger → shared` از قبل بود). `charts` و `transition`
  دیگر پیاده‌سازی موازی `prefersReducedMotion` ندارند.
- allowlist فعلی ۱۲ ردیف دارد: یک `convention` (`DEFAULTS`، §۳ قراردادها) و ۱۱
  ردیف `layered`/`same-meaning`؛ هر ردیف جدید نیاز به بازبینی در PR دارد.
- گیت روی *نام* حساس است نه امضا: دو نام متفاوت با امضای شبیه هنوز مجازند؛
  یکدست‌سازی امضاها کار #55/#118 است.
- موارد معلق (تصمیم نه‌گرفته): `hydrate`/`HydrationResult` بین
  `@zenith/runtime-core` و `@zenith/ssr` (شکل نتیجه متفاوت است) و
  `watch`/`WatchOptions` بین `@zenith/state` و `zenith` (سطح گزینه‌ها متفاوت).
  هر دو در allowlist با دلیل ثبت شده‌اند تا یکی‌سازی در موج بعدی انجام شود.
