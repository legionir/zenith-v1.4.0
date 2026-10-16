# DEC-037: زیرمسیرهای عمومی از یک جدولِ تنها؛ جایگاه رِجیستری ریستِ فرایند در `@zenith/errors`

- **وضعیت:** پذیرفته‌شده (موج ۴، شرایط تأیید مالک برای #142/#120، #118/#116)
- **تاریخ:** ۲۰۲۶-۱۰-۱۶
- **مرتبط:** DEC-029 (مرزهای schema و بودجهٔ ۴KB)، DEC-034 (شکل `exports`)،
  DEC-027 (ESM-only برای پکیج‌های جدید)، DEC-032 (پروتکل cleanup)، DEC-021
  (`Readable` ساختاری)، DEC-026 (lockstep)، #142، #120، #118، #116، #74

## زمینه

دو تصمیم در موج ۴ گرفته شد که هر دو «مرز عمومی» را تغییر می‌دهند و باید جای
ثبت داشته باشند:

1. **`@zenith/schema/attr`** به‌عنوان زیرمسیر عمومی اضافه شد تا باندل ورودی
   اصلی `@zenith/schema` زیر بودجهٔ **یخ‌زدهٔ ۴KB** (#142/DEC-029) بماند:
   `parseConfigAttr`/`parseJsonAttr`/`parseJsonValue`/`ParseJsonAttrOptions` از
   `index.ts` بیرون رفتند و مصرف‌کننده‌ها (directiveها، ssr، runtime-core) از
   زیرمسیر import می‌کنند. مشکل: ۱۱ زیرمسیر عمومی ورک‌اسپیس، JSON دست‌نویس در
   سه `package.json` بودند. build (`scripts/build-package.mjs`)، auditها
   (attw/publint/pack-audit/install-import) و تست‌ها همه از همان JSON تغذیه
   می‌کنند؛ یک اشتباه تایپی یا یک زیرمسیر فراموش‌شده هیچ‌جا قرمز نمی‌شد — فقط
   موقع نصب مصرف‌کننده.
2. **`onGlobalReset`/`runGlobalResets`** باید جایی بنشینند که `resetForTesting()`
   در `@zenith/testing` و `app.dispose()` بتوانند همهٔ وضعیت سراسری را پاک
   کنند. گزینه‌های طبیعی `@zenith/shared` (بودجهٔ ۲KB) و `@zenith/errors`
   (صفر وابستگی) بودند.

## گزینه‌ها

1. **زیرمسیرها دست‌نویس بمانند و فقط یک تست جدید اضافه شود.** رد شد: تست بدون
   تغییر منبع، دو نسخهٔ حقیقت می‌سازد.
2. **زیرمسیرها از پیمایش `src/*.ts` حدس زده شوند.** رد شد: «کدام فایل عمومی
   است؟» تصمیم طراحی است، نه feature فایل‌سیستم (`sw.ts`، فایل‌های internal و
   کمکی‌ها نباید خودکار عمومی شوند).
3. **جدول صریح در `scripts/lib/exports-shape.mjs` + گیتِ برابری (انتخاب‌شده).**
   فهرست زیرمسیرها یک ورودی عمدی دارد و شکل هر ورودی از `entryFor(name, {dual:false})`
   می‌آید؛ تست `scripts/test/exports-shape.test.mjs` هر ۵۰ `package.json` را با
   جدول مقایسه می‌کند و ردیفِ بی‌فایل یا زیرمسیرِ خارج از جدول را قرمز می‌کند.
4. **رجیستری ریست در `@zenith/shared`.** رد شد: بودجهٔ ۲KB این L0 تنگ است و
   `shared` هیچ‌گاه نباید رِجیستری فرایندی داشته باشد (فقط تایپ/ابزار خالص).
5. **رجیستری ریست در `@zenith/errors` (انتخاب‌شده).** `errors` L0 پایه است،
   هیچ وابستگی‌ای ندارد، و هر پکیج (مستقیم یا از طریق `shared`) از قبل به آن
   وابسته است — پس هیچ یال جدیدی و هیچ بودجهٔ جدیدی لازم نیست.

## تصمیم و دلیل

- **زیرمسیرها:** جدول `PUBLIC_SUBPATHS` در `scripts/lib/exports-shape.mjs` تنها
  منبع است (`subpathExports`/`exportsFor`/`declaredSubpaths`). `standardize-packages.mjs`
  هم از همان تابع می‌نویسد، پس اجرای دوبارهٔ استانداردسازی نمی‌تواند شکل دیگری
  بسازد.
- **بودجهٔ ۴KB بازنگری نمی‌شود.** `@zenith/schema` همان سقف ۴KB (#142) را دارد؛
  `attr` جای «بیرون‌بردن» است، نه بهانهٔ بزرگ‌کردن سقف. اندازه‌گیری فعلی:
  ۳٫۷۸KB از ۴KB — پس استخراج attr الزامی است، نه تزئینی.
- **`attr` یک زیرمسیر ESM-only است** (بدون شرط `require`) طبق DEC-027؛ شکل آن
  دقیقاً `entryFor('attr', { dual: false })` است و attw/install-import/dts-parity
  روی همین کلید اجرا می‌شوند (در CI، روی همهٔ زیرمسیرهای جدول).
- **سطح API عمومی شامل زیرمسیرهاست:** `scripts/generate-api-docs.mjs` هر زیرمسیر
  جدول را به‌عنوان کلید مستقل (`@zenith/schema/attr`) در
  `docs/api/api-surface.snapshot.json` ثبت می‌کند و برایش صفحهٔ مستقل می‌سازد؛
  حذف یا تغییر ناخواستهٔ زیرمسیر در CI قرمز می‌شود.
- **باندل مرورگری/SRI:** `browser-bundles/**` یک آرتیفکت انتشار است (git-ignore
  شده) و هر بار توسط `npm run build:browser` بازتولید می‌شود؛ `integrity.json`
  (sha384 + bytes هر فایل) همان‌جا نوشته می‌شود و e2e
  (`e2e/browser-bundle.spec.ts`) با `<script integrity>` واقعی آن را می‌سنجد.
  هیچ نسخهٔ دست‌نویس/committed وجود ندارد که «به‌روز نشود» — منبع، خودِ build است.
- **جایگاه ریست فرایندی:** `onGlobalReset(hook): Cleanup` و `runGlobalResets()`
  در `@zenith/errors` می‌مانند. رِجیستری روی `globalThis` زیر
  `Symbol.for('zenith.globalReset')` است تا خطر dual-package (ESM+CJS هم‌زمان)
  دو نسخهٔ ماژول نسازد. `Cleanup`/`GlobalResetHook` تایپ محلی‌اند (بدون import از
  `shared`) و هم‌ساختاری‌شان با `Cleanup` رسمی در pass دوم typecheck قفل شده است
  (`packages/shared/test/types.test-d.ts` + `scripts/typecheck-all.mjs`).

## پیامدها

- **مثبت:** هیچ زیرمسیری دست‌نویس نمی‌ماند؛ افزودن زیرمسیر یک ویرایش در یک فایل
  است و بقیه (build/audit/docs/snapshot) خودکار دنبال می‌کند. `@zenith/errors`
  برای ریست فرایندی «صاحب» دارد و بودجهٔ `shared`/`logger` دست‌نخورده می‌ماند.
- **منفی:** جدول باید دستی به‌روز شود (عمدی)؛ `docs/api` برای هر زیرمسیر یک فایل
  بیشتر دارد و تست api-surface شمارش را با جدول هم‌گام می‌داند.
- **خنثی:** رفتار API تغییر نمی‌کند؛ همهٔ ۱۱ زیرمسیر موجود پیش از این هم همین
  شکل را داشتند — این DEC منبعِ حقیقت را یکی می‌کند.
