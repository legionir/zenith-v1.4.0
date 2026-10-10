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
- الزام پذیرش: `expectTypeOf<ReadonlySignal<number>>().toMatchTypeOf<Readable<number>>()` در `packages/shared/test/types.test-d.ts` (اجرا با `vitest --typecheck`؛ اگر `Computed`/signal برند را از دست بدهد، CI قرمز می‌شود). `tsd` اضافه نمی‌شود چون vitest 2.x typecheck بومی دارد و dev-dep جدید + زیرساخت دوم لازم نیست (سادگی، §4 دستورالعمل).

## پیامدها

- یک منبع حقیقت برای `MaybeSignal`/`Readable`؛ پکیج‌های L2+ (cache/storage/ui) همان را مصرف می‌کنند.
- تست نوع بخشی از unit job CI است؛ شکست type-test merge را بلاک می‌کند.
- هیچ تغییر runtime لازم ندارد (brand DEC-009 از قبل روی prototypeهاست)؛ فقط type و aliasها.
- #117 (API-CONVENTIONS) الگوی «alias به‌جای redefine» را برای سایر تایپ‌های تکراری تعمیم می‌دهد.
