# دفتر اجرای code-first — ۲۰۲۶-۱۰-۱۶

## وضعیت فعلی و قاعدهٔ اجرا

- درخواست فعالِ محدودشدهٔ کاربر: **همان ۲۸ کارت دارای پیشرفت**؛ نه افزودن کارت‌های جدید به دامنه. هدف تکمیل کد و تست‌ها بدون اجرای آن‌هاست.
- طبق دستور صریح کاربر: ابتدا همهٔ کدها و تست‌های باقی‌مانده؛ سپس گیت‌های نهایی
  و رفع خطا. تا پایان این فاز **تست، coverage، lint/typecheck/build validation، CI
  یا push میانی اجرا نمی‌شود**. متن قدیمی «گیت پایان batch» در پلن، زمان‌بندی این
  فاز را تغییر نمی‌دهد. معیار پذیرش و آستانه‌ها حذف یا کم نشده‌اند.
- branch محلی بررسی‌شده: `arena/ff992be5-zenith-v1-4-0`؛ HEAD محلی هنگام ثبت
  `734f80b7e13d7d3fc96693b38df9dba95459a3f6`، با تغییرات **uncommitted/dirty**.
  نوشته‌های جدید هنوز SHA یا run موفقِ اعتبارسنجی خود را ندارند.
- آمار/commit/runهای W1 در گزارش‌های قبلی **تاریخی‌اند و شاهد dirty tree فعلی
  نیستند**. وضعیت audit، تعداد تست پاس و اندازهٔ جدید اندازه‌گیری نشده‌اند.
- در این فاز هیچ issue بسته، نسخه bump، tag، فروشگاه یا npm publish نشده است.
  تمام کارت‌های زیر از نظر پذیرش کامل بازند؛ ثبت کد معادل سبزشدن G/P نیست.

## کد/تست نوشته‌شده در ادامهٔ اخیر (همه بدون اجرا)

1. `runtime-core/src/registry.ts`: پنج عملیات یکنواخت + entries/dispose، کلید
   string و cleanup با token هر ثبت؛ حتی ثبت دوبارهٔ همان value از cleanup قدیمی
   محافظت می‌شود. موتور واقعی App از storeهای action/directive/plugin استفاده
   می‌کند. namespaceهای دیگر فقط reference store مستقل‌اند؛ adapter سراسری قدیم
   به آنها وصل نشده و lifecycle ارزش‌ها هنوز مسئول سازنده/پلاگین است.
2. اصلاح teardown App: ادامه پس از خطای یک root/plugin، پاک‌کردن همهٔ referenceها،
   rollback mount ناقص، retry plugin پس از نصب ناموفق، cleanup نصب اولیهٔ ناقص و
   cleanup برگشتی پس از dispose بازگشتی. hook reset پیش‌فرض در bundle هم نگه داشته
   می‌شود؛ App مستقل با reset پیش‌فرض پاک نمی‌شود.
3. `expressions/src/binding-context.ts`: view تنبل مشترک با locals و alias دلاری؛
   signal/getter تا زمان خواندن unwrap نمی‌شود. `compileExpression` خروجی unknown
   دارد؛ مصرف‌کنندگان URL/list متأثر narrowing دارند، نه cast به any.
4. realtime: bind/plugin واقعی برای ws/sse، state نام‌دار، topic، attr options،
   ارسال reactive، DOM events و مالکیت cleanup/DOM-removal؛ اصلاح view باینری با
   offset، lease listener تکراری و protocol failure. loopback WS deadline دارد.
5. testing-e2e: root Node و browser entry مستقل، host تستی با App واقعی، HTML/state/
   module-plugin descriptors، cancellation/timeout/generation ownership، remount و
   dispose، signal و snapshot واقعی state/registry، schema گزینه‌ها و teardown.
   component واقعی notifications و native مرورگر WS/SSE fixture اضافه شده‌اند؛
   اینها جای کل demo/UI/SSR/devtools acceptance را نمی‌گیرند.
6. analytics: binding/plugin مالک‌دار، props تنبل App/local، router string/object،
   cleanup DOM/debounce/uninstall و provider rejection. callback قدیمی به default
   App و reset/dispose آن متصل شده؛ هنوز روی pipeline کامل consent engine نیست.
7. tools/build: LICENSE و README در ZIP؛ target هر entry، رد target ناشناخته و
   جلوگیری از IIFE اشتباه testing-e2e/browser. اینها artifact ساخته‌شده نیستند.
8. API/release: gate strict در CI و preflight انتشار؛ Node ambient برای declaration
   resolution؛ OIDC/tag/tokenless/npm client policy و تست‌های منفی. baseline API و
   رفع همهٔ any/release-tagها **باقی است**؛ gate جدید تا رفع آن باید fail-closed
   بماند. هیچ CI/publish برای امتحان این تغییرات اجرا نشده است.

9. Auth: دو state machine قبلی به یک `Auth` canonical تبدیل شده‌اند؛ functional
   helpers و viewهای writable/read-only همان default instance را مصرف می‌کنند.
   AuthConfig واحد با adapter schema قدیمی، response flat/nested، storage versioned و
   migration raw keys، remember صریح، refreshMode کوکی HttpOnly، epoch/abort برای
   response و body دیررس و refresh lease، logout فوری، listener آفلاین و sync بدون
   secret نوشته شده‌اند. `authPlugin/getAppAuth/createAuthRegistry` به App صریح وصل
   هستند؛ پل تنبل facade زمان اجرای قدیمی به inventory واقعی `defaultApp` نیز نوشته شد. MFA فقط endpoint adapter
   است، نه پروتکل کامل challenge/recovery. تست‌های canonical/scoped/cross-tab و سه
   سناریوی مرورگری native نوشته شده‌اند، **هیچ‌یک اجرا نشده‌اند**. تغییرات بالقوه
   breaking با changeset پیشنهادی major فقط برای بازبینی مالک ثبت شده؛ نسخه bump
   یا انتشار مجاز/انجام نشده است.

10. ادامهٔ #118/#139: `runtime/src/auth-owner.ts` و facade تنبل `auth-api.ts`
    روی store واقعی default App کار می‌کنند؛ import/مصرف signal پل را اجرا نمی‌کند.
    adoption ثبت‌های قبلی با cleanup متحرک، تقدم مقدار صریح App، dispose نمونهٔ
    auto-owned و حفظ borrowed value، lease token، reset بدون resolve/new App و
    teardown بازگشتی نوشته شد. رجیستری Core subscription نام‌محور دارد (بدون payload)
    و تغییر مستقیم App، viewهای functional را به owner/value تازه متصل می‌کند.
    types/options/storage/registry-contract از Auth جدا شدند تا type-cycle تازه
    ایجاد نشود. reset hook واقعی Auth از PURE خارج و sideEffects اعلام شد؛ بودجهٔ
    ۳KB signal دست نخورده است. تست‌های owner/facade/observation و minified consumer
    فقط نوشته شده‌اند، نه اجرا. دامنه‌های دیگر #118 همچنان باقی‌اند.

تست‌های جدید در `packages/{auth,runtime-core,expressions,realtime,analytics,testing-e2e,
resource,runtime}/test`، `scripts/test/{build-target,release-policy,tools-build,
declaration-api}.test.mjs` و `e2e/{auth,testing-fixtures,realtime}.spec.ts` هستند.
نتیجهٔ اجرایی هیچ‌یک در این فاز ادعا نمی‌شود.

## عملیات metadata؛ نه validation

فقط برای همگام‌کردن dependencyهای نوشته‌شده،
`npx --yes npm@11.21.1 install --package-lock-only --ignore-scripts --no-audit --no-fund`
اجرا شد؛ exit **0**. این کار نه dependencyها/peerها را واقعاً نصب می‌کند، نه
lifecycle/test/build/audit اجرا می‌کند و نه شاهد صحت کد است. metadata رجیستری npm
برای client 11.21.1 نیز خوانده شد (Node `^20.17.0 || >=22.9.0`)؛ workflow ابزار
Node 22 دارد، بدون تغییر کف runtime کتابخانه‌ها. اجرای نهایی هنوز آغاز نشده است. در ادامه، dependency مستقیم موجود
`@zenith/shared@1.5.0` به manifest runtime و همان workspace entry در lock به‌صورت
متنی افزوده شد؛ برای این تغییر نصب یا دستور npm دیگری اجرا نشد. این همگام‌سازی
متنی و تغییر sideEffects شاهد نصب/صحت resolution یا خروجی bundle نیستند.

## ماتریس همهٔ ۴۸ کارت؛ تکمیل نشده‌اند

مرجع معیار دقیق هر ردیف:
[پلن اجرایی](./REMEDIATION-EXECUTION-PLAN-2026-10-16.md).
«قدم بعدی» مجوز اجرای زودهنگام تست نیست؛ سنجش‌ها به انتهای همهٔ پیاده‌سازی‌ها
موکول‌اند. موارد نیازمند مالک نمی‌توانند با mock به «انجام شد» تبدیل شوند.

| کارت | وضعیت واقعی در فاز فعلی | قدم بعدی/باقی‌مانده |
|---|---|---|
| #13 — audit dev و ارتقای زنجیرهٔ Vite | کد W1 و قالب Vite حفظ شده؛ شاهد جدید برای dirty tree نداریم | پس از کل پیاده‌سازی، audit/ماتریس و نصب پاک نهایی |
| #38 — حذف any از سطح عمومی واقعی | auditor declaration و مهاجرت Core/Store/Resource به مرزهای unknown، getterهای Computed و تست inference نوشته شد | موجودی تمام declarationها هنوز کامل نیست؛ compatibility/major و baseline نهایی باید بازبینی شوند |
| #39 — تکمیل مهاجرت logger | ۹ معافیت قدیمی مهاجرت و حذف؛ CLI writer، diagnostic injection تولیدی، IDE channel و errors transport + regressionها نوشته شد | بازبینی تغییر standalone errors/major، سازگاری مصرف‌کننده‌ها و اجرای نهایی silent/redaction/no-console/size gates |
| #40 — شکستن فایل‌های بزرگ بدون تغییر رفتار | Core/Store/CLI به ماژول‌های زیر۴۰۰خط شکسته شدند؛ بقیهٔ فایل‌های بزرگ باقی‌اند | تغییر قرارداد/ownership این candidate جداگانه major است؛ refactor API-identical و snapshot equivalence هنوز اثبات نشده |
| #51 — ابزارها بیرون packages و build صریح | tools خصوصی جدا؛ ZIP/VSIX و تست/قانون discovery نوشته؛ LICENSE/README در ZIP اضافه | پذیرش artifact واقعی، تست نصب/IDE و بررسی نهایی تمام collectorها |
| #55 — حذف تنظیمات positional باقی‌مانده | هفت مهاجرت options (retryWithBackoff/raceWithTimeout/te-tm/readFetchCache/applyBehaviorModifiers/driverByName/renderSSRHead با ZEN-DEPR-067..071/106/107 و ثبت رجیستری)، هر ۸ دستهٔ allowlist با kind=data + دستهٔ خالی legacy-positional، سه lease دقیق شکل جدید (setCachedData/formatRelativeTime/applyStrategy)، حذف ردیف trackPromise، اجبار kind در loader، parity یک‌باره در ۷ فایل تست + گسترش positional-config/options-object تست‌ها؛ همه نوشته و اجرا نشده | اجرای گیت audit/ESLint، تست‌ها و typecheck در فاز validation؛ حذف overloadهای قدیمی فقط در ۲.۰ |
| #56 — public API رسمی و report امضادار | کد-first کامل (اجرا نشده): هر ۲۱۰۰ export سطح‌ریشه/زیرمسیر طبقه‌بندی‌شده (۰ unclassified/conflicting در گراف source)؛ زیرمسیرهای جدید ssr/internal و expressions/internal (ESM-only، جدول یکتا + vitest/typecheck/depcruise)؛ پل hydrate منسوخ با ZEN-DEPR-108؛ سه تست جدید (hydrate-bridge، دو internal-surface)؛ changeset و تصمیم‌های root/public | فاز validation: تولید docs/api snapshot+reports و *.api.md پس از build نهایی، اجرای api:strict/ae-missing-release-tag (شامل memberها)، تست‌ها و typecheck؛ حذف bridgeها فقط در ۲.۰ |
| #57 — exports و build شرطی | target واقعی هر entry و جداسازی browser از Node نوشته؛ IIFE فقط umbrella | تکمیل تمام conditionها و resolve/pack/bundler/worker matrix |
| #61 — ممیزی مستقل بیرونی | مسدود بیرونی؛ ممیز/گزارش مستقل نداریم | مالک ممیز واقعی و candidate ثابت تعیین کند؛ سپس audit و retest |
| #63 — CSP سخت‌گیرانه و Trusted Types واقعی | پذیرش کامل نشده؛ کار جدیدِ کامل برای این کارت در این فاز ثبت نشده | fixture سرور با header واقعی nonce/strict CSP و TrustedTypes enforced بسازید؛ CSP فقط report-only یا meta آزمایشی نباشد. |
| #66 — Trusted Publishing و provenance | کد preflight تگ/OIDC/client/provenance و گیت‌های release نوشته؛ اجرا نشده | بازبینی workflow؛ مالک environment و Trusted Publisher را تأیید کند؛ انتشار فقط با مجوز |
| #67 — تأیید واقعی امنیت افزونه‌ها | تست‌های schema قبلی و مسیر ساخت tools حفظ شده؛ پذیرش واقعی کامل نیست | مرورگر extension واقعی و VS Code Extension Host با CSP/پیام منفی |
| #77 — مالکیت نام و scope | مسدود بیرونی؛ مالکیت scope/دو مالک/2FA اثبات نشده | مالک نام نهایی و شواهد مدیریتی بدون credentials ارائه کند |
| #80 — حفاظت شاخه و merge | مسدود بیرونی؛ نتیجهٔ دسترسی قبلی اثبات تنظیم protection نیست | مدیر با PR قرمز/بدون approval و export تنظیمات پذیرش را اثبات کند |
| #86 — benchmark واقعاً بازتولیدپذیر | پذیرش کامل نشده؛ کار جدیدِ کامل برای این کارت در این فاز ثبت نشده | runner کنترل‌شده با CPU/نسخه/GC/مرورگر و warmup ثابت تعریف؛ مقایسهٔ روش batch، best/median و informational از claims قطعی جدا شود. |
| #88 — lazy loading directiveهای سنگین | پذیرش کامل نشده؛ کار جدیدِ کامل برای این کارت در این فاز ثبت نشده | date-picker/data-table/crud/virtual-repeat را از eager entry جدا؛ registry loader پویا با cache promise و chunk مستقل ایجاد کنید. |
| #90 — Web Vitals دموها | پذیرش کامل نشده؛ کار جدیدِ کامل برای این کارت در این فاز ثبت نشده | Lighthouse CI برای ecommerce/dashboard با build production، دادهٔ ثابت، CPU چهاربرابر و شبکهٔ 4G پیکربندی کنید. |
| #95 — graceful degradation | پذیرش کامل نشده؛ کار جدیدِ کامل برای این کارت در این فاز ثبت نشده | ماتریس بدون JS، بدون SW، IndexedDB غیرفعال و localStorage throw را برای دمو/SSR/قالب تعریف کنید؛ محتوای fallback و محدودیت هرکدام روشن باشد. |
| #97 — بسته و انتشار فروشگاهی devtools | بسته‌بندی ZIP/VSIX کد دارد؛ artifact/فروشگاه تأیید نشده | گیت artifact و نصب واقعی؛ پذیرش/انتشار فروشگاهی توسط مالک |
| #100 — RTL/LTR تمام کامپوننت‌ها | پذیرش کامل نشده؛ کار جدیدِ کامل برای این کارت در این فاز ثبت نشده | ماتریس virtual-list افقی، date-picker، data-table، notifications و UI جدید را با dir ارثی/صریح و localeهای fa/ar/en تعریف کنید. |
| #103 — مرجع API کامل و سایت مستندات | پذیرش کامل نشده؛ کار جدیدِ کامل برای این کارت در این فاز ثبت نشده | TypeDoc را بر declaration/TSDoc عمومی برقرار؛ signature، generic، گزینه، default/unit و example را render کنید، نه فقط نام symbol. |
| #107 — حاکمیت و نگه‌دارندگان واقعی | مسدود بیرونی؛ افراد/پذیرش مسئولیت واقعی مشخص نشده | مالک دو نگه‌دارنده و review حوزه‌های حساس را تعیین کند |
| #109 — CLI چرخهٔ توسعه | پنج دستور واقعی، JSON/exit contract، physical doctor، AST upgrade/backup و fixtureهای source/tarball نوشته شد؛ scaffoldها test script دارند | consumer کامل Vite/SSR/PWA، signal/OS و پذیرش نهایی اجرا نشده؛ پیش‌نیازهای مستقل #158/#164/#167 پایان‌یافته ادعا نشده‌اند |
| #110 — HMR، sourcemap و ماتریس Vite | ماتریس تاریخی Vite 6/7 برای W1 است؛ HMR/sourcemap و کل دامنه ناقص | HMR واقعی، diagnostics و تعیین تکلیف Vite 8 پس از unplugin |
| #111 — type-safe template opt-in | پذیرش کامل نشده؛ کار جدیدِ کامل برای این کارت در این فاز ثبت نشده | قرارداد اختیاری state type/schema برای compiler و LSP تعریف کنید؛ unknown identifier از undefined runtime جدا باشد. |
| #113 — dashboard واقعی با mock API و RBAC | پذیرش کامل نشده؛ کار جدیدِ کامل برای این کارت در این فاز ثبت نشده | mock API داده‌محور برای کاربران/نقش‌ها/جلسه بسازید؛ دادهٔ اولیه deterministic باشد. |
| #114 — build دموها و Pages | پذیرش کامل نشده؛ کار جدیدِ کامل برای این کارت در این فاز ثبت نشده | manifest تولیدشدنی تمام demos/ecommerce/dashboard/index ریشه و دستور build هرکدام بسازید؛ static demo نیز link/import validation داشته باشد. |
| #118 — registryهای app-scoped | canonical token registry در shared؛ App.run، adapterهای Store/Resource/Permission/Component/ServerComponent و SSR provider + lifecycle regression نوشته شد | Devtools و باقی action/default compatibility، مرز async owner و محدودیت Edge context؛ سپس گیت‌های نهایی |
| #120 — امضای یکنواخت directive | context مشترک، binder realtime/stateOutput و overload canonicalِ Resource + rollback نوشته شد؛ تمام binderها یکسان نشده‌اند | باقی processXها و metadata/grammar/compiler از جدول واحد هنوز نیازمند کارند |
| #132 — نهایی‌سازی notifications | focus-trap مشترک a11y و facade سازگار نوشته شد؛ تأیید نشده | حفظ و اجرای ۲۲ تست قدیمی + keyboard/axe و رفتار mixed UI/notification نهایی |
| #139 — یک موتور auth با سازگاری قدیم | engine واحد، adapter functional، storage/migration، epoch/abort، cookie refresh و sync/App plugin + تست‌ها نوشته؛ اجرا نشده | پل legacy/defaultApp و تست‌های owner نوشته شده؛ بازبینی سازگاری/major metadata/API tags و اجرای نهایی unit/browser/pack؛ MFA کامل صرفاً در صورت پذیرش پروتکل جدا |
| #151 — پکیج مشترک a11y | primitives/adapters و Escape arbiter مشترک با UI/notification + regressionها نوشته شدند | metadata کامل، browser/axe/SSR/error parity، budget و گیت P نهایی |
| #152 — head واکنشی و per-request | manager صریح، serializer امن، plugin/hydration و SSR context + تست‌ها نوشته شد | directive/option parity، review major compatibility، سه مرورگر و P |
| #153 — UI headless کامل | controllerها، lazy tabs با SSR template، submenu/radio groups، Escape مشترک، date-picker grid/keyboard/lifecycle و تست‌ها نوشته شد | portal/modal focus+inert و date constraints/nonce/owner realm نوشته شد؛ menu lease/borrowed child و duplicate-parent اصلاح کدی شدند؛ ownership دیگر primitiveها، metadata و کل optionهای APG هنوز کار دارند |
| #154 — realtime واقعی، نه mock | transport واقعی، directive/plugin، WS/SSE fixtures و cleanup نوشته؛ هیچ‌کدام این فاز اجرا نشده | تکمیل parity/metadata/SSR و گیت P؛ پروب شبکهٔ اصلی در پایان بدون تضعیف |
| #155 — analytics کامل و مهار Promise rejection | callback قدیمی به bindTrack/engine canonical با consent صریح، DNT زنده، لغو revoke/regrant و ownership defaultApp وصل شد؛ regressionها نوشته شدند | بازبینی تغییر major و سازگاری، metadata و همهٔ گیت‌های P |
| #156 — adapter-node ایمن و عملیاتی | static/server API canonical، Brotli/gzip، shutdown race و observer hooks + loopback fixtures نوشته شد | streaming/backpressure، async factory، trustProxy/cache callback/schema/template parity و integration واقعی هنوز باقی‌اند؛ تمام تست‌ها اجرا نشده‌اند |
| #157 — adapter-edge مستقل از Node DOM | پکیج worker، SSR/edge با DOM صریح، linkedom/worker، state snapshot، nonce/abort/assets/cleanup و fixtureهای unit/Miniflare/Deno نوشته شد | happy-dom فقط factory صریح دارد؛ parity نهایی، bundle/size و اجرای Worker/Deno واقعی هنوز تأیید نشده |
| #158 — create-zenith و templates مستقل | کد-first کامل (اجرا نشده): `@zenith/templates` داده‌محور (فایل‌های واقعی shared+overlay، موتور scaffoldProject با force/dry-run/containment/host تزریقی، validateProjectName کانونی، جدول versions) + `@zenith/create-zenith` مستقل (bin، همهٔ flagها، قرارداد 0/1/2، نصب argv-array بدون shell)؛ cli به facadeهای بایت‌سازگار مهاجرت کرد (۵ ماژول literal حذف)؛ تست‌های templates/create؛ changeset؛ قراردادها (layers، README ریشه، snapshot+INDEX+صفحات docs/api، allowlist tarball، tsconfig refs) | فاز validation: build، تست‌ها، regen snapshot/pages و `*.api.md`، publint/attw/pack/install؛ تست per-template در CI؛ یکپارچه‌سازی versions با #109 |
| #159 — eslint-plugin قرارداد و قالب | options-object + ۹ rule کد و ۱۲ rule قالب، HTML processor/mapping، source integration و fixtures نوشته شد | adoption کامل library و رفع بدهی، review معنایی/metadata/types، docs کامل خوب/بد و اجرای نهایی fixtures/consumer gates |
| #160 — LSP واقعی و VS Code client نازک | پذیرش کامل نشده؛ کار جدیدِ کامل برای این کارت در این فاز ثبت نشده | regex/in-memory core فعلی را با LSP 3.17 transport/lifecycle/document incremental و engine مشترک diagnostics جایگزین/تکمیل کنید. |
| #163 — SSG مستقل با سایت hydrateپذیر | پذیرش کامل نشده؛ کار جدیدِ کامل برای این کارت در این فاز ثبت نشده | @zenith/ssg را از ssr/cli جدا؛ prerender/defineStaticRoutes و report قرارداد spec را حفظ کند. |
| #164 — unplugin روی پنج bundler | پذیرش کامل نشده؛ کار جدیدِ کامل برای این کارت در این فاز ثبت نشده | unplugin-zenith با هستهٔ compile/options واحد و subpath vite/rollup/webpack/esbuild/rspack ایجاد کنید. |
| #165 — mock شبکهٔ REST/WS و Service Worker | REST/fetch/WS/SW، lease/reset/record/abort و testing facade + unit/e2e نوشته شد | مصرف dashboard/demo، مرورگر واقعی SW/WS، reset/teardown همهٔ edgeها و P |
| #166 — fixtureهای Playwright مصرف‌شده در محصول | mount واقعی HTML/state/plugin، bridge، schema، console/axe و تست component/transport نوشته | مصرف full demo/UI/SSR/devtools واقعی؛ گیت‌های pack/target/size و مرورگر نهایی |
| #167 — codemod و upgrade قابل اعتماد | پذیرش کامل نشده؛ کار جدیدِ کامل برای این کارت در این فاز ثبت نشده | @zenith/codemod با AST TS و parser HTML؛ transformهای destroy/process/clear/form/error/logger/cache/i18n/runtime-imports طبق spec. |
| #174 — SSR با App/head/i18n مستقل | request head، factory App finally، registry request provider و تست owner/borrowed/error/async isolation نوشته شد | stream/ReadableStream و locale/nonce tests نوشته شد؛ review محدودیت fallback context و اجرای abort/concurrency/hydration واقعی و گیت‌های نهایی |
| #33 — e2e واقعی قالب‌ها و جریان‌های دمو | پذیرش کامل نشده؛ کار جدیدِ کامل برای این کارت در این فاز ثبت نشده | تمام قالب‌ها را از CLI واقعی در directory موقت تولید؛ پکیج‌های همین SHA pack و از registry fixture/local tarball نصب کنید تا نسخهٔ منتشرنشده وابستگی پنهان نباشد. |

## ادامهٔ متصل ۲۰۲۶-۱۰-۱۷ — a11y/head/UI/SSR/Node/mock

تمام موارد این بخش **نوشته‌شده، اما اجرا و تأیید نشده‌اند**. هیچ تست، lint،
typecheck، build، benchmark، CI، push یا بستن issue در این ادامه انجام نشد.
فقط metadata قفل با `npm@11.21.1 install --package-lock-only --ignore-scripts
--no-audit --no-fund` به‌روزرسانی شد (exit 0)؛ این نصب واقعی dependencyها یا
شاهد پذیرش محسوب نمی‌شود.

- `@zenith/a11y`: focus utilities و trap با stack مستقل هر Document، pause/
  unpause، fallback/return focus، پاک‌سازی حذف DOM، رویداد Escape تنها برای trap
  بالایی، roving با RTL، scroll/inert counted، motion reactive، live region،
  route announcer و scope صریح ID؛ plugin و unitهای regression نوشته شدند.
  core و notifications از همان implementation استفاده می‌کنند؛ facade boolean
  transition هم از a11y می‌آید. budget پیشنهادی ۵KB، هنوز اندازه‌گیری نشده.
- `@zenith/head`: manager صریح، ورودی getter/Readable، patch/dispose، dedupe،
  schema گزینه‌ها، JSON-LD-only، escape/nonce/maxTags، DOM reconciliation با
  marker و بازیابی attrs، route title و plugin. ambient `_activeHead` حذف شد؛
  legacy SSR `useHead` فقط manager صریح یا request context دارد. این تغییر
  به‌صورت پیشنهاد major ثبت شد، نه مجوز انتشار. budget ۳KB اندازه‌گیری نشده.
- `@zenith/ui`: position/autoUpdate و subpathهای dialog/popover/tooltip/tabs/
  menu/accordion/combobox/portal/date-picker نوشته شدند. date-picker و portal
  از runtime منتقل و facadeها به همان source وصل شدند؛ core هم position مشترک
  را re-export می‌کند. modal stack، leaseهای inert/scroll، IDs مستقل Document،
  readonly state views و abort/generation combobox اضافه شد. plugin و unitها
  و دو fixture مرورگری/axe نوشته شده‌اند. **تمام option parity، submenu، lazy
  tab semantics، date-picker keyboard و پذیرش APG/RTL هنوز تأیید کامل ندارند.**
- full preset و namespaceهای umbrella به a11y/head/UI متصل شدند. importmapهای
  browser fixture برای dependencyهای استخراج‌شده به‌روزرسانی شدند.
- SSR: factory App پس از serialize در success/error dispose می‌شود؛ borrowed
  App فقط unmount می‌شود. head داخل context مستقل request قرار دارد و head
  plugin App نیز پیش از teardown serialize می‌شود. برگشت دیرهنگام prepass بعد
  timeout اجازهٔ ساخت DOM نمی‌گیرد؛ marker موقت SSR و token مستقل ID هر request نیز restore می‌شوند تا reuse
  Document استخر، counter UI را بین درخواست‌ها مشترک نکند. streamها نیز head/attrs owner را پیش از flush
  جمع می‌کنند؛ fast-head قدیمی حفظ شده و برای prepass صریح `deferHead` اضافه شد.
  listener سیگنال خارجی ReadableStream در complete/error/cancel جدا می‌شود. تست
  ۱۰۰ factory هم‌زمان و teardown/error/borrowed نوشته شد، **اجرا نشده است**.
- adapterهای قدیمی Node/Fetch deadline کل request (شامل state loader)، پاسخ خطای
  redacted، nonce مشترک JSON-LD/hydration و escape nonce دستی دارند.
- `@zenith/adapter-node`: facade بر engine موجود SSR، static streaming با
  backpressure، HEAD/ETag/gzip، محافظت traversal/dotfile/symlink و server با
  graceful close/deadline؛ تست loopback/static/nonce/timeout/drain نوشته شد.
  template outlet، Express/Fastify و بودجهٔ اندازه‌گیری‌شدهٔ slow-client هنوز
  کار/پذیرش باقی‌مانده‌اند؛ این بسته به‌عنوان کارت کامل معرفی نمی‌شود.
- `@zenith/mock`: REST matcher/params، پاسخ یک‌باره، latency/clock/random/abort،
  record محدود و redacted، patch lease با restoration خارج از ترتیب، WS test
  transport و module Service Worker واقعی با MessagePort و handshake نوشته شد.
  testing.mockFetch/mockHttp به همین engine متصل است. unitهای HTTP/Resource و
  WS و یک e2e واقعی SW نوشته شده‌اند؛ اجرا نشده‌اند. چون integration کتابخانه‌ای
  است، mock در map و سند معماری به L4 منتقل شد؛ هیچ استثنای depcruise اضافه نشد.
- manifest/exports/targets/tsconfig/budget و release proposal برای پنج package
  جدید ثبت شدند. public API report، inventory/count baseline، dependency graph،
  build/pack/browser target و تمام گیت‌های G/P هنوز باید در پایان فاز code-first
  نهایی و بررسی شوند؛ اعداد جدید یا نتیجهٔ سبز فرض نشده‌اند.

## R01–R08، بازاعتبارسنجی و کار مدیریتی

- R01/R02: این دفتر و سربرگ‌های progress/readiness/audit، وضعیت نوشته‌شده را از
  green evidence تاریخی جدا می‌کنند؛ اصلاح جامع تمام اسناد هنوز تمام نشده است.
- R03/R05/R07/R08: manifestهای جدید و تغییر tools/API به READMEها وصل شده‌اند؛ گراف
  تولیدی، reference API امضادار، همهٔ مثال‌ها/قالب‌ها و آمارهای دیگر هنوز نهایی نیست.
- R04/R06: benchmark/performance/گواهی‌های امنیت و دامنهٔ دستی/بیرونی حل نشده‌اند؛
  معیار اصلی ≤۵٪ یا ممیزی مستقل با صرف متن جدید محقق نشده است.
- #106/#108/#112/#119: بازاعتبارسنجی نهایی بعد از همهٔ extractionها؛ هیچ بستن واقعی
  در GitHub انجام نشده و شواهد قدیمی به‌عنوان پذیرش تغییر جدید استفاده نمی‌شود.
- #176–#186: هیچ epic کامل اعلام نمی‌شود؛ childهای باز جدول بالا مانع خاتمه‌اند.
- #61/#66/#77/#80/#97/#107 و تصمیم‌های مالک:
  [OWNER-REQUESTS](./OWNER-REQUESTS-2026-10-16.md) و
  [MANUAL-STEPS](../MANUAL-STEPS.md). درخواست issue-write قبلی موفق نبود؛ متن محلی
  معادل ارسال درخواست یا تأیید مالک نیست.

## ترتیب ادامه

ادامهٔ کد/تست همهٔ کارت‌ها طبق dependencyهای پلن، به‌ویژه adapterهای registry و
Auth، تکمیل ESLint/binder/API inventory، a11y/head/UI/SSR، scaffold/unplugin/LSP/
codemod، mock/demo/CSP/SSG/performance. **تا این کارها تمام نشده‌اند وارد تست نهایی
نمی‌شویم.** سپس نصب واقعی dependencies، build و baseline review، تمام گیت‌های G/P
و ماتریس‌های لازم، رفع خطا بدون کم‌کردن معیار و ثبت شواهد روی candidate نهایی.

## ادامهٔ درخواست محدود به ۲۸ کارت — ۲۰۲۶-۱۰-۱۷ (بدون اجرای گیت)

این بخش گزارش **نوشتن کد** است، نه گواهی تمام‌شدن ۲۸ کارت. هیچ تست، typecheck،
build، lint، CI یا push در این ادامه اجرا نشد. تنها فرمان نصب، npm 11.21.1 با
`--package-lock-only --ignore-scripts --no-audit --no-fund` بود (موفق)؛ این فرمان
اعتبارسنجی رفتار، dependency audit یا پذیرش نصب پاک نیست.

- **#39/#109/#110:** نه معافیت قدیمی console حذف شد؛ CLI writer مستقل stdout/
  stderr/JSON دارد، خروجی داده با silent لاگر خاموش نمی‌شود و JSON نامعتبر قبل
  از نوشتن رد می‌شود. CLI/templates/compiler/Vite و VS Code از console مستقیم
  مهاجرت کردند. کد تولیدی logger/diagnostic dependency صریح دارد؛ نام ماژول با
  JSON امن تولید می‌شود و نمونهٔ action دیگر state/DOM/event را لاگ نمی‌کند.
  خطاهای legacy به transport تزریقی errors→logger وصل می‌شوند، نه import معکوس.
  transport بین bundleهای root/subpath و ESM/CJS مشترک است؛ cleanupهای نامرتب
  sink مرده را زنده نمی‌کنند. نصب bridge اثر import-time ندارد. رفتار errors
  مستقلِ بدون host policy عمداً silent شده و **نیازمند review تغییر major** است.
- **#118:** موتور token registry به shared منتقل شد؛ adapterهای Store/Resource/
  Permission/Component/ServerComponent از owner صریح App و provider درخواست SSR
  استفاده می‌کنند. `App.run` مرز **همگام** owner است؛ پس از await در مرورگر باید
  صریحاً دوباره وارد آن شد. اولویت App از ترتیب نصب provider مستقل است؛ نبودن
  نام در owner به global fallback نمی‌کند. cleanup ثبت، owner را capture می‌کند؛
  Store/Resource ساخته‌شده lifecycle-owned و ثبت قرضی reference-only است.
  primitiveهای Devtools و باقی سازگاری action/default هنوز نیازمند تکمیل‌اند؛
  محدودیت fallback AsyncContext در Edge با این patch حل نشده است.
- **#159:** ۹ rule کد علاوه بر options-object و ۱۲ rule قالب، parse5 processor،
  نگاشت line/column از virtual source به HTML، بررسی template literal، parser
  واقعی expression و metadata/option whitelist نوشته شدند. برای هر rule حداقل
  پنج fixture valid و پنج invalid نوشته شد؛ تست mapping Unicode/options نیز
  اضافه شد. root از همین source با jiti استفاده می‌کند؛ build قدیمی شرط lint
  نیست. recommended/template مصرف می‌شوند؛ adoption کامل library و رسیدگی به
  بدهی موجود، بررسی معنایی همهٔ scopeها و همهٔ قراردادهای وابسته به type checker
  **هنوز پذیرش‌شده نیست**. بدنهٔ typed/spread factory عمداً به type checker واگذار
  شده است؛ اجرای fixture یا پذیرش کل ruleها ادعا نمی‌شود.
- **#57/#51:** جدول واحد subpath برای UI/Mock/errors-internal، تولید CJS واقعی
  برای subpath دوفرمتی و external نگه‌داشتن runtime dependency ابزار Node نوشته
  شد. cardinality قدیمی ۵۰ در دو تست inventory با membership واقعی جایگزین شد؛
  این به‌تنهایی تکمیل همهٔ collector/API report/pack resolverها نیست.
- **#118، اتصال lifecycle به Resource:** Resource ابتدا request همسان را dedupe می‌کند و سپس controller جدید
  می‌سازد؛ نسل/Signal گرفته‌شده مانع پاسخ دیرهنگام بعد از supersede/reset/dispose
  است، retry backoff abortable شده و cleanup قدیمی cache درخواست جدید را حذف
  نمی‌کند. cache فهرست برای entity دیگری مصرف نمی‌شود؛ id یک path segment امن
  است و پاسخ ۲۰۴ loading را باز نمی‌گذارد. تست‌های رگرسیون این مسیرها نوشته شد.

تست‌های جدید registry/owner، SSR async isolation، transport/logger، CLI output،
RuleTester و request lifecycle **فقط نوشته شده‌اند**. سبزی تاریخی HEAD شاهد این
تغییرها نیست. وضعیت ۲۸ کارت هنوز یک‌دست «فقط منتظر تست» نیست: zero-public-any،
refactor تمام فایل‌های بزرگ، حذف positional debt، release-tag/report classification،
همهٔ binderها، تکمیل APG/options UI، Edge مستقل، analytics legacy parity و بقیهٔ
شکاف‌های جدول بالا همچنان کار کدی/بازبینی دارند. هیچ issue بسته یا بی‌نقص اعلام نشد.


## ادامهٔ پیاده‌سازی UI/Analytics/Edge — ۲۰۲۶-۱۰-۱۷، بدون اجرای اعتبارسنجی

این ادامه هم **به معنای آماده‌شدن همهٔ ۲۸ کارت نیست**. هیچ تست، typecheck،
lint، build، benchmark، CI، commit یا push اجرا نشد. فقط کد، تست و مستندات
نوشته/خوانده شدند؛ lockfile با npm 11.21.1 و `--package-lock-only
--ignore-scripts --no-audit --no-fund` به‌روز شد. خروجی موفق این فرمان اثبات
نصب، رفتار یا پذیرش dependencyها نیست.

- **#151/#132/#153:** Escape listener واحد به‌ازای document با cleanup لایه‌ای؛
  focus trap و popover/tooltip/menu/dialog همان داوری را مصرف می‌کنند. یک Escape
  لایهٔ داخلی را می‌بندد، نه هم‌زمان modal والد را. trap غیرفعال/paused می‌تواند
  decline کند؛ eventهای composing/prevented مصرف نمی‌شوند. nonmodal dialog
  Escape و initial focus دارد ولی Tab/scroll را قفل نمی‌کند. server-open dialog
  lease مرورگر/inert نمی‌گیرد. شکست فعال‌سازی همهٔ leaseها را آزاد می‌کند.
- **#153:** lazy tabs محتوای بازدیدنشده را با همان nodeها park می‌کند؛ mount و
  cleanup هر panel یک‌بار است. plugin فرزندان بعدی را با context همان App bind
  می‌کند؛ پنل اول دوباره bind نمی‌شود. محتوای غیرفعال SSR در template inert
  سریال می‌شود تا در hydration گم نشود. roving مجموعهٔ nested را نمی‌گیرد.
  menu دارای submenu، جهت RTL، بازگشت focus، محافظ cycle، گروه radio مستقل و
  typeahead است. date-picker grid/row/columnheader، یک tab stop روز، arrows/
  Home/End/Page/year و Enter/Space دارد؛ listenerهای render قبلی/disconnect
  آزاد می‌شوند. تست‌های این رفتارها فقط نوشته شده‌اند.
- **#155:** runtime callback دیگر engine مستقل ندارد؛ canonical bindTrack و
  createAnalytics را مصرف می‌کند. صرف configure کردن handler رضایت نیست؛
  `configureAnalytics(handler, { consent: true })` یا `setAnalyticsConsent(true)`
  پس از تصمیم واقعی رضایت لازم است. revoke حتی با regrant سریع callback قبلی
  را لغو می‌کند؛ جایگزینی handler صف قدیمی را منتقل نمی‌کند. DNT هم موقع قبول
  event و هم موقع callback delayed چک می‌شود. once اجازهٔ پایان همان تحویل را
  می‌دهد ولی manual/DOM/App cleanup آن را لغو می‌کند. هیچ element در payload
  سریال نمی‌شود. **runtime major proposal** برای این تغییر ثبت شد، نه انتشار.
- **#157/#174/#118/#57:** `@zenith/ssr/edge` مستقل از barrel مبتنی بر Node است؛
  App factory/mount/head/snapshot/dispose داخل مرز synchronous و DOM صریح هر
  درخواست انجام می‌شوند. sanitizer از ownerDocument و walker اصلی استفاده
  می‌کند، نه regex fallback یا global DOMParser/Node. `@zenith/adapter-edge`
  دارای Fetch/Cloudflare/Deno facade، GET/HEAD/405/health/assets، nonce امن،
  locale/hydration، deadline/abort، snapshot عمیق state/Readable و cleanup است.
  DOM مشترک زنده رد می‌شود؛ نتیجهٔ دیررس نمی‌تواند App mount کند. DOM پیش‌فرض
  `linkedom/worker` است و از artifact نازک external می‌ماند. peer jsdom در SSR
  optional شد و entry target Edge صریحاً worker است.
- **#157 — محدودیت صریح:** happy-dom به علت وابستگی‌های Node خودکار وارد Worker
  نمی‌شود؛ فقط با factory صریح روی host سازگار پذیرفته می‌شود. این تصمیم هنوز
  جای تأیید کامل تمام parity کارت را نمی‌گیرد. fixtureهای unit با ۱۰۰ درخواست،
  Miniflare با bundle واقعی/سقف ۱MB و probe مستقل Deno نوشته شدند؛ هیچ‌کدام
  اجرا نشده‌اند. نبود Deno در probe failure است، نه skip سبز.

**وضعیت:** هیچ کارت acceptance-complete اعلام یا issue بسته نشد. بدهی‌های
public-any، positional، refactor، adoption/metadata و سایر پذیرش‌های ثبت‌شده
همچنان از «فقط منتظر اجرای تست» جدا هستند. تأیید مالک/ممیز/فروشگاه نیز با کد
جایگزین نشده است؛ تضمین بی‌نقصی بدون اعتبارسنجی داده نمی‌شود.

- **#159، ادامهٔ همان نوبت:** no-global-name-collision اکنون export نام‌دار
  function/class/enum/namespace، re-export/namespace alias و binding patternهای
  destructuring را نیز پوشش می‌دهد؛ type-only export و نام داخلی default export
  مستثناست. fixtureهای مثبت/منفی افزوده شدند؛ اجرا/تایپ‌چک نشده‌اند.


## ادامهٔ متصل Core/Store/Resource/CLI/UI — بدون اجرای گیت

- **دامنه همچنان همان ۲۸ کارت است؛ وضعیت پذیرش ۰ کامل/۲۸ partial باقی می‌ماند.**
  این ادامه هنوز دلیل کافی برای عبارت «فقط منتظر تست» ندارد؛ بدهی‌های کدنویسی
  ستون آخر و تأییدهای واقعی مالک پاک یا پنهان نشده‌اند.
- **#38/#40/#56:** Core به types/options/app/scope/walker/hydrate/default/identity
  و directiveهای کوچک تقسیم شد؛ Store به types/engine/proxy/persist/storage/registry؛
  CLI به command و template moduleها. شمارش مستقیم فایل‌های جدید این سه بخش
  زیر۴۰۰خط بود، نه اجرای lint/max-lines یا گیت API. تغییر unknown، Computed و
  Cleanup عمداً major proposal است و API-identical بودن #40 را ادعا نمی‌کند.
- **#118/#174:** processChildren مالک subtree و cleanup زودهنگام دارد؛ structural
  rows/branches rollback، duplicate-key guard و restoration برای remount دارند.
  lifecycle callbacks به scope المان برمی‌گردند؛ App.run از scope App دیگر جداست.
  hydration App و signalهای ساخته‌شده‌اش را آزاد می‌کند؛ کلیدهای prototype از
  hydration JSON پذیرفته نمی‌شوند. تست owner/remount/partial-bind/hydration نوشته شد.
- **Store:** pluginهای پیش‌فرض و fallback memory در scope App هستند، نه درخواست
  دیگر SSR. constructor rollback، cleanupهای خطادار و reentrant dispose پوشش کد
  و تست دارند. proxy cache محلی، alias/cycle و native Date/Map/Set opaque هستند؛
  patchهای prototype رد می‌شوند. Store getter runtime همان Computed مانده و نوع
  عمومی اکنون با آن منطبق است؛ inference اعضای غایب به index signature جعلی نمی‌رود.
- **Resource/#120:** unknown boundary، JSON snapshot یک‌باره، failure بدون transport
  برای JSON خراب، generation مستقل queue، جلوگیری از rollback قدیمی و release
  Signal/registry نوشته شد. reset صریح legacy زنده‌سازی با Signal جدید است؛ reset
  رجیستری dispose می‌کند. overload `(element, BindContext)` و legacy deprecated،
  cleanup در partial bind و guard delayed bind اضافه شدند. فایل بزرگ Resource و
  دیگر binderهای positional همچنان بدهی مستقل باقی‌اند.
- **#109:** create و preview یک manifest دارند؛ پنج kind دیگر alias خام SPA نیستند.
  `workspace:*` از خروجی حذف و snapshot نسخه‌های package به build تزریق شد؛
  entry یکسان src/main.ts، SSR با Vite middleware/transformIndexHtml و production
  handler/static، PWA با یک registration/worker، manifest و SVG اولیه نوشته شد.
  نصب وابستگی یا build پروژهٔ تولیدی اجرا نشد. مالکیت/انتشار npm اثبات نشده است.
- **#151/#152/#153:** خطای فراخوانی createBindingContext در pluginهای a11y/head/UI
  رفع شد؛ lazy-panel cleanupها به controller متصل شدند. modal focus/inert مسیر
  portalهای منطقی را زنده دنبال می‌کند و sibling نامرتبط را باز نمی‌کند.
  date-picker دارای min/max/disabled/disabled-dates، clear value، nonce و کلاس/رجیستری
  owner document است. تست iframe و modal/portal نوشته شد، نه browser/APG certification.
- **Security:** corpus مستقل owner-document با jsdom در محیط Node، بدون نصب globals،
  به تست‌های نوشته‌شده اضافه شد. این جای CSP/TrustedTypes enforcement واقعی نیست.
- **هیچ test، typecheck، lint، build، coverage، API report، CI، commit یا push اجرا نشد.**
  هیچ issue بسته نشد. شمارش status آخر این ادامه ۲۶۷ entry بود (پوشه‌های untracked
  به‌صورت تجمیعی‌اند، نه تعداد دقیق فایل‌ها). تمام آزمون‌های جدید unrun هستند.

### بدهی واقعی که هنوز قبل از اعلام «فقط اجرای تست» باقی است

موجودی کامل public-any و release tagها؛ تمام binderهای #120 و positional allowlist
#55؛ باقی refactorهای بزرگ #40؛ borrowed/duplicate controller ownership و option/
metadata parity در UI و بسته‌های جدید؛ adoption/debt قواعد ESLint؛ اتصال consumerهای
کامل demo/e2e؛ و بازبینی قرارداد/major/approval واقعی مالک. baseline/API artifactها و
تمام اجرای final gates طبق دستور کاربر مؤجل‌اند، نه سبز یا قبول‌شده.

## ادامهٔ پیاده‌سازی ۲۰۲۶-۱۰-۱۷ — اجرای توافق‌شده، نه فهرست‌نویسی مجدد

کاربر ترتیب «تکمیل کد → اجرای تست و رفع خطا → تأیید معیار هر کارت → بستن همان
کارت» را تأیید کرد. این ادامه فقط فاز اول است؛ هنوز همهٔ۲۸ مورد code-complete
نیستند و فاز اجرای نهایی شروع نشده است.

### کد و تست تازه؛ بدون اجرا

- **#109/#39/#40/#56/#57:** CLI اجرایی از program side-effect-free و command
  moduleها جدا شد؛ پنج دستور dev/build/test/doctor/upgrade به مسیر واقعی وصل‌اند.
  runner پروژهٔ مشخص را بدون chdir و بدون shell interpolation اجرا می‌کند؛ script
  واقعی npm یا Vite/Vitest نصب‌شده، propagation خطا، deadline، POSIX process-group
  و Windows taskkill-tree دارد. JSON یک envelope نسخه۱، capture محدود و session
  مستقل AsyncLocalStorage دارد؛ parse/legacy commandها دیگر process.exit نمی‌کنند.
- **doctor:** بررسی read-only گراف physical node_modules با realpath، کپی تکراری
  state حتی با نسخهٔ برابر، constraintهای dependency/peer و engines، optional peer
  و config/lockfile. Yarn PnP و config پویا شاهد تأیید خودکار ندارند.
- **upgrade:** AST و lexical binding واقعی TypeScript برای const instanceهای
  شناخته‌شدهٔ destroy→dispose و notification imports/namespaces؛ کد خراب، shadowed
  و mutable محافظت می‌شوند. default فقط plan؛ --write دارای backup انحصاری،
  concurrent-edit guard و rollback است. downgrade/major/نسخهٔ ناشناخته manual است؛
  این به معنی پیاده‌سازی همهٔ codemodهای کارت مستقل #167 نیست.
- **CLI packaging:** ./program با ESM/CJS/types و builder مشترک؛ dependencyهای
  TypeScript/semver مستقیم، typeهای semver dev و sideEffects هر دو bin. همهٔ پنج
  scaffold اکنون فایل/script تست، Vitest و کف Node ابزار تولیدی صریح دارند؛ state
  مستقیم حتی در minimal حفظ شد. migrationِ exit codeهای command-line مستند شد.
- **#118/#120 Resource:** helper `resource()` واقعاً در request-lifecycle موجود
  است؛ نگرانی قبلی دربارهٔ helper فرضی با خواندن source رفع شد. child walk اکنون
  هنگام بسته‌شدن owner قطع می‌شود؛ cleanup همان child و fetch اولیه guard دارند.
  DOM registrationها token مستقل، explicit-unregister replacement safety و اجرای
  یک‌بارهٔ callback مشترک دارند؛ teardown همهٔ releaseها را با تجمیع خطا ادامه
  می‌دهد. reset در حین dispose اجازهٔ resurrect ندارد، reset بعد از پایان مجاز است.
- **#153 menu:** acquisitionهای مستقل با refcount روی یک controller؛ dispose یک
  مصرف‌کننده borrower را نمی‌کشد. parent link token و trigger conflict guard برای
  submenu نوشته شد. این اصلاح فقط menu است، نه ادعای پایان مالکیت کل UI.
- **#156/#40 Node:** فایل index به handler/static/compression/server تقسیم شد؛
  serveStatic(dir,opts)، staticDir/staticOptions، server.handler، listen(port,host)
  و gracefulShutdownTimeout با bridgeهای قدیمی نوشته شدند. static Brotli/gzip،
  q-value/identity/406، ETag قابل‌غیرفعال‌سازی، Vary و HEAD دارد. close منتظر listen
  درحال‌انجام می‌ماند و deadline socketهای tracked را می‌بندد. onError از خطای
  handled موتور SSR هم خبر می‌گیرد؛ CSP nonce پیش‌فرض فعال و completion log به
  finish/close متصل است. compression HTML و render streaming هنوز ادعا نمی‌شوند.

### تست‌های نوشته‌شده و wiring

- CLI lifecycle/JSON/errors/inference-free AST migration، physical state duplicates،
  symlink، optional peer، range/engine، backup conflict، idempotency، subprocess
  واقعی، deadline، capture truncation و concurrent invocation.
- Resource reentrant child bind، registration token/replacement، cleanup throwing
  و reset حین teardown؛ UI menu duplicate acquire/borrowed child/trigger conflict.
- Node canonical API/listen-close race/routes/onError/nonce و Brotli/gzip loopback.
- `scripts/lib/cli-consumer-check.mjs` از داخل install-import gate روی CLI نصب‌شده
  از tarball، JSON، پنج scaffold، child lifecycle/error/deadline و upgrade/backup
  را بررسی خواهد کرد. subpath بدون autorun CLI هم وارد import matrix شد. این fixture
  هنوز install/dev/build/HMR مرورگری مستقل هر پنج scaffold را کامل نمی‌کند.
- OS unit matrix علاوه بر scripts/test به lifecycle/scaffold CLI متصل شد. این فقط
  تنظیم workflow است؛ هیچ push یا CI برای اجرای آن انجام نشده است.

### تنها عملیات metadata

برای dependencyهای افزوده‌شده، فقط
`npx --yes npm@11.21.1 install --package-lock-only --ignore-scripts --no-audit --no-fund`
اجرا شد و exit۰ داد؛ نه نصب واقعی، نه lifecycle hook، نه audit/test/build/typecheck.

### باقی‌ماندهٔ واقعی؛ پذیرش همچنان صفر کارت

تمام public-any/release tags/API baseline، positional allowlist، سایر binderها و
metadata، refactorهای باقی‌مانده و option/SSR/APG parity کل UI هنوز کار دارند.
Node نیز async template/App factory، render streaming/backpressure، trustProxy،
cacheControl callback و schema/template parity کامل ندارد. CLI به consumer واقعی
پروژهٔ Vite/SSR/PWA و تست کامل signal در OSهای اعلام‌شده نیاز دارد. major/API و
پیش‌نیازهای بیرونی باید تعیین تکلیف شوند. هیچ issue بسته نشده؛ گزارش‌های قبلیِ
سبز یا نصب metadata شاهد این candidate نیستند.

## ادامهٔ ۲۰۲۶-۱۰-۱۷ — SSR/Node async ownership و document transport

این بخش، بندهای قدیمیِ «هنوز پیاده‌سازی نشده» دربارهٔ async factory و HTML stream
را به‌روز می‌کند؛ همهٔ تغییرات candidate هستند و پذیرش همچنان **۰ از ۲۸** است.

- SSR در ورودی Node از `node:async_hooks` واقعی استفاده می‌کند، نه fallback ناامن
  Node 18. ورودی مستقل `./edge` همچنان import این مسیر را ندارد.
- کارخانهٔ async App با context شامل document/state/head/route/signal؛ کنترل
  reuse/concurrent mount، abort/timeout در زمان setup/factory، dispose نتیجهٔ دیررس
  بدون mount، و خارج‌کردن DOM دارای factory معلق از pool نوشته شد. cleanup با
  context همان درخواست اجرا می‌شود. borrowed App مستقیم در facade قدیمی باقی است.
- Node canonical کارخانهٔ تازه و marker واقعی `<!--zen-outlet-->` را می‌خواهد؛
  قالب کامل، siblingهای body، script ماژول، head ثابت و attributeها حفظ می‌شوند.
  title/meta/link/base پویا جایگزین نسخهٔ هم‌کلید می‌شوند؛ nonce برای script/style
  قابل‌اعتماد قالب نیز اعمال می‌شود. marker/app در scaffold و fixtureهای Node
  هماهنگ شدند؛ facade قدیمی SSR حذف نشده است.
- loaderهای async template/state/head/i18n با deadline و onDispose؛ owner رجیستری
  در زمان loaderها و بعد از await؛ snapshot مشترک state/Signal با Edge و مالکیت
  فقط copyها نوشته شد. snapshot به معنای codec کامل JSON برای cycle/Map/Set نیست.
- HTML از renderToStream مشترک و pipeline با backpressure و br/gzip عبور می‌کند؛
  stream:false، HEAD، Vary/406، cacheControl callback پس از رندر و پیش از commit،
  trustProxy صریح با context URL/IP و schema options با خطای production نوشته شد.
  این جریان تحویل chunkشدهٔ render کامل است، نه progressive async components.
- fixtureهای جدید: ۱۰۰ context/factory async، دیررس/timeout/reuse/abort، snapshot،
  مرز UTF-16/UTF-8، قالب کامل/head/nonce، HTML compression/HEAD/cache، ۱۰۰ درخواست
  با Signal مشترک، proxy، client disconnect، write/drain backpressure و owner
  Resource در loaderها. هیچ‌کدام اجرا نشده‌اند.
- scaffold SSR اکنون App تازه در server و client، state منتقل‌شدهٔ counter، marker
  و cleanup/state HMR دارد؛ install/build/browser/hydration واقعی آن هنوز gate است.

### محدودیت‌های باقی‌مانده

Node/Edge option/schema/template parity نهایی، consumer واقعی middleware، hydration
و CSP/HMR مرورگری، API/release tags/public-any و سایر binderها/UI هنوز کار دارند.
بودجه‌ها و صحت تایپی/runtime این candidateها اثبات نشده‌اند. هیچ تست، build، lint،
typecheck، CI، push یا mutation کارت در این ادامه انجام نشده است. اقدام‌های بیرونی
#66/#97/#132 و تصمیم‌های major/API همچنان مستقل از اجرای نهایی تست‌ها هستند.

## ادامهٔ ۲۰۲۶-۱۰-۱۷ — مالکیت reentrant و cleanup اجزای UI

- owner داخلی UI پس از بسته‌شدن DOM/listener جدید نمی‌سازد؛ cleanup دیررس را فوراً
  آزاد می‌کند. خطا مانع آزادسازی سایر منابع/attributeها/finalizerها نمی‌شود.
- dialog/popover برای activation و بستن/reopen نسل مستقل دارند؛ focus اولیه،
  focus بازگشتی و geometry callback نمی‌توانند وضعیت قدیمی را روی opening تازه
  بنویسند. trap بسته‌شده در callback focus دیگر خطای stale activation نمی‌دهد.
- modal leaseها token دارند؛ refresh دوباره‌واردشده به pass بعدی منتقل می‌شود؛
  releaseهای خطادار بقیه را متوقف نمی‌کنند. branch ناموفق rollback می‌شود.
- tooltip دارای IDREF lease مستقل، احترام به disabled در API، لغو timer/Escape و
  cleanup هنگام حذف trigger است. popover hover/focus/manual، align منطقی RTL و
  observer callback غیرفعال پس از cleanup دارد؛ style پیکان بازگردانده می‌شود.
- lazy tabs قبل از user callback علامت in-flight می‌گیرد، selection بازواردشده
  برنده است و cleanup برگشتی پس از dispose فوراً آزاد می‌شود. accordion nested،
  snapshot مقدار اولیه، validation و keyboard غیرbutton نوشته شد.
- combobox از listenerهای مستقل row به delegation منتقل شد؛ row نگه‌داشته‌شدهٔ
  قدیمی پس از تعویض/dispose بی‌اثر است. close درخواست و debounce را لغو می‌کند،
  search مستقیم timer قبلی را جایگزین می‌کند و ArrowUp از آخرین گزینه شروع می‌شود.
- portal هم‌مقصد refcount/marker مشترک دارد، جابه‌جایی خارجی را پس نمی‌گیرد و
  مقصد ناسازگار/realm متفاوت/بازورود حین انتقال را رد می‌کند.
- bind ساخته‌شده هنگام uninstall پلاگین نگه داشته نمی‌شود؛ lazy child walk در
  بسته‌شدن پلاگین قطع می‌شود؛ خطای effect اولیه controller را نشت نمی‌دهد.
- فایل `packages/ui/test/reentrant-ownership.test.ts` برای این مسیرها نوشته شد.

**وضعیت:** هیچ تست، typecheck، build، lint، CI یا push اجرا نشد؛ پذیرش ۰/۲۸.
این کار پایان #153 نیست: MaybeSignal/options و schema/metadata/two-way directiveها،
API parity، date-picker چندتقویمی/form/range، transition/reduced-motion و اجرای
browser/axe/RTL/SSR/size هنوز باقی‌اند. سایر binderها و شکاف‌های Edge/API هم برقرارند.

## ادامهٔ ۲۰۲۶-۱۰-۱۷ — Date Picker و اتصال custom tag به App

- Date Picker به helper تقویم و schema options تقسیم شد؛ Gregorian/Jalali، leap
  و UTC civil dates، locale/digits، first-day، format و ISO ورودی Gregorian، min/max،
  readonly/required و disabled-dates محدودشده نوشته شد. JSON attribute فقط از
  helper مشترک schema خوانده می‌شود؛ config خراب به validity تبدیل می‌شود.
- range با قرارداد صریح `start..end`، partial بدون submit، مرتب‌سازی endpoint و
  ممنوعیت عبور از روز مستثنا؛ canonical event با detail کامل و bridge change برای
  انتخاب کامل نوشته شد. تغییر calendar بازتفسیر مقدار است، نه تبدیل خودکار تاریخ.
- ElementInternals form-associated با fallback یک proxy owned؛ name/form، validity،
  custom validity، reset/defaultValue، fieldset/legend، readonly/disabled و قطع/وصل
  نوشته شد. dispose مقدار فرم و listener/observer را آزاد می‌کند، نه markup را.
- `createDatePicker` با MaybeReactive/Signal options، schema strict و بازگرداندن
  attributeهای owned؛ processDatePicker با leaseهای مستقل و owner realm ادامه یافت.
- Core یک field اختیاری `DirectiveDefinition.tag` دارد؛ index با mutation registry
  invalid می‌شود و cleanup آن App-owned است؛ tag/attribute دوباره bind نمی‌شوند.
  UI plugin با همان مسیر custom tag را نصب می‌کند. این API افزوده، refactor
  API-identical برای #40 محسوب نمی‌شود؛ بازبینی API/release همچنان لازم است.
- unit regression برای calendar/range/form/reactive/disposal و tag directive و
  Playwright واقعی form/keyboard/range/axe نوشته شد. seed metadata/گرامر و README
  به‌روز شدند؛ snapshot editor در گیت نهایی باید regenerate/check شود.
- فقط lock metadata با --package-lock-only --ignore-scripts --no-audit به‌روز شد؛
  نه install واقعی و نه validation. همهٔ تغییرها candidate و پذیرش **۰/۲۸** است.

هنوز MaybeSignal/schema/two-way binding سایر primitiveها، transition/reduced-motion،
تطبیق کامل API و اندازهٔ UI، رفتار واقعی native/fallback form در browserها و QA
screen-reader نیازمند تکمیل/تأییدند. شکاف‌های Edge و public API دیگر هم برقرارند.
هیچ تست، typecheck، build، lint، CI، push یا بستن کارت در این ادامه انجام نشد.

### ادامهٔ همان روز — interaction و announcement

- Tooltip اکنون hover محرک/سطح و focus را جدا نگه می‌دارد؛ خروج یک ورودی در حضور
  دیگری مخفی نمی‌کند. deadline بازشدن با ورود focus دوباره شروع نمی‌شود؛ Escape
  و outside-close همان session را تا خروج همهٔ ورودی‌ها dismissed نگه می‌دارند.
  unit و browser fixture این ترکیب‌ها نوشته شدند، نه اجرا.
- Popover محاسبهٔ geometry را بدون نوشتن arrow انجام می‌دهد و بعد از کنترل revision
  arrow را به‌روز می‌کند؛ fixture برای dispose داخل getBoundingClientRect نوشته شد.
- Date Picker reset مقدار دست‌نخورده را هم با proxy دوباره sync می‌کند و anchor
  اعتبارسنجی native دارد. live-region ماه بین renderها همان node connected می‌ماند؛
  lang/dir ارثی مشاهده می‌شوند. digit map محدود به ۳۲ locale، خروجی بنگالی/hanidec
  را هم دوباره می‌خواند؛ هیچ document/request در cache نگه داشته نمی‌شود.
- تفسیر disabled/readonly/required/range با حضور HTML boolean attribute هم‌راستا شد؛
  first-legend exception، reset بدون تغییر، live region و locale fixture دارند.

همچنان **۰ پذیرش از ۲۸**؛ هیچ تست/typecheck/build/lint/CI یا push اجرا نشد.

## ادامهٔ ۲۰۲۶-۱۰-۱۷ — schema، collection و اتصال دوطرفهٔ UI

- مسیر داخلی options مشترک با schema strict مستقل از dev/prod، resolve/readable و
  effect owned نوشته شد. مقایسهٔ arrayهای primitive از churn ناشی از clone schema
  جلوگیری می‌کند؛ callbackها به‌اشتباه به‌عنوان getter اجرا نمی‌شوند.
- Tabs/Accordion/Combobox اکنون config و MaybeReactive options دارند؛ orientation،
  activation، selection، lazy، multiple/collapsible و source/debounce/filter به‌صورت
  owned تغییر می‌کنند. setValue بی‌رویداد از select/toggle کاربر جدا شد.
- Tabs تمام setup را زیر cleanup برد؛ بازگرداندن lazy content پیش از جابه‌جایی
  custom element ثبت می‌شود و روی snapshot nodeها کار می‌کند، نه while زنده.
  roving lease اگر پس از dispose برگردد همان لحظه آزاد می‌شود.
- Combobox source/value snapshot مشترک، ابطال source قبلی، حفظ input اصلی، schema
  ردیف‌های یکتا، readonly/disabled، IME و Home/End/اولین Arrow دارد. فیلترهای بعدی
  پس از dispose در callback دیگر اجرا نمی‌شوند؛ generated row listenerها delegated‌اند.
- برای Dialog/Popover/Tooltip/Menu نیز resolver schema نوشته شد؛ گزینهٔ خراب دیگر
  به پیش‌فرض نامرتبط فروکاسته نمی‌شود. setup Dialog با خطا attributes را برمی‌گرداند.
  **این چهار controller هنوز MaybeReactive کامل ندارند**؛ resolver با reactivity یکی نیست.
- اتصال دوطرفهٔ directive برای Dialog/Popover/Tabs/Accordion/Combobox نوشته شد؛
  expression عمومی فقط خواندنی است، نوشتن تنها به container مستقیمِ get/set انجام
  می‌شود. هیچ assignment با eval/Function/property-path ساخته نمی‌شود. Tooltip
  متن واکنشی امن و restoration nodeهای اولیه دارد؛ Dialog directive portal owned
  با ترتیب cleanup و SSR بدون جابه‌جایی دارد.
- Combobox valueExpr از optionsExpr جدا شد؛ field projection own-property، filter
  contains/startsWith/none، async loader نام‌دار، multiple و duration/schema attrs
  اضافه شدند. ثبت metadata تمام هفت directive، seed و جدول grammar به‌روز شدند.
- فایل‌های reactive-collections/directive-values/combobox-options/options-types و
  سناریوهای browser accordion/combobox نوشته شدند؛ همگی **اجرانشده** هستند.

### شکاف‌های صریح پس از این ادامه

Surface/Dialog/Menu reactivity، transition/reduced-motion مشترک، قرارداد API مصوب
و logical portal branch کامل هنوز تکمیل نیستند. Snapshotهای تولیدشوندهٔ metadata/API
همچنان به مرحلهٔ گیت نهایی موکول‌اند. همچنین source/config batch و synchronous
reentrancy فقط fixture کاندید دارند، نه اثبات. SSR/Node buffering و Edge integration
و موارد بیرونی دیگر در فهرست قبلی پابرجایند. **۰/۲۸ پذیرش**؛ هیچ test/typecheck/
build/lint/CI/push، انتشار یا بستن issue در این ادامه انجام نشد.

### ادامهٔ lifecycle Portal در همین نوبت

Portal عمومی نیز logical floating branch می‌گیرد، نه فقط Menu/Popover اختصاصی.
همان target با leaseهای مشترک تا release آخر حفظ می‌شود؛ حذف source subtree آن را
به والد detached اصلی برمی‌گرداند تا controller به‌صورت orphan در body نماند؛ حذف
target به source برمی‌گرداند و انتقال/حذف خارجی را دوباره زنده نمی‌کند. rollback
خطای append، cache حین reconnect و آزادسازی branch حتی پس از خطا نوشته شد. نه
fixture واحد تازه برای modal focus/inert، outside boundary، marker مفقود، lease قدیمی و حذف App subtree دارند؛
اجرا نشده‌اند و پذیرش/مرورگر واقعی/حجم را ثابت نمی‌کنند.

## ادامهٔ ۲۰۲۶-۱۰-۱۷ — surface واکنشی، motion و اتصال attribute

این بخش یادداشت‌های قدیمیِ «surface/motion پیاده نشده» را جایگزین می‌کند، نه
وضعیت پذیرش را. **۰/۲۸ پذیرش؛ همهٔ تغییرهای این بخش اجرا‌نشده‌اند.**

- Dialog/Popover/Tooltip/Menu دارای Config مشخص و Options نگاشت‌شدهٔ readable
  هستند. Dialog سیاست modal/focus/scroll/portal را بدون close/open مصنوعی عوض
  می‌کند و منشأ return-focus را نگه می‌دارد. تغییر portal ابتدا leaseهای focus و
  modal قدیم را آزاد می‌کند. Popover مالک trigger ARIA و geometry است؛ Menu
  snapshot تکراریِ همان ARIA را حذف کرده تا anchor قبلی دوباره آلوده نشود.
- motion مشترک برای هفت widget نمایشی نوشته و به Dialog/Popover/Tooltip/Menu،
  panelهای Tabs/Accordion و listbox Combobox وصل شد. leave از لحاظ منطقی فوراً
  بسته/inert/ARIA-hidden است؛ hidden فیزیکی به پایان animation موکول می‌شود.
  reopen، dispose، تغییر config و reduced-motion اجرای قبلی را لغو می‌کنند.
  بازشدن محتوای SSR، inert/aria-hidden حالت بستهٔ سرور را پاک می‌کند.
- موتور createTransition از realm خود عنصر برای RAF/style/media استفاده می‌کند؛
  before-hook/style-read reentrancy، حفظ classهای اولیه و حضور/نبود attribute
  class، settlement و سقف timer اصلاح شد. سایر APIهای transition هنوز به‌طور
  کلی از لحاظ realm بازنویسی نشده‌اند.
- هفت directive از گزینهٔ scalar با پیشوند `:`، expression engine موجود و
  readableهای owned استفاده می‌کنند؛ literalها و boolean existence حفظ شدند.
  Dialog directive از portal خود controller استفاده می‌کند، نه lease جداگانه؛
  false literal و مقصد reactive پشتیبانی می‌شوند. projection/filter/multiple و
  durationهای Combobox نیز reactive هستند؛ projection برابر و loader بدون تغییر
  identity تازهٔ بی‌دلیل نمی‌سازند. غیرفعال‌کردن lazy، فرزندان تازه‌آشکارشده را bind می‌کند.
- UI_METAS، seed و جدول grammar برای optionهای motion و floating کامل‌تر به‌روز
  شدند. snapshotهای تولیدی همچنان عمداً تا مرحلهٔ نهایی تولید/بررسی نشده‌اند.

### فایل/fixtureهای تازهٔ این مسیر (هیچ‌یک نتیجهٔ اجرا نیست)

| موضوع | کد | fixture |
|---|---|---|
| invalid config/foreign realm/SSR/reconnect | ui/src/{dialog,popover,surface-options}.ts | ui/test/surface-options-errors.test.ts |
| reconfiguration و watched-node lease | ui/src/{dialog,popover,tooltip,menu,internal,options}.ts | ui/test/reactive-surfaces.test.ts |
| motion، SSR closed attrs، reopen/dispose/media | ui/src/motion.ts و controllerها | ui/test/{motion,collection-motion}.test.ts |
| realm و synchronous cancellation | transition/src/transition.ts | transition/test/realm-and-reentrant.test.ts |
| attribute واکنشی، portal، lazy، projection | ui/src/{attributes,plugin}.ts | ui/test/directive-values.test.ts |
| types | ui/src/index.ts و Config/Options | ui/test/options-types.test.ts |
| مرورگر reduced-motion و leave inert | ui/src/motion.ts | e2e/ui-components.spec.ts |

### بازمانده‌های صریح

Generic createPortal هنوز target ثابت دارد. borrowed Menu منبع config اولین
controller را حفظ می‌کند؛ سیاست منبع مشترک/ناسازگار نیاز به تصمیم API دارد.
Tooltip text binding همراه arrow/فرزند authored به تکمیل composition نیاز دارد.
خطای config و callback/reentrant استثنایی باید fixtureهای بیشتری بگیرد؛ وجود
این candidate اثبات rollback کامل نیست. SSR stream هنوز HTML رندرشده را buffer
می‌کند و کارهای باقی tracker، API approval، بودجهٔ حجم و شاهدهای بیرونی پابرجایند.
هیچ test/typecheck/build/lint/CI/push/انتشار/تغییر issue انجام نشد.

## ادامهٔ ۲۰۲۶-۱۰-۱۷ — target عمومی Portal و stream با DOM owned

**کد/تست‌نویسی است، نه نتیجهٔ اعتبارسنجی؛ ۰/۲۸ پذیرش.** این یادداشت وضعیت
قدیمی «generic target ثابت / stream همیشه buffer کامل» را برای مسیرهای مشخص زیر
جایگزین می‌کند؛ پذیرش کامل #153/#156/#174 ادعا نمی‌شود.

- `ui/src/portal.ts` اکنون PortalConfig/PortalOptions/portalOptions دارد و target
  readable را با یک watcher متعلق به entry دنبال می‌کند. جابه‌جایی‌های میانی
  origin marker و logical branch اولیه را عوض نمی‌کنند. concrete borrower یا
  همان readable lease مشترک می‌گیرد؛ readable مستقل به‌جای نادیده‌گرفته‌شدن رد
  می‌شود. final release و حذف source/target watcher را می‌بندند. rollback append،
  external reparent، reconnect release، حذف synchronous source و origin/target
  در shadow tree پوشش کد و fixture دارند؛ explicit SSR marker/effect نمی‌سازد.
- renderer رشته‌ای و stream از یک عمر request مشترک استفاده می‌کنند. مسیر HTML
  معمولی به‌جای `root.outerHTML` کامل، DOM mounted را هنگام pull به chunk تبدیل
  می‌کند. App/registry/DOM تا پایان مصرف یا abort/return متعلق به request می‌مانند
  و قبل از done نهایی dispose می‌شوند. `onReady` و shell با `metadataOnly:true`
  نیاز به HTML کامل ندارند؛ onRendered و shell قدیمی برای سازگاری عمداً buffer
  می‌کنند. Node برای cacheControl ثابت از مسیر metadata استفاده می‌کند؛ callback
  کامل cacheControl همچنان نتیجهٔ HTML واقعی را دریافت می‌کند.
- serializer داخلی iterative و realm-independent برای HTML، attrs، template،
  comments/raw text و namespaceها نوشته شد. مرز surrogate حتی بین Text nodeهای
  مجاور حفظ می‌شود. noscript و XML برای سازگاری native fallback دارند؛ shell و
  state JSON نیز محدود به اندازهٔ chunk نیستند. این کار streaming پیش‌روندهٔ
  ServerComponentهای حل‌نشده یا رندر DOM با حافظهٔ ثابت نیست.
- request state در renderer هم snapshot owned می‌گیرد؛ legacy head اولیه و body
  از یک snapshot ورودی استفاده می‌کنند. Window/Document مربوط به user هر request
  تازه است؛ cache فقط templateهای inert را نگه می‌دارد، نه window کاربر قبلی.
  diagnostic keyها bounded شدند، cacheTemplates:false آن‌ها را نگه نمی‌دارد و
  cache epoch مانع refill توسط renderهای قبل از clear می‌شود.
- Node cleanup اکنون iterator.return را قبل از dispose acquisitionهای loader
  await می‌کند؛ HEAD/406 و قطع ارتباط نیز عمر SSR فرزند را قبل از والد می‌بندند.

| بخش | fixtureهای نوشته‌شده و اجرا‌نشده |
|---|---|
| target واکنشی، shared lease، SSR، reconnect و shadow | ui/test/reactive-portal.test.ts و options-types.test.ts |
| native HTML parity، deep/UTF-16/demand | ssr/test/dom-stream.test.ts |
| عمر App/DOM، return/cancel/error، fresh Window، shared state و ۱۰۰ stream همزمان | ssr/test/owned-stream.test.ts |
| Node بدون full-root buffer و nesting در HEAD | adapter-node/test/render-contract.test.ts |

بازمانده‌ها: composition متن Tooltip و arrow، سیاست config مشترک Menu و تصمیم‌های
API/major، بخش‌های دیگر tracker و Edge/CLI/security/release؛ بودجه/coverage/API و
شاهد browser/network هنوز اجرا نشده‌اند. نحوهٔ stream کردن body now code candidate
است، نه اثبات throughput/عدم نشت. هیچ test/typecheck/build/lint/generation/CI/push،
انتشار یا تغییر issue انجام نشد.

### 2026-10-17 — Tooltip composition / shared Menu sources (unvalidated candidates)

- `ui/src/tooltip-content.ts` projects literal expression text without destroying
  authored nodes or making reactive SVG/alternate-arrow selectors unreachable.
  Inactive fallback is presentation-masked and not child-bound; selected arrows
  remain decorative. Exact authored text/attributes/style restoration follows
  surface disposal, including trigger/root removal and initial failures.
- Core `BindContext.skipChildren?()` suppresses only the automatic child walk, not
  other root directives or explicit owned `processChildren`. Tooltip expression
  binding requires this capability; unsupported custom hosts fail before mutation.
  This is an **additive public API proposal**, not evidence for #40 API identity;
  reports, compatibility/owner approval and downstream checks remain pending.
- Shared Menu acquisition now validates every supplied field: same readable object
  or matching current concrete value; different sources/conflicts reject ZEN-1603,
  concrete trigger conflicts/invalid selectors use ZEN-1601. Existing separately
  configured children keep their sources; only new submenus inherit parent sources.
  Missing directive attributes do not become competing defaults. Explicit conflicting
  child attributes reject rather than silently reconfigure an existing child. This
  compatibility policy needs acceptance review; it is not an approved scope change.
- Authored `tooltip-content`, Core `owned-children`, `menu-source-ownership` fixtures,
  a browser tooltip text/arrow/axe scenario and options type fixtures. Self-arrow
  rejection now has a reserved-error regression. None have been run.
- Readback confirmed the serializer size-1 deferred-surrogate correction and its
  lone-high/new-valid-pair fixture are present. This is source confirmation only.
- No test/typecheck/build/lint/generator/CI/push/issue mutation was executed. No card
  acceptance or 28-card code-complete readiness is claimed by this entry.

### 2026-10-17 — CSP insertion / browser fallback fixture follow-up (unrun)

- Date Picker now sets nonce before inserting its shadow stylesheet. Nonce changes
  replace the sheet; mutating a nonce after connection is not assumed to authorize
  a previously blocked stylesheet. Added nonce-rotation unit and CSP-response-header
  browser fixtures with real grid styling, native form selection/reset and axe.
- Fixed-role Menu/Tooltip options now reject other roles in both public types and
  strict schemas, instead of accepting and silently overriding the requested role.
  This narrowing requires API compatibility/release review with the other proposals.
- Added Auth two-tab native storage-only refresh/logout and disposed-peer fixtures
  with BroadcastChannel absent; these supplement existing real-channel scenarios.
  Resource lifecycle/owned-child and explicit-document sanitizer candidates were
  read back, not executed; readback is not acceptance evidence.
- All fixtures above remain unrun. No gates, server, generator, push or issue mutation.

The Tooltip projection now acquires a reactive root cleanup **before** the initial
synchronous effect invocation, so an expression throw cannot strand that projection's
reactive owner before a stop handle is returned. Added a captured-owner disposal
regression (unrun). This local ownership correction is not a claim that every
legacy state effect/error path has been remediated or validated.

## 2026-10-17 — a11y, head and route integration continuation

Source/test authoring only; no validation commands or publication operations.

- #151/#120/#118: reactive directive/config parsing, binding/removal ownership,
  focus activation callbacks, inert/scroll lease restoration, native-inert fallback
  tab-stop ownership, explicit SSR motion isolation, and route-announcer cleanup.
- #152/#174: per-document head ownership and SSR borrowing/restoration; selective
  dedupe/title callbacks and strict options; literal authored-head projection and
  App cleanup; JSON-LD/nonce/link filtering; write rollback, reentrancy and
  independent teardown attempts. New DOM/plugin/type and 100-overlapping-request
  SSR fixtures plus streamed-owner fixture authored.
- Router: shared a11y/head adapters, explicit route metadata, legacy formatter
  passthrough, acquired-entry cleanup after reentrant disposal, reset ownership.
  `Route.component` now resolves `unknown` and `Route.meta` values are `unknown`;
  the incomplete legacy signal facade and other public-any debt remain, so #38
  is not complete.
- Three real browser fixture cases cover keyboard/inert/scroll leases, authored
  and reactive head adoption/restoration, and route live-region/title/link/focus
  ownership. Four explicit unsupported-inert fallback fixtures also authored.
- Authored seed/grammar rows are source candidates; generated snapshots were not
  refreshed. README and changeset notes describe candidate semantics honestly.

Pending decisions include authored projection versus moving original nodes,
callback/selective-dedupe API additions, runtime skipChildren/tag API, route
message/default-selector compatibility, and existing broader API/major choices.
Budgets (a11y≤5KB, head≤3KB, router entry budgets) remain unmeasured. Cross-package
imports, strict type inference, browser timing, head teardown failures and SSR
integration have not been compiled or executed. #66/#97/#132 retain their real
owner/publication/store-approval/screen-reader gates. No card accepted or closed;
no claim that all 28 are ready for final validation.

## 2026-10-17 — Realtime and Mock ownership continuation

Code/test authoring only, not final validation or issue acceptance.

- #154: late factory acquisitions close after reentrant dispose; parser/serializer,
  send/drain/observer and native-close paths guard connection generations. Ambient
  SSR Window no longer causes autoConnect. Blob decoding preserves receive order,
  clears obsolete work and bounds pending frames/bytes; decoder overload uses1704.
- #165: split Service Worker client setup from the barrel. Protocol v2 has a
  per-installation session and last-active-owner stack per page. Own registration
  activation/claim/handshake waits are bounded; server/external/pagehide cleanup
  aborts pending setup, request ports and socket leases without unregistering a
  shared registration. Worker preserves HEAD/null-body/statusText and prunes dead
  client entries on later START. Older protocol copies fail the handshake.
- Found and corrected a source-level URL matcher gap: absolute ws/wss handler
  patterns had been treated as pathname patterns. Socket warning, independent
  callback leases, stop-on-close and native client URL/protocol/close validation
  now have authored fixtures. Native server-side close codes remain distinct.
- Mock close/reset use request epochs, reject closed dispatch and cancel pending
  resolver/passthrough waits. Passthrough can inspect a POST body without consuming
  the forwarded copy. Configurable read-only/accessor fetch/WS descriptors are
  borrowed/restored without invoking setters; failed acquisitions do not add a
  phantom stack frame.
- Mock exposes frozen defaults and schema-backed options validated in production.
  Latency range is frozen; opaque callbacks/clocks are not frozen/evaluated. Direct
  schema dependency and test-only consumer dependencies reflected in manifests and
  workspace lock entries by source edits, without install/build/generation.
- Existing Resource CRUD demo now uses the public mock engine with page cleanup,
  rather than a hand-written fetch replacement. Browser fixtures consume that
  same backend via real HTTP/Resource APIs. Realtime fixtures use public mock WS,
  not test message injection. Worker nesting and HEAD browser cases authored.

New files: `packages/mock/src/{worker-client,options}.ts`, four Mock unit fixture
files, two Realtime fixture files and `demos/resource/mock-backend.mjs`; browser
worker fixture extended. All unrun. New protocol/schema and receive-buffer behavior
are compatibility proposals. Package/API/metadata/layer and ≤5KB Realtime budgets
unmeasured; actual transport/browser/pack results absent. No test/typecheck/build/
lint/generation/CI/commit/push/publication/issue mutation, no checkbox accepted, and
no declaration that the whole 28-card scope is implementation-complete.

## 2026-10-17 — shared API implementation continuation (unvalidated)

Actual authoring, not another planning-only update:
- Router: real Signal-backed Proxy facade, invocation-time method resolution,
  native async request isolation/disposal, explicit dual Node entry, shared
  ESM/CJS holder, no shared SSR fallback; four request/tracking fixtures authored.
- Public types tightened in Data/HTTP/Testing/SSR/Actions/State observers and
  registry, Form, Components/Events/Stateful and expression Token/AST boundaries.
  No claim that the complete published graph is any-free or internal-any ≤100.
- Auth mechanically separated into engine/registry/functional/decoding/transport
  concerns; Form split into factory/store/advanced/wizard/validation concerns.
  Cache extracted. Constructor/facade identity and lazy reads have authored
  regression fixtures; bundle/API/timing equality has not been established.
- Options overloads added for cache, Intl formatters and SW strategies, with
  canonical schemas and retained legacy edge behavior. Animation warning only
  on the legacy branch; zenAnimate bridge tagged and internal binder migrated.
  Warnings 072–085 registered. Worker subpaths and dual Router Node target wired.
- Declaration auditor now drives public-any (all manifest declaration conditions,
  references and inferred any), fails missing builds, separates deprecation from
  release level, checks explicit per-entry levels. Docs/export inventory no
  longer defaults missing tags to public. Overload implementation signatures are
  not callable API signatures. New audit/source/consumer fixtures authored.

Migration and pending contract decisions: `docs/API-MIGRATION-CANDIDATE-2026-10-17.md`.
Remaining code work includes Runtime/Core/CRUD/Resource refactor, complete public
API classification and consumers, remaining positional sites and declaration graph
cleanup. Root internal compatibility decisions are not silently approved. Reports,
snapshots, artifacts, counts and acceptance remain ungenerated/unverified.
**No tests/typecheck/build/lint/generation/CI/commit/push/publication/issue mutation;
0 accepted/closed, and the whole 28-card scope is not ready-for-final-validation.**

Additional wiring authored in the same continuation: Form's validation registry,
engine, values and HTML helpers are now separated (not just its main factory);
source-resolved type-test paths include the new Router Node / SW strategy entries;
final unit CI now builds required declarations before declaration-based fixtures.
Built ESM/CJS Router interoperability and canonical/legacy option fixtures are
written, **not executed**. No new readiness or acceptance assertion follows.

### Shared API continuation — CRUD / Resource / expression boundaries (authored only)

- CRUD facade now delegates to one engine owner with private config/computed/
  action/HTML/DOM leaves; Resource now has types/key/request/transport/mutation/
  lifecycle/registry leaves. Live typed capabilities retain original owner and
  signal/registration identity; no fabricated class context or writable computed
  contract. Boundary fixtures were written for both packages.
- Low-level expression results/type guards and async component context payloads
  now expose unknown. Native expression coercion is isolated behind three
  documented internal-any operands. Runtime/type fixtures were authored.
- Packed consumer harness now checks declared CJS entries on old Node rather
  than skipping all CJS. Selection fixtures authored, not run.
- Source files were read/count-inspected only; no tests/typecheck/build/lint/
  audit/report generation/CI/commit/push/publication/issue mutation. Local
  TypeScript is absent; the attempted AST-assisted source move stopped before
  writes and source moves were authored directly instead. No install was run.
- Runtime/Core, complete public export levels and positional migration, whole
  declaration graph and final measurements remain unfinished. **0 accepted /
  0 closed; the shared debt is still in implementation, not just awaiting tests.**


### Sustained Runtime/Core/shared-API authoring continuation (unvalidated)

Runtime lifecycle/walker/hydration/directive decomposition and their Core owners
are authored with identity/lifecycle/context/DOM/App-scope fixtures. Loop and
virtual-list owners are now 299/350 source lines; these are not size measurements.
Canonical custom registration/parity schemas and legacy 086–088 bridges are
written; Stateful uses canonical registration. Registry token ownership now
survives same-callback replacement, and names inventory is detached. Core's
registry factory constructs its original typed owner table without a double cast.

State Computed now implements actual read-only peek/subscription capabilities;
ReadonlySignal excludes both set/update. Form computed field/array views no
longer pretend to be writable Signals. Devtools unknown payload/read-only
inspection boundaries and explicit receiver-preserving time-travel writes are
integrated with runtime/type fixtures. These contract/correctness changes are
separate from compatible extraction candidates in the migration ledger and major
changeset; they are not release authorization or validation evidence.

All new fixtures remain unrun. No tests/typecheck/build/lint/audit/report
generation/CI/commit/push/publication/issue mutation occurred. Full published API
classification/public-any cleanup, positional method inventory/callers, remaining
28-card implementation and external approval/manual-QA blockers stay open. **The
shared API debt and the 28-card scope are not yet accepted or test-only-ready;
0 cards accepted/closed.** No acceptance checkbox was changed.

### Larger shared-API implementation continuation — authored, no gates

Source positional inventory and the ESLint rule now include qualified class,
interface, object and callback members; exact signature/file leases cannot exempt
unrelated methods. A separate built-declaration callable graph covers real exports,
namespace/return/generic-container paths and tuples. Loading/metadata are shared
with API/public-any tooling. Overload deprecation no longer retires the canonical
API, internal visibility conflicts survive facades, and explicit exports outrank
stars. New final-CI wiring is authored only, not triggered.

DataTable and Suspense are decomposed into real owner/helper leaves (DataTable
engine 361; Suspense context/controller/directive 168/205/197 source lines).
Canonical column-filter options/bridge 089, unknown table cell/key/editor types,
Store typed assembly/disposal-only heterogeneous storage, unknown legacy list/
Suspense contexts, and validated canonical Suspense context/tracking/timer options
are integrated. Internal Suspense callers no longer use deprecated creation.
Runtime/type/tooling/ESLint regression fixtures are written, not executed.

Contract changes are distinct from the module moves in the migration ledger and
candidate major changeset. New package dependency/lockfile edges are authored;
size, CJS floor, declaration and behavior evidence remain absent. Historical
coarse positional exemptions and remaining source/published member findings must
still be reviewed/migrated; no blanket method waiver or clean inventory is claimed.

**No tests/typecheck/build/lint/audit/report generation/CI/commit/push/publication/
issue mutation. Same 28 cards, 0 accepted/closed. Still implementation, not a
claim that all shared debt or all 28 cards are only waiting for tests.**

### 2026-10-18 — sustained Compiler/Testing/Security authoring (unvalidated)

- Compiler, Testing and Security oversized owners are decomposed into actual
  assembly/walk/emitter, reactivity/DOM/reset/timer/mock and policy/HTML/CSP/
  Trusted Types leaves. Existing facade identities, compiler classification
  sets, Testing reset Set and Trusted Types cache have one owner each.
- Compiler parity state is unknown. Native/Node parser return types and lazy
  constructor/import caches are typed honestly; jsdom 24 is an optional Node
  peer instead of an undeclared dev-only runtime edge.
- Canonical parity/render/directive/HTML-sink option bags plus deprecated bridges
  090–094 are authored and catalogued. Canonical state capability checks retain
  original state/signals and do not decode application fields. Callback schema
  checks callability only; callback result signatures remain caller-declared.
- Global Zen and timer installation no longer use broad any boundaries. Fake
  timeouts remain numeric, not fabricated Node Timeout objects. Failed
  clearTimeout installation rolls back the first patch (separate behavior fix).
- Trusted Types outputs are unknown native capabilities and are passed directly
  to the sink. This source-contract change and options migrations are distinct
  from module moves in the migration ledger/proposed major changeset.
- Runtime/type/real-facade metadata fixtures and canonical primary consumers,
  READMEs and CSP guidance are authored. Non-DOM fallback limitations are not
  disguised as DOM-equivalent security or actual browser enforcement evidence.

**No tests/typecheck/build/lint/audit/report generation/CI/commit/push/publication/
issue mutation. All new fixtures remain unrun. Same 28 cards, 0 accepted/closed;
no claim that all shared API debt or all 28 cards are only waiting for tests.**

### 2026-10-18 — State/Form/native-write integration (unvalidated)

Written: explicit zero-argument State subscriber types; unknown setter-only
capability detection without a fabricated getter/arbitrary write domain;
receiver-preserving native model/ref/persist/hydration writes and unknown hidden
model-map invocation. State registry record extraction preserves the owner;
Form private evaluators/dynamic-state/touched helpers preserve intended ordering.
Canonical schema bags and retained deprecated bridges 095–100 cover field/form/
lifecycle validation and FormStore movement/addition. Internal production calls
are canonical. Known Form setters now correlate string keys with field value
types; dynamic record forms remain dynamic, not decoded.

Runtime/type/real-facade metadata fixtures and migration/readme/convention notes
are authored. Source-contract changes, native error wording, AsyncFunction
reflection and stricter canonical validation are distinguished from module moves.
No root internal hook was removed or relabeled public to make a gate pass.
Computed initialization/tracking/lifetime, complete callback/member inventory,
remaining export classification and broader Form generic/ownership work still
require review before phase exit. No code/test completeness of all 28 is claimed.

**No tests/typecheck/build/lint/audit/report generation/CI/commit/push/publication/
issue mutation. Same 28 cards, 0 accepted/closed; all fixtures remain unrun.**


### 2026-10-18 — State/Form ownership and async lifetime authoring (unvalidated)

Implemented source candidates: nested State tracking/owner restoration; dead/null
owner distinction; untracked best-effort teardown; prior-run child disposal;
single-evaluation lazy Computed with typed empty/ready state, original initial
errors/retry/circular detection, observer isolation and terminal snapshots; watch
parent/once cleanup; owned async cancellation/deferred refresh/AbortError handling.
Advanced/Wizard forms now have explicit disposal and captured ownership for later
field/nested/array views; autosave timers and validation/submission/navigation use
stale-result guards. FormStore uses a real private validation coordinator with
independent field generations, aggregate busy state, abort/reset/disposal guards,
newer-field merge precedence and observer-safe teardown. Array correctness fixes
are recorded separately from owner decomposition.

Runtime/type/source-facade fixtures and migration/convention/readme/major-candidate
notes are authored. Root WritableCapability export and the metadata fixture's Map
helper shape were confirmed by reading source, not by a gate. Earlier pending
lifecycle notes are superseded by this authored candidate, **not** by acceptance.
Remaining callback/member/export inventory, State internal-entry/nominal singleton
packaging, broader Form generic/factory design, other implementation and external
owner/manual QA work remain open. No all-28/test-only readiness is claimed.

**No tests/typecheck/build/lint/audit/report generation/CI/commit/push/publication/
issue mutation. Same 28 cards, 0 accepted/closed; fixtures remain unrun and no
acceptance/readiness checkbox was changed.**


### 2026-10-18 — Factory/value/callback inventory authoring continuation

Written: real Form factory/reactive owners; honest missing-initial generic/union
returns; actual empty-step Wizard; small reactive disposal; schema adapters using
unambiguous Store construction; public factory/state types and overload metadata.
Advanced dirty comparison no longer requires JSON serialization, supports cyclic/
opaque data with conservative bounded semantics, verifies array capability,
handles undefined swaps/restored dirty state and manual-error precedence, and
checks observer-driven replacement before finishing mutation bookkeeping.

State Watch's erased callback no longer uses any; EffectFn reflects void-return
invocation. Source/ESLint/published callable inspectors now expand rest tuples and
union branches (aliases through the checker), bound Cartesian expansion and keep
exact data-operand callback leases separate from configuration. Six State/Form
protocols were explicitly reviewed with signature-bound leases, not package-wide
suppression. Runtime/type/source-export/AST/rule/declaration/lease-drift fixtures
and migration/readme/convention/proposed-major notes are written, **not run**.

Broader Form interface/generic design, full method/callback/export graph review,
State internal-entry/nominal singleton packaging, remaining same-28 implementation
and external/manual QA stay open. No test-only/all-28 readiness is asserted.
**No tests/typecheck/build/lint/audit/report generation/CI/commit/push/publication/
issue mutation. Same 28 cards, 0 accepted/closed; no readiness checkbox changed.**


Further source correction in the same pass: deep watch now observes a private
bounded cyclic/non-JSON graph while callbacks receive the actual typed source
values, not unwrapped/plain clones pretending to be T. Structural get-only roots,
nested tracking, raw previous identity, class methods and disposal during getter/
previous cleanup have authored runtime/type/private-export fixtures. This is an
explicit callback payload/previous-value contract change, not a compatible move;
no test, gate, CI/push or acceptance ran.

### ادامهٔ پیوستهٔ ۲۰۲۶-۱۰-۱۸ — اتصال State/Router/SSR و مسیر داخلی

کد و fixtureهای ورودی داخلی State (self-package facade، نه bundle مستقل از
implementation نسبی)، metadata/condition/source mapping و مهاجرت مصرف‌کنندهٔ SSR
نوشته شدند. API عمومی State و bridgeهای قدیمی root حذف نشده‌اند؛ جداسازی کامل
سطوح export هنوز نیازمند تصمیم migration است.

رفع مالکیت موازی currentOwner/EffectContext.owner همراه با context زمان ثبت برای
افکت صف‌شده، dispose دیرهنگام، computed تنبل، async refresh/abort و cleanup watch
نوشته شد. binder واقعی generic آرگومان/خروجی/استثنا را حفظ می‌کند؛ State وابستگی
Node/DOM نگرفت. SSR بومی snapshot هر ثبت را جدا می‌گیرد، DOM ALS و App claimهای
ESM/CJS را مشترک می‌کند و برای همهٔ renderها route مستقل و root مالک درخواست
(شامل prepass و factory پس از await) دارد. Abort در context درخواست dispatch
می‌شود؛ root پیش از آزادسازی App/registry/state/DOM بسته می‌شود و tombstone از
کار default-owned دیررس جلوگیری می‌کند. detach صریح و side effect وعدهٔ کاربر
لغو/بازگردانده نمی‌شوند.

fixtureهای source/type/metadata، ۱۰۰ مالک هم‌زمان، ۱۰۰ scope بومیِ زنده با dispatch
از context دیگر، ۱۰۰ render واقعی، lazy/refresh/abort/watch، failure/cancel/stream
و consumerهای buildشدهٔ State و SSR نوشته، **اجرا نشده‌اند**. اسناد migration و
README/changeset محدودیت‌ها را ثبت می‌کنند. این کار refactor هم‌قرارداد #40 یا
اثبات برابری constructor/observer/registry/priority بین root formatها نیست؛
SSR export levels، Edge و شکاف‌های دیگرِ همان ۲۸ کارت و موانع مالک/QA بازند.

هیچ گیت/گزارش تولیدی/CI/commit/push/انتشار/تغییر issue انجام نشد؛ ۰ پذیرفته/بسته.

## 2026-10-18 — continued State/Devtools/SSR authoring (not validation)

- [ ] Validate shared State observer/error/priority/legacy channels in both actual
  built load orders; fixtures include real scheduler work, identity/ABA and reset.
- [ ] Validate context registry lifetime/origin dispatch, explicit diagnostic flag,
  native callback capture/nontracking, recursion/reset and timeline bounds.
- [ ] Validate readonly State naming and generic-readable Core types; Core getter/
  listener/hook/reset and install-publication token fixtures are authored.
- [ ] Validate 100 actual SSR private registry/default priority renders, origin
  writes, stream retirement and prevention of outside Core capture/config mutation
  before route/prepass/factory document installation.
- [ ] Compile the new real packaged .mts/.cts root/internal consumers, no workspace
  paths/source fallback; this does not certify mixed-format constructor identity.
- [ ] Resolve root-public-only separation, mixed constructor/declaration identity,
  modern Core duplicate-module hazard and approved new State peer floors.

Latest source and fixture additions are **unrun/uncompiled**, not completed gates.
Readonly naming/readable Core, host-global observation policy, lease/reset/lifetime
and default-priority changes are proposed contracts, not #40 compatible refactors.
Full same28 acceptance/external approvals remain; **0 accepted / 0 closed**.
No interim tests/typecheck/build/lint/audit/report generation/CI/commit/push,
publication or issue mutation. Source/docs review is not final validation.

Further authoring in the same pass: Core hook/listener/panel/time-travel SSR policy,
panel replacement/reset identity tokens and payload release, concrete Snapshot
shape decoding (legacy omitted timeline metadata normalized), raw Signal reinspection,
failed-install config preservation, operation-token/epoch-safe overlapping replay,
native setter getter invalidation and actual native-bound retired-view assertions.
Fixtures written; **no execution**, no new acceptance/closure. Snapshot decoding
is not a decoder for arbitrary Signal value domains. Internal process reset stays
global; old peer floors/constructors/root-only export migration remain open.

## 2026-10-18 — graph/browser consumer/compatibility panel authoring

- [ ] Validate realm-graph SSR/disable policy versus explicit caller-owned local
  graphs; metadata copying, kind replacement, bounded nodes, collision-free edge
  keys, getter reset and real native hook receiver/reentry/fallback fixtures.
- [ ] Validate browser install ownership, stale-hook revocation, exact Document/
  Window cleanup, pagehide, native HMR, external replacement and setup rollback.
- [ ] Validate compatibility panel nontracking, nullable subscription tokens, reset/
  ABA/reentry, disposed-effect markers, record bounds and unknown payload arity.
- [ ] Validate canonical diagnostic options + deprecated 101–105 bridges, graph
  protocol-2 negotiation with foreign legacy hooks, explicit release tags and
  removal of the panel's obsolete broad positional waiver.
- [ ] Validate walker unknown-global discovery containment, native receiver,
  nontracking, per-element reentry and shared weak IDs across duplicate modules.
- [ ] Validate 100 actual SSR prepass/factory graph/panel privacy cases; prepass
  execution/output is asserted outside swallowed component error handlers.
- [ ] Validate new direct Errors dependency/lock metadata, State peer floors,
  constructor/Core duplicate-module identity, root-only export and size/type/
  built-consumer gates. No passing result inferred from source inspection.

All source/type/runtime fixtures are **unrun/uncompiled**. No tests/typecheck/build/
lint/audit/generated reports/CI/commit/push/publication or issue mutation. This is
still same28, **0 accepted / 0 closed**. Retention/ownership/protocol/type changes
are proposed contract migrations, not #40 API-identical refactor proof. External
owner/store/accessibility approvals, Edge parity and remaining card work stay open.

Additional unrun final-phase fixture: built Devtools **ESM** facade/Core constructor
and graph identity plus real packaged tsc options/readonly consumer, without source
paths/missing-dist skips. Legacy CJS loading ESM-only dependencies and mixed State
identity are not certified by this fixture. No validation or acceptance changed.

## ادامهٔ متصل ۲۰۲۶-۱۰-۱۸ — adapter-node: Express/Fastify (#156، code-first)

تمام موارد این بخش **نوشته‌شده، اما اجرا و تأیید نشده‌اند**. هیچ تست، lint،
typecheck، build، audit، CI، commit، push یا بستن issue انجام نشد.

- `packages/adapter-node/src/express.ts` (جدید): `toExpressMiddleware` و
  `createExpressMiddleware` روی handler canonical؛ آبجکت‌های Express فقط به‌صورت
  ساختاری به `IncomingMessage`/`ServerResponse` نگاشت می‌شوند — هیچ import یا
  وابستگی به Express اضافه نشد. miss مسیر به `next()` می‌رسد؛ rejection غیرمنتظره
  به `next(error)` می‌رسد.
- `packages/adapter-node/src/fastify.ts` (جدید): `toFastifyHandler` و
  `createFastifyHandler` روی shellهای حداقلی `{ raw }`؛ `reply.hijack()` در
  صورت وجود صدا زده می‌شود، miss مسیر به `reply.callNotFound()` ترجمه می‌شود
  (بدون آن، reply دست‌نخورده برای 404 خود Fastify می‌ماند)، خطای غیرمنتظره فقط
  پیش از commit هدرها به `reply.send(error)` می‌رسد.
- `src/index.ts`: re-export هر چهار تابع و تایپ‌های `ExpressMiddleware`،
  `FastifyHandler`، `FastifyRawRequest`، `FastifyRawReply`.
- `test/frameworks.test.ts` (جدید، اجرا نشده): رندر loopback از هر دو آداپتر،
  miss مسیر در هر دو، و rejection غیرمنتظره در Express — با fake shellها، بدون
  نصب پکیج express/fastify.
- `README.md`: بخش «Framework middleware» با مثال هر دو فریم‌ورک و معنای
  miss/error. changeset پیشنهادی `f-changeset/adapter-node-frameworks.md`
  (minor، صرفاً افزودنی) ثبت شد — مجوز انتشار نیست.
- باقی‌ماندهٔ #156 طبق پلن: اجرای واقعی روی consumerهای Express/Fastify، بودجهٔ
  اندازه‌گیری‌شدهٔ slow-client (قبل/بعد)، و گیت‌های G/P. این بسته همچنان کارت
  کامل معرفی نمی‌شود؛ وضعیت آن در ماتریس «باز» می‌ماند.

## ادامهٔ متصل ۲۰۲۶-۱۰-۱۸ — #40: شکستن actions/registry.ts (code-first)

تمام موارد این بخش **نوشته‌شده، اما اجرا و تأیید نشده‌اند**. هیچ تست، lint،
typecheck، build، CI، commit، push یا بستن issue انجام نشد.

- `packages/actions/src/registry.ts` (۵۲۱ خط) به سه ماژول زیر۴۰۰خط شکسته شد —
  جابه‌جایی محض، بدون تغییر رفتار یا امضا:
  - `src/types.ts` (جدید): `ActionContext`، `ActionFn`، `ActionMiddleware`،
    `ActionMetadata` با همان TSDoc؛ بدون import ران‌تایم.
  - `src/registry.ts`: فقط کلاس `ActionRegistry` (تایپ‌ها از `./types`).
  - `src/default-registry.ts` (جدید): سینگلتون پیش‌فرض، provider/request-scope،
    همهٔ توابع ماژول‌سطح و facade `action` (شامل `clearActionsInternal` و ثبت
    `onGlobalReset`، مثل قبل).
- `src/index.ts`: فقط مسیر re-exportها عوض شد؛ سطح عمومی (۱۱ مقدار + ۴ تایپ)
  عیناً حفظ شده. تست‌ها از barrel وارد می‌کنند، بی‌نیاز از تغییر. هیچ import
  عمیق خارجی به `actions/src/registry` وجود نداشت.
- معیار «refactor محض بدون تغییر امضا» در فاز validation باید با API report
  قبل/بعد، سوئیت حوزه و size-limit اثبات شود؛ این تغییر آن اثبات نیست.

- `packages/auth-oauth/src/client.ts` (۴۰۱ خط) به دو ماژول شکسته شد:
  `src/types.ts` (جدید: همهٔ تایپ‌ها + `DEFAULTS` منجمد، بدون import ران‌تایم)
  و `src/client.ts` (فقط `discover`، `createOAuthClient`، `oauthAuthAdapter`).
  barrel همان ۱۰ نام را می‌دهد (مقادیر از `./client`، تایپ‌ها/`DEFAULTS` از
  `./types`)؛ `directives.ts` حالا تایپ را از `./types` می‌گیرد. تست‌ها از
  barrel استفاده می‌کنند. تنها تفاوت عمدی و بی‌اثر رفتاری: cast `as any` روی
  `Symbol.dispose` به `as unknown as Record<symbol, …>` تبدیل شد.
- وضعیت #40: از ۳۴ فایل بالای ۴۰۰ خط، ۲ فایل شکسته شد (actions، auth-oauth)؛
  ۳۲ فایل باقی است. اثبات API-identical و size با report/سوئیت در فاز validation.

- `packages/charts/src/charts.ts` (۴۳۲ خط) به چهار ماژول شکسته شد:
  `src/types.ts` (جدید: تایپ‌ها + `DEFAULTS` + `chartOptionsSchema` + `PALETTE`)،
  `src/normalize.ts` (جدید: `escapeXml`، `toNum`، مدل `Normalized`، `sx`/`sy`،
  `buildNormalized`)، `src/svg.ts` (جدید: شش سازندهٔ fragment)، و `src/charts.ts`
  (فقط `renderChartSvg` + `createChart` + re-export `prefersReducedMotion`).
  barrel همان ۱۰ نام را می‌دهد؛ `directives.ts` مقدار را از `./charts` و تایپ‌ها
  را از `./types` می‌گیرد. تست‌ها از barrel استفاده می‌کنند.
- وضعیت #40: ۳ از ۳۴ فایل شکسته شد (actions، auth-oauth، charts)؛ ۳۱ باقی است.
  `cache.ts` بررسی شد: factory تک‌closure منسجم است و split کور آن به آبجکت
  context مصنوعی نیاز دارد — تصمیم split/exception مکتوب آن با بازبین، در ادامه.

- تصمیم `packages/cache/src/cache.ts` (۴۵۹ خط): **exception مستدل، بدون split.**
  دلیل: کل فایل یک factory closure واحد است که ۱۲+ تابع داخلی روی ۹ حالت
  مشترک (entries/tagIndex/pending/bumps/bytes/counters/evictCbs/disposed)
  کار می‌کنند و منطق ضد-نشت/نسل (bumps + commit معلق در microtask) به ترتیب
  اجرای دقیق همین closure گره خورده است. استخراج مکانیکی بخش‌ها به یک state
  struct مصنوعی، امضای داخلی را عوض می‌کند و بدون امکان اجرای سوئیت حوزه
  (فاز code-first) ریسک تغییر رفتاری پنهان دارد. کل بسته روی مرز ۴۰۰ خط است
  (۵۹ خط اضافه) و cohesion آن عمدیِ طراحی #144 است. بازبین در فاز validation
  یا exception را می‌پذیرد یا split تأییدشده با اجرای تست را می‌خواهد.
- وضعیت #40: ۳ شکسته + ۱ exception از ۳۴؛ ۳۰ فایل باقی است.

- `packages/cli/src/check.ts` (۶۷۲ خط) به پنج ماژول زیر۴۰۰خط شکسته شد —
  جابه‌جایی محض، بدون تغییر رفتار یا امضا:
  - `src/check-findings.ts` (جدید، ~۱۱۰ خط): `Severity`، `Finding`،
    `VALID_DIRECTIVES`، `DEPRECATED_DIRECTIVES`.
  - `src/check-scan.ts` (جدید، ~۷۰ خط): `findHtmlFiles`، `getLineColumn`،
    `extractExpression`.
  - `src/check-analyze.ts` (جدید، ~۳۶۵ خط): فقط `checkHtmlFile` (شامل
    `RUNTIME_ONLY_DIRECTIVES` محلی، مثل قبل).
  - `src/check-report.ts` (جدید، ~۴۵ خط): `COLORS` محلی + `colorize`،
    `printFinding`.
  - `src/check.ts` (~۱۲۵ خط): فقط `runCheck` با همان امضا؛ تنها مصرف‌کننده
    (`commands/legacy.ts`) بی‌نیاز از تغییر. هیچ تستی به درونی‌های check
    وابسته نبود.
- برابری بایت‌به‌بایت هر پنج بخش با اصل (منهای جابه‌جایی importها و کلیدواژهٔ
  `export`) با مقایسهٔ متنی تأیید شد؛ همچنان اجرا نشده و اثبات API-identical
  در فاز validation لازم است.
- وضعیت #40: ۴ شکسته + ۱ exception از ۳۴؛ ۲۹ فایل باقی است.

- `packages/components/src/async-loader.ts` (۴۳۶ خط) به سه ماژول زیر۴۰۰خط
  شکسته شد — جابه‌جایی محض، بدون تغییر رفتار یا امضا:
  - `src/async-cache.ts` (جدید، ~۱۱۵ خط): `CacheEntry`،
    `ComponentCacheConfig`، state کش‌ها (`cacheConfig`/`templateCache` به‌صورت
    live binding برای `configureComponentCache`)، `ERROR_CACHE_TTL_MS`،
    `configureComponentCache`، `clearComponentCache`.
  - `src/async-loader.ts` (~۲۳۰ خط): `LoadComponentOptions`، `escapeHTML`،
    `loadComponent` — مسیر dynamic import تنبل در `index.ts` (chunk جداگانه)
    دست‌نخورده ماند.
  - `src/async-component.ts` (جدید، ~۱۲۰ خط): `AsyncProcessChildren`،
    `processAsyncComponent`.
- barrel همان ۸ نام را می‌دهد (فقط مسیر مبدأها عوض شد)؛ تست‌ها از barrel
  استفاده می‌کنند. برابری بایت‌به‌بایت هر سه بخش با اصل تأیید شد (منهای
  جابه‌جایی importها و `export` روی state مشترک)؛ همچنان اجرا نشده.
- وضعیت #40: ۵ شکسته + ۱ exception از ۳۴؛ ۲۸ فایل باقی است.

- `packages/components/src/processor.ts` (۴۷۴ خط) به چهار ماژول زیر۴۰۰خط
  شکسته شد — جابه‌جایی محض، بدون تغییر رفتار یا امضا:
  - `src/processor-lifecycle.ts` (جدید، ~۵۵ خط): `ComponentLifecycle`،
    `registerLifecycle`، `getLifecycle` + state `lifecycleHooks` (export برای
    مصرف `processComponent`).
  - `src/processor-props.ts` (جدید، ~۱۲۰ خط): `PROP_PREFIX`،
    `normalizePropName`، `buildComponentContext`.
  - `src/processor-slots.ts` (جدید، ~۸۰ خط): `fillSlots`،
    `buildSlotContents`.
  - `src/processor.ts` (~۲۴۵ خط): `_processingStack` + `processComponent`، با
    re-export سازگاری (`registerLifecycle`/`getLifecycle`/
    `ComponentLifecycle`) تا deep-import تست `cleanup-protocol.test.ts`
    (`../src/processor`) بی‌نیاز از تغییر بماند؛ barrel دست‌نخورده.
- برابری بایت‌به‌بایت هر چهار بخش با اصل تأیید شد (تنها افزودنی عمدی: بلوک
  re-export سازگاری)؛ همچنان اجرا نشده.
- وضعیت #40: ۶ شکسته + ۱ exception از ۳۴؛ ۲۷ فایل باقی است.

- `packages/data/src/fetcher.ts` (۴۸۴ خط) به سه ماژول زیر۴۰۰خط شکسته شد —
  جابه‌جایی محض، بدون تغییر رفتار یا امضا:
  - `src/fetch-helpers.ts` (جدید، ~۸۰ خط): `FetchState`، `initialFetchState`،
    `isValidUrl`، `buildFetchContext`.
  - `src/fetch-perform.ts` (جدید، ~۱۴۰ خط): `PerformFetchOptions`،
    `performFetch` (با retry-429 بازگشتی، مثل قبل).
  - `src/fetcher.ts` (~۲۹۰ خط): بلوک re-export کش (`fetch-cache`)،
    `processFetch`، `invalidate` — barrel و deep-import تست
    (`../src/fetcher`) بی‌نیاز از تغییر.
- برابری بایت‌به‌بایت هر سه بخش با اصل تأیید شد (منهای جابه‌جایی importها و
  `export`)؛ همچنان اجرا نشده.
- وضعیت #40: ۷ شکسته + ۱ exception از ۳۴؛ ۲۶ فایل باقی است.

- `packages/devtools-core/src/index.ts` (۷۲۱ خط) به هفت ماژول زیر۴۰۰خط
  شکسته شد:
  - `src/core-options.ts` (~۴۵ خط): `DEVTOOLS_HOOK_VERSION`،
    `DevtoolsCoreOptions`، `devtoolsCoreOptions`، DEFAULTS/schema/resolve.
  - `src/core-types.ts` (~۸۰ خط): هفت اینترفیس عمومی (verbatim).
  - `src/core-state.ts` (~۱۴۰ خط): state مشترک (verbatim) + پنج mutation
    helper جدید (`allocSignalSeq`، `allocChangeSeq`،
    `bumpRegistryGeneration`، `resetSignalIds`، `setCurrentConfig`).
  - `src/core-registry.ts` (~۲۸۵ خط): hook، assert، register/name/record،
    getterها، clear (شامل فراخوانی سطح‌ماژول `onGlobalReset`، مثل قبل).
  - `src/core-timetravel.ts` (~۱۳۵ خط): snapshot/restore/replay (verbatim).
  - `src/core-panels.ts` (~۶۰ خط): رجیستری پنل‌ها (verbatim).
  - `src/core-install.ts` (~۱۱۵ خط): نصب + aliasهای deprecated (verbatim).
  - `src/index.ts` (~۸۰ خط): فقط barrel + re-export گراف؛ هر ۳۸ نام عمومی
    حفظ شده. تست‌ها از barrel استفاده می‌کنند.
- تنها تفاوت‌های عمدی و هم‌ارز رفتاری (۶ نقطه): چون rebinding روی live
  binding وارداتی ESM ممنوع است، پنج بازنویسی `let`/شمارنده (`nextSignalSeq++`،
  `nextChangeSeq++`، `registryGeneration++`، `signalToId = …`،
  `currentConfig = …` در ۲ نقطه) به helperهای هم‌نام state تبدیل شدند؛
  بقیهٔ متن بایت‌به‌بایت عین اصل تأیید شد. همچنان اجرا نشده و اثبات
  هم‌ارزی در فاز validation لازم است.
- وضعیت #40: ۸ شکسته + ۱ exception از ۳۴؛ ۲۵ فایل باقی است.

- `packages/errors/src/core.ts` (۲۲۱۲ خط) به یازده ماژول زیر۴۰۰خط شکسته شد:
  - `src/error-class.ts` (~۱۲۰ خط): `ZenithError` (verbatim).
  - `src/error-kinds.ts` (~۱۶۵ خط): severity/category، `ErrorCode`، pattern،
    `errorDocsUrl`، بازه‌ها (verbatim).
  - `src/reserved-codes-a.ts` (~۲۷۰ خط) و `src/reserved-codes-b.ts`
    (~۲۵۵ خط): دو نیمهٔ verbatim کاتالوگ (مرز تمیز پس از `ZEN-1901`؛ ۴۲+۳۹
    کلید، بدون هم‌پوشانی، ترتیب حفظ شده).
  - `src/reserved-codes.ts` (~۲۵ خط): اینترفیس + ادغام با spread (ترتیب
    کلیدها عین literal اصل)؛ نیمه‌ها (`_A`/`_B`) از barrel پنهان‌اند تا سطح
    عمومی عین قبل بماند.
  - `src/error-messages-en.ts` (~۳۵۰ خط): نقشهٔ انگلیسی (verbatim).
  - `src/error-locale.ts` (~۱۳۵ خط): locale، نقشهٔ legacy، `getErrorMessage`،
    `createReservedError` (verbatim).
  - `src/deprecation-codes.ts` (~۳۸۵ خط): رجیستری deprecation (verbatim).
  - `src/error-deprecate.ts` (~۴۵ خط): `deprecate` + `resetDeprecationWarnings`
    (verbatim؛ `warnedDeprecations` همان‌جا ماند).
  - `src/error-factories-a.ts` (~۲۲۵ خط) و `src/error-factories-b.ts`
    (~۳۰۰ خط): factoryها و ابزارها (verbatim؛ `findClosestMatch` از b در
    a استفاده می‌شود، `levenshtein` خصوصی در b ماند).
  - `src/core.ts` (~۴۵ خط): فقط barrel (`export *` + export صریح ادغام‌شده)؛
    هر ۳۷ نام عمومی حفظ شده. `hub.ts` (`from './core'`) و تست‌ها (barrel)
    بی‌نیاز از تغییر.
- تنها تفاوت ساختاری عمدی: دوپارگی کاتالوگ با ادغام spread (هم‌ارز رفتاری:
  ترتیب کلیدها و win تکراری‌ها مثل literal واحد است). همچنان اجرا نشده.
- وضعیت #40: ۹ شکسته + ۱ exception از ۳۴؛ ۲۴ فایل باقی است.

- `packages/events/src/delegation.ts` (۷۴۳ خط) به چهار ماژول زیر۴۰۰خط
  شکسته شد — جابه‌جایی محض، بدون تغییر رفتار یا امضا:
  - `src/action-parse.ts` (~۱۶۰ خط): `ParsedActionCall`، `parseActionCall`،
    `createContextForEval` (`splitActionArgs` خصوصی ماند).
  - `src/binding-cache.ts` (~۲۱۰ خط): `BindingMatch`، `ZEN_ACTION_PREFIX`،
    `computeBindingSignature`، `DelegationPhase`، `_bindingCache` +
    `clearBindingCache` (همان ماژول — rebinding لازم نشد)، `findBinding`،
    `findClosestActionElement`.
  - `src/delegate-event.ts` (~۲۴۵ خط): trio لینک (`LinkNavigationHandler`/
    setter/getter — همان ماژول ماند تا چرخهٔ import ساخته نشود)،
    `TimedHandlerCache`، `delegateEvent`.
  - `src/delegation.ts` (~۱۶۰ خط): `DelegationRoot`/`Options`،
    `initEventDelegation` + re-export سازگاری trio لینک؛ barrel دست‌نخورده.
- برابری بایت‌به‌بایت هر چهار بخش با اصل تأیید شد (منهای جابه‌جایی importها
  و `export`)؛ همچنان اجرا نشده.
- نکته برای فاز validation: تست `reverse-deps.test.ts` متن `delegation.ts`
  را از نظر عدم‌وابستگی به router می‌خواند — همچنان سبز است (هیچ‌یک از چهار
  ماژول import از router ندارند)، ولی پوشش آن حالا فقط slice ورودی است؛
  پیشنهاد: خواندن هر چهار فایل در همان تست.
- وضعیت #40: ۱۰ شکسته + ۱ exception از ۳۴؛ ۲۳ فایل باقی است.

- `packages/events/src/modifiers.ts` (۴۳۱ خط) به سه ماژول زیر۴۰۰خط شکسته
  شد — جابه‌جایی محض، بدون تغییر رفتار یا امضا:
  - `src/modifier-parse.ts` (~۹۰ خط): `ParsedEventBinding`، `parseBinding`،
    `checkKeyboardModifiers` (خالص، بدون import).
  - `src/modifier-registry.ts` (~۱۷۰ خط): `EventModifierHandler`،
    `_customModifiers` (export برای خواندن cross-module؛ جهش‌ها با متد،
    همان ماژول)، `BUILTIN_MODIFIERS`، register/unregister/clear/clearInternal/
    has/get + فراخوانی سطح‌ماژول `onGlobalReset` (مثل قبل).
  - `src/modifiers.ts` (~۱۹۰ خط): `extractListenerOptions`، warn-state،
    `applyBehaviorModifiers`، سه مجموعهٔ رویداد + `DelegatedEventName`؛
    barrel دست‌نخورده.
- برابری بایت‌به‌بایت هر سه بخش با اصل تأیید شد (منهای جابه‌جایی importها و
  `export`)؛ همچنان اجرا نشده.
- وضعیت #40: ۱۱ شکسته + ۱ exception از ۳۴؛ ۲۲ فایل باقی است.

- `packages/expressions/src/lexer.ts` (۴۳۲ خط) به دو ماژول زیر۴۰۰خط شکسته
  شد — جابه‌جایی محض، بدون تغییر رفتار یا امضا:
  - `src/token.ts` (جدید، ~۸۰ خط): `TokenType`، `Token`، `PUNCTUATORS`،
    `SORTED_PUNCTUATORS`.
  - `src/lexer.ts` (~۳۶۵ خط): فقط `lex` + re-export سازگاری
    (`TokenType`/`Token`) تا `parser.ts` (`from './lexer'`) و barrel
    بی‌نیاز از تغییر بمانند.
- برابری بایت‌به‌بایت هر دو بخش با اصل تأیید شد (منهای جابه‌جایی importها و
  `export`)؛ همچنان اجرا نشده.
- وضعیت #40: ۱۲ شکسته + ۱ exception از ۳۴؛ ۲۱ فایل باقی است.

- تصمیم `packages/expressions/src/parser.ts` (۶۴۴ خط): **exception مستدل،
  بدون split.** دلیل: کل فایل عملاً یک کلاس منسجم `Parser` است (recursive
  descent با state خصوصی مشترک `tokens/pos/source/depth` در ~۳۰ متد)؛
  استخراج مکانیکی گروه متدها به context-object مصنوعی یا تغییر `private` به
  `protected` (تغییر declaration عمومی) نیاز دارد و بدون امکان اجرای سوئیت
  گرامر در فاز code-first ریسک رگرسیون دارد. استخراج صرف تایپ `ASTNode`
  (~۷۰ خط) فایل را باز هم بالای ۴۰۰ نگه می‌دارد و سودی ندارد. بازبین در فاز
  validation یا exception را می‌پذیرد یا split تأییدشده با اجرای تست می‌خواهد.
- وضعیت #40: ۱۲ شکسته + ۲ exception از ۳۴؛ ۲۰ فایل باقی است.

- `packages/http/src/http.ts` (۸۵۵ خط) به شش ماژول زیر۴۰۰خط شکسته شد:
  - `src/http-types.ts` (~۱۳۵ خط): اینترفیس‌ها/تایپ‌ها + allowlistها
    (verbatim).
  - `src/http-options.ts` (~۱۱۰ خط): اسکیماها و resolveها (verbatim).
  - `src/http-state.ts` (~۱۸۰ خط): state مشترک (verbatim) + helper جدید
    `setDefaultConfig` + mock/regeister/clear/cancel (verbatim).
  - `src/http-config.ts` (~۱۲۵ خط): `mergeAndValidateHttpOptions` +
    `set/getHttpConfig` (verbatim؛ دو بازنویسی `defaultConfig` به helper
    تبدیل شد چون rebinding روی live binding وارداتی ESM ممنوع است).
  - `src/http-request.ts` (~۳۷۰ خط): `fetchRequestCacheOptions`، `request`
    (با فراخوانی بازگشتی retry، مثل قبل)، facade `http` (verbatim).
  - `src/http.ts` (~۳۰ خط): فقط barrel (`export *` ×۵ + re-exportهای
    realtime)؛ هر ۳۵ نام عمومی + barrel موجود `index.ts` بی‌تغییر. تست‌ها
    به درونی‌ها وابسته نبودند.
- برابری بایت‌به‌بایت هر شش بخش با اصل تأیید شد (تنها تفاوت‌های عمدی:
  helper + دو فراخوانی آن)؛ همچنان اجرا نشده.
- وضعیت #40: ۱۳ شکسته + ۲ exception از ۳۴؛ ۱۹ فایل باقی است.

- تصمیم `packages/i18n/src/core.ts` (۷۵۰ خط): **exception مستدل، بدون
  split.** دلیل: قلب فایل factory واحد `createI18n` است (~۴۲۵ خط closure با
  ~۲۰ تابع داخلی روی state مشترک واکنشی: localeSig/dirSig/messagesByLocale/
  کش‌ها/subs/disposed)؛ حتی با استخراج همهٔ بخش‌های جداشدنی (helpers،
  app-scope، detect، plugin) خود factory به‌تنهایی بالای ۴۰۰ می‌ماند و
  شکستن آن به struct مصنوعی، semanticهای change-only/dispose/SSR را بدون
  امکان اجرای تست به خطر می‌اندازد. بازبین در فاز validation یا exception
  را می‌پذیرد یا split تأییدشده با اجرای تست می‌خواهد.
- وضعیت #40: ۱۳ شکسته + ۳ exception از ۳۴؛ ۱۸ فایل باقی است
  (بعدی: `i18n/index.ts`).

- `packages/i18n/src/index.ts` (۴۷۷ خط) به سه ماژول زیر۴۰۰خط شکسته شد —
  جابه‌جایی محض، بدون تغییر رفتار یا امضا:
  - `src/jalali-compat.ts` (جدید، ~۳۰۰ خط): aliasهای جلالی + legacy +
    `isRTL` (verbatim).
  - `src/direction.ts` (جدید، ~۱۲۰ خط): `RTL_LOCALES`، regexها، شش تابع
    جهت/bidi، `LOGICAL_CSS_MAP` (verbatim؛ `isRTL` را از jalali-compat
    می‌گیرد).
  - `src/index.ts` (~۱۰۰ خط): re-export سازگاری هر دو ماژول + `DEFAULTS`،
    formatters، بلوک موتور و `detectLocale` (importهایش به بالا منتقل شد)؛
    هر ۲۴ نام عمومی حفظ شده. تست‌ها از barrel استفاده می‌کنند.
- برابری بایت‌به‌بایت هر سه بخش با اصل تأیید شد (منهای جابه‌جایی importها)؛
  همچنان اجرا نشده.
- وضعیت #40: ۱۴ شکسته + ۳ exception از ۳۴؛ ۱۷ فایل باقی است.

- `packages/notifications/src/notifications.ts` (۷۴۸ خط) به شش ماژول شکسته شد:
  `notification-types` (تایپ‌ها + DEFAULTS)، `notification-state` (سیگنال‌ها و
  پیش‌فرض‌ها + سه mutation helper)، `notification-toasts` (تایمرها و toast و
  alert/confirm و API)، `notification-render` (رندر DOM)، `notification-dialog`
  (DialogHandle و openDialog) و `notifications.ts` (هدر + re-export + ریست).
  جابه‌جایی محض و verbatim؛ چهار جایگزینی مستند (یک فراخوانی در notify و سه
  فراخوانی در reset). barrel عمدا روی state از `export *` استفاده نمی‌کند تا
  داخلی‌ها به API عمومی نشت نکنند؛ هر ۳۱ نام عمومی حفظ شده و index و تست
  دست‌نخورده. برابری بایت‌به‌بایت تأیید شد؛ همچنان اجرا نشده.
- وضعیت #40: ۱۵ شکسته + ۳ exception از ۳۴؛ ۱۶ فایل باقی است
  (بعدی: `permission/permission.ts`).

- `packages/permission/src/permission.ts` (۵۶۴ خط) به پنج ماژول شکسته شد:
  `permission-foundation` (deepFreeze و PermissionState)، `permission-manager`
  (کلاس PermissionManager)، `permission-registry` (رجیستری و factoryها و
  clear/reset سراسری) و `permission-guards` (سه گارد مسیر) و `permission.ts`
  (داک‌هدر اصل + re-export). جابه‌جایی محض و verbatim؛ بدون substitution
  (هیچ let مشترکی بین ماژول‌ها بازنویسی نمی‌شد) و بدون چرخه (guards به
  registry، registry به manager، manager به foundation). هر ۱۵ نام عمومی حفظ
  شده؛ index و directive و تست دست‌نخورده. برابری بایت‌به‌بایت تأیید شد؛
  همچنان اجرا نشده.
- وضعیت #40: ۱۶ شکسته + ۳ exception از ۳۴؛ ۱۵ فایل باقی است
  (بعدی: `router/router.ts`).

- `packages/router/src/router.ts` (۵۹۷ خط) به پنج ماژول شکسته شد:
  `router-types` (تایپ‌ها و defineRoutes/useRoute)، `route-match` (تطبیق خالص)،
  `router-navigate` (هسته stateful: lets مشترک، guards، navigate، popstate و
  cleanup — عمدا یکپارچه ماند تا rebinding فرامرزی لازم نشود) و
  `route-announce` (a11y) و `router.ts` (داک‌هدر + re-export خط ۳۴ route-state
  + re-export). جابه‌جایی محض و verbatim؛ بدون substitution و بدون چرخه. هر
  ۲۳ نام عمومی حفظ شده؛ index و تست‌ها (از barrel و route-state می‌خوانند)
  دست‌نخورده. برابری بایت‌به‌بایت تأیید شد؛ همچنان اجرا نشده.
- وضعیت #40: ۱۷ شکسته + ۳ exception از ۳۴؛ ۱۴ فایل باقی است
  (بعدی: `scheduler/scheduler.ts`).

- `packages/scheduler/src/scheduler.ts` (۴۸۳ خط) به شش ماژول شکسته شد:
  `scheduler-priority` (enum و ثابت‌ها و normalize)، `scheduler-state`
  (singleton سراسری و ثبت نمونه)، `scheduler-schedule` (ثبت Effect + nextTick
  که برای شکستن چرخه schedule/flush به اینجا آمد)، `scheduler-flush` (اجرای
  صف و شمارش و clear و afterFlush)، `scheduler-adapter` (آداپتور و هوک‌ها) و
  `scheduler.ts` (داک‌هدر + re-export). جابه‌جایی محض و verbatim؛ دوازده
  `export` اضافه‌شده برای استفاده فرامرزی (بدون تغییر رفتار) و barrel عمدا
  روی سه ماژول selective است تا داخلی‌ها (queue و helperها) به API عمومی نشت
  نکنند؛ هر ۲۲ نام عمومی + alias تأیید شد. برابری بایت‌به‌بایت تأیید شد؛
  همچنان اجرا نشده.
- وضعیت #40: ۱۸ شکسته + ۳ exception از ۳۴؛ ۱۳ فایل باقی است
  (بعدی: `schema/validate.ts`).

- `packages/schema/src/validate.ts` (۴۸۲ خط) به شش ماژول شکسته شد:
  `validate-reporter` (isDev و reporter)، `validate-check` (check بازگشتی و
  describe)، `validate-engine` (run/safeValidate/fail/validate)،
  `validate-options` (defineOptions)، `validate-attr` (parseConfigAttr) و
  `validate.ts` (هدر + re-export). جابه‌جایی محض و verbatim؛ پنج `export`
  اضافه‌شده برای استفاده فرامرزی و barrel کاملا selective تا هیچ داخلی‌ای
  (check و state) به API عمومی نشت نکند؛ هر ۷ نام عمومی حفظ شده و index و
  تست‌ها دست‌نخورده. برابری بایت‌به‌بایت تأیید شد؛ همچنان اجرا نشده.
- وضعیت #40: ۱۹ شکسته + ۳ exception از ۳۴؛ ۱۲ فایل باقی است
  (بعدی: `service-worker/index.ts`).

- `packages/service-worker/src/index.ts` (۵۱۱ خط) به شش ماژول شکسته شد:
  `sw-types` (تایپ‌ها و استراتژی‌ها)، `sw-options` (اسکیماهای defineOptions)،
  `sw-register` (ثبت SW)، `sw-lifecycle` (لغو ثبت و kill-switch و آپدیت)،
  `sw-plugin` (پلاگین Zenith) و `index.ts` (هدر + re-export). جابه‌جایی محض
  و verbatim؛ دو `export` اضافه‌شده برای اینترفیس‌های داخلی پلاگین و barrel
  روی types عمدا selective است؛ هر ۲۳ نام عمومی حفظ شده. برابری بایت‌به‌بایت
  تأیید شد؛ همچنان اجرا نشده. (کنارراه: در دو barrel قبلی `type` جاافتاده
  بود — PriorityInput و WarnReporter/DefinedOptions اصلاح شد.)
- وضعیت #40: ۲۰ شکسته + ۳ exception از ۳۴؛ ۱۱ فایل باقی است
  (بعدی: `service-worker/strategies.ts`).

- `packages/service-worker/src/strategies.ts` (۴۱۲ خط) به هشت ماژول شکسته
  شد: `strategy-types` (نام استراتژی و دو helper)، شش ماژول استراتژی
  (cache-first و network-first و stale و simple و cache-then-network و apply)
  و `strategies.ts` (هدر + re-export خط ۴ + re-export). جابه‌جایی محض و
  verbatim؛ دو `export` اضافه‌شده برای helperها و barrel روی types عمدا
  selective است؛ هر ۲۰ نام عمومی حفظ شده. برابری بایت‌به‌بایت تأیید شد؛
  همچنان اجرا نشده.
- وضعیت #40: ۲۱ شکسته + ۳ exception از ۳۴؛ ۱۰ فایل باقی است
  (بعدی: `service-worker/sw.ts`).

- `packages/service-worker/src/sw.ts` (۸۵۱ خط، بزرگ‌ترین) به یازده ماژول
  شکسته شد: `sw-types`، `sw-state` (lets مشترک + دو helper)، `sw-options`،
  `sw-setup` (چهار substitution)، `sw-killswitch`، `sw-routing`،
  `sw-mutations`، `sw-retry`، `sw-db`، `sw-listeners` و `sw.ts` (هدر +
  re-export). جابه‌جایی محض و verbatim؛ شانزده `export` اضافه‌شده و barrel
  کاملا selective؛ هر ۱۲ نام عمومی حفظ شده و تست‌ها (از index و barrelها
  می‌خوانند) دست‌نخورده. برابری بایت‌به‌بایت تأیید شد؛ همچنان اجرا نشده.
- وضعیت #40: ۲۲ شکسته + ۳ exception از ۳۴؛ ۹ فایل باقی است
  (بعدی: `ssr/render.ts`).

- `packages/ssr/src/render.ts` (۱۱۹۰ خط، بزرگ‌ترین کل صف) به دوازده ماژول
  شکسته شد: serialize و context و head (+useHead) و pool و await و ssr
  (renderToString یکپارچه) و page و abort (جدید، برای شکستن چرخه ssr/stream)
  و stream و readable و adapters و `render.ts` (هدر + re-export خطوط ۹۸۶ـ۹۸۷
  + re-export). جابه‌جایی محض و verbatim؛ یازده `export` اضافه‌شده و barrel
  روی چهار ماژول selective (دو ماژول داخلی کلا hide)؛ هر ۳۳ نام عمومی حفظ
  شده و ssg و index و تست‌ها دست‌نخورده. برابری بایت‌به‌بایت تأیید شد؛
  همچنان اجرا نشده.
- وضعیت #40: ۲۳ شکسته + ۳ exception از ۳۴؛ ۸ فایل باقی است
  (بعدی: `ssr/server-component.ts`).

- `packages/ssr/src/server-component.ts` (۵۲۴ خط) به هفت ماژول شکسته شد:
  types و registry و render و factory و parser و inline و `server-component.ts`
  (هدر + re-export). جابه‌جایی محض و verbatim؛ دو `export` اضافه‌شده برای
  helperهای parser و barrel روی parser عمدا خالی (کاملا داخلی)؛ هر ۱۵ نام
  عمومی حفظ شده. برابری بایت‌به‌بایت تأیید شد؛ همچنان اجرا نشده.
- وضعیت #40: ۲۴ شکسته + ۳ exception از ۳۴؛ ۷ فایل باقی است
  (بعدی: `stateful/resource-view.ts`).

- تصمیم `packages/stateful/src/resource-view.ts` (۴۶۴ خط): **exception
  مستدل، بدون split.** دلیل: کل فایل عملا یک closure واحد
  `processResourceView` است (خطوط ۱۱۷ـ۴۶۳، ~۳۴۷ خط) با هفت تابع تودرتوی
  درهم‌تنیده (clearSlot/clearItems/renderLoading/renderError/renderEmpty/
  computeKey/renderSuccess) روی ~۱۵ متغیر مشترک (el و tplContent و متن‌ها و
  itemsByKey و effectها)؛ حتی با استخراج کامل بخش‌های جداشدنی (constهای
  متون و ResourceLike و RenderedItem، ~۵۱ خط) فایل مقصد ~۴۱۲ خط می‌ماند —
  یعنی بالای سقف و بدون هیچ بهبود واقعی. شکستن عمیق‌تر نیازمند context
  مصنوعی و تغییر امضای توابع private است که بدون اجرای تست ریسک
  regression دارد. بازبین در فاز validation یا exception را می‌پذیرد یا
  split تأییدشده با اجرای تست می‌خواهد.
- وضعیت #40: ۲۴ شکسته + ۴ exception از ۳۴؛ ۶ فایل باقی است
  (بعدی: `storage/storage.ts`).

- `packages/storage/src/storage.ts` (۴۵۰ خط) به دو ماژول شکسته شد:
  `storage-helpers` (پیش‌فرض‌ها و پنج helper) و `storage.ts` (هدر + factory
  یکپارچه ~۳۴۱ خط + re-export). جابه‌جایی محض و verbatim؛ پنج `export`
  اضافه‌شده و barrel هر سه نام عمومی را حفظ کرده؛ index و singleton و
  تست‌ها دست‌نخورده. برابری بایت‌به‌بایت تأیید شد؛ همچنان اجرا نشده.
- وضعیت #40: ۲۵ شکسته + ۴ exception از ۳۴؛ ۵ فایل باقی است
  (بعدی: `transition/transition.ts`).

- `packages/transition/src/transition.ts` (۸۱۲ خط) به هفت ماژول شکسته شد:
  types و classes (ثابت‌ها و helperها، کلا از barrel پنهان) و legacy و group
  و core و animate و `transition.ts` (هدر + re-export). جابه‌جایی محض و
  verbatim؛ یازده `export` اضافه‌شده؛ هر ۳۳ نام عمومی حفظ شده. برابری
  بایت‌به‌بایت تأیید شد؛ همچنان اجرا نشده.
- وضعیت #40: ۲۶ شکسته + ۴ exception از ۳۴؛ ۴ فایل باقی است
  (بعدی: `virtual-list/controller.ts`).

- تصمیم `packages/virtual-list/src/controller.ts` (۵۶۲ خط): **exception
  مستدل، بدون split.** دلیل: خود closure کارخانه `createVirtualList`
  به‌تنهایی ۴۰۵ خط است (خطوط ۱۵۷ـ۵۶۱) با ~۲۰ متغیر مشترک (rendered و
  measurements و offsets و container و observerها و...) بین ~۱۵ تابع
  تودرتو؛ هیچ جابه‌جایی مکانیکی نمی‌تواند هیچ ماژولی زیر سقف بسازد و شکستن
  آن نیازمند context مصنوعی و تغییر امضای توابع private بدون امکان اجرای
  تست است. بازبین در فاز validation یا exception را می‌پذیرد یا split
  تأییدشده با اجرای تست می‌خواهد.
- وضعیت #40: ۲۶ شکسته + ۵ exception از ۳۴؛ ۳ فایل باقی است
  (بعدی: `virtual-list/virtual-list.ts`).

- `packages/virtual-list/src/virtual-list.ts` (۴۱۳ خط) به سه ماژول شکسته
  شد: `virtual-list-config` (کانفیگ و تایپ‌ها)، `virtual-list-items`
  (انیمیشن و بایندینگ) و `virtual-list.ts` (هدر + processVirtualList +
  re-export). جابه‌جایی محض و verbatim؛ سه `export` اضافه‌شده؛ هر ۵ نام
  عمومی حفظ شده و index دست‌نخورده. برابری بایت‌به‌بایت تأیید شد؛ همچنان
  اجرا نشده.
- وضعیت #40: ۲۷ شکسته + ۵ exception از ۳۴؛ ۲ فایل باقی است
  (بعدی: `vite-plugin/compile.ts`).

- `packages/vite-plugin/src/compile.ts` (۶۱۵ خط) به پنج ماژول شکسته شد:
  `compile-types` (تایپ‌ها + اسکیمای compileOptions + TransformResult)،
  `compile-scan` (EXPRESSION_DIRECTIVES و replaceAll و کش‌ها و LRU و
  has/getModuleName + دو helper جدید lookup/store برای شمارنده‌ها)،
  `compile-transform` (transformHtml + generateModule خصوصی)،
  `compile-analyze` (analyzeHtml) و `compile.ts` (فقط barrel). جابه‌جایی
  محض و verbatim؛ هفت `export` اضافه‌شده برای استفاده فرامرزی + ۲ helper
  (کد داخل helperها عین خطوط اصلی، با تطبیق رفتار یکسان از جمله کپی
  مستقل warnings) و barrel کاملا selective (EXPRESSION/replaceAll/کش‌ها/
  helperها پنهان)؛ هر ۱۳ نام عمومی حفظ شده و تست‌ها (از index وارد
  می‌کنند) دست‌نخورده. برابری بلوک‌به‌بلوک تأیید شد؛ همچنان اجرا نشده.
- وضعیت #40: ۲۸ شکسته + ۵ exception از ۳۴؛ ۱ فایل باقی است
  (بعدی: `vite-plugin/index.ts`).

- `packages/vite-plugin/src/index.ts` (۴۱۳ خط) به سه ماژول شکسته شد:
  `plugin-glob` (globToRegex)، `plugin-options` (ZenithPluginOptions +
  اسکیما/DEFAULTS/resolve) و `index.ts` (~۳۳۵ خط: factory و pendingModules
  و PLUGIN_VERSION + re-export). جابه‌جایی محض و verbatim؛ بدون
  `export` اضافه (دو import جدید به‌جای تعریف محلی)؛ import مستقیم
  plugin-options از compile-types (بدون چرخه)؛ هر ۱۸ نام عمومی + re-export
  حفظ شده و تست‌ها دست‌نخورده. برابری بلوک‌به‌بلوک تأیید شد؛ همچنان اجرا نشده.
- وضعیت #40: **۲۹ شکسته + ۵ exception از ۳۴؛ ۰ فایل باقی — splits کامل
  (code-first، اجرا/اعتبارسنجی در فاز validation).**

## ادامهٔ متصل ۲۰۲۶-۱۰-۱۸ — #51: ابزارها بیرون packages و build صریح (code-first)

تمام موارد این بخش **نوشته‌شده، اما اجرا و تأیید نشده‌اند**. هیچ تست، lint،
typecheck، build، CI، commit، push یا بستن issue انجام نشد.

- وضع موجود (بازخوانی‌شده از source): انتقال هر دو ابزار به `tools/` قبلا
  انجام شده (workspaces شامل `tools/*`، `build` ریشه = libraries + tools،
  `package:tools`، جاب `tools` در CI با build+package، tsconfig/lint/
  typecheck/no-console هر دو والد را پوشش می‌دهند، attw/publint/size/API
  فقط `packages/` را می‌شمارند و ابزارها را کتابخانهٔ npm حساب نمی‌کنند).
  هیچ ارجاع زنده‌ای به مسیرهای قدیم `packages/devtools-extension` و
  `packages/vscode-extension` و `packages/zenith-vscode` در کل درخت نیست
  (فقط دو snapshot تاریخ‌دار docs/progress که طبق R01 بازنویسی نمی‌شوند).
- شکاف‌های بسته‌شده در این ادامه:
  - `scripts/sync-license.mjs`: پوشش به `packages + tools` گسترش یافت
    (ابزارها privateاند اما distributable هستند؛ دیگر silently skip
    نمی‌شوند)؛ پیام‌ها و کامنت‌ها به‌روز شدند.
  - `tools/devtools-extension/LICENSE` (جدید): کپی عین root LICENSE —
    قبلا غایب بود در حالی که build ZIP انتظار LICENSE در source دارد؛
    LICENSE ابزار vscode از قبل عین root بود (متناً تأیید شد).
  - `scripts/test/license.test.mjs`: شمارش به `packages + tools`
    گسترش یافت (همان titles/ساختار، فقط مسیرهای نسبی کامل).
  - `scripts/test/tools-build.test.mjs`: تست منفی جدید «هیچ فایل زنده‌ای
    به مسیر قدیم packages/ اشاره ندارد» — ۶۷۵ فایل اسکن‌شده در شبیه‌سازی
    فقط‌خواندنی، صفر offender (snapshotهای تاریخ‌دار docs/progress مستثنا
    با دلیل مکتوب). اجرای واقعی تست در فاز validation.
- باقی‌ماندهٔ #51 طبق پلن: اجرای build/tools/pack، --check لایسنس،
  dry-run ZIP/VSIX و گیت‌های G. کارت کامل معرفی نمی‌شود؛ در ماتریس «باز»
  می‌ماند. ناهماهنگی‌های متنی زنده (PRODUCTION-READINESS و ARCHITECTURE
  که انتقال را ناتمام نشان می‌دهند) عمداً دست نخوردند و در فاز R (R01–R08)
  تعیین تکلیف می‌شوند.
