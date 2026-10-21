# DEC-029: مرزهای @zenith/schema — بدون console با reporter تزریق‌شده، zod دونگی، subpathها و امضای سازگار form

- **وضعیت:** پذیرفته‌شده
- **تاریخ:** 2026-10-10
- **مسئله مرتبط:** #142 (SPEC §۲.۲)، مبتنی بر DEC-020/021/026/027/028

## زمینه

`@zenith/schema` لایهٔ L0 است (فقط `errors` + `shared`) و باید چهار خواستهٔ
یکجا را جواب دهد: اعتبارسنجی options با کدهای `ZEN-1001..1004`، تولید
JSON Schema برای ابزارها، متادیتای directive با اسنپ‌شات CI، و میزبانی
منطق خالص `fromZod/fromJsonSchema/validateWithZod` که از `form` استخراج
می‌شود. تعارض‌ها:

1. قاعدهٔ `no-console` برای src همهٔ پکیج‌ها اجباری است (#143) و فهرست
   ratchet ۶۲فایل قدیمی قفل است؛ اما SPEC حالت `mode:'warn'` را دارد.
2. SPEC می‌گوید «peer اختیاری zod»؛ افزودن peerDependency واقعی برای یک
   duck-type بی‌مصرف است و گیت peer-rule/#70 را درگیر می‌کند.
3. امضاهای form (`fromZod(zod, cfg) ⇒ FormStore`) با منطق خالص L0 سازگار
   نیستند — L0 نمی‌تواند FormStore بسازد.
4. ورک‌اسپیس برای subpathها (مثل `@zenith/service-worker/sw`) alias صریح در
   vitest/typecheck-all می‌خواهد و build-package فقط `src/index.ts` را bundle
   می‌کند.

## گزینه‌ها

- **A. console.warn مستقیم در mode warn** — رد: نقض دروازهٔ no-console و
  سیاست «لاگ فقط از راه logger».
- **B. reporter تزریق‌شده (duck-seam) با پیش‌فرض سکوت** — پذیرفته.
- **C. zod به‌عنوان optional peerDependency اعلام شود** — رد: هیچ import
  واقعی از zod وجود ندارد؛ peer بی‌مصرف نصب/گیت‌ها را آلوده می‌کند. الگوی
  دونگی DEC-021 (مثل `Readable` در shared) دقیقاً همین وضعیت را پوشش می‌دهد.
- **D. تغییر امضاهای form در جریان مهاجرت** — رد: شکست سازگاری در minor
  (DEC-026: حذف فقط در 2.0). wrapperهای FormStore-sاز در form می‌مانند،
  delegate + `deprecate()`.
- **E. bundle کردن subpathها با esbuild + paths صریح در vitest/typecheck-all**
  — پذیرفته (الگوی service-worker؛ همان‌جا precedent «deviation مستند» وجود
  دارد اما schema می‌تواند exports map کامل داشته باشد چون dist/x.js قابل
  تولید است).

## تصمیم و دلیل

1. **warn reporter:** `setSchemaWarnReporter(fn)` ماژول-سطحی؛ حالت
   `mode:'warn'` آن را صدا می‌زند و بدون reporter **ساکت** است. مصرف‌کنندهٔ
   بالاتر (runtime در #148) آن را به `@zenith/logger` وصل می‌کند. خطای throw
   از `createReservedError(code)` کاتالوگ #171 می‌آید؛ هیچ `new Error` خامی
   از validate خارج نمی‌شود (فقط TypeError مصرفی json-schema، الگوی
   `shared/assert.ts`).
2. **zod دونگی:** interface `ZodLike = { safeParse }`؛ zod هرگز dep نیست.
   خروجی schema builder (`fromZod ⇒ s.custom`) داخل nestها (`s.object`)
   قابل استفاده است — تست‌شده.
3. **amضاها:** API جدید schema layer-clean است
   (`validateWithZod(zodSchema, input) ⇒ SafeResult`؛
   `fromJsonSchema(doc) ⇒ Schema`). form توابع قدیمی را با همان signature
   نگه داشته و به schema delegate کرده (validateWithZod) یا منطق فرم‌محور
   (استخراج rules → FormStore) را نگه داشته؛ هر سه `deprecate()` با
   ZEN-DEPR-016..018 (رجیستری errors؛ حذف در 2.0.0 — DEC-026).
4. **subpathها:** exports map کامل `./zod` و `./json-schema` به dist؛
   `build-package.mjs` برای هر subpath declared در exports یک esbuild bundle
   از `src/<name>.ts` می‌سازد (توسعهٔ عمومی؛ هیچ پکیج موجودی subpath ندارد،
   پس رفتارشان تغییر نمی‌کند) و tsc همان‌ها را d.ts می‌کند. aliasهای صریح
   در vitest و paths در typecheck-all اضافه شد.
5. **اسنپ‌شات meta:** `defineDirectiveMeta` رجیستری in-memory دارد؛
   `scripts/gen-zenith-meta.mjs` از seed `docs/meta/zenith.meta.seed.json`
   خروجی پایدار `zenith.meta.json` + `html.customData.json` می‌سازد و
   `--check` در گیت تازگی (`scripts/test/meta-snapshot.test.mjs`) استفاده
   می‌شود — الگوی sync-license --check. directiveهای واقعی در #52/#148/#173
   به همان seed/رجیستری می‌آیند.
6. **ajv:** فقط devDependency ریشه برای اعتبارسنجی meta-schema Draft 2020-12
   در تست؛ هیچ یال runtime از schema به ajv نیست (layering test).

## پیامدها

- مثبت: L0 پاک می‌ماند (بدون console، بدون zod، بدون ajv)؛ حالت prod کاملاً
  ساکت و قابل‌تزریق؛ form بدون شکست سازگاری migrate شد؛ subpath build برای
  پکیج‌های بعدی (#148 runtime-core) آماده است؛ اسنپ‌شات meta در CI drift
  نمی‌کند.
- منفی/ریسک: سکوت پیش‌فرض warn یعنی بی‌توجهی مصرف‌کننده = بی‌هشدار (آگاهانه؛
  همان policy DEC-020 که dev throw است و prod سکوت/هشدار از seam). seed meta
  فعلاً سه directive هستوی دارد و کامل نیست — تا #173 hand-maintained است و
  تست ساختار/مرتب‌بودن آن را کنترل می‌کند. `fromJsonSchema` subset است
  (allOf/oneOf ⇒ pass-through custom) — مستند در README پکیج.
