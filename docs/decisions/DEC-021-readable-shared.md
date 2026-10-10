# DEC-021: `Readable<T>` ساختاری در `shared` — ساخت روی brand موجود (DEC-009) + الزام تست نوع

- وضعیت: پذیرفته‌شده • ۲۰۲۶-۱۰-۱۰ • issueهای مرتبط: #175 (main)، #141 (پکیج shared)، #187/DEC-009 (brand)، #117 (API-CONVENTIONS)

## زمینه

`NEW-PACKAGES-SPEC.md` ریسک ۲: تایپ `MaybeSignal` امروز در دو جا تعریف شده (`state` و `runtime`/`events`) و پکیج جدید `shared` می‌خواهد `Readable<T>` (اتصال‌پذیری read-only) را به‌عنوان منبع واحد تعریف کند. شرط SPEC: «باید با تست نوع ثابت شود `ReadonlySignal` آن را برآورده می‌کند». #187/DEC-009 brand تشخیص runtime را با `Symbol.for('zenith.readable')` حل کرده بود؛ این ADR فقط لایهٔ **تایپ** را می‌بندد.

## گزینه‌ها

- **الف) `Readable<T> = { get(): T }` شل ساختاری** — هر آبجکت دارای `get` (Map-like، serviceها) pass می‌شود؛ همان دام‌typing که DEC-009 در runtime رد کرد. ❌
- **ب) interface با brand اختیاری phantom (`readonly [READABLE]?: true`)** — نیاز به تغییر کلاس‌ها ندارد، ولی assignability اجباری نیست و تست نوع پوچ می‌شود. ❌
- **ج) `Readable<T>` در `shared` به‌صورت structural با دو عضو `get()` + brand تایپی از `@zenith/state` (`Computed`/`ReadonlySignal`)؛ تطابق با `expectTypeOf` در تست نوع (`vitest` type-check) قفل می‌شود؛ `MaybeSignal` موجود در state alias می‌شود تا منبع واحد بماند.** ✅

## تصمیم و دلیل

گزینهٔ ج. `shared` (#141) این تایپ‌ها را تعریف می‌کند:
- `Readable<T>`: `get(): T` + عضو برند (هم‌راستا با `Symbol.for('zenith.readable')` DEC-009؛ در سطح نوع با نماد declared از state).
- `MaybeSignal<T> = T | Readable<T>` (alias واحد؛ defineهای state/events به import از shared تبدیل می‌شوند).
- الزام پذیرش: `expectTypeOf<ReadonlySignal<number>>().toMatchTypeOf<Readable<number>>()` در `packages/shared/test/types.test-d.ts` (اجرا با `vitest --typecheck`؛ اگر `Computed`/signal برند را از دست بدهد، CI قرمز می‌شود). `tsd` اضافه نمی‌شود چون vitest 3.x typecheck بومی دارد و dev-dep جدید + زیرساخت دوم لازم نیست (سادگی، §4 دستورالعمل).


## اجرای #141 (۲۰۲۶-۱۰-۱۰)

- `packages/shared` ساخته شد (L0؛ dependency فقط `errors@1.4.0`؛ ESM-only طبق
  DEC-027؛ نسخهٔ تولد `1.5.0` طبق DEC-026). `Readable`/`MaybeReactive` دقیقاً
  همان `interface { get(): T }` ساختاری (بدون عضو برند در سطح نوع — گزینهٔ «ب»
  رد‌شده در عمل گزینهٔ «ج»ی شد که فقط type را قفل می‌کند: برند runtime در state
  دست‌نخورده است).
- تست نوع: `packages/shared/test/types.test-d.ts` با `expectTypeOf` —
  Signal/Computed/ReadonlySignal هر دو طرفه با `Readable` و
  `MaybeSignal`(state) ≡ `MaybeReactive`(shared). چون vitest 3 بدون پیکربندی
  جدا typecheck را اجرا نمی‌کند و `--typecheck` کل suite را کند/fragile می‌کرد،
  دروازه در `scripts/test/shared-type-test.test.mjs` مستقیماً `tsc -p
  packages/shared/tsconfig.tests.json` را run می‌کند (همان مسیر اجرای DEC-021،
  فقط runner متفاوت؛ mismatch به شکل compile error قرمز می‌شود).
- **انحراف مستدل از «defineهای state/events به import از shared تبدیل
  می‌شوند»:** `@zenith/state` singleton publish‌شده است و هر یال
  state→shared (حتی type-only که در `.d.ts` باقی می‌ماند) در نصب تمیز
  peer-single-instance (#46) به dependency اعلام‌نشده منجر می‌شد — تست شد و
  همان‌جا شکست. بنابراین `MaybeSignal` در `packages/state/src/index.ts` به‌صورت
  **alias محلی** (`T | Readable<T>` با `Readable` خود state؛ ساختاراً identical)
  اعلام شد و هم‌ارزی دوطرفه در تست نوع قفل شده است. الگو: پکیج‌های publish‌شدهٔ
  L1 به بالا نمی‌توانند به shared یال type-only هم بدهند مگر آن dependency در
  package.jsonشان اعلام شود؛ مصرف P0 جدید (logger/cache/…) از shared عادی است
  چون آن پکیج‌ها تازه‌اند و deps خود را کامل اعلام می‌کنند.
- حذف تکرار (کار ۳): `CleanupFn` تکراری در `packages/state/src/effect.ts` حذف
  و از `context.ts` (منبع موجود) import type شد؛ `DEFAULT_*`ها پس از scan
  خصوصی/مختص پکیج بودند (تجمیع معنادار نیست — در #117 بازبررسی می‌شود).
  `secureId`/`isServer` تکراری در runtime/ssr بازنویسی نشد: re-export runtime
  از shared یال جدید در dist می‌ساخت (peer-single-instance همان دلیل را رد
  کرد)؛ canonical در shared برای پکیج‌های جدید #143+ است و مهاجرت مصرف‌کنندهٔ
  قدیمی با حذف‌های ۲.۰ (#58) انجام می‌شود.

## پیامدها

- یک منبع حقیقت برای `MaybeSignal`/`Readable`؛ پکیج‌های L2+ (cache/storage/ui) همان را مصرف می‌کنند.
- تست نوع بخشی از unit job CI است؛ شکست type-test merge را بلاک می‌کند.
- هیچ تغییر runtime لازم ندارد (brand DEC-009 از قبل روی prototypeهاست)؛ فقط type و aliasها.
- #117 (API-CONVENTIONS) الگوی «alias به‌جای redefine» را برای سایر تایپ‌های تکراری تعمیم می‌دهد.
