# چک‌لیست رساندن همان ۲۸ کارت به «آمادهٔ اجرای اعتبارسنجی نهایی»

تاریخ تطبیق: ۲۰۲۶-۱۰-۱۷ — شاخهٔ همین نشست: `arena/ff992be5-zenith-v1-4-0`.

## ۱. دامنه و معنی این فهرست

دامنه دقیقاً این ۲۸ کارت است:
`#13 #38 #39 #40 #51 #55 #56 #57 #66 #67 #97 #109 #110 #118 #120 #132 #139 #151 #152 #153 #154 #155 #156 #157 #159 #165 #166 #174`.

این سند با متن زندهٔ هر ۲۸ issue، `NEW-PACKAGES-SPEC.md`، `docs/API-CONVENTIONS.md`، پلن اجرایی و آخرین دفتر code-first تطبیق داده شده است. همهٔ ۲۸ issue هنگام این خواندن OPEN بودند. این فهرست برنامهٔ تکمیل است، نه گزارش انجام‌شدن یا نتیجهٔ آزمون.

- بعضی الزامات زیر کد/تست دارند؛ نباید دوباره از صفر نوشته شوند. باید با بند پذیرش متناظر تطبیق داده و فقط شکافشان تکمیل شود.
- هیچ گزینه یا رفتار وعده‌داده‌شده نباید صرفاً با وجود نام تابع، README، mock، cast، skip یا allowlist جدید «پیاده‌شده» حساب شود.
- «آمادهٔ اجرای نهایی» یعنی کار شناخته‌شدهٔ پیاده‌سازی، ادغام، نوشتن تست، مستندات و تنظیم گیت باقی نمانده؛ نه اینکه صحت بدون اجرا اثبات شده باشد.
- بنا به دستور کاربر در این مرحله هیچ test، lint، typecheck، build، benchmark، audit اجرایی، CI یا push برای راه‌انداختن CI اجرا نمی‌شود.
- تولید API report از declaration، ساخت tarball/ZIP/VSIX، اندازه‌گیری حجم و ثبت نتیجه به مرحلهٔ اجرای نهایی تعلق دارد؛ کد تولید، مرجع مقایسه و مسیر آرشیوشان باید از قبل آماده باشد.
- بستن واقعی #66 و #97، و تأییدهای انسانی امنیت/API/دسترس‌پذیری، فقط با کد و تست خودکار ممکن نیست. این بخش‌ها جدا نگه داشته شده‌اند.

### یادداشت ادامهٔ پیاده‌سازی در همین تاریخ

برای #156/#174 و بخش مشترک #157، native Node ALS، factory async و late cleanup،
حفظ document shell، HTML streaming/compression/backpressure، callback کش، proxy
context، snapshot مشترک state و fixtureهای مربوط نوشته شدند. scaffold SSR نیز
با marker و App تازه/انتقال state/HMR cleanup هماهنگ شد. جزئیات در آخرین بخش
`REMEDIATION-CODE-FIRST-2026-10-16.md` است. این یادداشت هیچ checkbox پذیرش را
تیک نمی‌زند؛ همهٔ تغییرات هنوز اجرا/اعتبارسنجی نشده‌اند و شکاف‌های باقی‌مانده
در integration، API، UI و Edge همچنان باید پیش از اعلام آمادگی رفع شوند.

برای #153/#151 نیز owner بسته، reentrant dialog/popover/lazy tabs، modal/portal
lease، tooltip IDREF/timer، combobox cancellation/delegation، accordion nested و
geometry RTL کد و fixture تازه دارند. قراردادهای کامل گزینه‌های reactive، schema/
metadata، date-picker و transition هنوز تکمیل نشده‌اند؛ هیچ بند پذیرش تیک نخورده است.

ادامهٔ Date Picker نیز کد/fixture برای Gregorian/Jalali، locale/format/first-day،
range، readonly/required، فرم native/fallback، reactive options و lifecycle دارد.
custom tag از field اختیاری جدید Core به App وصل می‌شود. این‌ها candidate هستند؛
API، native/browser/form/axe/size و snapshot metadata اجرا نشده‌اند و checkboxها
عمداً همچنان بدون تأیید باقی می‌مانند. Tooltip ترکیب hover/focus و dismissal-session،
Popover جلوگیری از arrow mutation پس از dispose در geometry، و Date Picker
live-region پایدار/locale digits نیز کد و fixture اجرا‌نشده دارند.

ادامهٔ بعدی #153/#120: schema strict هفت controller، گزینه‌های readable سه collection،
اتصال دوطرفهٔ expression/writable، tooltip text امن، dialog portal و گزینه‌های کامل
projection/filter/async در Combobox کد و unit/type/browser fixture دارند. floating/
dialog/menu reactivity، motion/reduced-motion مشترک و API/size parity هنوز بازند.
همهٔ fixtureها اجرا‌نشده‌اند؛ این یادداشت آمادگی نهایی هیچ کارت را تأیید نمی‌کند.
Portal عمومی هم branch منطقی و rollback حذف source/target/marker و lease قدیمی
دارد؛ unit fixture نوشته شده است، نه شاهد browser/reentrancy. گزینهٔ واکنشی target
و motion/shared public API همچنان بازند.

ادامهٔ تازهٔ #153/#120/#151: surfaceهای Dialog/Popover/Tooltip/Menu اکنون Config/
Options واکنشی و بازتنظیم owned دارند؛ motion مشترک به هفت widget نمایشی وصل است.
leave منطقی inert/ARIA-hidden، لغو reopen/dispose/media/config، adoption حالت بستهٔ
SSR و realm موتور transition کد/fixture دارند. attributeهای scalar با پیشوند `:`
به همان expression engine وصل شدند؛ portal در Dialog controller owned است و false/
مقصد reactive می‌پذیرد. Menu دیگر snapshot تکراریِ trigger ARIA ندارد. metadata
منبع، seed و grammar برای motion/floating به‌روز شدند؛ snapshot تولیدی هنوز قدیمی است.
فایل‌های reactive-surfaces/motion/collection-motion/realm-and-reentrant و توسعهٔ
fixtureهای directive/types/browser **اجرا نشده‌اند**. generic portal target، سیاست
borrowed Menu، composition متن Tooltip و arrow، API/size/browser و SSR buffering
هنوز بازند؛ این ادامه به معنی آمادگی کامل همان۲۸ کارت نیست.

ادامهٔ جدید #153/#156/#174: target عمومی Portal نیز readable و schema-backed شد؛
origin اولیه، یک منبع مشترک، rollback/reconnect و shadow origin/target کد/fixture دارند.
مسیر stream معمولی اکنون DOM owned را هنگام pull serialize می‌کند، نه HTML کامل و
سپس slice؛ App/DOM تا پایان مصرف نگه داشته و پیش از done نهایی بسته می‌شوند.
onReady و metadataOnly shell اضافه شد؛ hookهای نیازمند HTML کامل عمداً سازگاری
buffered دارند. Node cleanup فرزند SSR را قبل از loader والد await می‌کند.
state snapshot، Window تازهٔ هر request، cache templateهای inert، bounded diagnostic
و cache-clear epoch نیز کد و fixture دارند. native noscript/XML و shell/state JSON
fallback/رشتهٔ کامل دارند؛ progressive async-component rendering ادعا نمی‌شود.
fixtureهای تازهٔ portal/serializer/owned-stream و Node، از جمله ۱۰۰ stream همزمان،
**فقط نوشته شده‌اند**؛ type/build/unit/browser/transport/API/size هنوز اجرا نشده‌اند.
بنابراین checkbox هیچ کارت یا آمادگی نهایی کل۲۸ تغییر نکرده است.

ادامهٔ #153/#120/#40: Tooltip expression اکنون Text node مستقل و presentation
owned دارد؛ fallback و SVG arrow حذف یا جابه‌جا نمی‌شوند و selector واکنشی arrow
قابل استفاده می‌ماند. Core hook اختیاری `skipChildren` برای عدم bind محتوای fallback
اضافه شده؛ host فاقد آن پیش از mutation خطا می‌گیرد. این تغییر API جدید و نیازمند
review است، نه اثبات API-identical #40. restoration متن/attribute/style بعد از
surface cleanup و حذف root/trigger، fixture واحد/Core/type/browser اجرا‌نشده دارد.
Menu نیز برای همهٔ گزینه‌های عرضه‌شده سیاست منبع مشترک دارد: readable یکسان یا
concrete مطابق config فعلی؛ منبع متفاوت/تعارض رد می‌شود، نه نادیده‌گرفتن خاموش.
child مستقل منبع خودش را نگه می‌دارد و attribute غایب default رقیب نمی‌سازد.
این سیاست سازگاری هنوز نیازمند پذیرش است؛ fixtureهای تازه اجرا نشده‌اند و هیچ
checkbox یا ادعای آمادگی کل۲۸ تغییر نکرده است.

پیگیری #153/#139: nonce stylesheet تقویم پیش از اتصال تنظیم می‌شود و تغییر nonce
sheet تازه می‌سازد؛ unit rotation و browser با header واقعی CSP، فرم و axe نوشته شد.
role ثابت Menu/Tooltip در schema/type محدود شد تا درخواست ناسازگار خاموش نادیده
گرفته نشود. Auth نیز fixture دو تب storage-only بدون BroadcastChannel و disposed
peer دارد. همه اجرا‌نشده‌اند؛ سیاست API، گیت‌ها و آمادگی کل۲۸ همچنان تأیید نشده‌اند.

## ۲. تصمیم‌هایی که باید قبل از اعلام آمادگی روشن باشند

- [ ] **مرز refactor و تغییر قرارداد:** تغییرهای unknown/Computed/Cleanup، رفتار hydration/reset/dispose و تغییر مستقل errors/analytics، از استخراج مکانیکی #40 جدا شوند؛ مرجع قبل/بعد و changeset/migration هر تغییر روشن باشد. major proposal تأییدنشده جای API-identical بودن را نمی‌گیرد.
- [ ] **API پایدار در برابر سازگاری:** root فقط API مصوب را داشته باشد؛ اگر bridge deprecated فعلاً باید در root بماند، تعارض #56/#174 با مالک حل و رسماً ثبت شود. در این حالت حذف کامل root ادعا نشود.
- [ ] **Vite:** قرارداد سه major در #110، کف Node ابزار و کف runtime کتابخانه‌ها تعیین شود. حذف Vite 8 یا هر major فقط با تصمیم رسمی؛ نه skip خاموش یا peer range خوش‌بینانه.
- [ ] **پیش‌نیازهای بیرون این ۲۸ کارت:** قسمت لازم از #158/#164/#167 برای CLI/Vite، پایهٔ RTL، ownership npm و تنظیمات release باید موجود یا رسماً مسدود/تغییردامنه‌شده باشند. این شماره‌ها به‌خودی‌خود کارت جدیدِ این درخواست نیستند، اما جای dependency واقعی را placeholder نمی‌گیرد.
- [ ] **Edge:** رفتار `happy-dom` با factory صریح در برابر وعدهٔ انتخاب `domImpl`، و سطح پشتیبانی Bun/Vercel در کنار Workers/Deno، تعیین تکلیف شود. محیطی که شاهد/fixture ندارد supported معرفی نشود.
- [ ] **MFA:** قرارداد این دامنه hook اختیاری challenge/OTP است؛ پروتکل کامل challenge/recovery فقط اگر رسماً تعهد شده باشد لازم است. endpoint ساده به‌عنوان MFA کامل معرفی نشود.
- [ ] **تأییدهای بیرونی:** مسئول و مدرک مورد انتظار انتشار npm، فروشگاه‌ها، بازبینی امنیت و QA screen reader مشخص شود؛ هیچ credential در سند/چت ثبت نشود.

## ۳. کارهای مشترک اجباری برای تمام کارت‌ها

### C01 — ماتریس ردیابی پذیرش
- [ ] برای هر بند issue/spec یک ردیف با فایل پیاده‌سازی، API/attribute مرتبط، نام تست، نوع تست و گیت نهایی بسازید.
- [ ] ردیف بدون کد یا بدون تست به‌صورت کار باز بماند؛ «parity/بررسی نهایی» بدون مصداق کافی نیست.
- [ ] وضعیت «کد آماده»، «تست نوشته‌شده/اجرانشده»، «بیرونی» و «پذیرش‌شده با شاهد» از هم جدا باشند.

### C02 — قرارداد و بسته‌بندی پکیج‌های جدید/متأثر
- [ ] manifest، target واقعی، exports و همهٔ subpathها، type entry، `files`، sideEffects، engines و dependency/peer/optional peer مطابق لایه‌بندی باشند.
- [ ] نسخه‌های workspace/peer و lockfile سازگار باشند؛ state/scheduler چند نسخهٔ فیزیکی ناخواسته نگیرند.
- [ ] هر Options مشمول دارای schema واقعی، DEFAULTS منجمد، نوع، default/unit و تست default/invalid باشد؛ schema صرفاً مستند نباشد و در مسیر اجرا استفاده شود.
- [ ] همهٔ directiveها DirectiveMeta و ورودی metadata تولیدی داشته باشند؛ خطاهای بازهٔ هر پکیج در catalog و صفحات مستندات ثبت شوند.
- [ ] README نصب، مثال، گزینه/attribute، SSR/client-only و migration؛ TSDoc/TypeDoc، LICENSE، changelog و changeset تکمیل باشند.
- [ ] export داخلی، public-any، console مستقیم، خطای خام سفارشی و randomness امنیتی ضعیف از سطح مشمول حذف شوند؛ استثنای مجاز محلی، دقیق و مستند باشد.

### C03 — مالکیت و failure path
- [ ] برای هر factory/binder/subscription تعیین شود چه کسی مالک Signal/effect/listener/timer/observer/DOM/stream/socket است و چه کسی فقط borrower است.
- [ ] success، شکست ساخت/نصب/bind، dispose چندباره، reentrant dispose، unmount/remount و حذف DOM، cleanup کامل داشته باشند؛ خطای یک cleanup بقیه را متوقف نکند.
- [ ] تکمیل دیررس Promise، retry، async loader، queue یا worker بعد از dispose/reset/supersede نتواند state یا DOM نسل تازه را تغییر دهد یا منبع تازه بسازد.
- [ ] Node request context، App.run همگام و context صریح Edge قاطی نشوند؛ global DOM swapping یا fallback به App دیگر مجاز نباشد.

### C04 — تست و گیت آماده، ولی اجرا نشده
- [ ] تست مثبت، منفی، regression، type inference و integration واقعی متناسب با هر بند نوشته شود؛ assertion به رفتار/خروجی واقعی باشد، نه فقط وجود string/symbol.
- [ ] fake clock/random/transport فقط جایی استفاده شود که مناسب unit است؛ شبکه، SW، extension و SSR واقعی fixture جدا داشته باشند.
- [ ] consumer نصب‌شده از tarball، Node ESM/CJS و bundler/Workerهای اعلام‌شده fixture داشته باشند؛ صرف alias کردن source کافی نیست.
- [ ] ماتریس Node 18.19/20/22 و Chromium/Firefox/WebKit طبق spec/target آماده باشد؛ نیاز Node بالاتر ابزار build از کف runtime جدا شود. هر تغییر دامنه مصوب باشد.
- [ ] fixture منفی واقعاً مسیر failure را انتظار داشته باشد؛ skip در نبود ابزار/مرورگر ضروری به success تبدیل نشود.
- [ ] runnerها deadline، پاک‌سازی subprocess/temp files/ports و حالت شکست روشن داشته باشند؛ نتیجهٔ جعلی یا fallback موفق نداشته باشند.
- [ ] CI، ترتیب build وابستگی‌ها، scripts و artifact/trace/report retention به تمام fixtureها وصل شوند؛ هیچ گیت آماده اما فراخوانی‌نشده باقی نماند.
- [ ] حداقل coverage هستهٔ معیار اصلی ≥۸۰٪ و بودجه‌های موجود کاهش نیابند؛ baseline و روش مقایسهٔ regression از قبل تعریف شوند.

### C05 — تعیین تکلیف قطعات نوشته‌شدهٔ اخیر، پیش از فریز candidate
این‌ها کار جدید خارج از دامنه نیستند؛ خطرهای مشخص همان کدهای فعلی‌اند و باید در ردیف‌های #38/#40/#109/#118/#120/#153/#174 شاهد روشن داشته باشند.

- [ ] آخرین تغییر Resource در enqueue بعد از dispose، registerDOMCleanup دیررس/لغوثبت و جمع‌کردن خطاهای dispose از روی source بازخوانی و قراردادش یکسان شود؛ تست افزوده‌شدهٔ request-lifecycle به helper واقعاً موجود با امضای درست وصل شود، نه `resource()` فرضی.
- [ ] حلقهٔ bind فرزندان Resource/structural پس از بسته‌شدن owner یا خطای bind ادامه ندهد؛ cleanup ناقص/Promise دیررس rollback کامل داشته باشد؛ درخواست/بدنه فقط یک‌بار serialize شود.
- [ ] reset Store با factory دارای root مشترک، alias یا cycle صریحاً تعریف شود؛ proxy native/opaque و patch/prototype در مسیر legacy هم همان قواعد را رعایت کنند.
- [ ] mount/unmount/remount، duplicate key، template restoration و hydration owner/ID با تغییرهای Core تطبیق داده شوند؛ بازسازی keyed row با حفظ هویت اشتباه معرفی نشود.
- [ ] normalization نام پروژهٔ CLI در create/preview یکسان باشد؛ trim/NFC، مسیر traversal، quoting، shell injection، نسخهٔ source در برابر نسخهٔ injectشدهٔ build و scaffold SSR/PWA با فایل خروجی واقعی تطبیق داده شوند.
- [ ] ownership controllerهای menu/UI و lazy panelها، date-picker در iframe/realm دیگر، nonce و خطای تبدیل محدودهٔ تقویم از فهرست خطر به قرارداد و تست مشخص تبدیل شوند.
- [ ] sanitizer دارای ownerDocument در Node/SSR بدون تغییر globalها کار کند؛ تست‌های corpus و دو Document مستقل نوشته باشند و ادعای CSP/TrustedTypes یا network-inertness فقط با fixture واقعی همان محیط مطرح شود.

## ۴. چک‌لیست اختصاصی هر ۲۸ کارت

### 01 — #13: زنجیرهٔ ابزار و آسیب‌پذیری‌های dev
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/13

**تکمیل کد/تنظیمات**
- [ ] dependencyهای Vite/Vitest/esbuild و زنجیره‌های مرتبط با advisoryها، peer range افزونه، templates و lockfile هماهنگ شوند؛ override ناسازگار یا `--force` راه‌حل محسوب نشود.
- [ ] ماتریس نسخه/Node و سیاست پشتیبانی با #110 یکسان شود؛ نصب مصرف‌کننده از نسخه‌های واقعی بسته‌ها پیش‌بینی شود.
- [ ] runner ذخیرهٔ audit prod/dev، dependency path و تصمیم استثنای امنیتی آماده باشد؛ هدف صفر، critical/high مانع release و استثنای مجاز دارای مسئول/انقضا/تأیید باشد.

**تست‌های آمادهٔ اجرا**
- [ ] install پاک، plugin در پروژهٔ واقعی روی حداقل دو major پشتیبانی‌شده و تمام majorهای تعهدشده در #110، peer نامعتبر و سالم‌ماندن خروجی منتشرشدنی.
- [ ] audit نهایی dev/prod روی candidate نهایی؛ اعداد تاریخی جای نتیجهٔ جدید ننشینند.

### 02 — #38: صفر any عمومی
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/38

**تکمیل کد/تنظیمات**
- [ ] مهاجرت تمام گراف عمومی، نه فقط Core/Store/Resource/Auth؛ شامل callbackها، methods، generic defaultها، re-exportها، زیرمسیرها و `.d.ts/.d.cts`.
- [ ] مرز ناشناخته با unknown و narrowing/validation واقعی حل شود؛ `Function`، cast به any یا cast سراسری جانشین اصلاح قرارداد نباشد.
- [ ] inference getter/action/this در Store، پاسخ CRUD، context directive، overloadها و wrapperهای legacy حفظ یا با migration مصوب اصلاح شود.
- [ ] any داخلی حداکثر۱۰۰؛ هر مورد باقی‌مانده دلیل محلی داشته باشد. ESLint و auditor AST/declaration یک سیاست و ratchet واقعی داشته باشند.

**تست‌های آمادهٔ اجرا**
- [ ] fixture منفی any در re-export، generic callback و subpath؛ type consumer بدون cast و نصب از tarball؛ fixture تمایز API داخلی از عمومی.

### 03 — #39: مهاجرت کامل logger
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/39

**تکمیل کد/تنظیمات**
- [ ] همهٔ diagnosticها در source، tools و قالب تولیدی فقط از logger بگذرند؛ consoleSink تنها محل مجاز console اجرایی باشد؛ معافیت legacy صفر بماند.
- [ ] قالب `[zen:scope] CODE: message`، سطح production، redaction و failure isolation transportها یکسان شود.
- [ ] stdout دادهٔ CLI و stderr diagnostic تفکیک شوند؛ تصمیم رفتار standalone errors بدون bridge و تغییر major/سازگاری آن قطعی شود.

**تست‌های آمادهٔ اجرا**
- [ ] silent روی تمام مسیرهای مهاجرتی، JSON CLI بدون آلودگی، AST کد تولیدی، sink/transport معیوب و جلوگیری از چاپ credential/token/اطلاعات شخصی.

### 04 — #40: پایان refactor فایل‌های بزرگ
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/40

**تکمیل کد/تنظیمات**
- [ ] باقی فایل‌های بزرگ شامل auth، runtime/index، runtime/walker، crud-engine، form، Resource و هر source دستی مشمول به ماژول‌های مسئولیت‌دار تقسیم شوند؛ استخراج Core/Store/CLI به‌تنهایی کافی نیست.
- [ ] شمارش ESLint max-lines با سقف۴۰۰ روشن باشد؛ استثنا فقط با توجیه فنی و بازبین، نه حذف comment یا فشرده‌کردن خطوط برای سبزکردن معیار.
- [ ] barrel/importها و چرخه‌های runtime/type اصلاح شوند؛ refactor محض از اصلاح رفتار/major جدا و مرجع مقایسهٔ API و bundle قبلی آماده شود.

**تست‌های آمادهٔ اجرا**
- [ ] سوئیت قبلی بدون تضعیف، API before/after یکسان برای بخش refactor محض، build از dist خالی، dependency cycle و عدم افزایش bundle همان حوزه.

### 05 — #51: ابزارها و discovery/build
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/51

**تکمیل کد/تنظیمات**
- [ ] تمام ارجاع‌های مسیر قدیمی extensions در workspaces، tsconfig، aliases، CODEOWNERS، workflow و مستندات اصلاح شوند.
- [ ] build/lint/package هر دو ابزار صریحاً از root/CI فراخوانی شود؛ ابزار نه npm library حساب شود و نه silently skip شود.
- [ ] همهٔ collectorهای API/metadata/size/release/license و مستندسازها با جداسازی tools سازگار شوند؛ فایل‌های لازم ZIP/VSIX داخل manifest بسته باشند.

**تست‌های آمادهٔ اجرا**
- [ ] build libraries/tools، کشف ارجاع شکسته، dry-run ZIP/VSIX و fixture منفی که شکست build ابزار را به شکست job تبدیل می‌کند.

### 06 — #55: حذف بدهی positional config
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/55

**تکمیل کد/تنظیمات**
- [ ] تمام allowlist موجود به دادهٔ واقعی، legacy deprecated و config قابل‌مهاجرت تفکیک شود؛ عدد تاریخی۱۱۳ فهرست نهایی فرض نشود.
- [ ] تمام configهای مشمول به options منتقل شوند؛ از جمله fetcher/retry، cache TTL، suspense، transition/animation group، service worker، locale/formatting و موارد تازهٔ همین candidate.
- [ ] overload قدیم delegation به همان implementation، TSDoc deprecation، warning یک‌باره و migration/codemod داشته باشد؛ نتیجه یا defaultها متفاوت نشود.
- [ ] auditor و ESLint منبع طبقه‌بندی یکسان داشته باشند و config پنهان در کنار Options یا داخل overload را تشخیص دهند؛ بدهی config از allowlist حذف شود. استثنای «داده» نباید config اختیاری باشد.

**تست‌های آمادهٔ اجرا**
- [ ] old/new parity، هشدار یک‌باره، overload متخلف و `fn(value, locale, options)`؛ امضای جدید متخلف گیت را بشکند.

### 07 — #56: API رسمی و گزارش کامل امضا
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/56

**تکمیل کد/تنظیمات**
- [ ] همهٔ exportهای تمام entrypointها release tag صریح داشته باشند؛ default-public ضمنی وجود نداشته باشد.
- [ ] Parser/lex/TokenType، devtools instrumentation، domAls/global getters و helperهای واقعاً داخلی به مسیر مناسب منتقل شوند؛ API عمومی hydrate با helper داخلی هم‌نام اشتباه نشود.
- [ ] compatibility bridge، برنامهٔ حذف major، changeset و تصمیم اختلاف root/public مشخص شوند؛ API Extractor همهٔ پکیج‌ها و subpathها را پوشش دهد.
- [ ] مسیر تولید/ثبت/مقایسهٔ `*.api.md` شامل signature/generic/member/tag آماده باشد؛ report فقط فهرست نام‌ها نباشد. تولید snapshot واقعی بعد از build نهایی است.

**تست‌های آمادهٔ اجرا**
- [ ] تغییر نوع بدون تغییر نام، حذف member، نشت internal و entrypoint جاافتاده gate را قرمز کنند؛ consumer tarball و declaration parity.

### 08 — #57: exports و محیط‌ها
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/57

**تکمیل کد/تنظیمات**
- [ ] جدول همهٔ package/subpath/condition/type/target کامل و هم‌منبع با builder/standardizer باشد؛ `./package.json` و internal/experimental/testing لازم وجود داشته باشند.
- [ ] dev/prod، browser/node/worker و import/require فقط برای محیط واقعی تعریف شوند؛ fallback ناسازگار و type/file بی‌خروجی وجود نداشته باشد.
- [ ] production define شاخهٔ dev را حذف کند؛ sideEffects واقعی reset/registration از tree-shaking حذف نشوند؛ dual ESM/CJS singleton را نشکند.

**تست‌های آمادهٔ اجرا**
- [ ] resolve هر condition، Node ESM/CJS پشتیبانی‌شده، Vite/webpack/esbuild و Deno/Worker مطابق target؛ publint/attw/pack/install و اسکن production برای شاخهٔ dev.

### 09 — #66: release با OIDC/provenance
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/66

**تکمیل کد/تنظیمات**
- [ ] تمام مسیرهای release، از جمله script دستی، فقط مسیر مجاز CI/tag را اجرا کنند؛ build/test/package قبل از publish اجباری باشد.
- [ ] حداقل permission، `id-token: write`، environment محافظت‌شده، npm client سازگار OIDC، `--provenance` و `publishConfig.provenance` همهٔ بسته‌ها هماهنگ شوند.
- [ ] preflight tag/version/workflow/environment/token policy و failureهایش آماده باشد؛ secrets فقط از نظر نام/وجود بررسی شوند، نه مقدار.

**تست‌های آمادهٔ اجرا**
- [ ] tag/نسخه/environment نامعتبر، نبود تأیید و تلاش با token بلندمدت متوقف شوند؛ dry-run tarball مسیر publish را بدون انتشار واقعی بررسی کند.

**بیرونی؛ شرط بستن واقعی**
- [ ] مالک Trusted Publisher و release environment را واقعاً تنظیم و حذف token بلندمدت را تأیید کند؛ انتشار فقط با اجازهٔ صریح و سپس provenance/attestation بستهٔ منتشرشده را تأیید کند.

### 10 — #67: امنیت extension واقعی
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/67

**تکمیل کد/تنظیمات**
- [ ] CSP واقعی webview، popup و graph viewer؛ script خارجی/nonce تازه و بدون inline handler؛ وضعیت inline style با policy صریح و ادعای دقیق تعیین شود.
- [ ] schema و sender/origin/channel/command، payload بزرگ، prototype pollution و ورودی HTML در مسیر واقعی پیام بررسی شوند؛ sink ناامن innerHTML حذف/ایمن شود.
- [ ] harness نصب extension Chromium و VS Code Extension Host/webview واقعی، capture CSP/console/DOM و ذخیرهٔ artifact آماده باشد.

**تست‌های آمادهٔ اجرا**
- [ ] پیام معتبر، sender متقلب، schema خراب، payload حجیم و injection از ورودی واقعی پنل؛ عدم اجرای script و عدم اثر جانبی پیام ردشده؛ string-only test کافی نیست.

### 11 — #97: artifact و فروشگاه‌های Devtools
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/97

**تکمیل کد/تنظیمات**
- [ ] manifest/build نسخه‌دار Chrome و Firefox، تفاوت MV3، `browser_specific_settings`، ZIP قابل‌بازتولید، lint و مسیر artifact CI کامل باشند.
- [ ] permissions/optional hosts، telemetry و داده‌های واقعاً جمع‌آوری‌شده با privacy policy عمومی و متن store یکسان باشند؛ screenshot/راهنمای نصب آماده شود.

**تست‌های آمادهٔ اجرا**
- [ ] نصب ZIP ساخته‌شده در پروفایل پاک هر مرورگر، inspection/message واقعی و تطبیق permission/policy با رفتار.

**بیرونی؛ شرط بستن واقعی**
- [ ] مالک ارسال و بازخورد Chrome Web Store و AMO را پیگیری کند؛ تأیید/انتشار هر دو و لینک privacy policy ثبت شود. ZIP یا رسید ارسال جای تأیید نیست.

### 12 — #109: CLI کامل، نه فقط scaffold
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/109

**تکمیل کد/تنظیمات**
- [ ] `zenith dev/build/test/upgrade/doctor` واقعاً پیاده و به runner/codemod/doctor متصل شوند؛ scaffold پنج‌گانهٔ نوشته‌شده این بند را کامل نمی‌کند.
- [ ] process lifecycle، cwd/config resolution، signal forwarding، Ctrl+C، timeout/error و نبود orphan؛ runner غایب نباید fallback موفق بدهد.
- [ ] doctor کف Node، نسخه‌ها، config، exports و دو نصب فیزیکی state را تشخیص دهد؛ upgrade به تبدیل واقعی وصل باشد و فایل کاربر را بی‌دلیل overwrite نکند.
- [ ] قرارداد JSON نسخه‌دار و مشترک همهٔ دستورات، stdout داده/stderr diagnostic و exit codeهای۰/۱/۲ تعریف و اعمال شوند.
- [ ] create/preview/generate با path layout/versions/dependencies/schema یکسان؛ SSR/PWA قابل‌مصرف و templateهای تولیدی مطابق API واقعی و lint باشند. پیش‌نیازهای #158/#164/#167 در حد تعهد این کارت حل شوند.

**تست‌های آمادهٔ اجرا**
- [ ] CLI نصب‌شده از tarball در پروژهٔ واقعی؛ همهٔ commandها، peer/config/runner خراب، JSON parse، دو state واقعی، Ctrl+C و child failure؛ create → install → dev → build → test و upgrade/doctor.

### 13 — #110: HMR و sourcemap واقعی
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/110

**تکمیل کد/تنظیمات**
- [ ] هستهٔ compile/options و مسیر wrapper مشترک با طراحی unplugin سازگار شود؛ cache بر content/options/dependencies hash و invalidation واقعی باشد.
- [ ] update سازگار HTML بدون full reload، با حفظ state و dispose نسخهٔ قبل؛ تغییر ناسازگار fallback صریح داشته باشد.
- [ ] sourcemap زنجیره‌ای HTML → compiled → bundle با mappings واقعی، فایل/line/column expression و diagnostics درست باشد.
- [ ] fixture پروژهٔ واقعی Vite 6/7/8 و engines/peer همان قرارداد؛ حذف major نیازمند مصوبه است.

**تست‌های آمادهٔ اجرا**
- [ ] حفظ state و عدم reload،۱۰۰ update بدون listener اضافی، تغییر content/options/dependency و invalidation؛ خطای expression روی مختصات HTML؛ ماتریس سه major.

### 14 — #118: تمام registryها و ownership
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/118

**تکمیل کد/تنظیمات**
- [ ] inventory actions/components/auth/permissions/resources/stores/server-components/directives/plugins/devtools و cleanupهای scheduler/router تکمیل شود؛ صرف namespace خالی کافی نیست.
- [ ] هر adapter واقعی به App/request درست وصل باشد؛ legacy فقط default-owner bridge و نبود key در App هرگز fallback به global نباشد.
- [ ] پنج عملیات یکسان، نام key واحد، undefined هنگام miss، cleanup token/idempotent و replacement safety برای همهٔ inventory برقرار باشد.
- [ ] created در برابر borrowed و unregister در برابر dispose دقیقاً تعریف شود؛ dispose/reset یک App به دیگری آسیب نزند؛ reentrant/default reset و late acquire پوشش داشته باشند.
- [ ] resetForTesting همهٔ state پیش‌فرض مشمول را پاک کند؛ aliasهای قدیم deprecation یک‌باره داشته باشند؛ مرز async در Node/Browser/Edge روشن باشد.

**تست‌های آمادهٔ اجرا**
- [ ] یک contract suite پارامتری روی تمام registryها؛ same key/different App، same-value replacement، borrower، dispose/error/reentrancy، async boundary، default reset و۱۰۰ درخواست مستقل.

### 15 — #120: همهٔ binderها و grammar مشترک
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/120

**تکمیل کد/تنظیمات**
- [ ] جدول کامل directive/tag/legacy attribute → canonical binder → DirectiveMeta تهیه و missing mapping مانع گیت شود.
- [ ] همهٔ `processX`ها به wrapper deprecated روی `bindX(el, BindContext): Cleanup` تبدیل شوند؛ Resource/realtime فعلی فقط بخشی از مهاجرتند.
- [ ] context شامل app/state/evaluation/locals/processChildren/cleanup با یک قرارداد بدون cycle لایه‌ای باشد؛ subtree cleanup قابل‌مالکیت و async bind قابل‌لغو باشد.
- [ ] هر JSON attribute فقط از parseConfigAttr/schema مشترک؛ boolean/duration/number و اولویت options/attribute طبق grammar؛ JSON.parse مستقیم attribute صفر شود.
- [ ] metadata/runtime/compiler/grammar/cookbook از جدول واحد مصرف/تولید شوند؛ legacy warning و allowlist binderهای #55 اصلاح شوند.

**تست‌های آمادهٔ اجرا**
- [ ] تمام binderها: امضا و metadata، default/invalid config، legacy parity/warning، context/scoping، cleanup دوباره، partial bind و حذف DOM پیش از async completion.

### 16 — #132: notifications و accessibility
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/132

**تکمیل کد/تنظیمات**
- [ ] `showAlert/showConfirm` canonical و alias قدیمی با warning؛ notifications facade و توابع جدا یک engine باشند.
- [ ] maxVisible، queue/ordering، dedupe و تخلیه؛ timer pause/resume hover/focus و reduced motion/RTL کامل باشند.
- [ ] نقش status/alert، aria-live و confirm با primitive مشترک focus/Escape/return focus؛ تداخل با dialog/menu/notification دیگر مالکیت درست داشته باشد.

**تست‌های آمادهٔ اجرا**
- [ ] حفظ۲۲ تست قبلی؛ fixture۱۰۰ اعلان، confirm باز، timeout/hover/focus، Tab/Shift+Tab/Escape، mixed UI و axe واقعی.
- [ ] دستورالعمل QA screen reader با OS/مرورگر/ابزار و expected announcement آماده شود.

**پذیرش انسانی نهایی**
- [ ] خوانده‌شدن polite/assertive و confirm با screen reader واقعی ثبت شود؛ نتیجهٔ ساختگی یا axe جای این شاهد نیست.

### 17 — #139: یک engine Auth و سازگاری
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/139

**تکمیل کد/تنظیمات**
- [ ] تمام class/functional/runtime facadeها دقیقاً یک Auth canonical و یک AuthConfig را مصرف کنند؛ timer/token/session موازی حذف شود.
- [ ] config/response/storage legacy mapping و defaultApp/App explicit ownership، precedence، borrower و reset/reentrant teardown تطبیق داده شوند.
- [ ] storage امن و قرارداد @zenith/storage، remember/migration، refresh کوکی HttpOnly و عدم افشای secret در log/channel/URL کامل باشند.
- [ ] BroadcastChannel/storage fallback، scope و loop suppression؛ login/refresh/logout، request/body دیررس و dispose/cancellation نسل‌بندی درست داشته باشند.
- [ ] hook اختیاری challenge/MFA، canonical exports و جدول alias/deprecation/migration طبق تصمیم API تکمیل شوند.

**تست‌های آمادهٔ اجرا**
- [ ] هر دو سبک، storage deny/corrupt/migrate، stale response و refresh race، دو App، دو تب واقعی با logout/refresh و fallback channel؛ tarball/browser/default-owner.

### 18 — #151: تمام قرارداد a11y
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/151

**تکمیل کد/تنظیمات**
- [ ] تفاوت‌های API با spec حل شوند: initialFocus به‌شکل callback، getFocusable/includeHidden، inert(on)، شکل Cleanup/Disposable و ReadonlySignal؛ اگر قرارداد عوض می‌شود باید مصوب/مهاجرت‌دار باشد.
- [ ] focus trap/stack/pause/fallback/outside click، live region/announce، roving، scroll lease، reduced motion و IDهای per-App/request کامل باشند؛ DOM realm و portalها مستقل بمانند.
- [ ] directiveهای focus-trap/autofocus/inert/scroll-lock شرط boolean واقعاً واکنشی باشند؛ live نقش status/alert و aria-atomic درست بگذارد؛ duration مانند5s از grammar مشترک بیاید.
- [ ] installRouteAnnouncer و اتصال واقعی router/main focus/title؛ notifications/UI/transition و مصرف‌کنندگان مشمول به implementation واحد وصل شوند.
- [ ] error1401..1403، metadata، schema/defaultها و SSR no-op/ID hydration مطابق C02؛ بودجه۵KB gzip.

**تست‌های آمادهٔ اجرا**
- [ ] Tab/Shift+Tab/Escape/Home/End، disabled/hidden/nested/portal، restore fallback، چند scroll lease، تغییر motion، route announcement و ID server/client؛ axe مصرف‌کننده واقعی.

### 19 — #152: head کامل و request-scoped
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/152

**تکمیل کد/تنظیمات**
- [ ] تمام HeadInputها MaybeSignal/getter، patch/dispose، titleTemplate، base، html/body attrs، dedupe بر name/property/rel+href/key و last-entry precedence کامل باشند.
- [ ] `<zen-head>` و انتقال فرزندان، `zen-head-key` و چهار directive title/description/canonical/og-image به implementation واحد و metadata وصل شوند؛ وجود چهار directive به‌تنهایی کل spec نیست.
- [ ] reconciliation/adoption/rollback بدون آسیب به tag/attribute قرضی؛ ownership چند manager/App و cleanup ثبت ناقص/خطادار حل شود.
- [ ] JSON-LD فقط مجاز، escaping `</script>`، URL/attribute validation، nonce/maxTags و خطا1501..1503؛ SSR renderHead و router titleFromRoute مصرف واقعی داشته باشند.
- [ ] P/C02، optional peer SSR و بودجه۳KB gzip.

**تست‌های آمادهٔ اجرا**
- [ ] دو manager/App/request، signal update، entry priority/patch/dispose، hydration adoption بدون duplicate، JSON-LD injection، attribute restore و tag limit.

### 20 — #153: UI کامل؛ شکاف‌های مشخص
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/153 — جدول تفصیلی: `NEW-PACKAGES-SPEC.md §3.4`.

**تکمیل مشترک**
- [ ] API برنامه‌نویسی و directive هر هشت component، گزینه‌های camelCase/MaybeSignal، schema/default، data-state/placement/disabled/orientation و CSS vars مشترک کامل شوند؛ اختلاف `open/state/show/hide/ids` با spec حل شود.
- [ ] مالک controller ایجادشده و borrower، duplicate-parent/controller، trigger مشترک، ثبت تکراری directive و cleanup یک مصرف‌کننده بدون کشتن controller دیگری تعیین و پیاده شود.
- [ ] transition enter/leave و لغو animation با cleanup، reduced motion و SSR/client-only؛ facade runtime دقیقاً همان date-picker/portal را مصرف کند.

**تکمیل componentها**
- [ ] Dialog: reactive/two-way open، portal مقصد، reason رویداد close/open، title/description IDs، modal/nonmodal، stacking و بازگشت focus؛ portalهای منطقی خارج از DOM modal واقعاً در focus/inert/Escape شریک باشند.
- [ ] Popover/tooltip: reactive open/text، placementهای start/end در RTL، arrow، trigger-on click/hover/focus/manual، delay/hide-delay و disabled؛ observer geometry و listener/timer cleanup.
- [ ] Menu: تمام keyboard/typeahead، disabled، checkbox/radio group، submenu، چرخه/duplicate-parent، outside click، Tab/Escape و selection در portal.
- [ ] Tabs: activeExpr و نگاشت tab/panel بر id، orientation/activation، lazy SSR parking/hydration و cleanup زودهنگام panel؛ state writable/binding طبق قرارداد.
- [ ] Accordion: valueExpr/id، single/multiple/collapsible، keyboard، ARIA و change event طبق spec.
- [ ] Combobox: valueExpr، option-label/value مسیر فیلد، filter contains/startsWith/none، async loader، debounce/minChars، multiple/custom و input/change events؛ abort/generation و active-descendant درست.
- [ ] Date-picker: علاوه بر min/max/disabled موجود، calendar جلالی/میلادی، locale، first-day، format، readonly/required/name/form integration، range و `zen-date-picker-change`؛ value encoding و رویداد legacy با migration؛ owner realm و nonce حفظ شوند.
- [ ] همهٔ subpathها import مستقل و tree-shakable؛ error1601..1604 و metadata کامل؛ بودجه کل۱۵KB gzip.

**تست‌های آمادهٔ اجرا**
- [ ] fixture واقعی هر هشت component، keyboard/APG و RTL/LTR، axe، reactive options، دو modal، portal+submenu، controller قرضی/تکراری، async result دیررس، حذف وسط animation و SSR/hydration.

### 21 — #154: realtime transport و همهٔ گزینه‌ها
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/154

**تکمیل کد/تنظیمات**
- [ ] WS و EventSource واقعی، status state machine، open/close/send، topic/events و Cleanupهای on/subscribe مطابق قرارداد؛ mock فقط در مسیر testing باشد.
- [ ] reconnect retries/delay/factor/jitter/maxDelay، heartbeat interval/timeout/message، queue maxSize/buffer/drop، history، parse/serialize، AbortSignal و maxMessageSize کامل باشند.
- [ ] auth first-message پیش‌فرض، subprotocol/query فقط opt-in امن؛ ws ناامن production رد شود؛ token وارد URL/log پیش‌فرض نشود.
- [ ] zen-ws/sse، stateOutput، topic/reconnect/protocols/parse/history/send/options و DOM events، facade http و SSR idle → hydrate connect یکپارچه باشند.
- [ ] metadata، schema/default، خطا1701..1705 و P؛ بودجه۵KB gzip.

**تست‌های آمادهٔ اجرا**
- [ ] unit deterministic reconnect/queue/heartbeat/parser؛ loopback WS/SSE رفت‌وبرگشت، قطع/وصل، protocol/binary payload و browser واقعی؛ dispose هنگام connect/retry و auth failure.

### 22 — #155: analytics با privacy و provider isolation
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/155

**تکمیل کد/تنظیمات**
- [ ] createAnalytics و legacy configureAnalytics/zen-track یک engine؛ consent major/legacy migration و handler replacement/reset/defaultApp قطعی باشد.
- [ ] track/page/identify/setConsent/flush/use، consent پیش‌فرض false، DNT زنده، sampleRate، batch size/interval، redact، sessionTimeout و router autoPageViews کامل باشند.
- [ ] revoke هیچ صف شخصی نگه ندارد؛ revoke/regrant، dispose وسط flush و تعویض handler تحویل قدیمی را احیا نکنند؛ providerهای سالم از شکست یکی مستقل باشند.
- [ ] gtag/plausible/beacon/console provider، trigger click/submit/visible/change، props/label/data-label/once/debounce و DOM removal؛ SSR صفر ارسال/صف.
- [ ] metadata/schema/default و خطا1901/1902؛ بودجه۳KB gzip.

**تست‌های آمادهٔ اجرا**
- [ ] provider throw/reject، rejection دیررس و نبود unhandled event، چند provider، batching/flush/sample/session، consent/DNT/revoke، router، legacy attributes و cross-App/cross-copy.

### 23 — #156: تکمیل API و رفتار Node adapter
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/156 — جزئیات: `NEW-PACKAGES-SPEC.md §3.7`.

**تکمیل کد/تنظیمات**
- [ ] اختلاف API فعلی با NodeAdapterOptions/server/static spec حل شود؛ `handler` روی server، next/middleware behavior، listen signature و نام gracefulShutdownTimeout/staticDir مصوب باشند، نه صرفاً مستند متفاوت.
- [ ] template string/async factory و app factory همگام/async، outlet validation، routes، stream پیش‌فرض true، cacheControl callback، health و timeout503 کامل شوند.
- [ ] static traversal/symlink/encoding، etag قابل‌تنظیم، gzip/br و negotiation، trustProxy opt-in، logger requestId و onError/onAbort کامل باشند.
- [ ] abort اتصال به renderer/stream/App برسد؛ backpressure واقعی، drain/shutdown deadline و cleanup منابع/connectionها برقرار باشد.
- [ ] nonce CSPRNG هر پاسخ و تطابق header/HTML؛ ALS نبودن و template/timeout با1803/1802/1801؛ jsdom/dependency و P.

**تست‌های آمادهٔ اجرا**
- [ ] Node/Express/Connect/Fastify واقعی،۱۰۰ request با state/head/locale مجزا، slow client با بودجهٔ حافظهٔ ازپیش‌تعریف‌شده، abort، route miss/next، compression و graceful shutdown با active request.

### 24 — #157: تکمیل parity Edge و runtimeها
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/157

**تکمیل کد/تنظیمات**
- [ ] renderer فقط context/DOM صریح؛ هیچ import مستقیم/ترانزیتی jsdom، ALS، node:async_hooks یا global DOM swapping وارد Worker نشود.
- [ ] Fetch/Cloudflare/Deno handler، env/context، Web Streams و cancel/backpressure، assets، waitUntil، timeout/error/abort و option parity با Node به‌جز موارد مستثنا کامل شوند.
- [ ] state/head/i18n/scheduler/IDs و ownership DOM/App هر درخواست مستقل؛ clone/serialization داده و Readableها با hydration codec قرارداد یکسان داشته باشد، نه cast عمومی.
- [ ] happy-dom انتخابی، host factory و سطح پشتیبانی Bun/Vercel رسماً حل شوند؛ خطا1811/1812 برای runtime/DOM نامعتبر درست باشد.
- [ ] worker target/exports و dependencyهای DOM صحیح؛ budget adapter۶KB gzip و deployment bundle≤۱MB؛ P.

**تست‌های آمادهٔ اجرا**
- [ ] bundle واقعی و ممنوعیت Node imports؛ Miniflare و Deno هر کدام۱۰۰ request مستقل، nonce/head/locale، asset miss/error، deadline/late cleanup، waitUntil/cancel و hydrate واقعی خروجی. runtime ضروری غایب failure باشد نه skip سبز.

### 25 — #159: ruleها، semantics و adoption
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/159

**تکمیل کد/تنظیمات**
- [ ] هر۱۰ rule کد: no-console، no-plain-error، no-destroy-alias، options-object، dispose-required، no-module-state، no-math-random-security، no-deprecated-api، no-global-name-collision و tsdoc-default.
- [ ] هر۱۲ rule قالب: directive معتبر/ناشناخته، option ناشناخته، key، structural conflict، expression، forbidden identifier و پنج rule a11y؛ HTML و template literal با mapping صحیح.
- [ ] معنای export/re-export، overload، type-only، destructuring، scope، typed/spread factory، async cleanup و deprecated alias درست باشد؛ no-op یا regex تزئینی کافی نیست.
- [ ] configs recommended/strict/library/template، settings version/packages، schema گزینهٔ هر rule و جدول rule→بند قرارداد با مثال خوب/بد تکمیل شوند.
- [ ] root، library و scaffold واقعاً مصرف کنند؛ تخلف فعلی رفع یا debt مجاز دقیق با مسئول/ratchet شود؛ allowlist جدید مشکل #38/#55/#120 را پنهان نکند.

**تست‌های آمادهٔ اجرا**
- [ ] حداقل۵ valid و۵ invalid برای هر rule، location Unicode/HTML/template، parser/type-aware cases، fixture consumer و تخلف عمدی failکنندهٔ CI؛ P.

### 26 — #165: mock کامل و مصرف واقعی
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/165

**تکمیل کد/تنظیمات**
- [ ] API server/listen/close/use/reset/calls، تمام REST verbs، ws.link، respond/json/text/status/headers، passthrough و delay طبق قرارداد واحد باشند.
- [ ] Node fetch interception و browser Service Worker واقعی، WS mocking، nested/replacement lease و restoration امن globalها کامل شوند.
- [ ] unhandled error/warn/bypass، baseURL، latency ثابت/بازه‌ای deterministic، record/redaction، double-response2531 و unhandled2530.
- [ ] testing.mockHttp و fixture واقعی dashboard/demo از همین engine استفاده کنند؛ http/resource بدون تغییر مصرف‌کننده باشند؛ reset handler/calls/state و dispose/abort کامل باشند.
- [ ] worker asset/export/نصب/README و P آماده باشند.

**تست‌های آمادهٔ اجرا**
- [ ] integration http/resource، SW مرورگر واقعی و WS، چند installer، unhandled/double response، abort حین delay/handler، record privacy و برگرداندن fetch/WS اصلی.

### 27 — #166: fixture در محصول، نه فقط harness
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/166

**تکمیل کد/تنظیمات**
- [ ] test.extend، mountApp، hydration readiness واقعی، signal get/set، state/registry/devtools snapshot و timeout/cancellation/generation کامل باشند؛ sleep ثابت substitute readiness نباشد.
- [ ] console/page error قبل از mount capture، failOnConsoleError، a11y rules/exclude/impact و hydrationTimeout5s طبق schema/default اعمال شوند.
- [ ] حداقل یک demo و component واقعی، و سناریوهای UI/SSR/devtools مشمول از fixture عمومی استفاده کنند؛ source-only bridge جای مصرف tarball را نگیرد.
- [ ] cleanup هر test/page/server، report HTML، trace فقط شکست و retention artifact CI تنظیم شوند؛ Node/browser entries صحیح باشند.

**تست‌های آمادهٔ اجرا**
- [ ] mount→hydrate→interact→axe، fail واقعی برای hydration timeout/console/a11y عمدی، remount/teardown، signal isolation میان تست‌ها و trace قابل‌بازیابی؛ P.

### 28 — #174: SSR یکپارچهٔ App/head/i18n
مرجع: https://github.com/legionir/zenith-v1.4.0/issues/174

**تکمیل کد/تنظیمات**
- [ ] String/Node Stream/ReadableStream همه factory App تازه per-request و finally شامل success/error/abort داشته باشند؛ استفادهٔ مجدد یا dispose شدن App قرضی با قرارداد مالکیت حل شود.
- [ ] generateFullPage از renderHead مشترک، i18n locale/messages/dir/timeZone درخواست و `__ZENITH_I18N__` مصرف کند؛ fallback global به request نشت نکند.
- [ ] serialization امن state/Readable/head/i18n و escaping، nonce، deterministic IDs و client adoption یک قرارداد مشترک داشته باشند؛ hydrate دوباره fetch پیام یا tag duplicate نسازد.
- [ ] APIهای domAls/global getters و helperهای داخلی به /internal با bridge/migration مصوب بروند؛ API پایدار رسمی و گزارش #56 هماهنگ باشند.
- [ ] explicit Edge renderer و Node request context همان semantic رندر/cleanup را داشته باشند بدون واردکردن Node DOM به Edge؛ optional peers نصب‌پذیر و مستند باشند.

**تست‌های آمادهٔ اجرا**
- [ ]۱۰۰ render همزمان با title/meta/lang/dir/messages متفاوت، همهٔ streamها، abort/error/late factory، borrowed App، nonce و hydration مرورگر بدون mismatch/duplicate؛ API report پایدار.

## ۵. صف اجرای نهایی — فقط بعد از پایان کدنویسی و با مجوز اجرا

این بخش الآن اجرا نمی‌شود. runner باید ترتیب و dependencyها را آماده کند:

1. install پاک از lockfile؛ format/lint/typecheck، dependency/layer/peer/singleton و hygieneهای API/error/cleanup/attribute/positional.
2. build از dist خالی؛ build جداگانهٔ tools؛ generation declaration، metadata، API reports و docs؛ مقایسهٔ امضا و بررسی intentional API changes.
3. unit/integration/type/coverage و fixtureهای منفی gate؛ همهٔ تست‌های قدیمی بدون تضعیف.
4. pack، publint، attw، dts parity، install/import consumers، exports/conditions، tree-shaking و size budgets.
5. Vite6/7/8 و CLI lifecycle/HMR/sourcemap؛ Node middleware/stream/slow-client/۱۰۰concurrency/shutdown؛ Worker bundle/Miniflare/Deno.
6. Chromium/Firefox/WebKit، UI/APG/RTL/axe، auth دو تب، realtime، analytics privacy، SW mock، SSR hydration، extension و VS Code host واقعی.
7. audit prod/dev، مرور امنیت/API، QA screen reader و گیت‌های release dry-run؛ رفع خطاهای آشکارشده و اجرای مجدد فقط بخش لازم سپس regression نهایی.
8. برای هر نتیجه: candidate SHA، command/exit، test name، نسخهٔ محیط، CI URL و artifact ثبت شود. نتیجهٔ تاریخی شاهد candidate جدید نیست.

بودجه‌ها: a11y۵KB، head۳KB، UI۱۵KB، realtime۵KB، analytics۳KB، adapter-edge۶KB gzip و Edge deployment≤۱MB؛ بودجه‌های قبلی دیگر پکیج‌ها هم حفظ شوند.

## ۶. شرط خروج از فاز نوشتن و شرط بستن issue

### مجاز به گفتن «فقط منتظر اجرای نهایی» وقتی:
- [ ] همهٔ C01–C04 و تمام بندهای کدی/تست‌نویسی بالا پوشش فایل و تست دارند؛ هیچ TODO پذیرشی، command غایب، option بی‌اثر، metadata جاافتاده یا debt بدون تصمیم باقی نیست.
- [ ] تضادهای spec/API و تصمیم‌های major/compatibility تعیین تکلیف شده‌اند؛ تغییر دامنه با تأیید رسمی است، نه توضیح README به‌جای پیاده‌سازی.
- [ ] تمام تست‌ها و fixtureها نوشته، به runner/CI متصل و محیط مورد نیازشان مشخص است؛ وضعیت همگی «اجرانشده» است.
- [ ] فقط تولید artifact، اجرای گیت‌ها، رفع خطای حاصل از آن اجرا و پذیرش‌های انسانی ازپیش‌مشخص‌شده باقی است؛ این حالت به معنی تضمین بی‌باگ بودن نیست.

### مجاز به بستن واقعی هر issue وقتی:
- [ ] معیار اختصاصی کارت + گیت مشترک G و در پکیج جدید P با شاهد candidate نهایی پاس شده‌اند.
- [ ] تأییدهای امنیت/API/دسترس‌پذیری لازم و کار بیرونی همان کارت مدرک واقعی دارند.
- [ ] در #66 انتشار و provenance واقعی، و در #97 تأیید هر دو فروشگاه وجود دارد؛ dry-run/mock/ZIP جای آن‌ها نیست.
- [ ] مجوز تغییر وضعیت/انتشار وجود دارد؛ هیچ issue صرفاً به خاطر نوشته‌شدن کد یا این چک‌لیست بسته نشده است.

## منابع

- متن زندهٔ همان۲۸ issue، خوانده‌شده در۲۰۲۶-۱۰-۱۷؛ لینک هر کارت در بخش خودش.
- `docs/progress/REMEDIATION-CODE-FIRST-2026-10-16.md` — وضعیت واقعی آخرین کدها، نه اثبات اجرا.
- `docs/progress/REMEDIATION-EXECUTION-PLAN-2026-10-16.md` — معیارهای اختصاصی و G/P؛ ترتیب قدیمی «گیت پایان batch» با دستور فعلی کاربر جایگزین شده است.
- `NEW-PACKAGES-SPEC.md`، به‌ویژه §3.2–3.8، §3.10، §4.5–4.6، §5 و §6.2.
- `docs/API-CONVENTIONS.md` و `STANDARDIZATION-PLAN.md`.

## Source-authoring continuation — a11y/head/router (unvalidated)

The a11y/head/router implementation and new unit, strict-type, browser and SSR
fixtures are candidate progress for #38/#118/#120/#151/#152/#174, not acceptance.
See `REMEDIATION-CODE-FIRST-2026-10-16.md` for the implementation and unresolved
compatibility/budget details. Route loader/metadata boundaries now use `unknown`;
other public-any debt is not cleared. Head authored content projects clones and
restores original source nodes; that semantic choice still needs approval. Seed
metadata and grammar changed without running generators. The same 28 cards stay
in scope, **0 accepted**, with code/integration completion still preceding all
final gates. No tests/typecheck/build/lint/CI/commit/push/publication/issue mutation
performed during this continuation.

## Source-authoring continuation — Realtime/Mock (unvalidated)

#154/#165 now have additional generation/decoder and worker-session ownership,
abortable setup/passthrough, ws/wss origin matching, strict Mock options, descriptor
restoration and actual Resource-demo consumption code. New unit and public
consumer fixtures plus worker/demo browser scenarios are authored, not run. Worker
protocol v2, production option validation and receive-buffer ceiling semantics are
candidate compatibility changes; package/size/API/transport gates remain pending.
See the implementation ledger for exact paths. Same 28-card scope, 0 accepted;
no tests or other gates executed and no issue mutations.

### ادامهٔ API مشترک — نوشته‌شده، نه تأییدشده

facade واقعی Router، context بومی و ورودی Node، تفکیک Auth/Form/cache،
تایپ‌های unknown/generic، overloadهای options برای cache/Intl/SW و اصلاح
ممیزی declaration/release-level نوشته شدند. fixtureها نیز نوشته شده‌اند؛
هیچ‌کدام اجرا نشده‌اند. جزئیات و تفکیک refactor سازگار از تغییر قرارداد در
[سند مهاجرت](../API-MIGRATION-CANDIDATE-2026-10-17.md) است.
این ادامه هنوز جایگزین تکمیل Runtime/CRUD/Resource، طبقه‌بندی همهٔ نمادها و
تمیزکردن گراف API نیست. هیچ checkbox، کارت یا تأیید major بسته/قبول نشده است.

Shared API continuation: CRUD and Resource private module boundaries and new
identity/lifecycle fixtures are now authored, together with expression/component
unknown contracts and non-skipping dual-CJS consumer selection. This is **not**
a readiness update: Runtime/Core, full classification/positional consumers and
whole-graph cleanup remain. No final validation or acceptance was performed.


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

Further continuous authoring: source/member positional inventory and matching
ESLint coverage, actual published-callable graph, shared fail-closed declaration
loading, overload/exposure metadata corrections, DataTable/Suspense decomposition,
unknown table/Store/walker boundaries, canonical filter/Suspense configuration and
new runtime/type/tooling fixtures are written. Details and source line counts are
in the migration ledger. Dependency/lockfile and final-CI wiring are authored only.
No tests or other gates were executed and no issue changed. Full method/exemption
review, export classification, whole-graph cleanup, remaining implementation and
external approvals/manual QA remain open. **0 accepted/closed; no readiness
checkbox was changed.**

### 2026-10-18 — Compiler/Testing/Security continuation, not acceptance

Written: real owner decomposition for Compiler/Testing/Security; unknown parity
state and opaque Trusted Types outputs; honestly sync-or-async private parser
with declared optional jsdom peer; canonical shared-schema parity/render/
directive/HTML-sink bags and deprecated bridges 090–094; receiver-preserving
unknown Zen lookup; honest numeric timers with partial-install rollback; shared
reset/cache ownership. Runtime/type/source-export fixtures and canonical
consumers/docs/dependency edges are authored. Mechanical candidates and
source/lifecycle changes are separated in the migration ledger and proposed
major changeset.

**No fixture or gate executed, no generated acceptance report, no CI/push or
issue mutation.** Existing implementation, export/method inventory, consumer/
size/CJS, approval and external/manual QA work remains open. Same 28-card scope;
**0 accepted/closed and no readiness checkbox changed**.

### State/Form continuation — source candidates only, 2026-10-18

Explicit reactive subscriber and unknown writable capabilities are integrated
through native Runtime/Core writes, including hidden model maps and real method
receivers. Form gains canonical validation/lifecycle/store-method bags and
retained bridges 095–100; internal callers avoid bridge warnings and known field
setters retain key/value correlation. State registry types and Form evaluator/
state-construction helpers have separate owners without fabricated class scopes.
Runtime/type/source-facade fixtures, proposed migration notes and API conventions
are written, not executed. Full State/Form lifetime/ownership, generic ergonomics,
callback/member inventory, export classification and other 28-card implementation
remain open. **No gate, CI/push, issue mutation or accepted/readiness checkbox;
0 cards accepted/closed.**


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

### ادامهٔ ۲۰۲۶-۱۰-۱۸ — State internal / مالکیت واقعی درخواست SSR

- ورودی `@zenith/state/internal` با سطح داخلی، conditionهای ESM/CJS و types،
  جدول یکتای exports و نگاشت‌های source نوشته شد؛ facade به خودِ root package
  ارجاع می‌دهد تا build مستقل زیرمسیر state/نوع nominal دیگری نسازد. مصرف SSR
  منتقل شد؛ exportهای قدیمی root بدون مجوز حذف نشدند و root-public-only باز است.
- owner سراسریِ موازی با EffectContext حذف و مالکیت از context انتخاب‌شده خوانده
  می‌شود. rerun/teardown، lazy computed، async refresh/abort و watch cleanup به
  context زمان ثبت متصل شده‌اند؛ binder آرگومان/خروجی واقعی را حفظ می‌کند.
- Node SSR برای هر ثبت snapshot بومی می‌گیرد، DOM store و claimهای App را بین
  formatها مشترک می‌کند، حتی بدون route ورودی scope مستقل `/` می‌سازد و پیش از
  prepass/async factory مالک درخواست ایجاد می‌کند. teardown آن را پیش از منابع
  دیگر می‌بندد؛ owner مرده مانع افکت default-owned در ادامهٔ دیررس می‌شود.
- fixtureهای ۱۰۰ scope زنده و ۱۰۰ render واقعی، failure/cancel/stream، نوع/metadata
  و consumerهای buildشده نوشته شدند؛ هیچ‌کدام اجرا یا کامپایل نشده‌اند. یکسانی
  constructorهای root بین formatها، observer/registry/priority، exportهای SSR،
  Edge و سایر شکاف‌های همان ۲۸ کارت همچنان ادعای تکمیل ندارند.

هیچ test/typecheck/build/lint/audit/report/CI/push یا تغییر issue انجام نشد؛
**۰ کارت پذیرفته/بسته‌شده** و هیچ checkbox پذیرش تیک نخورد. این گزارش اعلام
«فقط منتظر تست بودن همهٔ ۲۸ کارت» نیست؛ تأیید API/major و موانع بیرونی برقرارند.

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
