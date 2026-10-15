# DEC-034: شکل `exports` (انواع جدا برای CJS)، یک `.d.ts` تجمیع‌شده به‌ازای هر ورودی، و `require(esm)` برای پکیج‌های ESM-only

- وضعیت: پذیرفته‌شده (موج ۷، #74)
- تاریخ: 2026-10-15
- مرتبط: #74 (اعتبارسنجی بستهٔ منتشرشده)، #140 (توازن d.ts/JS)، DEC-027 (فرمت dual/ESM-only)، DEC-018 (singleton state/scheduler)

## زمینه

اجرای واقعی `@arethetypeswrong/core` روی tarball پکیج‌ها (که تا اینجا فقط heuristicهای خودمان را داشتیم) سه مشکل واقعی نشان داد:

1. **FalseESM** — در ۳۹ پکیج dual، شرط `require` و `import` هر دو به همان `index.d.ts` اشاره می‌کردند؛ چون `"type": "module"` است، TypeScript آن را ESM می‌بیند و مصرف‌کنندهٔ CJS با Node16 انواع «ESM» می‌گیرد.
2. **InternalResolutionError** — `tsc` برای هر ماژول یک `.d.ts` می‌ساخت که importهای نسبیِ بدون پسوند دارد (`./async`)؛ Node16/NodeNext آن‌ها را resolve نمی‌کند.
3. **`require('@zenith/state')` در عمل شکسته بود** — بیلد CJS هر پکیج dual، `require('@zenith/logger')` (و `cache`/`schema`/`shared`/…) را دارد، ولی این پکیج‌ها طبق DEC-027 ESM-only‌اند و exports آن‌ها فقط `types`+`import` داشت ⇒ `ERR_PACKAGE_PATH_NOT_EXPORTED`.

## گزینه‌ها

- **الف) همه‌چیز را dual کنیم (CJS برای logger/shared/cache/schema/…)** — DEC-027 را برعکس می‌کند و هزینهٔ نگهداری دو بیلد روی لایهٔ L0 دارد. ❌
- **ب) ESM-only‌ها را داخل بیلد CJS هر پکیج inline کنیم** — singletonهای L0 (رجیستری logger، cache، schema) به‌ازای هر پکیج تکثیر می‌شوند و DEC-018 را می‌شکند. ❌
- **ج) شکل استاندارد exports + `.d.cts` + bundle انواع + شرط `default` برای ESM-only** ✅

## تصمیم

1. **dual**: `exports["."] = { import: { types: ./dist/x.d.ts, default: ./dist/x.js }, require: { types: ./dist/x.d.cts, default: ./dist/x.cjs } }`. `.d.cts` هنگام build تولید می‌شود. تعریف یگانه: `scripts/lib/exports-shape.mjs` (استانداردساز، scaffold، build و audits همه از آن می‌خوانند).
2. **ESM-only**: `{ types, import, default }`؛ شرط `default` اجازه می‌دهد `require()` در Node ≥ 20.19 / ≥ 22.12 (`require(esm)`) آن را بارگذاری کند.
3. **انواع**: `tsc` در یک پوشهٔ موقت می‌نویسد و `rollup-plugin-dts` هر ورودی عمومی را به **یک** فایل `.d.ts` کامل تبدیل می‌کند (importهای `@zenith/*`/بیرونی باقی می‌مانند). rollup-plugin-dts modifier `type` را روی re-exportهای خارجی حذف می‌کرد؛ `scripts/lib/dts-bundle.mjs` آن را از روی منبع پیش از bundle برمی‌گرداند (وگرنه d.ts مقدارِ نامصدّر ادعا می‌کرد — #140 دقیقاً همین را می‌گیرد).
4. **ابزار bundle انواع و مجوز (`#78`)**: `rollup-plugin-dts` تنها گزینه‌ای بود که روی هر ۴۹ پکیج درست کار کرد، ولی مجوزش `LGPL-3.0-only` است و گیت `license:check` آن را رد می‌کرد. جایگزین MIT یعنی `dts-bundle-generator` آزموده شد و رد شد: (الف) نوع‌های پکیج‌های همسایهٔ workspace را inline و تکثیر می‌کند (هویت نوع `Signal` بین پکیج‌ها از بین می‌رود مگر با `followSymlinks:false`)، (ب) روی `vite-plugin` در پردازش `postcss.d.mts` crash می‌کند و دور زدنش نیازمند monkeypatch درونی کتابخانه است، (ج) `type` را از re-exportها حذف می‌کند. بنابراین **یک استثنای محدود و مستند** در `scripts/check-licenses.mjs` (`BUILD_ONLY_EXCEPTIONS`) اضافه شد: فقط `rollup-plugin-dts` با دقیقاً همین مجوز و فقط اگر devDependency ریشه باشد و هیچ پکیج قابل‌انتشاری آن را در `dependencies`/`peerDependencies` نداشته باشد. LGPL فقط برای لینک/توزیع خودِ کتابخانه الزام می‌آورد؛ این ابزار منتشر یا لینک نمی‌شود و خروجی‌اش (`.d.ts` تولیدشده از کد خودمان) اثر مشتق نیست. **اگر سیاست سازمان هر LGPL را (حتی build-only) ممنوع می‌کند، این استثنا را بردارید و ابزار bundle را با `api-extractor` جایگزین کنید.**
5. **گیت‌های CI** (job «Package lint»): `pack-audit --pack` (allowlist مثبت tarball، هر target در exports داخل tarball، `.d.cts` برای dual)، `attw-all` (پروفایل کامل برای dual، `esm-only` برای ESM-only)، `install-import-check` (نصب همهٔ tarballها در پروژهٔ تمیز؛ import به‌صورت ESM و CJS؛ `zenith --version`)، و `dts-parity` (#140).

## پیامدها

- **CJS مصرف‌کننده‌ها** (هر پکیجی با `require`) به `require(esm)` نیاز دارد (Node ≥ 20.19 / 22.12)، چون وابستگی‌های ESM-only را require می‌کنند. ESM بدون تغییر از Node 18.19 کار می‌کند. در Node قدیمی‌تر، خطای شفاف `ERR_REQUIRE_ESM` می‌دهد (به‌جای `ERR_PACKAGE_PATH_NOT_EXPORTED` مبهم). Node 18 و 20 در این تاریخ EOL‌اند؛ افزایش floor در 2.0 (DEC-027) این محدودیت را رسمی می‌کند.
- `typescript` در lockfile یک نسخه می‌ماند: `@arethetypeswrong/core` به `5.6.1-rc` پین است و با `overrides` به نسخهٔ ریشه (`$typescript`) هدایت شده (معیار #42).
- `buildPackage` حالا در پوشهٔ کناری `dist.build-<pid>-<n>` می‌سازد و با rename جایگزین `dist/` می‌کند (پیش‌تر `dist/` ابتدا پاک می‌شد و تست‌های موازی `TS7016` می‌گرفتند).
- فایل‌های `*.d.ts.map` و `.d.ts` تک‌ماژولی دیگر در tarball نیستند؛ فقط ورودی‌های تجمیع‌شده.
