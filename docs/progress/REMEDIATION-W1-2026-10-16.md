# اجرای remediation — batch اول W0/W1 — ۲۰۲۶-۱۰-۱۶

مرجع: [پلن اجرا](./REMEDIATION-EXECUTION-PLAN-2026-10-16.md) و
[گزارش تطبیق issueها](./ISSUE-RECONCILIATION-2026-10-16.md).
این سند snapshot اجرای batch است؛ **تکمیل ۴۸ کارت یا آمادگی انتشار را ادعا نمی‌کند**.

## دامنه و وضعیت

- baseline کد: `734f80b7e13d7d3fc96693b38df9dba95459a3f6`؛ شاخهٔ نشست
  `arena/ff992be5-zenith-v1-4-0` حفظ شد. دو سند ممیزی/پلن از مرحلهٔ قبل untracked بودند.
- ۶۳ issue باز در آغاز batch بازخوانی شدند؛ هیچ issue در این batch بسته نشده است.
- مجری تغییرات درون‌مخزنی: عامل همین نشست؛ بازبین امنیت/مالک انتشار هنوز تعیین نشده‌اند.
- hotfix کد: `e416261` و `1845e41`؛ ابزارهای امن و ماتریس: `7561995`؛ compiler: `f57d806`؛ شاهد CI جدید هنوز در انتظار push/run است.

| کارت | نتیجهٔ این batch | باقی‌مانده / وضعیت issue |
|---|---|---|
| #13 | audit prod+dev صفر؛ ابزار رفع‌شده، peer امن، build/dev-server واقعی Vite 6/7، نصب peer نامعتبر رد می‌شود | CI و browser همان candidate باید تأیید شوند؛ تا آن زمان باز |
| #155 | throw/reject provider مهار و ZEN-1901 بدون PII گزارش می‌شود | استخراج analytics و کل privacy/provider/contract spec در W5؛ باز |
| #156/#157 | nonce تصادفی per-response، CSP template، انتقال cancellation و cleanup listener | پکیج adapter واقعی، transport/stream/deploy و Edge واقعی کامل نشده‌اند؛ باز |
| #154 | پروب واقعی transport نقص را اثبات و مستندات prototype اصلاح شد | ارسال/دریافت، reconnect، parsing و backpressure پیاده نشده‌اند؛ باز |
| R01/R02 | snapshot زنده از baseline تاریخی در بالای AUDIT/PRODUCTION/PROGRESS جدا شد | reconcile کامل checklistها در موج‌های بعد |
| R06 | ادعاهای دسترسی در MAINTAINERS مشروط شد؛ جدول اقدامات مالک تازه شد | افراد/مجوزها/تنظیمات بیرونی تأییدنشده‌اند |
| #106/#108/#112/#119 | در گیت‌های نهایی این batch بازاعتبارسنجی می‌شوند | بدون CI و مجوز write به GitHub بسته نمی‌شوند |

## ۱. SSR: nonce و لغو درخواست

تست‌های red ابتدا مقدار ثابت `zen-ssr-nonce` و `zen-edge-nonce` و نادیده‌گرفتن
signal را نشان دادند. اصلاح:

- `node:crypto.randomBytes(16)` برای هر پاسخ؛ ۱۲۸ بیت entropy و نمایش base64؛
  نه timestamp، شمارنده یا Math.random.
- nonce همان پاسخ در hydration script و CSP پیش‌فرض؛ custom policy با `{{nonce}}`
  تمام رخدادهای placeholder را جایگزین می‌کند. policy سفارشیِ بدون placeholder
  همچنان policy کاربر است و ممکن است hydration را مسدود کند.
- Node: رویداد request `aborted` و response `close` پیش از `writableEnded`، نه
  `IncomingMessage.close` عادی؛ state loading و render signal مشترک دارند؛
  success/error/abort در `finally` listenerها را برمی‌دارند؛ پاسخ قطع‌شده نوشته نمی‌شود.
- Fetch: `request.signal` منتقل و cancellation به‌صورت `AbortError` propagate می‌شود.
- `renderToString` قبل/بعد از import و prepass کنترل لغو دارد؛ پس از لغو، DOM/App
  جدید شروع نمی‌شود. کار async دلخواه کاربر که قبلاً شروع شده **به‌زور متوقف نمی‌شود**؛
  مسئول I/O باید signal خود را مصرف کند. این hotfix ادعای hard cancellation ندارد.
- Fetch-shaped handler هنوز در پکیج Node-targeted SSR است؛ وجود Fetch API یا
  یک تست Edge-like، deployment واقعی Cloudflare/Deno را اثبات نمی‌کند.

شاهد: `packages/ssr/test/adapter-security.test.ts`، **۱۶ تست** شامل ۱۶ پاسخ همزمان
Node، ۸ پاسخ Fetch، custom CSP، pre-abort، abort حین import/prepass/state، cleanup،
یک درخواست HTTP واقعی موفق و یک قطع اتصال HTTP واقعی بدون mount/write دیرهنگام؛ دو تست اضافی، reject همزمان state در همان لحظهٔ abort را بدون unhandledRejection اثبات می‌کنند.

## ۲. Analytics: مهار و گزارش بدون دادهٔ حساس

`void provider.send(event)` فقط throw همزمان را می‌گرفت و reject را رها می‌کرد.
اکنون send به Promise تبدیل و catch متصل می‌شود؛ throw همزمان نیز همان مسیر گزارش
را دارد. reporter محافظت‌شده است تا خرابی خودش reject دیگری نسازد.

گزارش فقط `createReservedError('ZEN-1901')` است؛ نام provider، event/props، شناسهٔ
کاربر، متن exception و cause خام ارسال نمی‌شوند. provider سالم ادامه می‌دهد؛
reject دیرهنگام پس از dispose مهار می‌شود؛ consent/DNT عوض نشده‌اند.
پیام catalog و صفحهٔ ZEN-1901 و نمونهٔ آن با رفتار و export واقعی runtime همگام شدند.

شاهد: `packages/runtime/test/analytics-provider-failure.test.ts`، **۵ تست**؛
probe `unhandledRejection`، privacy، provider سالم، consent، dispose و reporter خراب.
این اصلاح برابر پکیج مستقل analytics یا تکمیل همهٔ معیارهای #155 نیست.

## ۳. Audit و تصمیم ابزارها (#13 / DEC-040)

| snapshot | critical | high | moderate | total |
|---|---:|---:|---:|---:|
| قبل، prod+dev | ۲ | ۵ | ۳ | ۱۰ |
| قبل، omit=dev | ۰ | ۰ | ۰ | ۰ |
| پس از ارتقا، prod+dev | ۰ | ۰ | ۰ | ۰ |
| پس از ارتقا، omit=dev | ۰ | ۰ | ۰ | ۰ |

عدد ۱۰ شمار package entries آسیب‌پذیر است، نه لزوماً ۱۰ advisory مستقل.
منبع نسخه‌های قبل lockfile baseline و خروجی JSON همان روز است:

| dependency path قبل | advisory / نوع مواجهه | رفع |
|---|---|---|
| vitest 3.2.7 → tinypool 1.1.1 | GHSA-5gmw-xhrv-c9v3 و GHSA-85c8-ppgw-ccpr، critical prototype-pollution worker-option gadgets؛ exploitability ورودی‌های واقعی این مخزن مستقلاً اثبات نشده، اما برای نگه‌داشتن آن استثنا پذیرفته نشد | Vitest 4.1.12؛ tinypool از tree حذف |
| vitest/@vitest/mocker 3.2.7 | GHSA-82fw-gwwq-j7x9، moderate path traversal در redirect mock؛ سطح حملهٔ dev/test endpoint، نه اثبات آسیب‌پذیری همهٔ سایت‌های مصرف‌کننده | Vitest/mocker/coverage 4.1.12 |
| coverage-v8 قدیمی → glob 10.4.5 | GHSA-5j98-mcp5-4vw2، high command injection با CLI cmd و نام فایل نامطمئن؛ استفادهٔ exploit در این مخزن ادعا نمی‌شود | coverage جدید؛ glob از tree حذف |
| lint-staged 15.5.2 → micromatch 4.0.8 → braces 3.0.3 | GHSA-vfj7-8cjw-p6xm، high stack exhaustion با pattern عمیق؛ ابزار dev نیز زنجیرهٔ تأمین است | lint-staged 16.4.0؛ زنجیرهٔ قدیمی حذف |
| vite-plugin → Vite 5.4.21 → esbuild 0.21.5 | GHSA-67mh-4wv8-2f99، moderate dev-server request/read؛ dev server حتی در توسعه نباید بی‌قید روی شبکه منتشر شود | Vite 6.4.4/esbuild 0.25.12 و Vite 7.3.7/esbuild 0.28.1 |
| Vite 5.4.21 | GHSA-4w7w-66w2-5vf9، GHSA-v6wh-96g9-6wx3، GHSA-fx2h-pf6j-xcff، traversal/Windows UNC/fs-deny bypass، شدت بالاتر high؛ دامنهٔ dev server و سیستم‌عامل مهم است | دو خط رفع‌شدهٔ 6.4.4 و 7.3.7 |

حذف peer قبلی Vite 5 یک **تغییر شکنندهٔ پشتیبانی ابزار build** است؛ changeset آن major
است، نه تغییر runtime API. به‌سبب fixed/lockstep group، اجرای version bump/انتشار
باید با مالک انتشار هماهنگ شود؛ این batch هیچ نسخه‌ای را bump یا publish نمی‌کند.

نسخه‌های lock جدید: Vitest/coverage/mocker **4.1.12**، lint-staged **16.4.0**،
Vite **6.4.4 و 7.3.7**؛ root esbuild **0.28.1**. `tsx` در ریشه صریح pin شد تا
قرارداد تک‌نسخه‌ای #42 به نصب optional قدیمی وابسته نباشد. `ws` فقط ابزار پروب کنترل
محلی است، نه transport پیاده‌شدهٔ Zenith. هیچ `npm audit fix --force` یا override
خارج از قرارداد سازگاری اضافه نشد.

npm 10 هنگام ارتقای همزمان stack قدیمی خطای Arborist `edgesOut` داد؛ عملیات install
ارتقا با npm 11 تکمیل شد. سپس **npm ci با npm 10.9.8** از lock جدید موفق شد؛ استفاده
از npm 11 شرط نصب عادی این checkout نیست.

تصمیم [DEC-040](../decisions/DEC-040-secure-development-toolchain.md): توسعه/test/hook
روی Node 22 LTS >=22.12؛ کف `engines >=18.19` کتابخانه فعلاً بدون تغییر؛ build قدیمی
صرفاً اثبات artifact compatibility است، نه پشتیبانی Vitest جدید روی Node 18 یا توصیهٔ
Node EOL. peer افزونه `^6.4.4 || ^7.3.7` است؛ مهاجرت در README و migration ثبت شده.

در تست واقعی دو نقص دیگر آشکار و اصلاح شدند: hook HTML دیر اجرا می‌شد و virtual module
واقعاً bundle نمی‌شد؛ اکنون `order: pre` دارد. همچنین build-mode فقط به `command=build`
وابسته است تا serve بعد از build API با NODE_ENV=production اشتباهاً compile نشود.

شاهدها:
- `node scripts/vite-plugin-integration.mjs`: build واقعی compiled HTML با chunk و
  importهای resolve‌شده، HTTP واقعی dev server و دریافت HTML-proxy HMR module در هر دو major.
- `scripts/test/vite-peer.test.mjs`: چهار نصب peer ناسازگار/ناامن 5.4.21، 6.4.2، 7.3.6 و
  8.3.4 با `ERESOLVE` رد می‌شوند. این fixture متادیتای Vite peer را از dependencies
  منتشرنشدهٔ Zenith جدا می‌کند؛ ادعای نصب مصرف‌کننده از registry نیست.
- CI دو job مجزای Vite 6/7 دارد؛ audit کامل با `--audit-level=low` بدون `|| true` مسدودکننده شد.
- Vite 8، HMR حفظ‌کنندهٔ state و sourcemap واقعی در #110 همچنان باز هستند.

## ۴. Transport واقعی #154: شکست آگاهانه، نه تست سبز نمایشی

```bash
npm run build
node scripts/repro/realtime-transport.mjs
```

خروجی مشاهده‌شده:

```json
{"issue":154,"controlEcho":true,"status":"open","serverReceived":[]}
```

WebSocket کنترل، از سرور loopback echo می‌گیرد؛ سپس کلاینت واقعی Zenith `open/send`
می‌کند ولی هیچ frame دریافت نمی‌شود؛ assertion تحویل پیام با exit **1** شکست می‌خورد.
این پروب عمداً جدا از suite واحد نگه داشته شده، نه `skip` یا `it.fails` شده و نه
به‌عنوان موفقیت transport شمرده می‌شود. TSDoc/README اکنون prototype بودن را صریح
می‌گویند. W5 باید assertion ارسالِ بدون تغییر را پاس و به گیت لازم تبدیل کند.
محدودیت پروب: پنجرهٔ ۳۰۰ms یک تشخیص محدود محلی است، نه سنجهٔ latency یا تست unit قطعی.

## ۵. اقدامات مالک و محدودیت اتصال

برای #61/#66/#77/#80/#107 متن دقیق اقدام بیرونی در
[درخواست‌های مالک](./OWNER-REQUESTS-2026-10-16.md) و [MANUAL-STEPS](../MANUAL-STEPS.md) ثبت شد.
تلاش واقعی ثبت کامنت در #77 با `Resource not accessible by integration` رد شد؛
**هیچ کامنت یا برچسب GitHub ثبت نشد** و دیگر issueها بی‌جهت retry نشدند.
اتصال GitHub برای نوشتن issue نیازمند اصلاح مجوز توسط مالک است؛ credential درخواست نشد.
این محدودیت، تأیید scope/2FA/OIDC، branch protection یا ممیزی بیرونی را جعل نمی‌کند.

## ۵.۱. نقص codegen آشکارشده توسط coverage جدید

پس از ارتقای Vitest، همهٔ ۱۸۶۵ تست آن snapshot پاس شدند ولی گیت **قرمز** ماند:
compiler statements=79.62% زیر حد 80% بود. آستانه و include/exclude دست‌نخورده ماندند.
با اجرای واقعی خروجی generated renderer در VM محلی + JSDOM و evaluator واقعی AST،
شش تست با `ReferenceError: dir is not defined` قرمز شدند: codegen به متغیر محلی
زمان کامپایل `dir.value` ارجاع می‌داد، نه expression سریال‌شدهٔ قالب.

در `f57d806` پنج مسیر text/if/show/html/trusted، expression را با JSON.stringify
به‌عنوان داده وارد کد می‌کنند. **۱۴ تست رفتاری** جدید در
`packages/compiler/test/generated-render.test.ts` تغییر text/if/show، quote در expression،
فراخوانی sanitizer/fallback trusted، class/boolean binding و حالت strict/runtime-fallback
را با اجرای کد تولیدشده می‌سنجند. هیچ eval/new Function به source کتابخانه اضافه نشده؛
VM فقط کد تولیدشده از fixture ثابت تست را اجرا می‌کند. effectها در این harness صریحاً
بازاجرا می‌شوند؛ این تست، parity جامع reactive یا تست browser/CSP #163/#63 نیست.

این اصلاح در changeset patch compiler ثبت شد؛ #163 همچنان باز است. تست‌های اضافه‌شده
باید پوشش واقعی را افزایش دهند، نه اینکه خروجی renderer echo شود یا آستانه کاهش یابد.

## ۶. گیت‌ها و شواهد

کد runtime/compiler بررسی‌شده: `f57d806` (همراه hotfixهای قبلی)؛ تنظیم دامنهٔ
artifactهای تولیدی lint در `a401bdf` و اسناد پس از آن ثبت شده‌اند. کد runtime پس از
اجرای کامل suite تغییر نکرده است. نتیجهٔ محلی:

| گیت | نتیجهٔ مشاهده‌شده |
|---|---|
| npm ci (npm 10.9.8 / Node 22.22.3) | موفق؛ از lockfile جدید |
| lint | ۰ error، ۹۳۸ warning؛ بدهی any قدیمی همچنان باز |
| typecheck | ۵۰ پکیج + type-test، موفق |
| build | ۴۹ ساخته، ۰ شکست؛ vscode فاقد index در build-all و compile جداگانهٔ آن موفق |
| build:browser | bundle واقعی ساخته شد |
| test:coverage | **۲۲۰ فایل / ۱۸۸۱ تست پاس**، بدون skip؛ ۴۰ تست بیشتر از baseline ۱۸۴۱ |
| core statements | کل **88.69%**؛ compiler **94.70%**، expressions **89.70%**، scheduler **88.57%**، state **83.42%**؛ آستانهٔ ۸۰٪ همه حفظ و پاس |
| size | بودجه‌ها پاس؛ browser runtime **67.31 kB brotlied / 70 kB**؛ SSR **8.92 kB brotlied / 9 kB** |
| dependency-cruiser و گیت‌های قرارداد | بدون violation؛ unused/peer/error/cleanup/grammar/traceability پاس |
| docs examples / ADR / graph / DEC / exports | ۱۴ مثال marked کامپایل؛ ۱۵ ADR معتبر؛ graph تازه؛ ۴۰ DEC؛ ۱۳ shared-name استثنای مستند؛ گیت‌های منفی مربوط در suite پاس |
| Vite integration | build و dev HTTP/proxy واقعی روی 6.4.4 و 7.3.7 پاس |
| package verification | publint پاس؛ pack-audit و ATTW برای ۴۹ پکیج؛ parity declaration/ESM/CJS برای ۴۸؛ نصب واقعی ۴۹ tarball و import ESM+CJS و نسخه CLI پاس |
| peer singleton / license | state/scheduler هرکدام یک نسخه؛ license check برای ۳۴۹ پکیج نصب‌شده پاس |
| format | پاس؛ markdown طبق ignore موجود جزو Prettier gate نیست |
| audit کامل و omit=dev | هر دو صفر؛ هیچ استثنای critical/high پذیرفته نشده |
| realtime transport | **شکست پذیرش واقعی** طبق بخش ۴؛ در تعداد تست‌های پاس شمرده نشده |
| browser محلی | **اجرا نشد**؛ executable مرورگر موجود نیست، launch شکست خورد |
| CI همین snapshot | در زمان ثبت سند هنوز push/run این snapshot انجام نشده؛ نتیجهٔ محلی جای CI نیست |

چهار مورد #106/#108/#112/#119 از نظر گیت‌های محلی بازاعتبارسنجی شدند، نه اینکه
بدون مجوز و run مرتبط بسته شده باشند. نسخهٔ وب مستندات و تست دستی/ممیزی بیرونی
با گیت وجود فایل یا کامپایل مثال اثبات نمی‌شوند.

چرخهٔ نخست حین توسعه: duplicate import لاگر در typecheck آشکار و حذف شد؛ دو تست
policy دربارهٔ شمارهٔ DEC و optional tsx شکست خوردند و بدون تضعیف assertion رفع شدند؛
size به‌علت ساخته‌نشدن browser bundle اجرا کامل نبود. چرخهٔ نهایی bundle را پیش از size
می‌سازد. در بازبینی تکمیلی، race لغو همزمان state با reject با دو تست red بازتولید و
در `1845e41` با observe کردن promise حتی وقتی signal از قبل aborted است رفع شد.
در چرخهٔ آخر، خود ۱۸۸۱ تست و coverage پاس شدند، اما wrapper به‌علت lint روی فایل‌های
vendor تولیدشدهٔ `playwright-report/trace` exit 1 داشت. در `a401bdf` فقط artifactهای
Playwright که از قبل در gitignore بودند به دامنهٔ ignore ابزارها اضافه شدند؛ **هیچ
source/test پروژه‌ای مستثنا نشد**. سپس `npm run lint` کامل مجدداً ۰ error/۹۳۸ warning
داد. probeهای منفی no-console و no-floating-promises روی source واقعی همچنان error
دادند و بررسی isPathIgnored تأیید کرد source/testها lint می‌شوند. این شکست نیز پنهان
یا با کاهش شدت rule حل نشده است. این شکست‌های موقت با موفقیت نهایی اشتباه گرفته نمی‌شوند.

اجرای محلی Playwright با `--project=chromium --max-failures=1` در مرحلهٔ launch با
نبودن executable مرورگر شکست خورد (یک fail زیرساختی و ۲۵ test اجرا نشد). مرورگر در
محیط حاضر نصب نیست و نصب از میزبان خارج allowlist انجام نشد. نتیجهٔ browser **تأییدنشده**
است؛ CI موجود مرورگرها را نصب می‌کند، اما تا run موفق، سبز اعلام نمی‌شود.

لاگ‌های خام و JSONهای audit خارج Git در `/home/user/remediation-w1/` نگه‌داری شدند؛
node_modules/dist/coverage/artifact بزرگ یا credential وارد commit نمی‌شود. CI artifactها
طبق workflow نگه‌داری می‌شوند؛ این سند و تست‌ها شواهد سبک versioned هستند.

## ۷. صف بعدی

1. گیت‌های batch و CI همین candidate، سپس تصمیم دربارهٔ خاتمهٔ #13 و چهار بازاعتبارسنجی؛
   ناتوانی ثبت issue به‌صورت مانع صریح بماند، نه ادعای closure.
2. W2: #51، bootstrap #56/#57/#38، scaffold #159/#166 و شروع #39/#40 طبق پلن.
3. #154 و تکمیل پکیج‌های #155/#156/#157 به W5 باقی‌اند؛ اصلاح خطر فوری مساوی اتمام کارت نیست.
4. پاسخ مالک برای دسترسی، scope، ممیز و Trusted Publishing جداگانه لازم است؛ هیچ انتشار
   واقعی یا merge روی main در این batch انجام نمی‌شود.
