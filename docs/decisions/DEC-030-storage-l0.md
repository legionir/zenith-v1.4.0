# DEC-030: مرزهای @zenith/storage — سیگنال ساختاری خودکفا، دادهٔ میراث v0، لاگ ASCII و SyncBus تزریق‌پذیر

- **وضعیت:** پذیرفته‌شده
- **تاریخ:** 2026-10-10
- **مسئله مرتبط:** #145 (SPEC §۲.۵)، مبتنی بر DEC-009/018/020/021/026/027

## زمینه

`@zenith/storage` لایهٔ L0 است (فقط `errors` + `shared` + `logger`) و باید
ذخیره‌سازی سه مصرف‌کننده (auth tokenStorage، store persist، سبد demo) را زیر
یک API واحد جمع کند، در حالی‌که چند دروازهٔ هم‌زمان فعال است: layering
(هیچ یال L0→L1 حتی type-only که publish را بشکند)، no-console ratchet (#143)،
ESM-only 1.5.0 (DEC-026/027)، قاعدهٔ peer #46/DEC-018، SSR-safety (هیچ
دسترسی window در import-time) و بودجۀ سخت ≤۴KB gzip در `size-limit`.

تعارض‌ها:

1. SPEC می‌گوید `storage.signal` همگام با state باشد؛ import از
   `@zenith/state` برای L0 ممنوع است و peer اعلام‌کردنش هم قاعدهٔ #46 را
   درمی‌شکند (هر peer باید واقعاً import شود) و دروازهٔ single-instance را
   بغول می‌آورد.
2. auth امروزه توکن را با `JSON.stringify` خام در localStorage می‌نویسد؛
   ورود storage با wrapper `{v,t,e,d}` آن داده‌ها را «خراب» می‌پندارد و
   جلسهٔ کاربر را می‌سوزاند.
3. بودجۀ gzip: رشته‌های فارسی داخل باندل به `\uXXXX` فرار می‌کنند (۶ بایت به
   کاراکتر در ASCII-charset؛ حتی با charset=utf8 فشرده‌سازی‌شان ضعیف‌تر است).
   هستۀ کامل API (چهار درایور + migrate + quota + sync) فقط ~۱.۱KB مینیفای
   جا دارد.
4. تست cross-tab و TTL در Node/vitest بدون timer و بدون مرورگر واقعی باید
   قطعی باشد (الگوی #144: clock تزریق‌شده).

## گزینه‌ها

- **A. signal با peer `@zenith/state` + duck-type** — رد: یال publish (حتی
  type-only) گیت peer-single-instance/layering را می‌شکند و نصب state را به
  هر مصرف‌کنندهٔ storage تحمیل می‌کند.
- **B. سیگنال ساختاری خودکفا در `signal-core.ts`** — پذیرفته: ظرف
  `Readable<T>` ساختاری DEC-021 (هر چیزی با `get()`) را مستقیم برآورده
  می‌کند؛ زیرمسیر `@zenith/storage/signal` فقط entry سبک است (الگوی
  cache/signal #144 ولی بدون adapter، چون storage خودش subscribe دارد).
- **C. رد کردن دادهٔ بدون wrapper به‌عنوان corrupt** — رد: session های
  موجود auth را از بین می‌برد.
- **D. دادهٔ JSON سالمِ غیر-record = version 0 (میراث)** — پذیرفته: از
  `migrate(old, 0)` عبور می‌کند و با wrapper تازه (بک‌فیل) بازنویسی می‌شود؛
  بدون migrate ⇒ ZEN-1104 و حذف. مهاجرت auth با migrate ۴خطی کامل است.
- **E. پیام‌های لاگ فارسی** — رد در باندل: همه پیام‌های `logger.warn`
  پکیج ASCII شد (کد ZEN-NNNN همیشه پیشو است) و فارشی/جزئیات در `context` و
  README می‌نشیند؛ تست‌های gate روی `ZEN-110x` (نه متن) می‌چرخند. این
  تصمیم آگاهانه برای رعایت بودجۀ SPEC §۲.۵ است — نه کوتاه‌آمدن از آستانه.
- **F. همگام‌سازی فقط با BroadcastChannel** — رد: در jsdom/Node در دسترس
  نیست و SSR-safe نیست. **G. `SyncBus` تزریق‌پذیر با پیش‌فرض window
  storage-event** — پذیرفته: publish مرورگر خودش بین‌تب است؛ در تست bus
  fake با semantics واقعی (ناشر پیام خودش را نمی‌گیرد) تزریق می‌شود.
- **H. ttl با timer** — رد (همان قاعدۀ #144/DEC-028): lazy در read،
  `t` مبنای evict-oldest؛ هیچ setTimeout در barrel (debounce فقط در
  persist.ts — گیت layering).
- **I. دایرکتیو `zen-persist` در پکیج جدا یا @zenith/storage** — رد:
  storage لایهٔ L0 است و یال به `state`/`expressions` (L1/L2) ندارد؛
  دایرکتیو DOM-محور است. پذیرفته: در `runtime/directives/persist.ts`
  (هم‌خانوادگی با model.ts و dispatch walker)؛ runtime یال جدید
  runtime→storage/logger (L3→L0) می‌گیرد — مجاز در گراف لایه. نگاشت
  مقدار→signal از همان قرارداد مسیر model.ts پیروی می‌کند و ورودی
  نامعتبر طبق قرارداد parsePersistAttr فقط `logger.warn` می‌دهد (throw
  نمی‌کند) — الگوی parseCacheAttr #144.

## پیامد‌ها

- سبد demo/auth/store می‌توانند یک‌نواخت بنویسند؛ مهاجرت دادهٔ قدیمی
  خودکار و قابل‌تست است (`storage-core.test.ts` «legacy raw JSON»).
- حساسیت: `sensitive:true` صرفاً `memory`/`cookie` را می‌پذیرد
  (SPEC: cookie مجاز ولی در README با هشدار صریح «کوکی کلاینت هرگز HttpOnly
  نمی‌تواند باشد؛ توکن session اینجا نروید»).
- `driver.name` در fallbackهای غیرمتعارف رشتهٔ دلخواه می‌تواند داشته باشد؛
  مقایسه‌های sensitive با نام‌های دقیق memory/cookie انجام می‌شود (safe-by-
  default: هر چیز ناشناخته «persistent» تلقی می‌شود).
- اگر قابلیت جدیدی بودجه را بشکند، راهِ مجاز کم‌کردن بایت واقعی است
  (dedupe مسیرها، حذف String()های زائد) — بالا بردن `limit` ممنوع (#145
  معیار عمومی بند ۶.۲).
- IndexedDB: رکوردها `{k,v}` با keyPath ⇒ یک `getAll()` برای snapshot؛
  نوشتن fire-and-forget با sink خطا به logger (ZEN-1102) — هرگز throw/console.
