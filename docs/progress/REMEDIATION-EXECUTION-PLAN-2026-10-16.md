# پلن اجرایی رفع نواقص و باقی‌مانده‌ها

> **ترتیب فعال طبق دستور کاربر:** ابتدا همهٔ کدها و تست‌های باقی‌مانده نوشته شوند؛
> تست/validation/CI فقط پس از تکمیل همهٔ پیاده‌سازی‌های قابل انجام و سپس رفع خطا.
> push میانی انجام نمی‌شود. این ترتیب جای زمان‌بندی «گیت پایان هر batch» در متن
> قدیمی را می‌گیرد؛ هیچ معیار پذیرش یا آستانه‌ای حذف نشده است.
> وضعیت dirty tree و همهٔ کارت‌های باز در
> [دفتر code-first](./REMEDIATION-CODE-FIRST-2026-10-16.md) است.
> [گزارش W0/W1](./REMEDIATION-W1-2026-10-16.md) شواهد تاریخی است، نه گواه تغییرات
> فعلی. هیچ کارت/issue کامل یا انتشار آماده اعلام نشده است.

تاریخ: **۲۰۲۶-۱۰-۱۶**

مبنای برنامه: commit `734f80b7e13d7d3fc96693b38df9dba95459a3f6`

منبع یافته‌ها: [گزارش تطبیق issueها با کد](./ISSUE-RECONCILIATION-2026-10-16.md)

> این فایل **برنامهٔ اجرا** است، نه گزارش انجام کار. هیچ checkbox این فایل به معنی اجرای فعلی نیست. دستورها، تست‌ها و مسیرهایی که «پیشنهادی/جدید» نامیده شده‌اند باید در مرحلهٔ مربوط ساخته شوند؛ وجودشان در این سند به معنی وجودشان در مخزن نیست.

## ۱. دامنه، تصمیم‌های پایه و تعریف پایان

### دامنهٔ پوشش

- **۴۸ issue اجرایی ناقص/باقی‌مانده:** برای هر یک کارت مستقل با پیش‌نیاز، گام، آزمون و معیار پذیرش در بخش ۴ وجود دارد.
- **۴ issue تکمیل‌شدهٔ پیشنهادی** (#106/#108/#112/#119): فقط بازاعتبارسنجی و ثبت شواهد، نه بازنویسی بی‌دلیل.
- **۱۱ issue مدیریتی** (#176–#186): مسیر به‌روزرسانی/خاتمهٔ مستقل در بخش ۶.
- **۸ اصلاح گزارش/مستندات** (R01–R08): بخش ۵.
- این برنامه مجوز انتشار عمومی، تغییر سطح دسترسی، بستن issueها یا کاهش معیار اصلی آنها نیست؛ آن عملیات در زمان اجرا با اختیار مناسب و شواهد انجام می‌شوند.

### قواعد اجرا

1. ابتدا بدنهٔ زندهٔ issue و آخرین کد را بخوانید؛ گزارش مبنا یک snapshot تاریخی است. تغییر دامنه را با تصمیم مصوب ثبت کنید، نه با تفسیر دلخواه «انجام شد».
2. کار این نشست فقط روی `arena/ff992be5-zenith-v1-4-0` است. ساخت/تعویض شاخه یا push به شاخه‌ای دیگر در این نشست انجام نشود. حفاظت شاخهٔ پیش‌فرض موضوع #80 است، نه تغییر شاخهٔ کاری.
3. رفع فوری امنیتی را از refactor بزرگ جدا کنید. هر تغییر رفتاری تست دارد؛ برای باگ قابل‌بازتولید ابتدا تست شکست‌خورنده نوشته شود.
4. API قدیمی تا موعد حذف مصوب حفظ شود: wrapper/alias + هشدار deprecation + آزمون سازگاری. انتقال داخلی‌ها از API فعلی به زیرمسیر نیز migration لازم دارد؛ حذف breaking فقط در major مصوب.
5. هدف پیش‌فرض، **تحقق معیار اصلی** است. اگر مثلا #86 با خطای ≤۵٪ محقق نشد، باز بماند؛ تغییر این معیار نیازمند تأیید صریح مالک و اصلاح issue/ADR است.
6. تست، coverage، بودجهٔ حجم، قواعد امنیتی و checks برای سبزشدن حذف/skip/تضعیف نشوند. allowlist بدون دلیل، مسئول و مسیر حذف مجاز نیست.
7. artifactهای بزرگ مانند dist، trace، گزارش مرورگر، VSIX و tarball در Git نگه‌داری نشوند؛ فقط در storage/artifact CI با retention مشخص. fixture کوچک و baseline لازم با روش موجود مخزن ثبت شود.
8. GitHub از `gh` و Git محلی از `git` استفاده کند؛ credentials در فایل/چت ثبت نشود. نیاز به دسترسی مدیر از مالک پیگیری شود، نه با فرض موفقیت.

### گیت مشترک پایان هر کارت: G

تمام معیارهای مخصوص کارت **به‌اضافهٔ G** لازم‌اند:

- [ ] تست مثبت رفتار واقعی و تست منفیِ نشان‌دهندهٔ شکست گیت نوشته و اجرا شده؛ smoke/string check جای integration لازم را نگرفته است.
- [ ] lint/typecheck/build و تست‌های حوزهٔ متأثر سبزند؛ در پایان هر batch، سوئیت کامل و checks مرتبط CI روی همان SHA سبزند.
- [ ] README/TSDoc/مثال/migration/changeset و snapshotهای متأثر به‌روزند؛ تغییر API ناخواسته صفر است.
- [ ] dependency graph، peer singleton، بسته‌بندی، size/tree-shaking و SSR/dispose در دامنهٔ تغییر رگرسیون ندارند.
- [ ] شواهد شامل SHA، نام تست، دستور و کد خروج، لینک run و artifact لازم ثبت شده؛ نتیجهٔ CI متعلق به commit قدیمی به‌عنوان شاهد تغییر جدید استفاده نشده است.
- [ ] برای کار بیرونی، مدرک واقعی تأیید وجود دارد. در نبود آن وضعیت «بخش کد آماده؛ منتظر مالک» باقی می‌ماند؛ تست mock اثبات فعال‌شدن تنظیم واقعی نیست.

### گیت مشترک پکیج جدید: P

هر کارت پکیج جدید علاوه بر G، معیار §۶.۲ `NEW-PACKAGES-SPEC.md` را کامل کند:

- [ ] manifest/exports/target/نسخه مطابق DEC معتبر، README نصب/گزینه/attribute، LICENSE، changelog و مرجع API وجود دارد.
- [ ] Options دارای schema، DEFAULTS منجمد، TSDoc پیش‌فرض/واحد و تست ورودی نامعتبر است.
- [ ] factory دارای dispose است؛ cleanup چندبار اجرا، حذف DOM وسط کار و نشت listener/timer/subscription آزموده شده‌اند.
- [ ] کدهای خطا در catalog/صفحات، DirectiveMeta و metadata تولیدی ثبت‌اند.
- [ ] SSR/hydration یا client-only صریح؛ a11y واقعی برای UI؛ هیچ any عمومی، console مستقیم، خطای خام یا randomness امنیتی ضعیف وجود ندارد.
- [ ] API report امضادار، package lint/attw/pack/install-import، بودجهٔ gzip و آزمون import مستقل سبزند.
- [ ] ماتریس Node و مرورگر **متناسب با target** اجرا می‌شود؛ استثنای محیطی فقط با دلیل فنی مصوب، نه skip خاموش. نسخهٔ Node ابزار build با کف runtime کتابخانه اشتباه نشود.

## ۲. نقش‌ها، موج‌ها و ترتیب وابستگی

نقش‌های زیر **مسئولیت پیشنهادی** هستند، نه ادعای وجود تیم یا مجوز فعلی:

| نقش | مسئولیت |
|---|---|
| مجری کد | پیاده‌سازی، تست، مستند، migration و ثبت شواهد |
| بازبین هسته/API | قراردادها، SSR، public surface، سازگاری و اندازه |
| بازبین امنیت | nonce/CSP، dependency audit، auth، transport و یافته‌های ممیز |
| QA مرورگر/a11y | سناریو واقعی مرورگر/IDE، RTL، screen reader و regression |
| مالک/مدیر | npm/GitHub/فروشگاه‌ها/دامنه، نگه‌دارندگان واقعی و تصمیم‌های تغییر دامنه |
| ممیز مستقل | ارزیابی بیرونی و بازآزمایی یافته‌های #61 |

### ترتیب اجرایی پیشنهادی

| موج | ترتیب کار | شرط خروج |
|---|---|---|
| W0 — شروع | ثبت baseline، R01/R02 اولیه، بازاعتبارسنجی چهار مورد تکمیل‌شده؛ آغاز بیرونی #77/#107/#80/#61 | موجودی و مسئول‌ها روشن؛ گیت قرمز پنهان نشده |
| W1 — خطر فوری | #13؛ hotfix nonce/abort از #156/#157؛ مهار reject provider در #155؛ سپس تست اثبات #154 | nonce ثابت و reject رهاشده رفع؛ موجودی audit و transport صادقانه ثبت شده |
| W2 — زیرساخت قرارداد | #51؛ bootstrap #56/#57/#38؛ scaffold تست #159 و harness #166؛ شروع #39/#40 | ابزارهای سنجش واقعی API/type و ساخت ابزارها برقرار |
| W3 — ایزولاسیون و مهاجرت | #118 → #139؛ #55؛ #120؛ تکمیل #159 و refactor #40 | قرارداد/registry سراسری و API مهاجرتی آزموده شده |
| W4 — پایه‌های UI/SSR | #151 و #152؛ سپس #174؛ #100؛ تکمیل #132 و #67 | UI پایه و head/locale مستقل، تست واقعی CSP/a11y |
| W5 — قابلیت و استقرار | #154/#155؛ #156/#157؛ #153 به دو batch؛ #88؛ نهایی‌سازی #56/#57/#38/#39 | پکیج‌های واقعی و deploy adapterها، بدون اسکلت نمایشی |
| W6 — DX و آزمون کاربردی | #164 → #110؛ #167؛ #158؛ #160؛ #111؛ تکمیل #109؛ #165/#166؛ #163 | پروژهٔ مصرف‌کنندهٔ ساخته‌شده با ابزارهای واقعی اجرا می‌شود |
| W7 — دمو و سخت‌سازی | #113 → #33 → #114؛ #95؛ #63؛ #86/#90؛ #103 | دمو/قالب/SSR زیر محدودیت واقعی، اسناد و گیت‌های عملکرد قابل اتکا |
| W8 — عرضه و خاتمه | ممیزی نهایی #61؛ تکمیل بیرونی #66/#77/#80/#97/#107؛ R01–R08؛ #176–#186 | تمام شروط انتشار و شواهد بیرونی برقرار؛ موارد معوق صریحاً باز |

**نکات زمان‌بندی:** موج‌ها قفل آبشاری کامل نیستند. کارهای مستقل موازی شوند و هر کارت فقط منتظر پیش‌نیاز واقعی‌اش بماند. #56/#57/#38 و #159/#166 دو مرحله دارند: ابتدا زیرساخت سنجش، سپس پاس‌شدن کل موجودی. نقص API legacy نباید مانع ساخت ابزار سنجش آن شود.

**زنجیره‌های حساس:**

- #118 → #152 → #174 → #156/#157 → #63/#163 → #61 نهایی.
- #151 → #132 و #153 → #100 نهایی/#33.
- #164 → #110 → #158/#109 نهایی؛ #158 + #113 + #165/#166 → #33 → #114/#90.
- #167 → دستور upgrade در #109 و code action در #160.
- bootstrap #56 → baseline امضا برای #40؛ bootstrap #57 → زیرمسیرها؛ پایان #56 بعد از انتقال‌ها.
- #77 + #107 + #80 → راه‌اندازی واقعی #66؛ #67 + #51 → بستهٔ #97.

## ۳. اولین batch؛ کارهایی که باید ابتدا انجام شوند

1. SHA و issueهای زنده را ثبت کنید؛ `npm ci` و گیت‌های بخش ۷ را اجرا و آمار جدید را جایگزین آمار تاریخی نکنید مگر در جدول snapshot تازه.
2. برای nonce ثابت تست دو پاسخ مستقل بنویسید؛ Node و Edge باید nonce متفاوت با entropy امن داشته باشند و header/HTML هر پاسخ همسان باشند. hotfix را از استخراج پکیج جدا کنید.
3. برای Promise ردشدهٔ provider تست `unhandledRejection`/`unhandledrejection` بنویسید و باگ را بدون لو دادن props حساس اصلاح کنید.
4. audit prod/dev را با dependency path و advisory ثبت کنید؛ ابتدا critical/high، سپس #13 و ماتریس Vite را اصلاح کنید.
5. برای #154 یک تست ارسال واقعی به transport بنویسید؛ شکست فعلی مستند شود. تا رفع کامل، API به‌عنوان «transport آمادهٔ production» معرفی نشود.
6. درخواست‌های مالک برای npm/access/ممیز را هم‌زمان آغاز کنید؛ منتظر اتمام تمام کدنویسی نمانید.
7. پایان batch: گیت G، خلاصهٔ progress و شواهد؛ سپس batch بعدی. هیچ issue صرفاً به دلیل انجام یک گام میانی بسته نشود.

## ۴. کارت‌های اجرایی؛ ۴۸ issue

شمارهٔ issue در عنوان هر کارت است؛ لینک مرجع همهٔ شماره‌ها: `https://github.com/legionir/zenith-v1.4.0/issues/<number>`.

### #13 — audit dev و ارتقای زنجیرهٔ Vite

**زمان/مسئول:** W1، مجری کد + بازبین امنیت؛ بدون پیش‌نیاز.

**گام‌ها:**
1. audit JSON prod/dev و `npm ls` را ذخیره؛ dependency path و exploitability هر مدخل فعلی را ثبت کنید. عدد ۱۰ فقط baseline است، نه فهرست ثابت آینده.
2. Vite/Vitest/esbuild و زنجیره‌های lint-staged/glob/tinypool را به نسخه‌های پشتیبانی‌شدهٔ رفع‌شده ارتقا دهید؛ override ناسازگار/`--force` کور ممنوع.
3. peer range افزونه و ماتریس CI را با نسخه‌های واقعاً سازگار هماهنگ کنید؛ اگر ابزار جدید Node بالاتر می‌خواهد، تصمیم کف runtime/build را ثبت کنید، نه تغییر بی‌صدای engines.
4. install پاک و build/unit/browser/plugin integration را روی majorهای اعلام‌شده اجرا کنید؛ تصمیم خروج major آسیب‌پذیر از پشتیبانی در migration ثبت شود.

**آزمون:** audit prod/dev، پروژهٔ Vite واقعی روی حداقل دو major پشتیبانی‌شده؛ تست خطای نصب peer نامعتبر.

**معیار پذیرش:**
- [ ] advisory باز بدون تصمیم وجود ندارد؛ هدف audit کامل صفر است. استثنا فقط با advisory، دلیل، مسئول، تاریخ انقضا و تأیید امنیت، مطابق مجوز خود issue؛ critical/high بدون رفع، انتشار را متوقف کند.
- [ ] حداقل دو major پشتیبانی‌شده CI سبز دارند؛ خروجی کتابخانه و peer compatibility سالم‌اند. نیاز #110 به ۶/۷/۸ جداگانه نیز تعیین تکلیف شده است.

### #38 — حذف any از سطح عمومی واقعی

**زمان/مسئول:** W2 bootstrap تا W5 نهایی، بازبین هسته/API؛ bootstrap #56 کمک‌کننده است، نه مانع شروع.

**گام‌ها:**
1. auditor مبتنی بر TypeScript روی declaration تولیدشده بسازید؛ re-export، generic، method، callback و زیرمسیرها را دنبال کند؛ اسکن barrel فعلی به‌تنهایی مبنا نباشد.
2. baseline any عمومی/داخلی را جدا ثبت کنید؛ ابتدا Auth/Store/Resource/BindContext را با generic/unknown و narrowing مهاجرت دهید.
3. تست نوع مصرف‌کنندهٔ مستقل با inference و بدون cast اضافه؛ no-explicit-any در source عمومی error شود.
4. anyهای داخلی موقت را با دلیل محلی و شمارش AST نگه دارید؛ ratchet نزولی تا سقف هدف و گیت CI declaration اضافه شود.

**آزمون:** fixture منفی any در typeِ re-exportشده، generic callback و زیرمسیر؛ build پاک و typecheck پروژهٔ نصب‌شده از tarball.

**معیار پذیرش:**
- [ ] در امضای عمومی تمام `.d.ts/.d.cts` منتشرشدنی **صفر AnyKeyword/any صریح**؛ internalها از public graph عبور نکنند.
- [ ] any داخلی ≤۱۰۰، هر باقی‌مانده دارای توجیه؛ افزودن any عمومی در fixture گیت را قرمز می‌کند؛ inference نمونهٔ مصرف‌کننده بدون cast پاس است.

### #39 — تکمیل مهاجرت logger

**زمان/مسئول:** W2–W5، مجری کد؛ logger موجود، پس از انتقال ابزارها در #51 مسیرها دوباره بررسی شوند.

**گام‌ها:**
1. ۹ فایل معاف baseline را موجودی‌برداری؛ diagnostic، log و stdout قراردادی CLI را تفکیک کنید.
2. consoleهای diagnostic را به logger منتقل کنید؛ CLI machine output از writer صریح stdout عبور کند، نه console؛ templateهای تولیدی نیز اسکن شوند.
3. no-console را بدون معافیت فایل legacy فعال و ratchet را خالی کنید؛ consoleSink تنها محل مجاز باشد.
4. قالب log، سطح production و redaction اطلاعات حساس را یکسان کنید.

**آزمون:** capture console/stdout با level=silent؛ CLI --json بدون آلودگی؛ اسکن AST template تولیدشده و تست sink.

**معیار پذیرش:**
- [ ] console اجرایی در source/قالب تولیدی فقط در sink مجاز؛ فهرست معافیت legacy صفر است.
- [ ] حالت silent هیچ diagnostic در console نمی‌نویسد؛ خروجی دادهٔ CLI همچنان صحیح است؛ خطای تولیدی credential چاپ نمی‌کند.

### #40 — شکستن فایل‌های بزرگ بدون تغییر رفتار

**زمان/مسئول:** W2–W3 و پس از extractionها، مجری کد + بازبین API؛ پیش‌نیاز: baseline امضادار bootstrap #56.

**گام‌ها:**
1. برای auth/runtime/crud/walker/form/runtime-core نقشهٔ types/core/internal و مسئولیت ماژول‌ها بنویسید؛ ابتدا تست‌های رفتاری فعلی را قفل کنید.
2. refactor هر حوزه را جدا و بدون تغییر رفتار انجام دهید؛ تغییر auth یا directive را در commit رفتاری مستقل از جابه‌جایی کد بگذارید.
3. barrelها را ثابت نگه دارید و API report قبل/بعد، import cycle و size را مقایسه کنید.
4. ESLint max-lines با سقف ۴۰۰ و روش شمارش روشن فعال شود؛ فایل تولیدشده/استثنای توجیه‌شده جدا از source دستی باشد.

**آزمون:** سوئیت حوزه، API diff، build از dist خالی، size-limit و deps.

**معیار پذیرش:**
- [ ] source دستی >۴۰۰ خط بدون استثنای مکتوب و بازبین وجود ندارد؛ استثنا برای دورزدن refactor ایجاد نشده است.
- [ ] refactor محض هیچ تغییر امضای عمومی، snapshot رفتاری یا افزایش اندازهٔ bundle همان حوزه ندارد؛ تست‌ها بدون تضعیف سبزند.

### #51 — ابزارها بیرون packages و build صریح

**زمان/مسئول:** W2، مجری زیرساخت؛ پیش از #67/#97/#160 نهایی.

**گام‌ها:**
1. devtools-extension و vscode-extension را به `tools/` یا `apps/` منتقل؛ انتخاب را در DEC و architecture ثبت کنید.
2. manifest و build/lint/package واقعی برای هر ابزار؛ workspaces، tsconfig، aliasهای تست، CODEOWNERS و workflowها را تطبیق دهید.
3. root build برای libraries و tools مسیر صریح و مستند داشته باشد؛ skip خاموش vscode حذف شود.
4. اسکریپت‌های discovery پکیج/API/size را اصلاح کنید تا ابزار را نه کتابخانهٔ npm حساب کنند نه بی‌صدا جا بیندازند.

**آزمون:** build پاک ابزارها و libraries؛ جستجوی مسیر قدیمی؛ dry-run بسته‌بندی ZIP/VSIX.

**معیار پذیرش:**
- [ ] `packages/` فقط پکیج‌های انتشارپذیر هدف را دارد؛ هیچ ارجاع شکسته به مسیر قدیمی نیست.
- [ ] build هر دو ابزار در CI اجرا و شکست عمدی build ابزار باعث شکست job می‌شود؛ دستور جدا اگر وجود دارد صریحاً در root workflow فراخوانی شده است.

### #55 — حذف تنظیمات positional باقی‌مانده

**زمان/مسئول:** W3، بازبین API؛ هماهنگ با #120 و #159.

**گام‌ها:**
1. ۱۱۳ ردیف allowlist را به «دادهٔ واقعی»، «legacy deprecated» و «تنظیمات نیازمند مهاجرت» تقسیم؛ فقط دستهٔ اول معاف باشد.
2. برای تنظیمات از جمله locale در formatDateTime و پارامترهای formatting امضای options بسازید؛ overload قدیم @deprecated و warning یک‌باره داشته باشد.
3. auditor به‌جای «وجود هر Options» معنای پارامترهای تنظیماتی قبل/بعد را بررسی کند؛ public re-exportها و overloadها را پوشش دهد.
4. rule ESLint از همان منبع طبقه‌بندی استفاده کند؛ نمونه‌ها/codemod به‌روز شوند. حفظ positional در دسته‌ای خاص فقط با اصلاح دامنهٔ مصوب issue مجاز است.

**آزمون:** old/new نتیجهٔ یکسان؛ warning یک‌باره؛ fixture `fn(value, locale, options)` و overload جدیدِ متخلف گیت را بشکنند.

**معیار پذیرش:**
- [ ] تمام تنظیمات positional یا مهاجرت کرده‌اند یا deprecated هستند؛ هیچ استثنای «داده» در واقع تنظیم اختیاری نیست.
- [ ] امضای عمومی جدید با تنظیم positional رد می‌شود؛ allowlist بدهی تنظیماتی صفر و تست سازگاری سبز است.

### #56 — public API رسمی و report امضادار

**زمان/مسئول:** W2 bootstrap، W5 نهایی؛ بازبین API؛ خروجی #57/#174 و extractionها در نهایی‌سازی مصرف شود.

**گام‌ها:**
1. api-extractor را روی declarationهای واقعی برای entrypoint و زیرمسیرها برقرار؛ report شامل نام، امضا، generic، member و release tag تولید کنید. snapshot فعلی نام‌ها فعلاً باقی بماند.
2. تمام exportها را public/internal/experimental/beta/deprecated طبقه‌بندی کنید؛ default-public ضمنی را حذف کنید.
3. internalها از جمله Parser/lex/domAls/global getters و hydrate helperهای داخلی را به زیرمسیر منتقل کنید؛ سازگاری نسخهٔ جاری با bridge deprecated و برنامهٔ حذف major مدیریت شود.
4. CI report را با نسخهٔ ثبت‌شده مقایسه کند؛ تغییر عمدی نیازمند review و changeset باشد.

**آزمون:** تغییر نوع پارامتر بدون تغییر نام، حذف member و نشت internal در fixture باید gate را بشکند؛ نصب از tarball.

**معیار پذیرش:**
- [ ] تمام پکیج‌ها و entrypointهای عمومی report `*.api.md` دارند و همهٔ release tagها صریح‌اند.
- [ ] API پایدار فقط public است؛ legacy bridgeها جدا و deprecatedاند. اگر معیار «حذف کامل از root» با سازگاری نسخهٔ جاری تعارض دارد، issue تا major مصوب یا تغییر معیار رسمی باز می‌ماند؛ bridge به‌عنوان حذف کامل جا زده نمی‌شود.
- [ ] drift امضا/type/member واقعاً CI را قرمز می‌کند، نه فقط تغییر نام export.

### #57 — exports و build شرطی

**زمان/مسئول:** W2 bootstrap تا W5 نهایی، مجری build + بازبین API.

**گام‌ها:**
1. جدول target/شرط/زیرمسیر را بر اساس مصرف واقعی بسازید؛ محیط پشتیبانی‌نشده صریح باشد، نه export دروغین.
2. `scripts/lib/exports-shape.mjs` و build/standardizer را برای dev/prod و browser/node/worker متناسب با target گسترش دهید؛ `./package.json` و مسیرهای internal/experimental/testing مورد نیاز تعریف شوند.
3. شاخه‌های dev در production با define حذف شوند؛ sideEffects/types/import/require به فایل موجود برسند و singleton state شکسته نشود.
4. consumer fixture برای Node ESM/CJSِ پشتیبانی‌شده و bundler/runtimeهای درخواستی بسازید.

**آزمون:** resolve هر entry/condition در Node و حداقل یک bundler؛ Vite/webpack/esbuild و Deno/Worker مطابق دامنهٔ issue؛ اسکن production برای `__ZENITH_DEV__` و هشدار dev.

**معیار پذیرش:**
- [ ] هر شرط/زیرمسیر تعریف‌شده فایل، type و تست resolve دارد؛ محیط ناسازگار fallback اشتباه ندارد.
- [ ] production فاقد شاخهٔ dev؛ publint/attw تمام پکیج‌های مشمول بدون خطا؛ dual import/require تک‌نمونه‌بودن هسته را حفظ می‌کند.

### #61 — ممیزی مستقل بیرونی

**زمان/مسئول:** آغاز W0، اجرا پس از تثبیت امنیت، پایان W8؛ مالک + ممیز مستقل.

**گام‌ها:**
1. بستهٔ AUDIT-PACKAGE را با SHA و دامنهٔ sanitizer/expressions/auth/http/SSR/CSP و یافته‌های جدید به‌روز کنید.
2. مالک ممیز مستقل، دسترسی امن، زمان‌بندی و کانال گزارش خصوصی را تعیین کند؛ داخلی/AI به‌عنوان مستقل معرفی نشود.
3. ممیز روی candidate ثابت ارزیابی کند؛ findings با شدت/بازتولید/مسئول پیگیری و اصلاحات با تست ثبت شوند.
4. re-test ممیز روی اصلاحات و خلاصهٔ عمومی بدون اطلاعات exploit حساس تهیه شود؛ تغییر امنیتی پس از ممیزی دوباره ارزیابی گردد.

**آزمون/شواهد:** گزارش تاریخ‌دار ممیز، SHA دامنه، retest findings و لینک خلاصهٔ عمومی.

**معیار پذیرش:**
- [ ] گزارش مستقل واقعی دریافت شده؛ تمام Critical/High رفع و توسط ممیز بازآزمایی شده‌اند.
- [ ] خلاصهٔ عمومی و محدودیت‌ها لینک دارند؛ موارد پایین‌تر مالک/مهلت دارند. نبود قرارداد/گزارش = باز، نه «انجام شد».

### #63 — CSP سخت‌گیرانه و Trusted Types واقعی

**زمان/مسئول:** W7، بازبین امنیت + QA؛ پیش‌نیاز: hotfix nonce، #174/#156/#157 و قالب‌های #158.

**گام‌ها:**
1. fixture سرور با header واقعی nonce/strict CSP و TrustedTypes enforced بسازید؛ CSP فقط report-only یا meta آزمایشی نباشد.
2. runtime/compiler/SSR/Vite و templateها را از inline handler، script/style بدون nonce و sink نامجاز پاک کنید؛ nonce امن را تا HTML عبور دهید.
3. تمام `securitypolicyviolation`ها و reportها را جمع و fail کنید؛ خطای عمدی گیت را بیازماید.
4. دو دمو، قالب‌های SPA/PWA/SSR و hydration/تعامل را زیر policy اجرا؛ راهنما با policy اجراشده یکسان شود.

**آزمون:** Chromium برای TrustedTypes، تمام موتورهای پشتیبانی‌کننده برای CSP؛ zen-html/JSON-LD/SSR state و payloadهای XSS؛ مرورگر فاقد TT به‌صورت capability روشن گزارش شود.

**معیار پذیرش:**
- [ ] بدون unsafe-eval/unsafe-inline، صفر violation در سناریوهای واقعی؛ هر script مجاز nonce منطبق یا منبع self مجاز دارد.
- [ ] با `require-trusted-types-for 'script'` sink بدون policy رد و sink مجاز کار می‌کند؛ تست منفی واقعاً fail می‌شود؛ CI artifact و راهنمای نصب وجود دارد.

### #66 — Trusted Publishing و provenance

**زمان/مسئول:** آماده‌سازی W2، نهایی W8؛ مالک + مجری CI؛ پیش‌نیاز بیرونی #77/#80/#107 و تأیید انتشار.

**گام‌ها:**
1. workflow تگ را برای build/test/package gates، id-token حداقلی، محیط release و provenance بررسی کنید؛ npm client پشتیبان OIDC در CI انتخاب و نسخه ثبت شود.
2. مالک environment با reviewer معتبر و Trusted Publisher متناظر با repo/workflow/environment را در npm تنظیم کند؛ فهرست secrets فقط به‌صورت نام/وضعیت بررسی شود، مقدار خوانده/ثبت نشود.
3. مسیر token بلندمدت حذف و dry-run انتشار روی tarballها آزموده شود؛ tag نامعتبر و محیط تأییدنشده باید متوقف شوند.
4. فقط پس از اجازهٔ صریح انتشار، مالک release واقعی انجام و نشان provenance/attestation را راستی‌آزمایی کند.

**معیار پذیرش:**
- [ ] OIDC واقعی و عدم وابستگی به token بلندمدت تأیید شده؛ انتشار فقط از تگ و محیط محافظت‌شده ممکن است.
- [ ] بستهٔ منتشرشده provenance قابل راستی‌آزمایی دارد. dry-run به‌تنهایی کافی نیست؛ تا مجوز/شاهد انتشار، بخش بیرونی باز می‌ماند.

### #67 — تأیید واقعی امنیت افزونه‌ها

**زمان/مسئول:** W4، QA مرورگر/IDE + امنیت؛ پیش‌نیاز #51.

**گام‌ها:**
1. مرورگر Chromium با extension واقعی و VS Code Extension Host با webview واقعی را در CI اجرا کنید؛ تست schema واحد حفظ شود.
2. پیام معتبر/نامعتبر، sender متقلب، prototype pollution، payload بزرگ و دادهٔ HTML را از مسیر واقعی به پنل بفرستید.
3. CSP violation، console error و DOM injection را capture کنید؛ nonce تازه در هر webview و عدم inline handler را تأیید کنید.
4. style inline را در صورت هدف سخت‌گیرانه به stylesheet/nonce منتقل یا استثنای style را با policy واقعی و محدودیت صریح مستند کنید؛ ادعای «بدون unsafe-inline» با وجود استثنا ممنوع.

**معیار پذیرش:**
- [ ] panelها و webview واقعی بدون CSP violation اجرا می‌شوند؛ پیام نامعتبر هیچ DOM/عمل ناخواسته ایجاد نمی‌کند.
- [ ] payload غیرقابل‌اعتماد script اجرا نمی‌کند؛ artifact اجرای مرورگر/IDE روی SHA موجود است؛ تست string-only شاهد نهایی نیست.

### #77 — مالکیت نام و scope

**زمان/مسئول:** W0 آغاز، پیش از #66/#158 انتشار؛ مالک npm + بازبین نام‌گذاری.

**گام‌ها:**
1. نام‌های @zenith، umbrella، create-zenith و unplugin را زنده بررسی کنید؛ 404 پکیج را با مالکیت scope برابر ندانید.
2. مالک سازمان/نام‌ها را با حداقل دو مالک واقعی و 2FA تأیید یا نام جایگزین قطعی انتخاب کند؛ بررسی تعارض برند/علامت ثبت شود.
3. اگر تغییر نام لازم شد، migration واحد manifest/import/docs/template/release را dry-run و سپس با تست مصرف‌کننده اعمال کنید.
4. سند نام نهایی و شاهد دسترسی بدون اطلاعات حساس ثبت شود.

**معیار پذیرش:**
- [ ] مالکیت نام‌های نهایی، دو مالک و 2FA با مدرک مدیریتی تأیید شده است.
- [ ] fixture ایجاد پروژه و publish dry-run نام نهایی را مصرف می‌کند؛ نام‌های قدیمی فقط در migration/alias مجاز باقی‌اند؛ تعارض تأییدنشده صفر است.

### #80 — حفاظت شاخه و merge

**زمان/مسئول:** W0 شروع، W8 نهایی؛ مدیر GitHub؛ پیش‌نیاز شناسایی مالک معتبر #107.

**گام‌ها:**
1. branch پیش‌فرض و checks واقعی را inventory؛ پاسخ 403 را به نیاز دسترسی تبدیل کنید، نه فرض نبود protection.
2. CODEOWNERS معتبر برای حوزهٔ امنیت و بقیه؛ required checks، review مالک، منع bypass/force-push نامجاز و linear history یا merge queue مطابق سیاست تنظیم شود.
3. مدیر با PR آزمایشی قرمز و PR بدون approval، عدم امکان merge را اثبات کند؛ با تغییر commit، approval/check قدیمی قابل اتکا نباشد.
4. روش merge و recovery در CONTRIBUTING ثبت و دوره‌ای configuration drift کنترل شود.

**معیار پذیرش:**
- [ ] principal عادی بدون bypass نه با CI قرمز نه بدون review لازم merge می‌کند؛ مسیرهای امنیت reviewer مالک معتبر می‌خواهند.
- [ ] export تنظیمات یا شاهد مدیر و لینک PR آزمایشی موجود؛ تست حفاظت نیازمند ساخت/تعویض شاخه در همین نشست نیست و توسط مدیر در محیط مناسب انجام می‌شود.

### #86 — benchmark واقعاً بازتولیدپذیر

**زمان/مسئول:** W7، مجری performance + بازبین مستقل؛ بدون تغییر خاموش معیار ≤۵٪.

**گام‌ها:**
1. runner کنترل‌شده با CPU/نسخه/GC/مرورگر و warmup ثابت تعریف؛ مقایسهٔ روش batch، best/median و informational از claims قطعی جدا شود.
2. دادهٔ خام چند اجرای مستقل و baseline با SHA ثبت کنید؛ رقبا با build صحیح و workload معادل اجرا شوند.
3. برای اعداد ادعاشده، انحراف مطلق نسبت به baseline در هر اجرای مستقل و تعداد اجراها از قبل تعریف شود؛ پیشنهاد حداقل ۵ اجرا با محیط یکسان.
4. روش ناپایدار اصلاح شود؛ اگر عدد قابل تضمین نیست آن را ادعای بازتولید ≤۵٪ نکنید و تغییر دامنه فقط با تأیید issue/ADR؛ گیت strict واقعی جدا از advisory باشد.

**معیار پذیرش:**
- [ ] طبق معیار اصلی، `npm run bench` در محیط مرجع تمام اعداد مشمول را با خطای ≤۵٪ بازتولید می‌کند؛ حداقل ۵ اجرای مستقلِ ازپیش‌تعیین‌شده شاهد دارد، نه انتخاب بهترین run پس از دیدن نتیجه.
- [ ] هر عدد به script/SHA/environment و دادهٔ خام لینک دارد؛ انحراف عمدی fail می‌شود. اگر فقط بخشی از متریک‌ها این شرط را دارند، issue کامل بسته نمی‌شود مگر دامنه رسماً اصلاح شده باشد.

### #88 — lazy loading directiveهای سنگین

**زمان/مسئول:** W5، مجری runtime؛ پیش‌نیاز #120/#57 و استخراج UI مربوط.

**گام‌ها:**
1. date-picker/data-table/crud/virtual-repeat را از eager entry جدا؛ registry loader پویا با cache promise و chunk مستقل ایجاد کنید.
2. loader هنگام کشف attribute/تگ فعال شود؛ loading/error/retry، حذف DOM قبل از پایان import و dispose هنگام navigation مدیریت شوند.
3. SSR preload همگام/manifest سازگار داشته باشد؛ hydration منتظر وابستگی درست بماند و state دو بار bind نشود.
4. entry بدون directive و entry با directiveهای ترکیبی را اندازه‌گیری و مستند کنید.

**معیار پذیرش:**
- [ ] تست network صفحهٔ بدون هر directive دانلود chunk آن را نشان نمی‌دهد؛ اولین مصرف فقط یک بار آن را بار می‌کند.
- [ ] parity eager/lazy برای رفتار و cleanup، شکست import و hydration سبز؛ اندازهٔ ورودی اولیه کاهش مستند و بدون budget regression دارد.

### #90 — Web Vitals دموها

**زمان/مسئول:** W7، performance + QA؛ پیش‌نیاز #33/#113 و build دموها.

**گام‌ها:**
1. Lighthouse CI برای ecommerce/dashboard با build production، دادهٔ ثابت، CPU چهاربرابر و شبکهٔ 4G پیکربندی کنید.
2. LCP/CLS و Performance در چند run ثابت ثبت؛ برای INP جریان تعامل و Event Timing معتبر اضافه کنید؛ TBT به‌جای INP گزارش نشود.
3. font/cloak/layout shift/JS/chunk را اصلاح و قبل/بعد با همان پروفایل مقایسه کنید.
4. gate و artifact گزارش/trace در CI؛ اجرای local قابل بازتولید و روش تجمیع نتایج پیشاپیش مشخص باشد.

**معیار پذیرش:**
- [ ] هر دو دمو: LCP≤۲٫۵s، INP≤۲۰۰ms، CLS≤۰٫۱ و Performance≥۹۰ در پروفایل/روش ثبت‌شده.
- [ ] regression عمدی gate را قرمز می‌کند؛ INP فاقد interaction با عدد ساختگی جایگزین نشده است.

### #95 — graceful degradation

**زمان/مسئول:** W7، QA + مجری storage/runtime؛ پیش‌نیاز قالب/SSR قابل اجرا.

**گام‌ها:**
1. ماتریس بدون JS، بدون SW، IndexedDB غیرفعال و localStorage throw را برای دمو/SSR/قالب تعریف کنید؛ محتوای fallback و محدودیت هرکدام روشن باشد.
2. noscript/SSR مفید، ثبت SW قابل‌صرف‌نظر و storage memory fallback با حفظ error reporting امن تکمیل شود.
3. Playwright capabilityها را پیش از اجرای کد مسدود کند؛ fallback واقعی و خواندن/نوشتن داده آزموده شود.
4. خطای quota/private mode و ازبین‌رفتن persistence در reload مستند شود.

**معیار پذیرش:**
- [ ] در هر حالت هیچ exception/rejection مدیریت‌نشده‌ای نیست؛ بدون JS محتوا/پیام قابل‌استفاده وجود دارد، نه صفحهٔ خالی.
- [ ] نبود SW مانع boot نیست؛ storage بسته به قرارداد به memory تنزل می‌کند؛ همهٔ حالت‌ها در CI تست دارند.

### #97 — بسته و انتشار فروشگاهی devtools

**زمان/مسئول:** W8، مجری tools + مالک فروشگاه؛ پیش‌نیاز #51/#67.

**گام‌ها:**
1. build نسخه‌دار Chrome/Firefox، تنظیم browser_specific_settings و تفاوت‌های MV3 را پیاده کنید؛ lint و ZIP قابل بازتولید CI.
2. permissions/optional hosts، جمع‌آوری داده و privacy policy عمومی را با کد واقعی تطبیق دهید.
3. ZIP نصب‌شده در پروفایل پاک هر مرورگر با پیام/inspection واقعی تست شود؛ screenshot و راهنمای store آماده کنید.
4. مالک بسته‌ها را در Chrome Web Store و AMO ارسال، بازخورد ممیزی را رفع و لینک تأیید نهایی را ثبت کند.

**معیار پذیرش:**
- [ ] CI بستهٔ نصب‌پذیر نسخه‌دار و lint سبز تولید می‌کند؛ policy عمومی با رفتار افزونه یکسان است.
- [ ] هر دو فروشگاه تأیید/انتشار واقعی دارند و صفحهٔ store به policy لینک می‌دهد؛ صرف ZIP یا رسید ارسال، تکمیل issue نیست.

### #100 — RTL/LTR تمام کامپوننت‌ها

**زمان/مسئول:** W4 تا W7، QA UI؛ پیش‌نیاز #151 و تکمیل اجزای #153 برای آزمون نهایی.

**گام‌ها:**
1. ماتریس virtual-list افقی، date-picker، data-table، notifications و UI جدید را با dir ارثی/صریح و localeهای fa/ar/en تعریف کنید.
2. dir ثابت date-picker حذف؛ logical CSS، جهت scroll، icon و کلیدهای جهتی بر اساس جهت مؤثر حل شوند.
3. formatting/plural/date از Intl و locale مشخص استفاده کند؛ bidi isolation برای متن ترکیبی حفظ شود.
4. تست DOM، screenshot ثابت و keyboard برای هر خانهٔ ماتریس؛ font/viewport ثابت و تغییر جهت حین اجرا نیز تست شود.

**معیار پذیرش:**
- [ ] تمام کامپوننت‌های فهرست‌شده در RTL/LTR درست render و navigate می‌شوند؛ ArrowLeft/Right مطابق APG جهت می‌گیرند.
- [ ] تصویر/DOM مورد تأیید و تست CI هر دو جهت موجود؛ locale و timezone موجب تست flaky نشده‌اند.

### #103 — مرجع API کامل و سایت مستندات

**زمان/مسئول:** W7، مجری docs + API؛ پیش‌نیاز #56 نهایی و نام نهایی #77 برای انتشار.

**گام‌ها:**
1. TypeDoc را بر declaration/TSDoc عمومی برقرار؛ signature، generic، گزینه، default/unit و example را render کنید، نه فقط نام symbol.
2. README/صفحهٔ API همهٔ پکیج‌های انتشارپذیر و زیرمسیرها را inventory کنید؛ اعداد ثابت ۳۶/۴۳ حذف شوند.
3. gate export public بدون توضیح/مثال و لینک شکسته اضافه کنید؛ تست منفی export بی‌مستند باید fail کند.
4. سایت نسخه‌دار را در Pages با workflow build/deploy مستقل و لینک README منتشر کنید؛ preview PR و deploy اصلی تفکیک شوند.

**معیار پذیرش:**
- [ ] هر پکیج/زیرمسیر عمومی صفحهٔ امضا/گزینه/مثال و README دارد؛ export بدون TSDoc در CI رد می‌شود.
- [ ] سایت واقعی خودکار پس از merge به‌روز و لینک‌های عمومی/صفحات خطا معتبرند؛ deploy branch bundle جای سایت حساب نشده است.

### #107 — حاکمیت و نگه‌دارندگان واقعی

**زمان/مسئول:** W0 تا W8، مالک؛ همکار #80/#77.

**گام‌ها:**
1. اسناد موجود را با صاحبان واقعی مرور کنید؛ تیم‌های placeholder یا نامعتبر در CODEOWNERS جایگزین شوند.
2. مالک حداقل دو نگه‌دارندهٔ واقعی با نقش انتشار، پاسخ‌گویی امنیتی و جانشینی تعیین و دسترسی GitHub/npm را در تنظیمات اعمال کند.
3. کانال گزارش COC/security و RFC/changeset/PR را با افراد تعیین‌شده آزمایش کنید؛ Community profile کنترل شود.
4. MAINTAINERS سیاست مطلوب را از وضعیت تأییدشده جدا کند؛ شواهد دسترسی بدون secrets و اطلاعات شخصی غیرضروری ثبت شوند.

**معیار پذیرش:**
- [ ] CONTRIBUTING/COC/GOVERNANCE/ROADMAP کامل و Community checks مربوط معتبرند.
- [ ] دو نگه‌دارندهٔ واقعی دارای دسترسی لازم و CODEOWNERS معتبر تأیید شده‌اند؛ OIDC/2FA صرفاً ادعای متن نیستند و به مدرک #66/#77 ارجاع دارند.

### #109 — CLI چرخهٔ توسعه

**زمان/مسئول:** W6، مجری tooling؛ پیش‌نیاز #158/#164/#167 و API doctor.

**گام‌ها:**
1. dev/build/test را با process lifecycle، signal forwarding و انتخاب runner روشن وصل کنید؛ دستور غایب به fallback موفق ساختگی نرود.
2. upgrade به codemod واقعی وصل؛ doctor Node/نسخه/exports/config و duplicate physical state را بررسی کند.
3. خروجی renderer انسانی و JSON با schema نسخه‌دار جدا؛ stdout داده و stderr diagnostic باشد.
4. exit code ۰/۱/۲ و subprocess failure mapping مستند و fixtureهای CLI نصب‌شده از tarball اضافه شوند.

**معیار پذیرش:**
- [ ] تمام دستورهای خواسته‌شده در پروژهٔ واقعی اجرا و تست می‌شوند؛ Ctrl+C فرزند orphan نمی‌گذارد.
- [ ] doctor دو نسخهٔ واقعی state را تشخیص می‌دهد؛ --json قابل parse و بدون log اضافه است؛ exit codeهای مستند در موفقیت/خطای کاربر/سیستم درست‌اند.

### #110 — HMR، sourcemap و ماتریس Vite

**زمان/مسئول:** W6، مجری bundler؛ پیش‌نیاز #13 و #164.

**گام‌ها:**
1. wrapper Vite از هستهٔ unplugin استفاده کند؛ cache بر hash محتوا و گزینه‌ها و dependencyها، با invalidation واقعی.
2. HMR HTML با dispose قبلی و حفظ state برای updateهای سازگار؛ تغییر ناسازگار باید fallback صریح و مستند داشته باشد.
3. sourcemap زنجیرهٔ HTML→compiled→bundle با mappings غیرخالی تولید کنید.
4. fixture روی Vite 6/7/8 اجرا؛ اگر majorی امن/سازگار نیست، حذف رسمی آن از قرارداد به تصمیم مالک نیاز دارد، نه skip تست.

**معیار پذیرش:**
- [ ] ویرایش پشتیبانی‌شدهٔ HTML بدون reload صفحه و بدون از‌دست‌رفتن state اعمال می‌شود؛ ۱۰۰ update listener تکراری ایجاد نمی‌کند.
- [ ] خطای expression به file/line HTML درست اشاره دارد؛ cache با تغییر گزینه/محتوا باطل می‌شود؛ سه major درخواستی یا دامنهٔ جایگزین مصوب CI سبز دارند.

### #111 — type-safe template opt-in

**زمان/مسئول:** W6، compiler/LSP؛ پیش‌نیاز #160 و compiler contract، ادغام build با #164.

**گام‌ها:**
1. قرارداد اختیاری state type/schema برای compiler و LSP تعریف کنید؛ unknown identifier از undefined runtime جدا باشد.
2. expression AST را با scopeهای for/slot/action و انواع state تحلیل؛ نوع ناسازگار و نام ناشناخته diagnostic ZEN با span دقیق بدهند.
3. nearest-name suggestion و mapping HTML line/column اضافه؛ compiler و LSP یک engine مشترک مصرف کنند.
4. build fixture صحیح/نام غلط/نوع غلط و پروژهٔ بدون تعریف نوع را اجرا کنید.

**معیار پذیرش:**
- [ ] در حالت opt-in متغیر ناشناخته و نوع ناسازگار build را با file/line/code مناسب می‌شکنند؛ پیشنهاد نزدیک‌ترین نام تست دارد.
- [ ] حالت legacy بدون type definition بدون تغییر کار می‌کند؛ shadowing و scopeهای nested false positive ندارند.

### #113 — dashboard واقعی با mock API و RBAC

**زمان/مسئول:** W7، مجری demo + QA؛ پیش‌نیاز #139/#165 و router/permission موجود.

**گام‌ها:**
1. mock API داده‌محور برای کاربران/نقش‌ها/جلسه بسازید؛ دادهٔ اولیه deterministic باشد.
2. auth instance و permission واقعی به route guard و UI وصل؛ نقش‌ها و خطای 401/403 از API mock نیز اعمال شوند.
3. login/logout/refresh و دسترسی مستقیم URL با نقش غیرمجاز را پیاده کنید؛ کنترل UI جای مجوز سرور معرفی نشود.
4. README دقیقاً واقعی/نمونه بودن API و محدودیت امنیتی frontend را بیان کند.

**معیار پذیرش:**
- [ ] e2e حداقل نقش مجاز/غیرمجاز: صفحه، دکمه و URL مستقیم درست allow/deny می‌شوند؛ API mock عملیات غیرمجاز را رد می‌کند.
- [ ] boot و جریان‌ها بدون console error/rejection؛ دمو با یک دستور مستند و دادهٔ ثابت قابل اجراست.

### #114 — build دموها و Pages

**زمان/مسئول:** W7، مجری CI/demo؛ پیش‌نیاز #113/#33.

**گام‌ها:**
1. manifest تولیدشدنی تمام demos/ecommerce/dashboard/index ریشه و دستور build هرکدام بسازید؛ static demo نیز link/import validation داشته باشد.
2. build تمام دموها با پکیج‌های همین checkout در CI؛ شکست هر دمو باید job را بشکند.
3. deploy نسخهٔ production به Pages پس از merge main با base-path صحیح، فهرست دموها و لینک README.
4. smoke URLهای deployed و cache/version را بررسی کنید؛ bundle branch و سایت دمو دو محصول جدا باشند.

**معیار پذیرش:**
- [ ] همهٔ دموهای manifest بدون skip خاموش build و smoke می‌شوند؛ import به dist قدیمی/نسخهٔ npm تصادفی ندارند.
- [ ] پس از merge مجاز، آدرس زنده به SHA جدید اشاره و navigation/asset زیر Pages base-path صحیح است.

### #118 — registryهای app-scoped

**زمان/مسئول:** W3، مجری core؛ پیش از #139/#152/#174.

**گام‌ها:**
1. تمام registryها را inventory: actions/components/auth/permission/resource/store/server-component/directive/plugin و موارد devtools؛ ownership و key واحد تعریف شود.
2. storage هر registry به App/SsrContext تزریق شود؛ singleton قدیمی فقط wrapper روی defaultApp، نه منبع مشترک دو App.
3. register/get/has/list/unregister و Cleanup idempotent، replace safety و dispose مالک را استاندارد کنید.
4. resetForTesting فقط مسیر تست؛ dispose یک App نباید دیگری را پاک کند؛ aliasهای clear/reset قدیم هشدار بدهند.

**معیار پذیرش:**
- [ ] تست قراردادی روی تمام registryهای inventory و دو App با key یکسان، value متفاوت و dispose مستقل پاس است.
- [ ] ۱۰۰ درخواست همزمان state registry را نشت نمی‌دهند؛ resetForTesting تمام حالت‌های default آزموده‌شده را پاک می‌کند؛ clear قدیم warning یک‌باره دارد.

### #120 — امضای یکنواخت directive

**زمان/مسئول:** W3، مجری runtime/compiler؛ پیش‌نیاز BindContext و metadata موجود، هماهنگ با #55.

**گام‌ها:**
1. جدول همهٔ directiveها و legacy attribute/tag را به source binder و DirectiveMeta وصل کنید؛ missing mapping گیت باشد.
2. هر processX legacy wrapper deprecated روی `bindX(el, ctx): Cleanup` شود؛ context شامل state/eval/processChildren/app/cleanup مطابق قرارداد واحد باشد.
3. config فقط از parseConfigAttr/schema مشترک؛ warning مسیر قدیمی و semantic migration تست شود.
4. metadata/grammar/compiler/runtime/cookbook از جدول واحد تولید و allowlist directive-binder #55 کوچک شود.

**معیار پذیرش:**
- [ ] تمام directiveهای موجود binder استاندارد و Cleanup idempotent دارند؛ checker امضا، metadata و mapping کامل را می‌سنجد.
- [ ] JSON.parse مستقیم attribute صفر؛ attribute قدیمی با warning و رفتار برابر کار می‌کند؛ حذف DOM وسط async bind نشت نمی‌گذارد.

### #132 — نهایی‌سازی notifications

**زمان/مسئول:** W4، QA a11y + مجری notifications؛ پیش‌نیاز #151 و harness #166.

**گام‌ها:**
1. focus trap محلی را به primitive مشترک a11y با re-export سازگار وصل کنید؛ تست‌های ۲۲گانهٔ فعلی حفظ شوند.
2. fixture مرورگری اعلان واقعی با ۱۰۰ پیام، queue، confirm باز و timeout/hover/focus بسازید؛ به axe-core واقعی وصل کنید.
3. ترتیب focus/return-focus، Escape/Tab/Shift+Tab و reduced-motion/RTL را اجرا کنید.
4. QA روی screen reader منتخب با نام/نسخهٔ OS/مرورگر/ابزار، اعلان polite/assertive و confirm را بررسی و نتیجه ثبت کند.

**معیار پذیرش:**
- [ ] فقط maxVisible مرئی، صف درست تخلیه، alias قدیمی warning دارد؛ axe سناریوی فعال صفر serious/critical دارد.
- [ ] پیام زنده و dialog توسط screen reader طبق قرارداد خوانده می‌شوند؛ keyboard/focus و چند dialog نشت یا trap شکسته ندارند؛ گزارش دستی دارای محیط و SHA است.

### #139 — یک موتور auth با سازگاری قدیم

**زمان/مسئول:** W3، مجری auth + امنیت؛ پیش‌نیاز #118 و storage موجود.

**گام‌ها:**
1. AuthConfig واحد و instance canonical تعریف؛ endpoint/config قدیمی functional به آن map شود.
2. functional state/timer/token مستقل حذف و به default Auth delegation کند؛ APIهای قدیمی alias سازگار با warning/migration.
3. storage امن و refresh/logout هماهنگ BroadcastChannel/storage با loop suppression، scope و cleanup پیاده شود؛ MFA hook اختیاری مستند بماند.
4. compatibility tests برای هر دو سبک و Playwright دو تب واقعی با login/refresh/logout اضافه کنید.

**معیار پذیرش:**
- [ ] دو سبک قدیمی یک session و همان engine/config را مصرف می‌کنند؛ state/timer مستقل موازی نیست.
- [ ] logout/refresh دو تب را همگام می‌کند و cross-app/channel نشت ندارد؛ export canonical کاهش یافته و جدول مهاجرت/aliasها روشن است.

### #151 — پکیج مشترک a11y

**زمان/مسئول:** W4، مجری UI + QA؛ پیش‌نیاز runtime-core موجود؛ گیت P.

**گام‌ها:**
1. @zenith/a11y را scaffold و primitiveهای runtime-core را بدون یال چرخه‌ای استخراج؛ facade قدیم همان implementation را export کند.
2. API کامل focus/live/roving/inert/scroll/reduced-motion/useId/route-announcer و directiveهای spec؛ trap stack و scroll-lock شمارنده‌ای پیاده شوند.
3. useId با seed/counter per-App/request برای SSR و hydrate قطعی شود؛ client-onlyها روی سرور no-op مستند باشند.
4. router/notifications/transition و UI به همان نسخهٔ مشترک مهاجرت کنند.

**معیار پذیرش:**
- [ ] کل API/attributeهای spec و P برقرار؛ gzip≤۵KB؛ کیبورد Tab/Shift+Tab/Esc/Home/End و reduced-motion تست دارند.
- [ ] nested trap فعال درست، scroll lock با dispose هر مصرف‌کننده امن، ID سرور/کلاینت یکسان؛ axe مصرف‌کنندگان صفر serious/critical.

### #152 — head واکنشی و per-request

**زمان/مسئول:** W4، مجری SSR/UI؛ پیش‌نیاز #118؛ گیت P.

**گام‌ها:**
1. @zenith/head را با context صریح per-App/request استخراج؛ `_activeHead` module-global حذف یا فقط bridge defaultApp شود.
2. useHead ورودی MaybeSignal/getter، patch/dispose، title/meta/link/JSON-LD/attrs، dedupe و maxTags/nonce مطابق spec.
3. reconciliation DOM و adoption تگ SSR با data-zen-head و directiveها؛ router titleFromRoute وصل شود.
4. SSR generateFullPage از renderHead مشترک و peer اختیاری استفاده کند؛ facade قدیمی حفظ شود.

**معیار پذیرش:**
- [ ] P و gzip≤۳KB؛ دو درخواست و دو App هیچ title/meta مشترک ندارند؛ entry آخر اولویت و dispose rollback صحیح دارد.
- [ ] hydration تگ تکراری/متفاوت نمی‌سازد؛ `</script>` JSON-LD، URL/attribute نامجاز خنثی و nonce درست؛ تغییر signal واقعاً DOM را به‌روز می‌کند.

### #153 — UI headless کامل

**زمان/مسئول:** W5، مجری UI + QA؛ پیش‌نیاز #151/#100 پایه/transition/jalali؛ گیت P.

**گام‌ها:**
1. @zenith/ui و subpath مستقل/position مشترک؛ batch اول dialog/popover/tooltip/tabs با APG و رویدادهای spec.
2. batch دوم menu/accordion/combobox/date-picker؛ portal/date-picker از runtime به facade همان implementation منتقل شوند.
3. keyboard/typeahead/async filter، disabled، nesting، RTL، portal target و cleanup animation پیاده شود.
4. fixture واقعی هر component و interaction با axe/کیبورد؛ تست import مستقل و size کل.

**معیار پذیرش:**
- [ ] هر هشت component و position/autoUpdate و attributeهای spec پیاده و تست شده؛ اتمام batch اول به معنی بستن کل issue نیست.
- [ ] P، gzip کل≤۱۵KB؛ axe صفر serious/critical؛ stacking دو dialog، حذف وسط animation، navigation RTL و SSR/client-only مطابق قرارداد پاس‌اند.

### #154 — realtime واقعی، نه mock

**زمان/مسئول:** W1 تست اثبات، W5 پیاده‌سازی؛ مجری transport + امنیت؛ گیت P.

**گام‌ها:**
1. @zenith/realtime با transport تزریقی و پیاده‌سازی WebSocket/EventSource واقعی؛ receiveMockMessage به مسیر testing منتقل شود.
2. state machine اتصال/خطا/close، صف bounded، history و topic/events؛ ارسال open واقعاً روی socket انجام شود.
3. reconnect backoff+jitter، heartbeat timeout، auth first-message/subprotocol/query opt-in، maxMessageSize و AbortSignal.
4. zen-ws/zen-sse و metadata/plugin؛ facade http سازگار؛ SSR idle و اتصال پس از hydrate.

**معیار پذیرش:**
- [ ] سرور WS/SSE آزمایشی پیام رفت/برگشت واقعی دریافت می‌کند؛ قطع و وصل network reconnect واقعی با زمان‌بندی deterministic در unit و smoke شبکه دارد.
- [ ] dispose حین اتصال/retry تمام timer/listenerها را حذف؛ صف پر/heartbeat/parse error کد درست می‌دهد؛ ws ناامن production رد و token پیش‌فرض در URL نیست؛ P و gzip≤۵KB.

### #155 — analytics کامل و مهار Promise rejection

**زمان/مسئول:** W1 hotfix، W5 extraction؛ مجری analytics + امنیت؛ گیت P.

**گام‌ها:**
1. تست provider با throw و Promise.reject و dispose وسط flush بنویسید؛ dispatch async rejection را catch و با logger امن گزارش کند.
2. @zenith/analytics را استخراج؛ consent/DNT، batch/flush/sampling/redact/session و router autoPageViews مطابق spec تکمیل شوند.
3. zen-track و data-label قدیم از همان engine عبور کنند؛ payload/trigger/once/debounce حفظ و SSR no-op باشد.
4. providerهای gtag/plausible/beacon/console با transport mock و failure isolation آزموده شوند.

**معیار پذیرش:**
- [ ] بدون consent یا با DNT صفر درخواست و صفر صف دادهٔ شخصی؛ revoke consent صف را پاک می‌کند؛ SSR هیچ ارسال ندارد.
- [ ] throw و reject provider unhandled event ایجاد نمی‌کنند و provider سالم مستقل کار می‌کند؛ legacy attribute parity، batch/flush/sampling تست؛ P و gzip≤۳KB.

### #156 — adapter-node ایمن و عملیاتی

**زمان/مسئول:** W1 hotfix، W5 نهایی؛ مجری SSR + امنیت؛ پیش‌نیاز #174؛ گیت P.

**گام‌ها:**
1. nonce ثابت را با CSPRNG per-response جایگزین و تست header/HTML همسان بنویسید؛ abort اتصال را واقعاً به renderer/stream وصل کنید.
2. @zenith/adapter-node با createNodeHandler/createNodeServer/serveStatic استخراج؛ template outlet، health، timeout/error و logger requestId.
3. static path traversal دفاعی، cache/etag/compression، streaming backpressure، trusted proxy opt-in و graceful shutdown تکمیل شوند.
4. integration واقعی Node/Express/Fastify، client کند/abort، ۱۰۰ درخواست مستقل و shutdown با active request.

**معیار پذیرش:**
- [ ] ۱۰۰ درخواست همزمان state/head/locale مجزا؛ nonce پاسخ‌ها متفاوت و داخل هر پاسخ همسان؛ abort رندر را لغو و منبع‌ها آزاد می‌کند.
- [ ] stream مشتری کند حافظهٔ unbounded ندارد (بودجهٔ قبل/بعد آزمون از پیش ثبت شود)، shutdown درخواست فعال را تا timeout مصوب تخلیه می‌کند؛ template بد/timeout کد 1802/1801 و status درست؛ P.

### #157 — adapter-edge مستقل از Node DOM

**زمان/مسئول:** W1 nonce fix، W5 نهایی؛ مجری Edge/SSR؛ پیش‌نیاز #174 و refactor context صریح؛ گیت P.

**گام‌ها:**
1. nonce ثابت Edge اصلاح؛ entry renderer بدون jsdom/ALS با DOM صریح linkedom یا happy-dom و context per-request فراهم شود.
2. @zenith/adapter-edge با Fetch/Web Streams و handler Cloudflare/Deno؛ assets/waitUntil/timeout/abort مطابق spec.
3. bundler هیچ node:async_hooks/jsdom و Node-only fallback ناخواسته وارد worker نکند؛ renderToString Node مستقیم مسیر Edge نباشد.
4. Miniflare و Deno واقعی، ۱۰۰ درخواست و hydrate خروجی آزمایش شوند؛ عدم نصب DOM error مناسب بدهد.

**معیار پذیرش:**
- [ ] هر دو runtime واقعی ۱۰۰ درخواست بدون نشت state/head/locale و nonce تصادفی پاسخ می‌دهند؛ request.abort منابع را آزاد می‌کند.
- [ ] گراف bundle فاقد jsdom/node:async_hooks؛ bundle≤۱MB، کد adapter gzip≤۶KB؛ P و errorهای 1811/1812 آزموده‌اند.

### #158 — create-zenith و templates مستقل

**زمان/مسئول:** W6، مجری CLI/template؛ پیش‌نیاز #77 نام نهایی، #164/#156 برای قالب مرتبط؛ گیت P.

**گام‌ها:**
1. create-zenith و @zenith/templates داده‌محور را ایجاد؛ قالب‌های spa/ssr/pwa/dashboard/minimal فایل‌های واقعی باشند، نه literal تودرتوی escape‌پذیر.
2. flagهای spec برای TS، pm، install/git، force/dry-run/yes/json و اعتبارسنجی نام/پوشه پیاده شوند.
3. zenith create قدیم به همان engine وصل؛ install امن با argv بدون shell interpolation و محافظت مسیر/overwrite.
4. هر قالب در پوشهٔ موقت ساخته، با tarballهای همین SHA install، build، serve و browser تعامل شود.

**معیار پذیرش:**
- [ ] هر پنج قالب و مسیر standard/PWA در CI بدون console error build/boot می‌شوند؛ نام مخرب/پوشهٔ غیرخالی رد و بیرون cwd فایلی نوشته نمی‌شود.
- [ ] --dry-run صفر write/install/git دارد؛ JSON و exit ۰/۱/۲ صحیح؛ P و تست package managerهای اعلام‌شده موجود است.

### #159 — eslint-plugin قرارداد و قالب

**زمان/مسئول:** W2 bootstrap، W3 تکمیل؛ مجری lint؛ پیش‌نیاز API-CONVENTIONS/schema/expressions موجود.

**گام‌ها:**
1. @zenith/eslint-plugin با recommended/strict/library/template و جدول rule→بند قرارداد؛ rule محلی options-object استخراج شود.
2. تمام ruleهای کد spec و processor HTML/template literal با parse expression و mapping diagnostic به فایل اصلی.
3. ruleهای directive/option/key/conflict/forbidden identifier و a11y کامل؛ setting نسخه/پکیج و option schema هر rule.
4. مصرف در root و templateهای جدید؛ تخلف‌های فعلی رفع یا allowlist دقیق نزولی با مسئول ثبت شوند.

**معیار پذیرش:**
- [ ] برای **هر rule** حداقل ۵ valid و ۵ invalid در RuleTester؛ fixture template واقعی و location صحیح.
- [ ] تمام rule/configهای spec، نگاشت قرارداد و مثال خوب/بد وجود دارند؛ rule تزئینی/no-op نیست؛ root/template CI با تخلف عمدی fail می‌شود؛ P.

### #160 — LSP واقعی و VS Code client نازک

**زمان/مسئول:** W6، مجری language tooling؛ پیش‌نیاز #51/#159 و metadata؛ code action مهاجرت بعد از #167.

**گام‌ها:**
1. regex/in-memory core فعلی را با LSP 3.17 transport/lifecycle/document incremental و engine مشترک diagnostics جایگزین/تکمیل کنید.
2. completion/hover/definition/references/rename/formatting/semantic tokens/actions/folding/links از metadata و state scope.
3. maxFileSize، cancellation، malformed input، logger و configها؛ VS Code فقط client، load server و webview بماند.
4. VSIX با vsce ساخته و در Extension Host نصب؛ diagnostics/completion/hover/rename و fuzz در CI؛ Marketplace با اختیار مالک.

**معیار پذیرش:**
- [ ] درخواست واقعی LSP برای قابلیت‌های spec نتیجهٔ معتبر دارد؛ directive تازه از metadata بدون تغییر completion دستی ظاهر می‌شود.
- [ ] VSIX نصب‌پذیر و client نازک؛ فایل ناقص/بزرگ server را crash نمی‌کند؛ تست‌های integration و P سبزند؛ انتشار Marketplace اگر در دامنهٔ issue است تا لینک تأیید واقعی باز می‌ماند.

### #163 — SSG مستقل با سایت hydrateپذیر

**زمان/مسئول:** W6، مجری SSG؛ پیش‌نیاز #174/#109 برای اتصال CLI؛ گیت P.

**گام‌ها:**
1. @zenith/ssg را از ssr/cli جدا؛ prerender/defineStaticRoutes و report قرارداد spec را حفظ کند.
2. crawl opt-in، concurrency، timeout، trailingSlash، sitemap/robots، static paths و outDir امن/قابل‌کنترل تکمیل شوند؛ CLI فقط IO.
3. سایت fixture چندمسیره با dynamic paths و head/i18n واقعی render کنید؛ echoRenderer فقط unit کمکی بماند.
4. خروجی static با وب‌سرور serve و hydration/تعامل واقعی آزمایش شود؛ route خطادار و traversal خروجی تست شوند.

**معیار پذیرش:**
- [ ] سایت چندمسیره HTML کامل، title/lang/dir صحیح و hydration بدون mismatch دارد؛ sitemap معتبر و مسیر خروجی امن است.
- [ ] failOnError خطای مسیر را nonzero می‌کند؛ حالت soft report کامل دارد؛ concurrency/timeout/robots/crawl تست شده و P برقرار است.

### #164 — unplugin روی پنج bundler

**زمان/مسئول:** W6، مجری bundler؛ پیش‌نیاز compiler پایدار و #57 زیرمسیرها؛ گیت P.

**گام‌ها:**
1. unplugin-zenith با هستهٔ compile/options واحد و subpath vite/rollup/webpack/esbuild/rspack ایجاد کنید.
2. include/exclude، strict، meta generation، watchPatterns، htmlHmr و devtools contract کامل شوند.
3. vite-plugin به wrapper نازک با mapping گزینهٔ قدیمی و deprecation بدل شود؛ compiler/options implementation دوم نسازید.
4. پروژهٔ fixture روی هر پنج bundler build و در مرورگر اجرا؛ dev/HMR فقط در محیط پشتیبانی‌شده با خطای مشخص برای ناسازگاری.

**معیار پذیرش:**
- [ ] پنج build/boot واقعی سبز؛ subpathهای نصب‌شده resolve می‌شوند؛ legacy vite config بدون تغییر کار می‌کند و warning لازم دارد.
- [ ] خطاهای bundler/HMR ناسازگار کد درست دارند؛ metadata تازه، P و tree-shaking سالم‌اند.

### #165 — mock شبکهٔ REST/WS و Service Worker

**زمان/مسئول:** W6، مجری testing/network؛ پیش‌نیاز shared؛ پیش از #113/#33 نهایی؛ گیت P.

**گام‌ها:**
1. @zenith/mock با createMockServer/rest/ws/respond/passthrough/delay و calls API؛ matcher و onUnhandledRequest مشخص.
2. installFetchMock در Node و setupWorker مرورگر با SW واقعی؛ use/reset/listen/close و restoration امن fetch/WS.
3. latency ثابت/بازه‌ای با clock/random تزریقی و record با redaction؛ double response و unhandled خطاهای spec.
4. testing.mockHttp به engine مشترک و dashboard/demo fixture متصل شوند؛ http/resource بدون تغییر مصرف کنند.

**معیار پذیرش:**
- [ ] REST و WebSocket واقعی mockشده، Node fetch و مرورگر SW کار می‌کنند؛ unhandled/error/warn/bypass و double response آزموده‌اند.
- [ ] latency/record/reset درست و close/dispose محیط اصلی را برمی‌گرداند؛ http/resource تست integration دارند؛ P.

### #166 — fixtureهای Playwright مصرف‌شده در محصول

**زمان/مسئول:** W2 harness، W6 کامل؛ مجری QA tooling؛ پیش‌نیاز #151/#153 برای مصرف نهایی؛ گیت P.

**گام‌ها:**
1. @zenith/testing-e2e با test.extend و mountApp/waitForHydration/getSignal/setSignal/axe/console/devtools snapshot پیاده کنید.
2. readiness/hydration از علامت واقعی app باشد، نه sleep ثابت؛ خطای page/console پیش از mount capture شود.
3. a11y rule/exclude/impact و hydrationTimeout/failOnConsoleError مطابق spec؛ cleanup هر تست مستقل.
4. e2e دموها و UI از fixtureها استفاده کنند؛ trace/report فقط شکست و artifact CI با retention ثبت شود.

**معیار پذیرش:**
- [ ] نمونهٔ mount→hydrate→interaction→axe پاس؛ hydration timeout، console.error و violation عمدی هرکدام fail واقعی می‌دهند.
- [ ] trace شکست ذخیره، signal/state بین تست‌ها نشت نمی‌کند؛ حداقل یک demo و component واقعی مصرف‌کننده‌اند؛ P.

### #167 — codemod و upgrade قابل اعتماد

**زمان/مسئول:** W6، مجری migration tooling؛ پیش‌نیاز قرارداد نهایی #55/#120/#139/#56؛ گیت پکیج مرتبط P.

**گام‌ها:**
1. @zenith/codemod با AST TS و parser HTML؛ transformهای destroy/process/clear/form/error/logger/cache/i18n/runtime-imports طبق spec.
2. تشخیص semantic/context و موارد ambiguous؛ import/comment/string حفظ و unsupported case به گزارش دستی file/line برود، نه rewrite حدسی.
3. --from/--to/--dry/--glob/--write/--report json/--check و exit status؛ اتصال zenith upgrade، LSP code action و migration guide.
4. fixture ورودی/خروجی برای هر transform؛ نسخهٔ sandbox ecommerce را migrate، install/build/test و بار دوم اجرا کنید.

**معیار پذیرش:**
- [ ] هر transform fixture و idempotency دارد؛ dry هیچ فایل/متادیتای پروژه را نمی‌نویسد؛ check در نبود تغییر ۰ و در نیاز به تغییر nonzero است.
- [ ] دمو migrated واقعاً build و boot می‌شود؛ ambiguousها با line گزارش و بدون corruption باقی می‌مانند؛ تکرار اجرا صفر diff دارد.

### #174 — SSR با App/head/i18n مستقل

**زمان/مسئول:** W4، مجری SSR/core؛ پیش‌نیاز #118/#152 و bootstrap #56/#57.

**گام‌ها:**
1. renderToString/Stream/ReadableStream از factory App تازه per-request و context صریح استفاده کنند؛ finally شامل dispose در success/error/abort.
2. head مشترک و i18n locale/messages/dir از همان request؛ serialization امن و hydration adoption یکسان؛ default global به request نشت نکند.
3. domAls/global getters و helperهای داخلی به /internal با برنامهٔ سازگاری مصوب #56 منتقل شوند.
4. ۱۰۰ render موازی با locale/title/messages متفاوت، stream، abort و hydration واقعی مرورگر اجرا کنید.

**معیار پذیرش:**
- [ ] title/meta/lang/dir و دادهٔ i18n خروجی درست؛ hydration هیچ mismatch/duplicate tag ندارد؛ ۱۰۰ request بدون نشت و dispose کامل.
- [ ] API report پایدار فقط قرارداد عمومی را نشان می‌دهد؛ bridge legacy اگر لازم است صریحاً deprecated و خارج از ادعای «حذف کامل» باشد. معیار #56 دربارهٔ major رعایت شود.

### #33 — e2e واقعی قالب‌ها و جریان‌های دمو

**زمان/مسئول:** W7، QA؛ پیش‌نیاز #158/#113/#165/#166 و مسیر build دموها.

**گام‌ها:**
1. تمام قالب‌ها را از CLI واقعی در directory موقت تولید؛ پکیج‌های همین SHA pack و از registry fixture/local tarball نصب کنید تا نسخهٔ منتشرنشده وابستگی پنهان نباشد.
2. install/build/start و snapshot فایل‌های template؛ plain و PWA شامل registration/offline/update مسیرهای مربوط تست شوند.
3. ecommerce login/cart/inventory/checkout و dashboard login/role/deny/logout با mock API، نه fixture counter، اجرا شوند.
4. fixtureهای testing-e2e، console/pageerror fail و trace به CI وصل؛ هر template/demo به سناریو نگاشت شود.

**معیار پذیرش:**
- [ ] هر قالب و مسیر standard/PWA واقعاً install/build/browser boot با صفر خطای مدیریت‌نشده دارد؛ snapshot و test case مستقل موجود است.
- [ ] جریان‌های اصلی تمام دموهای تعیین‌شده و RBAC درست اجرا می‌شوند؛ bug عمدی template/checkout CI را می‌شکند؛ jsdom/string check جای آن نیست.

## ۵. اصلاح گزارش‌های نوشته‌شده؛ R01 تا R08

این کارها issue اجرایی جدیدی را خودکار ایجاد نمی‌کنند؛ به #186 و issue مرتبط لینک داده شوند. هر کارت دارای output، مراحل و پذیرش است.

### R01 — baseline تاریخی AUDIT و PRODUCTION-READINESS

1. بالای هر سند تاریخ/SHA baseline قدیم و نقش سند را بنویسید؛ متن تاریخی را بی‌صدا به گذشتهٔ جعلی تبدیل نکنید.
2. جدول وضعیت زنده با SHA/run جدا ایجاد؛ build/test/lint/وجود فایل‌ها و advisoryهای روز از خروجی واقعی پر شوند.
3. یافته‌های رفع‌شده/جزئی/باز به issue و تست وصل شوند؛ ۰/۱۴ تست و lint=echo به‌عنوان وضعیت فعلی باقی نمانند.

**پذیرش:** [ ] هر ادعای «اکنون» تاریخ/SHA/شاهد دارد؛ baseline قدیم مشخص است؛ #13 باز و findings بسته درست جدا شده‌اند. گیت/بازبینی متن اعداد تولیدشدنی را با baseline انتخاب‌شده می‌سنجد.

### R02 — خلاصهٔ زندهٔ PROGRESS

1. سربرگ آخرین batch/SHA، CI، باز/بسته/blocked/needs-human را از منبع زنده پر کنید.
2. «کد/سند آماده» را از «پذیرش کامل» جدا؛ ادعاهای #61/#77/#154/#156/#157/#38/#67/#132 اصلاح شوند.
3. پایان هر batch خلاصه به‌روز و تاریخچهٔ موج‌ها تاریخی بماند؛ تعداد تست/پکیج به run خودش تعلق داشته باشد.

**پذیرش:** [ ] سربرگ با بدنه و وضعیت GitHub متناقض نیست؛ هیچ placeholder بیرونی «done» نشده؛ هر مورد کامل لینک تست/SHA/run دارد.

### R03 — architecture/standardization/spec

1. فهرست پکیج/exports/layer را از inventory تولید یا دارای SHA کنید؛ ابزارهای tools از libraries جدا شوند.
2. `STANDARDIZATION-PLAN` و `NEW-PACKAGES-SPEC` صریحاً هدف را از implementation موجود تفکیک کنند.
3. ماتریس package→manifest→API→test→budget→وضعیت §۶.۲ تهیه؛ تابع جاسازی‌شده برابر پکیج کامل نباشد.

**پذیرش:** [ ] اعداد ۳۶/۴۱/۴۳ قدیمی به‌عنوان جاری گزارش نمی‌شوند؛ هر package ادعاشده به manifest واقعی می‌رسد؛ گراف تولیدی تازه و یال‌های مجاز مستدل‌اند.

### R04 — BENCHMARKS

1. توضیح GC/probe، best/median، تعداد passes و advisory/strict را دقیقاً با implementation یکسان کنید.
2. عدد اطلاعاتی و عدد دارای تضمین بازتولید تفکیک؛ claim ≤۵٪ فقط برای شواهد #86 مجاز باشد.
3. generator و تست freshness/روش همزمان اصلاح شوند، نه فقط خروجی دستی.

**پذیرش:** [ ] عبارت‌های متناقض expose-gc و روش تجمیع صفر؛ هر عدد منبع و محیط دارد؛ تازگی سند با صحت روش اشتباه نشده است.

### R05 — A11Y-AUDIT و CSP-GUIDE

1. عنوان «ممیزی کامل» را تا شاهد کامل به «پوشش آزموده‌شده» تبدیل؛ component/state/browser/keyboard/AT دستی را جدا فهرست کنید.
2. checker داخلی، axe-core و screen reader را جدا نام ببرید؛ نام تست گمراه‌کننده اصلاح شود.
3. policy CSP واقعی، TrustedTypes support و استثناهای style از #63/#67 وارد راهنما شوند.

**پذیرش:** [ ] هر ادعای انطباق به حالت UI و روش آزمون وصل است؛ صفر serious axe به‌عنوان کل WCAG معرفی نشده؛ مثال policy در fixture واقعی پاس می‌شود.

### R06 — MANUAL-STEPS، scope و MAINTAINERS

1. توصیهٔ NPM_TOKEN قدیمی با OIDC، شاخهٔ قدیم با main و نقش‌های نامعتبر با افراد واقعی یکدست شود.
2. جدول کار بیرونی شامل مسئول، گام، status، شاهد و آخرین تاریخ تأیید اضافه؛ secrets/اطلاعات حساس منتشر نشوند.
3. 404 registry فقط availability همان نام را توصیف کند، نه آزادبودن scope؛ مجوز/2FA/provenance فقط پس از مدرک قطعی نوشته شود.

**پذیرش:** [ ] هیچ ادعای مالکیت/دسترسی/فروشگاه/ممیزی بدون شاهد قطعی وجود ندارد؛ status تمام #61/#66/#77/#80/#97/#107 با issueها همخوان است.

### R07 — docs/api و مثال‌ها

1. خروجی TypeDoc و api-extractor از #103/#56 منبع canonical؛ فهرست symbol فعلی نقش محدودش را توضیح دهد.
2. README و cookbook از API canonical/نام نهایی استفاده کنند؛ marker تست مثال‌ها حفظ و پوشش گسترش یابد.
3. اگر `html test` اضافه شد، harness اجرای واقعی directive/hydration بنویسید؛ صرف regex «تگ دارد» compile/execute معرفی نشود.

**پذیرش:** [ ] تغییر امضا و مثال شکسته در CI رد می‌شود؛ تمام مثال‌های علامت‌خورده واقعاً بر حسب قرارداد خود آزموده می‌شوند؛ سایت و linkها معتبرند.

### R08 — شواهد و traceability

1. جدول issue→معیار→تست→SHA→run→artifact→تأیید بیرونی را در progress یا سند evidence سبک ثبت کنید.
2. نام/تعداد تست‌ها از run واقعی استخراج؛ نتیجهٔ unit، integration، browser و manual جدا باشد.
3. گیت وجود لینک و schema evidence و چک نمونه‌ای بازبین؛ artifact بزرگ خارج Git و مدت نگه‌داری روشن.

**پذیرش:** [ ] هر issue بسته همهٔ معیارها را پوشش و شواهد همان SHA دارد؛ link/run قدیمی و placeholder موفقیت محسوب نمی‌شوند؛ ادعای counts با خروجی واقعی سازگار است.

## ۶. خاتمهٔ چهار مورد تکمیل‌شده و epicها

### چهار مورد آمادهٔ بازاعتبارسنجی

| issue | گام | معیار پذیرش خاتمه |
|---|---|---|
| #106 | check:docs-examples و تست‌های docs-examples را روی SHA اجرا؛ محدودیت فعلی HTML و دامنهٔ markerها در کامنت ثبت | همهٔ مثال‌های علامت‌خورده کامپایل/اجرا طبق قرارداد، پروب منفی سبز، CI همان SHA؛ ادعای اجرای HTML بدون harness نشود |
| #108 | check:adr و check:architecture-graph و تست ADR/graph را اجرا | حداقل ۱۰ ADR معتبر، گراف تازه و گیت منفی drift، CI همان SHA |
| #112 | check:error-docs و تست error-docs-pages؛ probe docsUrl در خروجی | تمام کدهای catalog صفحهٔ علت/نمونه/رفع دارند و لینک چاپ می‌شود؛ دسترس‌پذیری وب اگر ادعا شود جدا تست شود |
| #119 | check:unique-exports و تست deprecation/allowlist؛ برخورد تازهٔ منفی | صفر برخورد با معنای متفاوت؛ استثنا هم‌معنا/لایه‌ای دلیل دارد؛ alias قدیم warning؛ bridgeهای extraction بعدی دوباره کنترل شوند |

بستن واقعی فقط با اختیار مناسب و evidence انجام شود. اگر تغییرات بعدی این موارد را بشکنند، regression جدید با لینک به issue اصلی ثبت گردد؛ «قبلاً بسته بوده» دلیل چشم‌پوشی نیست.

### ترتیب خاتمهٔ مدیریتی

برای هر epic: (۱) تمام ارجاعات بدنه، نه فقط فهرست نمونهٔ زیر، دریافت؛ (۲) childها با evidence همگام؛ (۳) unchecked به‌واقع بررسی؛ (۴) نتیجه و CI ثبت؛ (۵) تنها با اتمام همهٔ معیارها بسته شود.

| issue | ترتیب/گام مشخص | معیار پذیرش |
|---|---|---|
| #176 | پس از #13، موارد تاریخی AUDIT و childهای بسته بازتطبیق؛ R01 | تمام یافته‌های دامنه بسته/رسماً تعیین تکلیف و audit dev طبق معیار #13؛ چک‌لیست ۲۲گانه شواهد دارد |
| #177 | پس از #33/#38/#39/#40؛ گزارش واحد کیفیت/پوشش | هر child کامل، هیچ any/console/max-lines بدهی خلاف معیار باقی نیست؛ CI کامل سبز |
| #178 | پس از #51/#55/#56/#57؛ API compatibility و exports matrix | architecture/API reports و package targets مطابق قرارداد؛ child ناقص صفر |
| #179 | پس از #61/#63/#66/#67؛ تأیید امنیت و کار بیرونی | ممیزی مستقل، CSP واقعی و انتشار امن دارای شواهد؛ Critical/High باز در دامنه صفر |
| #180 | پس از #77/#80/#66 و packaging gates | مالکیت نام، protection، provenance و release pipeline اثبات‌شده؛ childها کامل |
| #181 | پس از #86/#88/#90/#95/#97/#100 و شواهد a11y | performance/degradation/RTL/store مطابق معیارهای اصلی، گزارش دستی/بیرونی لازم موجود |
| #182 | پس از #103/#107/#109/#110/#111/#113/#114/#160 و چهار مورد تأییدشده | docs/DX/governance/demo end-to-end و سایت‌ها واقعی؛ R01–R08 تکمیل |
| #183 | پس از #118/#120/#139/#159 و دیگر childها | قراردادهای API/directive/registry عملاً enforce و تست شده‌اند؛ ابزار جایگزین بدون تصمیم باقی نیست |
| #184 | تمام پکیج‌های spec با manifest و گیت P، نه API جاسازی‌شده | ماتریس §۶.۲ برای هر پکیج کامل؛ اختیاری/تعویق فقط با تغییر دامنهٔ مصوب، نه تیک انجام |
| #185 | فازها بعد از epicهای مرتبط؛ تغییر ترتیب/دامنه در ADR و changelog ثبت | همهٔ فازهای scope بسته و CI روی candidate نهایی سبز؛ مانع انتشار یا وابستگی باز صفر |
| #186 | در هر batch نگاشت زنده به‌روز؛ پس از بقیه cross-check کامل | هیچ آیتم سند بدون issue/وضعیت/شاهد نیست؛ به‌عنوان index زنده می‌تواند باز بماند؛ بسته‌شدن اداری فقط با تصمیم صریح مالک و مرجع جانشین، نه برای سبزشدن آمار |

## ۷. چک‌لیست اجرای batch و فرمان‌های اعتبارسنجی

### ابتدای هر batch

- [ ] issueهای زنده/پیش‌نیازها/تغییرات کاربر بررسی؛ baseline SHA و dirty files ثبت.
- [ ] برای هر کارت مسئول، آزمون پذیرش و خروجی محدود روشن؛ کارت‌های P صرفاً skeleton بسته‌بندی نشوند.
- [ ] artifact plan و دادهٔ تست deterministic؛ شبکهٔ بیرونی واقعی فقط در integration لازم با محیط مشخص، نه unit تصادفی.

### فرمان‌های موجود در مخزن

اینها فرمان‌های **موجود در baseline** هستند؛ پس از جابه‌جایی workspaces/ابزارها تطبیق و مستندسازی شوند. لازم نیست تمام فرمان‌های سنگین بعد از هر تغییر کوچک اجرا شوند؛ پایان batch و candidate نهایی باید دامنهٔ کامل مرتبط را پوشش دهد.

```bash
npm ci
npm run lint
npm run format:check
npm run typecheck
npm run build
npm test
npm run test:coverage
npm run test:e2e
npm run deps
npm run deps:unused
npm run peer-rule
npm run peer:single-instance
npm run error-hygiene
npm run cleanup-hygiene
npm run attribute-grammar
npm run check:positional-config
npm run check:unique-exports
npm run check:error-docs
npm run check:docs-examples
npm run check:adr
npm run check:architecture-graph
npm run check:bench-doc
node scripts/generate-api-docs.mjs --check
npm run publint
npm run attw
npm run pack:audit
npm run install-import
npm run dts-parity
npm run size
npm audit --json
npm audit --omit=dev --json
```

- benchmark معتبر طبق #86 در runner مرجع و performance demo طبق #90 جدا اجرا شوند؛ CI سبز عمومی substitute آن دو نیست.
- گیت‌های **جدید** api-extractor، public declaration-any، template typecheck، extension واقعی، Node/Edge integration، Lighthouse/INP و artifact evidence در کارت خود ساخته و به workflow وصل شوند؛ نام script موجود برای آنها فرض نشده است.
- برای تست مرورگر از مرورگر نصب‌شده/CI image مصوب استفاده و capability ثبت شود. برای preview کاربری server به `0.0.0.0` bind شود و درخواست browser به backend از relative URL/proxy باشد؛ تنظیم localhost تست داخل sandbox با URL مرورگر کاربر اشتباه نشود.
- حداقل coverage فعلی و size budgets کاهش نیابند؛ coverage هستهٔ معیار اصلی ≥۸۰٪ حفظ شود. package جدید بودجهٔ spec خودش را دارد.

### پایان batch

- [ ] معیارهای مخصوص کارت + G (+P در صورت لزوم) بررسی و تست منفی اثبات‌شده است.
- [ ] progress/evidence/changelog و Rهای متأثر به‌روز؛ scope جزئی به‌عنوان کامل گزارش نشده است.
- [ ] commit موضوعی روی شاخهٔ همین نشست؛ در صورت انتشار تغییرات Git فقط همان شاخه push شود، نه main/شاخهٔ تاریخی.
- [ ] CI روی همان SHA بررسی؛ شکست کد رفع، شکست زیرساختی با دلیل تفکیک، rerun جای رفع باگ نشود.
- [ ] child/epic فقط پس از اختیار و شواهد مناسب تغییر وضعیت؛ هیچ tag انتشار/فروشگاه/npm بدون تأیید مربوط ایجاد نشود.

## ۸. تحویل نهایی و معیار پایان کل برنامه

- [ ] تمام **۴۸ کارت** دارای یکی از دو حالت روشن‌اند: «پذیرش کامل با شاهد» یا «باز/مسدود/منتظر مالک با گام دقیق». حالت دوم گزارش‌پذیر است، اما به معنی رفع همهٔ نواقص یا production-ready نیست.
- [ ] چهار مورد تکمیل‌شده بازاعتبارسنجی و ۱۱ مورد مدیریتی مطابق بخش ۶ همگام شده‌اند.
- [ ] nonce ثابت، transport ساختگی معرفی‌شده به‌عنوان واقعی و reject provider رهاشده در محصول باقی نمانده‌اند.
- [ ] گیت‌های کامل روی candidate نهایی و environmentهای اعلام‌شده سبز؛ declaration-any، API reports، CSP/TT، a11y/RTL، templates/demos و Node/Edge integration واقعی اجرا شده‌اند.
- [ ] audit و ممیزی مستقل مطابق معیار اصلی، دسترسی/مالکیت/OIDC/protection و انتشارهای بیرونی دارای شواهد معتبرند؛ نبود هرکدام مانع ادعای آمادگی انتشار مربوط است.
- [ ] R01–R08 تمام؛ گزارش‌ها تاریخ‌دار، ادعاها محدود به دامنهٔ آزموده‌شده و همهٔ لینک‌ها/آرتیفکت‌ها قابل پیگیری‌اند.
- [ ] خلاصهٔ نهایی شامل SHA، CI، موارد بسته، موارد باز، تصمیم‌های مصوب تغییر دامنه و ریسک باقی‌مانده ارائه شده است؛ هیچ کاهش معیار یا استثنای خاموش وجود ندارد.
