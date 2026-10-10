# Progress Tracker (AGENT-INSTRUCTIONS §2)

آخرین issue کامل: #143
issue در حال انجام: (none — #144 در پیش است)
بعدی: #144، #146، #142، #145، #115، #116، #117، #173، #172، #52، #147، #148، #149، #92، #48، #49
مسدود/نیازمند انسان: #68 (تأیید مالک MIT — docs/MANUAL-STEPS.md)، #59 (فعال‌سازی Private vulnerability reporting از UI — docs/MANUAL-STEPS.md)
آخرین run موفق CI: 38039101614 (روی HEAD c08d4fc — #141؛ هر ۱۲ job سبز)

## وضعیت شناخته‌شدهٔ baseline
- 181 issue باز (#6..#186).
- #27 انجام شد: vitest + coverage-v8 در ریشه (`vitest.config.ts`)، `npm test`=`vitest run`.
  - اسکریپت‌های test مرده از ۱۴ پکیج حذف شد؛ `scripts/test-all.mjs` حذف شد.
  - ۹۱ تست؛ پوشش statements هسته ≥۷۰٪ (state 77.9, scheduler 86.3, expressions 77.9, compiler 75.7).
  - DEC-001 (SW listener)، DEC-002 (runner) ثبت شد.
- #36 انجام شد: ESLint 9 flat config + typescript-eslint (typed via `tsconfig.eslint.json`)،
  Prettier 3 + `.editorconfig` + `.prettierignore`؛ `lint`/`lint:fix`/`format`/`format:check` در ریشه.
  - همهٔ خطاهای lint رفع شد (کد خروج ۰)؛ ۶۵۹ هشدار `no-explicit-any` موقتاً warn تا #38.
  - DEC-003 (دامنهٔ lint و انحراف‌ها) ثبت شد.
  - مراحل Lint + Format check به CI اضافه شد؛ README docs/README.md بخش دستورهای توسعه.
- #79 انجام شد: main.yml بازسازی شد به ۱۱ job موازی مستقل (lint، format، typecheck،
  unit+coverage، audit(prod/high)، dependency-graph، build Node18/22، publint، size-limit،
  browser-e2e Playwright/Chromium روی باندل واقعی، release).
  - ابزارهای stage: publint، @playwright/test 1.56، dependency-cruiser 16، size-limit 11 + @size-limit/file (Node 18 سازگار).
  - اسکریپت‌های جدید: scripts/publint-all.mjs، scripts/e2e-server.mjs؛ کانفیگ‌ها:
    .dependency-cruiser.cjs (چرخه استاتیکی post-compilation)، .size-limit.json، playwright.config.ts، e2e/browser-smoke.spec.ts + e2e/fixture.html.
  - zenith-vscode با compile -w ساخته می‌شود تا publint سبز شود؛ DEC-004 ثبت شد؛ .github/CI.md بازنویسی شد (#16 را هم پوشش می‌دهد).
  - dev-dep audit/secret-scan → #65؛ بودجه دقیق per-package → #83؛ لایه‌بندی کامل → #49؛ publint+attw کامل → #74.
- #25 انجام شد: package-order لبه‌های dev را وارد گراف کرد؛ چرخهٔ فقط-dev = هشدار+رد لبه،
  چرخهٔ واقعی = throw با نام پکیج‌ها؛ injectable شد؛ ۶ تست در scripts/test/package-order.test.mjs؛
  DEC-005؛ typecheck/build روی dist خالی سبز.
- #26 انجام شد: typecheck-all بدون emit؛ tsconfig موقت noEmit با paths→src در `.tsbuild/`
  (wipe ابتدای هر اجرا، gitignore شد)؛ spawn از typescript/bin/tsc ورک‌اسپیس؛ ۴ تست
  scripts/test/typecheck-all.test.mjs (شامل «declaration کهنه خطا را پنهان نمی‌کند»)؛ DEC-006.
- #14 انجام شد: engines ≥18.19 در ریشه+۳۵ پکیج+lockfile؛ ماتریس CI کامنت؛ DEC-007؛
  تست scripts/test/engines.test.mjs (قرارداد اجرایی).
- #70 انجام شد: repository/homepage/bugs/publishConfig/sideEffects در ۳۵ پکیج؛
  sideEffects=router/cli glob صریح، بقیه false (اسکن ایستا)؛ اسکریپت CI
  scripts/validate-package-fields.mjs؛ تست‌های package-fields + side-effects
  (شامل اثبات tree-shaking با esbuild)؛ DEC-008.
- #68 انجام شد: LICENSE MIT ریشه («Zenith Team 2026») + sync به ۳۵ پکیج
  (scripts/sync-license.mjs با --check در CI)؛ 'LICENSE' در files تمام پکیج‌ها؛
  تست license (۳۹ مورد incl. اثبات npm pack)؛ مالک حقوقی → needs-human +
  docs/MANUAL-STEPS.md.
- #59 انجام شد: SECURITY.md (جدول نسخه‌های پشتیبانی‌شده، گزارش خصوصی GHSA +
  fallback ایمیل ZENITH-SEC، SLA تأیید ۴۸ ساعت / ارزیابی ۷ روز / افشای ≤۹۰ روز،
  دامنه in/out، اشاره به مرز امنیتی expressions و Node ≥18.19)؛ لینک از
  docs/README.md (لینک از README ریشه → #69؛ CONTRIBUTING → #107)؛
  تست scripts/test/security.test.mjs (۸ مورد)؛ فعال‌سازی Private vulnerability
  reporting فقط از UI است → needs-human + docs/MANUAL-STEPS.md.
- #69 انجام شد: README.md ریشه (معرفی HTML-First/Signal، شروع سریع قابل‌اجرا با
  باندل مرورگری + راستی‌آزمایی Playwright هدلس، جدول ۳۶ پکیج با لایه/نقش/لینک،
  لینک ARCHITECTURE/docs/SECURITY/MANUAL-STEPS، نشان‌ها)؛ ۱۲ README پکیج
  تکمیل شد (compiler/crud/dependency-graph/error-boundary/i18n/permission/
  resource/stateful/store/suspense/transition/virtual-list)؛
  تست scripts/test/root-readme.test.mjs (۷ مورد: جدول کامل، لینک‌های نسبی
  سالم، API واقعی quickstart). حین آزمون manual، باگ واقعی computed-in-template
  کشف و به‌عنوان #187 گزارش شد (پس از رفع #187، README الگوی واقعی computed را دارد).
- #187 انجام شد (موج ۱): brand `Symbol.for('zenith.readable')` روی
  Signal/Computed در state (`readable.ts` + `isReadable`/`isWritable`)؛
  createContext رانتایم و createContextForEval events هر readable را unwrap
  می‌کنند (اسنپ‌شات computed حذف شد)؛ جاهای نوشتنی (zen-model/hydrate)
  همچنان set لازم دارند؛ DEC-009؛ ۱۲ تست جدید (unit brand + context + jsdom
  zen-text end-to-end) همه red-before-fix؛ README quickstart به `computed`
  واقعی برگشت و دوباره با Playwright هدلس روی باندل راستی‌آزمایی شد (0→2→6).
- typecheck/build از baseline سبز است (۳۴/۳۴).
- #7 انجام شد (موج ۱): اعتبارسنجی نام پروژه در `zenith create` — ماژول جدید
  `packages/cli/src/validate-project-name.ts` (الگوی `[a-zA-Z0-9._-]` شروع
  alphanumeric، رد مطلق/سپاریتر POSIX+ویندوز+یونیکد/نام خالی/بیش از ۱۰۰/
  رزرو ویندوز/لنگهٔ resolve داخل cwd)؛ `index.ts` با پیام `[ERROR] Invalid
  project name` و exit 1 فراخوانی می‌کند؛ ۸ تست در
  `packages/cli/test/cli-traversal.test.ts` (واحد + یکپارچگی با بیلد واقعی
  CLI در سندباکس: `../evil`، `a/b`، `..\evil` رد و هیچ فایل بیرون cwd
  نوشته نمی‌شود؛ `my-app` می‌گذرد).
- #10 انجام شد (موج ۱): هاردن کردن parser/lexer در برابر EOF — `current()`
  هرگز undefined نمی‌دهد (EOF sentinel)؛ helper `syntaxError()` همهٔ پرتاب‌های
  syntax پارسر + ۳ پرتاب خام lexer را به `expressionSyntaxError` (ZenithError
  ZEN-004 با position) تبدیل می‌کند؛ EOF در پیام به‌جای `'null'` → «end of
  input»؛ `parse()` junk انتهایی (`a)`، `(a))`، `1 2`) را رد می‌کند؛
  تست `packages/expressions/test/parser-eof.test.ts` (۳۵ مورد: ۳۲ ورودی ناقص
  + فیوژ قطعی ۱۰٬۰۰۰ ورودی، همه red-before-fix؛ ۳۵۹/۳۵۹ سراسری؛ CI 37907905842).
- #17 انجام شد (موج ۱): رفع محتوای کهنه در `virtual-list/controller.ts` —
  `RenderedItem` حالا `item` را نگه می‌دارد؛ `renderRange` پیش از استفاده از
  نود کشی، با helper `itemChanged` (برابری ارجاع → مقایسهٔ سطح‌یک record)
  تغییر آیتم را می‌سنجد و در صورت تفاوت نود را دور ریخته و `renderItem` را
  دوباره صدا می‌زند؛ مرتب‌سازی/جایگزینی آرایه/جایگزینی شیء با همان key/
  درج-حذف میانی پوشش داده شد؛ ۴ تست jsdom در
  `packages/virtual-list/test/controller-stale.test.ts` (red-before-fix؛
  آیتم بی‌تغییر دوباره رندر نمی‌شود = تست ضعیف‌شده مجاز نیست)؛ ۳۶۳/۳۶۳ سراسری.
- #19 انجام شد (موج ۱): اجرای callbackهای کاربر در virtual-list داخل `untrack()`
  (`getItemKey`/`itemSize(fn)`/`renderItem`/`onVisibleRangeChange`/`onScroll`)؛
  تنها وابستگی effect خودِ signal آیتم‌هاست؛ حلقهٔ نوشتن در
  onVisibleRangeChange حذف شد؛ ۴ تست در
  `packages/virtual-list/test/controller-untrack.test.ts` (قرمز→سبز، سقف‌دار)؛ DEC-010.
- #20 انجام شد (موج ۱): شمارندهٔ نسل/چرخه در `createSuspense.track()` —
  `reset()` نسل را زیاد می‌کند و تسویهٔ پرامیس‌های نسل قبل (resolve و reject)
  کاملاً نادیده گرفته می‌شود (رفع onReady زودهنگام در retry)؛ در شاخهٔ reject
  id پیش از reportError از loadingSet حذف می‌شود (رفع نشت/گیرکردن boundary)؛
  ۶ تست در `packages/suspense/test/suspense-generation.test.ts` (۲ مورد قرمز
  قبل از رفع)؛ DEC-011.
- #23/#24 انجام شد (موج ۱، کامیت a4c9414 + 87855c0):
  - #23: measureTransitionDuration از getComputedStyle (بیشینهٔ delay+duration
    transitionها و delay+duration×iterations animationها، سقف ایمن ۳۰s/۱۰۰
    دور)؛ رویداد زودرس با elapsedTime<deadline run را تمام نمی‌کند؛ رویدادهای
    فرزندان نادیده گرفته می‌شوند؛ DEC-012؛ ۴ تست jsdom + ۲ e2e Chromium واقعی
    (e2e/transition.spec.ts + transition-fixture.html).
  - #24: fallback timer همزمان با شروع run (نه بعد از دو rAF) — تب پس‌زمینه
    finished را معلق نگه نمی‌دارد؛ تمدید در rAF دوم؛ clearTimeout در
    finish/cancel؛ DEC-013؛ ۳ تست (rAF متوقف‌شده، cancel بدون callback دیرهنگام،
    پاک‌سازی تایمر پس از پایان طبیعی).
  - رفع جانبی: e2e-server حالا به /favicon.ico پاسخ 204 می‌دهد (Chrome دسکتاپ
    404 را به‌عنوان page error به smoke test تزریق می‌کرد).
- #23/#24 بسته شدند (CI سبز 38015190108؛ کامیت‌ها a4c9414، 229feb6).
- #64 انجام شد (موج ۱): `secureId(bytes)` در `@zenith/security` (crypto.getRandomValues،
  ZenithError ZEN-403 در نبود crypto، بدون fallback غیرامن)؛ suspense innerId به
  secureId(4)؛ jitter سرویس‌ورکر با کامنت NON-SECURITY + eslint-disable؛ قانون
  ESLint no-restricted-syntax روی Math.random در packages/**/src (اثبات: probe
  خطا می‌دهد، repo سبز)؛ security→errors و suspense→security edgeها بدون چرخه
  (dependency-cruiser سبز)؛ ۴ تست `packages/security/test/secure-id.test.ts`؛ DEC-014.
- #30 انجام شد (موج ۱): corpus امنیتی مشترک `packages/security/test/xss-corpus.mjs`
  (۴۴ payload: OWASP XSS + mXSS template/svg/math/noscript + javascript:/data: +
  CSS injection)؛ تست jsdom `xss-corpus.test.ts` (۵۱ مورد incl. sanitizeCSS و
  generateCSP)؛ تست مرورگر واقعی `e2e/xss-corpus.spec.ts` + `e2e/xss-fixture.html`
  با positive control (خام MUST اجرا شود، sanitized MUST NOT) — سبز در Chromium؛
  fuzz قطعی `packages/expressions/test/fuzz-security.test.ts` (mulberry32 seed
  ثابت، ۱۰۰٬۰۰۰ ورودی در ~۳s، ساخت‌یافته: proto-pollution/depth/truncation/
  long-string؛ هیچ crash/hang/pollution)؛ workflow `fuzz-nightly.yml` (۲M ورودی،
  seed چرخشی با run_number، artifact لاگ)؛ DEC-015. fuzz بخشی از unit job CI است
  و شکستش merge را بلاک می‌کند.
- #62 انجام شد (موج ۱، کامیت 67dd7fd):
  - هشدار dev با کد **ZEN-404** در `Auth` constructor هنگام
    `tokenStorage: 'localStorage'|'sessionStorage'|'cookie'` (الگو
    `__ZENITH_DEV__ !== false`؛ `memory` بی‌صدا)؛ `ErrorCode.
    SECURITY_INSECURE_TOKEN_STORAGE` در `@zenith/errors`.
  - راهنمای `docs/security/auth.md` (کوکی HttpOnly سمت سرور + access در حافظه،
    CSRF double-submit/synchronizer + Origin، rotation/reuse detection،
    credentials include/withCredentials، CORS) + لینک از `packages/auth/README.md`.
  - تست `packages/auth/test/auth-security.test.ts` (۹ مورد؛ ۲ مورد هشدار
    red-before-fix؛ قفل refresh-race تک‌درخواست، retry پس از 503 بدون logout،
    پاک‌سازی logout، same-origin login، include+keepalive secureLogout fallback).
  - DEC-016 (چرا warn نه throw؛ چرا sessionStorage هم شامل شد). CI 38016693234 سبز.
- #45 انجام شد (موج ۱، کامیت fa274c8):
  - بازمطالعهٔ جدول issue: `auth→http` و `ssr→{router,runtime}` با dynamic
    import **واقعاً استفاده می‌شوند** (نگه داشته شد — stale)؛ دو مورد افزوده:
    `permission→router` و `service-worker→runtime` (فقط کامنت). در مجموع
    ۱۴ اعلام بلااستفاده از ۱۱ پکیج حذف شد؛ lockfile بازتولید شد.
  - گیت CI جدید: `scripts/unused-zenith-deps.mjs` (npm run deps:unused در
    job deps؛ dynamic import شمرده می‌شود، کامنت نه — state-machine
    حذف‌کامنت) + `scripts/test/unused-zenith-deps.test.mjs` (۵ تست شامل
    شرط پذیرش «صفر بلااستفاده» روی ریپوی واقعی — red-before-fix).
  - ARCHITECTURE §۴.۱ به‌روز شد؛ DEC-017 (چرا اسکریپت هدفمند به‌جای
    depcheck/knip). CI 38017422885 سبز (deps:unused در لاگ CI تأیید شد).
- #46 انجام شد (موج ۱، کامیت 6fe84ff):
  - ۲۲ مصرف‌کننده: state/scheduler فقط peer با `^1.4.0` (استثنای state→
    scheduler به‌عنوان dependency هسته حفظ شد)؛ lockfile بازتولید.
  - `scripts/peer-rule.mjs` در job deps CI (dependencies ممنوع، caret range،
    import در src ⇒ peer اعلام‌شده لازم؛ reuse collectUsed #45)؛
    `scripts/peer-single-instance.mjs` job مستقل needs-build (npm pack + نصب
    واقعی → state=1/scheduler=1 + پروب reactivity بین‌پکیجی)؛
    `standardize-packages.mjs` fixPeers تا caret خراب نشود.
  - `scripts/test/peer-rule.test.mjs` (۷ تست، acceptance روی ریپو red-before-fix)؛
    `peer-single-instance` سبز محلی و در CI.
  - ARCHITECTURE §۴.۳ بازنویسی + جدول §۲ به‌روز؛ DEC-018 (استثنا، caret، job مستقل).
    CI 38018912934 سبز (۱۲ job؛ peer-single-instance تأیید شد).
- #47 انجام شد (موج ۱): تک‌مسیر API برای virtual-list/transition با wrapper منسوخ‌شونده:
  - `deprecate(code, old, new, hint?)` + `resetDeprecationWarnings()` در `@zenith/errors`
    (هشدار یک‌بار به‌ازای کد، خاموش وقتی `__ZENITH_DEV__ === false` — الگوی ZEN-404 انحصاری شد)؛
    رجیستری کدها ZEN-DEPR-001..004 (DEC-019).
  - transition: چهار موتور موازی (WAAPI/CSS × enter/leave) حذف شد؛ `enterTransition`/
    `leaveTransition`/`animateGroup` حالا نازک‌wrapper روی `createTransition` (همان موتور
    دارای رفع #23/#24) هستند و ZEN-DEPR-002/003/004 می‌دهند؛ `animate.ts` (zen-animate WAAPI
    presets) ویژگی مستقل است و دست‌نخورده؛ suspense بررسی شد: از قبل تک‌هسته
    (`createSuspenseContext`) — بدون تغییر.
  - virtual-list: `processVirtualList` شد wrapper روی `createVirtualList` (engine دارای رفع
    #17/#19) با ZEN-DEPR-001؛ engine توسعه یافت: `getState()`، `onItemUpdated`/`onNodeRemoved`،
    `registerVirtualListNodeDisposes` (WeakMap) برای حفظ معنای dispose هر نود؛ مسیر SSR
    (رندر کامل بدون virtualize) نگه داشته شد — دومین موتور virtualization نیست (DEC-019)؛
    API عمومی (`VirtualListController`, scrollToIndex/rebuild/getRange) بدون تغییر.
  - مصرف‌کنندهٔ داخلی رانتایم مهاجرت کرد: `zen-if` (`directives/if.ts`) مستقیم
    `createTransition` می‌سازد (به ازای هر directive یک controller، dispose در teardown) —
    کاربر نهایی هرگز ZEN-DEPR نمی‌بیند؛ تست رفت‌وبرگشت بدون هیچ warning.
  - تست‌های جدید (red-before-fix همه): `packages/errors/test/deprecate.test.ts` (4)،
    `packages/transition/test/transition-deprecation.test.ts` (6)،
    `packages/virtual-list/test/process-virtual-list-deprecation.test.ts` (5)،
    `packages/runtime/test/if-transition-deprecation.test.ts` (2). `npm test` 475 سبز.
  - «یکی کردن VirtualListConfig و VirtualListOptions»: پل نوعی در `virtual-list.ts`
    فیلدهای مشترک (itemHeight↔itemSize، buffer↔overscan، direction) را به options
    قفل می‌کند (واگرایی = خطای compile) + helper واحد `virtualListConfigToOptions`
    که wrapper دایرکتیو هم از همان عبور می‌کند؛ `config-options-unification.test.ts`
    (۵ تست، red-before-fix) — `npm test` 480 سبز.
  - کامیت‌ها: 674f0a2 (wrapperها + زیرساخت) و 606fe51 (یکی‌سازی config).
  - dependencies جدید `@zenith/errors` در transition/virtual-list (lockfile بازتولید)؛
    importmap fixture اضافه‌شده به `@zenith/errors`؛ demos (transition/virtual-list) و
    READMEها/ARCHITECTURE §لایه‌های موازی/§۲ بازنویسی؛ DEC-019.
- #175 انجام شد (موج ۲، RFC): هر ۸ تصمیم باز NEW-PACKAGES-SPEC بسته شد —
  DEC-020 (کد خطا: بدون renumber؛ بازه ۴رقمی SPEC برای جدیدها + ZEN-DEPR رسمی)،
  DEC-021 (Readable<T> در shared روی brand DEC-009 + تست نوع expectTypeOf؛ tsd نه — vitest typecheck)،
  DEC-022 (adapter-edge به تعویق تا #92 — قید فنی: ssr وابستگی hard به jsdom+AsyncLocalStorage دارد)،
  DEC-023 (ترتیب ui: dialog→popover→tooltip→tabs؛ مبنای WAI-ARIA APG)،
  DEC-024 (charts/icons: community/اختیاری؛ در رسمی‌شدن باز)،
  DEC-025 (runtime-core: parity-first؛ تا snapshot parity سبز نشود هیچ فایلی منتقل نمی‌شود؛ #148)،
  DEC-026 (lockstep 1.5.0؛ حذف API قدیمی فقط 2.0.0 پس از یک نسخه deprecation؛ #58)،
  DEC-027 (Node floor همان ≥18.19 تا 2.0 طبق DEC-007؛ ESM-first و CJS فقط ابزارها طبق §۰.۶).
  - گیت: `scripts/test/rfc-decisions.test.mjs` (۱۶ تست؛ red-before-fix: ۱۶ شکست قبل از ADRها)؛
    «docs/adr/» بدنۀ issue به `docs/decisions/` دستورالعمل §4 تطبیق یافت (ثبت در تست).
  - NEW-PACKAGES-SPEC «ریسک‌ها و تصمیم‌های باز» به «بسته‌شده» با لینک ADR هر بند به‌روز شد؛
    ARCHITECTURE §۹ لینک ADRها. npm test = 496 سبز.
- #171 انجام شد (موج ۲، DEC-020): فضای کد خطا در `@zenith/errors`:
  - `ERROR_CODE_PATTERN` (ZEN-NNN | ZEN-NNNN | ZEN-DEPR-NNN)، `ERROR_CODE_RANGES`
    (۱۶ بازهٔ SPEC §۰.۴)، کاتالوگ `RESERVED_ERROR_CODES` (۶۲ کد issue با
    message فارسی/suggestion/domain)، `createReservedError()` + `errorDocsUrl()`
    + `docsUrl` روی ZenithError (toUserString/toJSON)، `DEPRECATION_CODES`
    (ZEN-DEPR-001..004، removedIn 2.0.0).
  - دو دستهٔ افزودنی `Validation`/`Network` به ErrorCategory (بازطراحی کامل=#115).
  - بدون renumber کدهای موجود؛ گیت `packages/errors/test/error-code-ranges.test.ts`
    (۶۲+۸ تست: یکتایی/بازه/عدم‌تداخل با legacy/نبود regex سه‌رقمی-محور در
    devtools+cli+vscode؛ red-before-fix). README errors + ARCHITECTURE §۲/§۹ به‌روز.
  - npm test = 570 سبز؛ build/publint/size/cruiser/e2e سبز.
- #141 انجام شد (موج ۲، SPEC §۲.۱): پکیج جدید `@zenith/shared` (L0؛ deps فقط
  `errors@1.4.0`؛ نسخهٔ تولد `1.5.0` DEC-026؛ ESM-only DEC-027؛ بودجه ۲KB با
  `.size-limit.json` + گیت gzip در test/size-budget).
  - API کامل بند ۲.۱: types.ts (Disposable/Cleanup/Readable ساختاری/
    MaybeReactive/ZenithGlobals + declare global فلگ‌های __ZENITH_*)،
    reactive.ts (toValue/isReadable/createDisposer LIFO+idempotent)،
    options.ts (mergeOptions ضد prototype-pollution با own-key/UNSAFE_KEYS/
    unknown-drop + defineDefaults deep-freeze)، parseDuration ("0"/"1.5s"
    قابل؛ "-1"/"abc" ⇒ NaN؛ never sentinel)/parseBooleanAttr/parseNumberAttr
    طبق گرامر §۰.۳، env.ts (isServer/hasDOM/hasWindow بدون import-effect)،
    id.ts (createId شمارنده‌ای با resetIdCounter برای SSR deterministic +
    secureId canonical CSPRNG/ZEN-403 #64)، assert.ts (invariant → ZEN-1090
    از catalog #171 با [CODE] prefix و docsUrl).
  - تست‌ها (red-before-fix، ۵۰ مورد): shared.test.ts (۳۸، jsdom)،
    env-import.test.ts (Node خالص: import بدون window/document)،
    layering.test.ts (۵: L0 deps-only-errors، ESM-only، freezeِ یال
    state→shared — type-only هم ممنوع چون publish state را به dependency
    جدید واداشت و peer-single-instance #46 را در نصب تمیز شکست — تجربه شد و
    در DEC-021 «اجرای #141» مستند است)، size-budget.test.ts (۳)،
    types.test-d.ts (expectTypeOf دوطرفه Signal/Computed/ReadonlySignal ≡
    Readable و MaybeSignal ≡ MaybeReactive؛ دروازه با tsc -p
    tsconfig.tests.json در scripts/test/shared-type-test.test.mjs).
  - جایگزینی تکرارها: CleanupFn duplicate effect.ts حذف (import type از
    context.ts منبع موجود)؛ MaybeSignal به‌عنوان alias محلی state export شد.
  - زیرساخت: build-package.mjs — پکیج ESM-only دیگر index.cjs یتیم نمی‌سازد
    (DEC-027؛ exports بدون require ⇒ skip CJS)؛ tsconfig references +
    LICENSE sync + README ریشه ردیف shared (۳۷ دایرکتوری/۳۶ npm-pkg:
    package-fields/package-order ۳۶، root-readme ۳۷)؛ ARCHITECTURE §۲.
  - گیت‌های محلی سبز: lint (۰ error)/format/typecheck (36 pkg)/test 624/
    coverage/deps+cruiser+deps:unused+peer-rule/peer:single-instance/build/
    publint (36 clean)/size (shared 1.74KB≤2)/e2e (4)/attw (--pack: 🥴
    InternalResolution فقط به‌خاطر unpublished بودن @zenith/* از registry در
    sandbox — baseline virtual-list هم همین؛ #66/#74).
- #143 انجام شد (موج ۲، SPEC §۲.۳): پکیج جدید `@zenith/logger` (L0؛ deps فقط
  `errors@1.4.0` + `shared@1.5.0`؛ نسخهٔ تولد `1.5.0` DEC-026؛ ESM-only DEC-027؛
  بودجه ۲KB: `.size-limit.json` (brotli CI: 1.88kB) + گیت gzip محلی (src: 2042B≤2048).
  - API کامل بند ۲.۳: `createLogger(opts)→FullLogger (Logger & Disposable & setLevel)`،
    `logger` پیش‌فرض scope `zen`، debug/info/warn/error(msgOrError, details)،
    `child` (صورتبندی `parent:child`)، `isEnabled`، `addSink→Cleanup`،
    `setLogLevel`/`addSink` ماژولی، `consoleSink` (SSR: JSON خطی + requestId؛
    مرورگر: console[level])، `bufferSink({maxEntries})` حلقوی، `beaconSink`
    (fetch-only، ndjson، batch/interval/dispose-flush، هرگز throw نمی‌کند)،
    `warnOnce` per-instance، `deprecate(old,new,since)` با کد از رجیستری
    `DEPRECATION_CODES` (DEC-020) + fallback `ZEN-DEPR-999`؛ redact ۵ کلید
    default (case-insensitive، nested/array، چرخه⇒`[Circular]`)؛ فرمت
    `[zen:scope] CODE: message` + خط suggestion؛clock قابل‌تزریق؛ سطح پیش‌فرض
    dev=debug/prod=warn (فلگ `__ZENITH_DEV__`).
  - sink خراب: حذف فوری + گزارش `ZEN-1091` (createReservedError کاتالوگ #171)
    به sinkهای سالم با dispatch گزارش `report=false` ⇒ سقف عمق ۲، حلقهٔ خطا
    ناممکن (میار پذیرش)؛ async reject با `.catch→fail`.
  - اتصال ZenithError: entry با code/suggestion/details merge با حفظ reference
    (چرخه در spread نمی‌شکند) + `globalThis.reportError` duck best-effort —
    بدون یال L0→L2 به error-boundary (DEC-021).
  - زیرساخت no-console (کار ۳): قاعده `error` برای `packages/*/src/**` فعال؛
    `scripts/no-console-ratchet.mjs` منبع واحد ۶۲ فایل بدهی #39؛ گیت
    `scripts/test/no-console-ratchet.test.mjs` (ضدلغزش: نه فایل جدید console،
    نه ورودی کهنه، دقیقاً یک override off؛ فهرست فقط کوتاه می‌شود)؛
    `packages/logger/src/sinks.ts` تنها مرز console با file-level disable توجیه‌شده؛
    DEC-003 §«اجرای #143» (الگوی ratchet، beaconSink fetch-only، پیام انگلیسی
    deprecate، reportError duck).
  - تست‌ها (red-before-fix، ۴۷ مورد در ۷ فایل): logger.test (سطوح/silent/child/
    redact/چرخه/ZenithError/clock/warnOnce/dispose)، sinks.test (buffer ring،
    beacon با fake timers + fetch stub، console SSR JSON+requestId، sink خراب)،
    deprecate.test (یک‌بار به ازای کد، ZEN-DEPR-999، سکوت prod)، console-sink.test
    (jsdom: routing و فرمت)، env-import (Node خالص)، layering (قفل یال‌ها/ESM)،
    size-budget (۳). npm test = 679 سبز (از 624).
  - شمارش‌ها/اسناد: package-fields/package-order ۳۷، root-readme ۳۸، README
    ریشه ۳۸ پکیج + ردیف logger، ARCHITECTURE §۲ ردیف logger + هدر ۳۸/۳۷،
    docs/README و MANUAL-STEPS «۳۷ پکیج»؛ tsconfig references + LICENSE sync.
  - گیت‌های محلی سبز: lint (۰ error + اثبات عملکرد قاعده با probe)/format/
    typecheck (37)/test 679/coverage (87.16≥70)/build (36)/deps:unused/peer-rule/
    dependency-cruiser/peer:single-instance/publint (37 pkg ۰ error بعد از
    compile vscode)/size-limit (logger 1.88kB<2kB)/e2e (4 با باندل مرورگری بازسازی‌شده).
