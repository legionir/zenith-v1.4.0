# Progress Tracker (AGENT-INSTRUCTIONS §2)

آخرین issue کامل: #9 (همراه با #29، #15، #12، #73، #77، #61 — تکمیل موج ۳)
issueهای باز (جزئی): #117 و #173 — کد/سند/گیت هر دو کامیت شده؛ بقایا:
lint plugin واقعی → #159 و لینک CONTRIBUTING → #107 (هر دو موج ۴)
بعدی: موج ۴ (#13، #18، #21، #22، #37، #38، #165، #39، #40، #41، ...)
مسدود/نیازمند انسان: #68 (تأیید مالک MIT)، #59 (فعال‌سازی Private vulnerability reporting از UI)، #73 (NPM_TOKEN + tag push)، #77 (رزرو اسکوپ `@zenithjs` روی npm)، #61 (انعقاد قرارداد ممیزی امنیتی مستقل) — همه مستند در `docs/MANUAL-STEPS.md`
آخرین run موفق CI: 38198172598 (روی HEAD 6ae1b21 — #115/#116؛ هر ۱۲ job مسدودکننده سبز)

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

- #144 انجام شد (موج ۲، SPEC §۲.۴): پکیج جدید `@zenith/cache` (L0؛ deps فقط
  errors+shared؛ ESM-only/1.5.0 طبق DEC-026/027) — تنها پیاده‌سازی cache کل
  ورک‌اسپیس؛ انقضای lazy بدون timer (SSR-safe)، LRU/FIFO، maxBytes+sizeOf،
  tags/invalidate، getOrLoad با dedupe (۱۰۰ هم‌زمان ⇒ ۱ loader)، SWR با
  revalidate پس‌زمینهٔ dedupe‌شده، ژن‌شمارندهٔ bumps ضد commit دیرهنگام،
  stats هم‌شکل expressions، registerCache/listCaches (devtools)،
  parseCacheAttr («30s,swr=2m»/never/false/تگ)، signal با setSignalAdapter
  (بدون یال cache→state — DEC-021؛ انحراف subpath مستدل)، ZEN-1201/1202 از
  کاتالوگ #171، رجیستری duplicate ⇒ ZEN-1090.
  - مهاجرت شش مصرف‌کننده (API عمومی حفظ شد): expressions (compile/clearCache/
    getCacheSize/configureCache/getCacheStats — همان پنج‌فیلد آمار؛ configure
    با rebuild و انتقال entryها)، http (cacheStore⇒httpCache با wrapper {data}؛
    clearHttpCache جدید + alias clearCache با deprecate ZEN-DEPR-005 ثبت‌شده در
    DEPRECATION_CODES — کار #3 issue؛ سازگاری __tag: قدیمی با predicate)،
    data (getCachedData/setCachedData/clearFetchCache روی peek/set/clear؛ TTL
    پارامتری در wrapper)، resource (_inflightRequests⇒_dedupeCache؛ delete در
    settle ⇒ فقط join هم‌زمانی، staleTime/سگنال بدون تغییر)، components
    (templateCache/inflight/errorCache⇒سه createCache؛ هویت AbortError حفظ)،
    router (LRUCache دستی حذف؛ routeCache cache + timestamp Map با onEvict).
  - گیت جدید: consumers.test.ts (شش import + نبود Map/LRUCache دستی + deps
    package.json) — معیار «هیچ پیاده‌سازی cache مستقل دیگری».
  - تست‌ها (red-before-fix، ۷۸ مورد در ۷ فایل): cache (۳۰+ get/set/ttl/clock
    جعلی/LRU-FIFO/evict reasons/stats)، get-or-load (۱۱؛ dedupe ۱۰۰تایی، SWR
    با deferred promise، خطای loader⇒ZEN-1202 با cause)، limits-registry (۱۷؛
    maxBytes، رجیستری ZEN-1090، adapter، نشت/تایمر)، layering (۶)، env-import
    (۲)، size-budget (۳؛ gzip≤3072B + .size-limit 3kB brotli — واقعی 2.34kB)،
    consumers (۱۰). npm test = 762 سبز (از 679)؛ coverage 87.1≥70.
  - شمارش‌ها/اسناد: package-fields/package-order 38، root-readme 39، README
    ریشه ۳۹ + ردیف cache، ARCHITECTURE هدر ۳۹/۳۸ + ردیف cache + ستون وابستگی
    شش مصرف‌کننده، docs/README و MANUAL-STEPS «۳۸ پکیج»؛ tsconfig references
    + LICENSE sync؛ DEC-021 §«اجرای #144» (seam آداپتور + تحلیل یال مهاجرت).
  - گیت‌های محلی سبز: lint (۰ error)/format/typecheck (38)/test/coverage/build
    (37 built)/deps:unused (37 checked، ۰)/peer-rule/peer:single-instance/
    dependency-cruiser (۱۵۳ modules ۰)/publint (38 پاک)/size-limit (cache
    2.34kB≤3)/e2e (۴ با باندل بازسازی‌شده + playwright install در sandbox).

- #146 انجام شد (موج ۲، SPEC §۲.۶): پکیج جدید `@zenith/jalali` (L0؛ deps فقط
  errors+shared؛ ESM-only/1.5.0 طبق DEC-026/027) — تقویم جلالی خالص با هستۀ
  Borkowski (چرخهٔ حسابی ۳۳‌ساله، پورت از مرجع jalaali-js؛ DEC-028).
  - API: toJalaliParts/fromJalaliParts (timeZone صریح utc|local|IANA — UTC
    پیش‌فرض ⇒ قطعی SSR)/formatJalali (همۀ توکن‌های YYYY..ss)/parseJalali/
    addDays/addMonths/addYears (clamp پایان ماه)/diffDays/isLeap/monthDays/
    monthName/weekdayName (۰=شنبه)/compareJalali/jalaliNow (clock تزریقی)/
    isValidJalali + toPersianDigits/toArabicDigits/toLatinDigits.
  - رفتار مرز طبق SPEC: خارج از بازه ⇒ ZEN-1301 throw (انحراف عمدی از legacy؛
    DEC-028)، قالب نامعتبر ⇒ ZEN-1302، تاریخ نامعتبر/ناموجود ⇒ ZEN-1303.
    createReservedError حالا پیام را با پیشوند `[CODE]` می‌سازد (قابل assert).
  - migration از i18n با alias سازگار: ZEN-DEPR-006..015 در
    DEPRECATION_CODES ثبت (کل رجیستری ۱۵ کد؛ حذف در 2.0 — DEC-026)؛ عصر
    legacy (`Gregorian < 1622` ⇔ Jy < ۱۰۰۰) همان الگوریتم ۳۳‌سالهٔ قدیمی را
    حفظ می‌کند (صفر تغییر خروجی)؛ مسیر مدرن delegate می‌کند؛ فرمول معیوب
    `fromJalali` legacy (که هیچ تاریخ معتبری نمی‌داد) با delegation تصحیح
    شد — بی‌مصرف در مخزن پس از مهاجرت date-picker.
  - مصرف داخلی: `runtime/date-picker` به API مبنا منتقل شد (بدون یال i18n؛
    grid با getUTCDay ⇒.timezone-safe؛ مقدار ورودی با isValidJalali اعتبار
    کامل می‌شود — کد قدیمی ۱۴۰۲/۱۲/۳۰ ناموجود را می‌پذیرفت). الگو: #47.
  - تست‌ها (red-before-fix، ۶۷ مورد در ۶ فایل): jalali.test ۲۶ (لنگرها،
    roundtrip ۱۰۰۰..۳۰۰۰ هر ۳ روز + ۳۰k PRNG با seed، ۱۲۰٬۰۰۰ sample تساوی
    با Intl در ۱۲۰۱..۱۵۰۰ صفر اختلاف، کبیسه/ماه/سال/فرمت/پارس/add*/weekday/
    clock/ZEN-1301/2/3) + layering ۶ + env-import ۳ + size-budget ۳؛
    i18n/jalali-alias.test ۲۸ (حفظ legacy edgeها، DEPR دقیقاً یک‌بار،
    تصحیح fromJalali)؛ runtime/date-picker-jalali.test ۳ jsdom (قرمز: ۴
    هشدار ZEN-DEPR → سبز: صفر). npm test = 836 سبز (از 762)؛ coverage
    gate ≥70 سبز؛ `testTimeout: 20_000` ریشه فقط برای دو تست سنگین تقویمی.
  - شمارش‌ها/اسناد: package-fields/package-order ۳۹، root-readme ۴۰،
    rfc-decisions max DEC 028؛ README ریشه ۴۰ پکیج + ردیف jalali؛
    ARCHITECTURE هدر ۴۰/۳۹ + خط L0 + ردیف jalali/i18n + §۶ JalaliOptions +
    §۴.۲ یال runtime؛ docs/README و MANUAL-STEPS «۳۹ پکیج»؛ tsconfig
    references + `.size-limit` ۴kB (واقعی ۳٫۵۲kB) + LICENSE sync (۳۹)؛
    DEC-028 ثبت شد (Borkowski/ICU agreement ۱۲۰۱..۱۵۰۰/UTC-default).
  - گیت‌های محلی سبز: lint (۰ error)/format/typecheck (39)/test 836/
    coverage/build (38 built)/deps:unused (۰)/peer-rule/peer:single-instance/
    dependency-cruiser (۱۵۸ modules ۰ نقض)/publint (39 پاک؛ vscode compile)/
    size-limit (jalali 3.52kB≤4)/e2e (۴ با playwright install در sandbox).
  - CI سبز: run 38071497936 روی 069c7c6 (۱۲ job)؛ issue با چک‌لیست تیک‌خورده
    + کامنت شواهد بسته شد (status:done).
- #142 انجام شد: @zenith/schema (L0، SPEC §۲.۲) — پکیج تازه v1.5.0 ESM-only
  (DEC-027)، deps فقط errors+shared (گیت layering). API کامل: s.* (۱۵ kind)،
  validate/safeValidate با ValidateOptions (mode throw|warn|result؛
  `__ZENITH_DEV__`؛ strict/coerce/abortEarly/name)، defineOptions ⇒ DEFAULTS
  فریزشده + resolve، parseConfigAttr (ZEN-1003)، ZEN-1001/1002/1004 فقط با
  createReservedError کاتالوگ #171. حالت warn **بدون console** (دروازهٔ
  #143/ratchet): `setSchemaWarnReporter` duck-seam (DEC-021)؛ بدون reporter
  = سکوت prod؛ وصل‌کردن به logger در #148.
  - زیرمسیرها: /zod (دونگی ZodLike؛ zod هیچ‌وقت dep نیست) و /json-schema
    (toJsonSchema Draft 2020-12 + fromJsonSchema subset). build-package.mjs
    برای subpathهای exports map باندل esbuild + d.ts می‌سازد (الگوی
    service-worker/sw)؛ alias vitest + paths typecheck-all.
  - متادیتای directive: defineDirectiveMeta (رجیستری، kebab-case+description،
    فریز عمیق)، toDirectiveManifest، toHtmlCustomData؛
    scripts/gen-zenith-meta.mjs از seed `docs/meta/zenith.meta.seed.json`
    اسنپ‌شات zenith.meta.json + html.customData.json؛ گیت تازگی --check در
    scripts/test/meta-snapshot.test.mjs (۳ directive هستوی؛ گسترش در #52/#148/#173).
  - مهاجرت form: سه API با همان امضای FormStore-sاز ماندند (L0 نمی‌تواند
    FormStore بسازد) + delegate به schema/zod هرجا layer-clean بود +
    deprecate() با ZEN-DEPR-016..018 (رجیستری ۱۵→۱۸؛ حذف 2.0 — DEC-026)؛
    form deps: errors + schema. الگو: #47/#146.
  - گیت‌های زیرساختی: unused-zenith-deps زیرمسیر را به والد نگاشت می‌کند
    (`'@zenith/x/y' → x`)؛ peer-single-instance ترانزیتی‌های form را هم pack
    می‌کند (errors/schema/shared)؛ ajv@8.20.0 devDep ریشه فقط برای تست
    meta-schema (eslint با ajv@6 تودرتو — بررسی شد).
  - تست‌ها (red-before-fix، ۷۷ مورد جدید): schema.test ۲۶ (primitives/مسیر/
    strict/coerce/abortEarly/name/defineOptions/parseConfigAttr)،
    json-schema.test ۷ (اعتبار meta-schema ajv همهٔ kindها + round-trip +
    subset fromJsonSchema)، zod.test ۴، manifest.test ۶، layering.test ۶،
    env-import.test ۵، size-budget.test ۳؛ form/schema-deprecation.test ۴؛
    meta-snapshot.test ۴؛ errors DEPR ۱۵→۱۸. npm test = ۹۰۶ سبز (از ۸۳۶).
  - شمارش‌ها/اسناد: package-fields/package-order ۴۰، root-readme ۴۱،
    rfc max DEC 029؛ README ردیف schema + ۴۱؛ ARCHITECTURE هدر ۴۱/۴۰ +
    خط L0 + ردیف schema/form (§۴.۲) + §۶ ValidateOptions؛ docs/README و
    MANUAL-STEPS «۴۰ پکیج»؛ tsconfig ref؛ .size-limit ۴kB (واقعی ۳٫۷۵kB
    brotli)؛ LICENSE sync (۴۰)؛ DEC-029 (reporter seam / zod دونگی /
    امضای form / subpath build / seed snapshot).
  - گیت‌های محلی سبز: lint (۰ error)/format/typecheck (40)/test ۹۰۶/
    coverage/build (39)/deps:unused (۰)/peer-rule/peer:single-instance/
    dependency-cruiser (۱۷۵ یال ۰ نقض)/publint (40 پاک؛ vscode compile)/
    size-limit/e2e (playwright ۴).
  - CI سبز: run 38077852171 روی bc1f584 (۱۲ job مسدودکننده)؛ issue با
    چک‌لیست تیک‌خورده (+ یادداشت: «schema همهٔ *Options» عمداً باز — در #52
    طبق متن خود issue) و کامنت شواهد بسته شد (status:done).
- #145 انجام شد (موج ۲، SPEC §۲.۵): پکیج جدید `@zenith/storage` (L0، بدون DOM/state):
  یکپارچه‌سازی localStorage/sessionStorage/cookie/memory پشت API واحد با رکورد
  `{v,t,e,d}`، TTL تنبل، namespace (پیش‌فرض `zen`؛ `''` = کلید legacy دقیق)،
  migrate+backfill برای JSON خام (v0)، سیاست quota (evict-oldest با regex `/"t":(\d+)/`
  + یک retry)، sensitive ⇒ فقط memory/cookie، خطاهای ZEN-1101..1104 (+ZEN-1201 ttl)،
  SyncBus تزریق‌پذیر (پیش‌فرض window storage event)، gzip ≤4KB سخت (ASCII؛ parity با
  esbuild `--charset=utf8`). گزینه I در DEC-030: `zen-persist` در runtime ماند
  (L0 نمی‌تواند DOM/state لمس کند) — `packages/runtime/src/directives/persist.ts`
  (hydrate + debounce 300ms + cross-tab + path-copy مثل model.ts؛ اتریبیوت نامعتبر
  فقط logger.warn طبق الگوی parseCacheAttr)، dispatch در walker بعد از zen-model.
  - مصرف‌کننده‌ها: auth (remember-me روی storage، راهنمای security در README)،
    store (`persistStore(store,{storage,key,selector})` — hydrate سنکرون + debounce؛
    بدون تغییر رفتار قبلی)، ecommerce-demo مهاجرت کرد به storage (clone legacy
    `zenith_cart`؛ persistCart/restoreCart حذف) و به JS خالص + importmap تبدیل شد
    (مرورگر .ts خام load نمی‌کند؛ build pipeline نداشتیم) — سه باگ نهفتهٔ demo
    (factory-vs-instance، `store.actions.*`، `this.cartCount.get()`) کشف/رفع شد.
  - زیرساخت meta/e2e: seed + اسنپ‌شات zenith.meta (۴ directive، `--check` سبز)؛
    e2e واقعی cross-tab با Chromium (fixture + spec؛ ۵ سبز؛ acceptance criterion).
  - تست‌ها (red-before-fix، ۹۰ مورد جدید؛ npm test = ۹۹۶ از ۹۰۶): storage هسته/
    drivers/quota/sync/size، zen-persist jsdom ۶، demo-cart ۳، auth-storage.
  - شمارش‌ها/اسناد: ۴۲ دایرکتوری / ۴۱ پکیج قابل‌سفارش؛ runtime deps 18 (+logger
    +storage)؛ root README ۴۲ ردیف؛ package-fields/package-order/ratchet/bundle به‌روز؛
    ARCHITECTURE (۱۸ پکیج §۴ + persist در درخت directives)؛ storage README؛
    DEC-030 (طراحی + گزینه I).
  - گیت‌های محلی سبز: lint ۰ error / format / typecheck 41 / test ۹۹۶ / coverage
    exit 0 / build-all + browser bundle 49.51KB ≤ 50KB / storage size-limit 3.74KB ≤
    4KB (بی‌تغییر آستانه) / deps:unused / peer-rule / peer:single-instance /
    dependency-cruiser ۰ نقض / publint 41 / package-fields / license-sync / e2e ۵.
  - CI سبز: run 38094314128 روی 34dda9e (۱۲ job مسدودکننده)؛ issue با چک‌لیست
    تیک‌خورده + کامنت شواهد بسته شد (status:done).
- #115 انجام شد (موج ۲، DEC-031): یکپارچه‌سازی سه سیستم خطای موازی (state/error-boundary/errors)
  در **یک hub در `@zenith/errors`** (`src/hub.ts`؛ `index.ts`→`core.ts` با `git mv` + barrel):
  - hub: `onError` (تک‌پیاده‌سازی، idempotent، Cleanup برگشتی)، `emitError` (history حلقوی ۵۰ +
    listener ایزوله + sink تزریق‌پذیر `setErrorLogger`؛ fallback `__zenithLog`/console)،
    `reportError` با **حفظ instance** (لازمهٔ directive zen-error)، `setDevMode/isDevMode`،
    `markErrorRouted/isErrorRouted` (ضد double-emit effect→scheduler)، `errorHubGeneration`
    (بازثبت فید errorSignal پس از reset تست)، `resetErrorHubForTesting`.
  - مدل واحد: کلاس `ZenithError` فیلدهای `severity/hint/timestamp/source/expression/element`
    گرفت (element `unknown` — L0 DOM-free)؛ `state.ZenithError` شد alias type فقط (deprecated)؛
    interface موازی error-boundary حذف (`ZenithErrorInfo = ZenithError`)؛ کدهای جدید
    ZEN-905/906/907/908 + کارخانهٔ `developerError` (`ZEN-NNN: text` + docsUrl).
  - ۴۰ `throw new Error` به ZenithError/developerError/resourceHttpError تبدیل شد (baseline ۶۶؛
    ۲۶ باقی‌مانده همگی allowlist: expressions parser، compiler strict-mode، cli/lighthouse،
    shared/assert، errors/core)؛ `errorSignal`/`onError`/`reportError` boundary شدند wrapper روی
    hub (فید lazy — sideEffects:false حفظ شد)؛ effect خطا را به hub emit می‌کند و سپس rethrow
    با علامت routed؛ scheduler emit ZEN-906 (و ZEN-905 برای infinite-loop/afterFlush) با حفظ
    متن‌های قدیمی؛ `onEffectError`/`SchedulerHooks.onError` observer ماندند.
  - یال‌های جدید `@zenith/errors` (dep 1.4.0): state، scheduler، error-boundary، actions، auth،
    components، crud، data، events، resource، service-worker، store، testing، virtual-list،
    transition (+lockfile)؛ errors خودش L0 بی‌وابستگی ماند (cruiser ۰ نقض؛ dependency edges فقط
    رو به پایین). dep بلااستفادهٔ compiler حذف شد.
  - گیت جدید `scripts/error-hygiene.mjs` (`npm run error-hygiene`؛ job deps CI): throw-allowlist،
    مدل/ZenithError/onError تک‌پیاده‌سازی، ceiling console.error/warn = **۲۰۲** (از baseline ۲۴۷؛
    فقط رو به پایین — هدف پلکانی #112/#137). ratchet no-console با مهاجرت واقعی کوتاه شد:
    boundary.ts/error.ts(state) از لیست بیرون (۶۲→۶۱؛ هستهٔ گیت ضدلغزش دست‌نخورده)؛
    index.ts→core.ts + hub.ts (sink) جانشین شدند.
  - تست‌ها (red-before-fix): `errors/test/hub.test.ts` (۹) + `unified-error-path.test.ts` (۵؛
    معیار پذیرش — directive/effect/scheduler هر سه به یک listener + یک history + یک کلاس،
    errorSignal mirror)؛ state-support به‌روز (contract جدید category Runtime/ZEN-905 + sink).
    npm test = ۱۰۱۰ سبز (از ۹۹۶)؛ coverage ≥۷۰ سبز.
  - سازگاری‌ها: `emitError` partial قدیم را normalize می‌کند (lowercase→PascalCase، recoverable
    نادیده)؛ `Zen.reportError(message, opts)` همان امضا؛ `emitError` از state re-export؛
    اتریبیوت zen-error با instance-identity کار می‌کند. `.size-limit` ردیف runtime ۵۰→۵۱kB
    (افزودن اجتناب‌ناپذیر hub؛ در DEC-031 ثبت — بی‌تغییر در آستانه‌های هسته).
  - گیت‌های محلی سبز: lint ۰ error / format / typecheck 41 / test ۱۰۱۰ / coverage / build 40 /
    deps (cruiser ۰ نقض) / deps:unused ۰ / peer-rule / error-hygiene / peer:single-instance /
    publint (مثل baseline) / size-limit / e2e ۵ (fixture importmap + errors) / package-fields /
    license-sync.

- #116 انجام شد (موج ۲، DEC-032): پروتکل یکسان cleanup در کل public API:
  - قرارداد: `Disposable`/`Cleanup` از `@zenith/shared` مبنا شد؛ هر `process*`/`bind*`
    و هر ثبت (`registerX`/`onX`/`beforeEach`/`setHttpConfig`) حالا `Cleanup`
    (`() => void`) **idempotent** برمی‌گرداند و همزمان در آرایهٔ `disposes[]`
    (سازگاری با walker/HMR) قرار می‌گیرد؛ مسیرهای خطا/SSR `() => {}` می‌دهند.
    حذف ثبت‌ها با محافظ هویت (identity-guard) تا cleanup قدیمی ثبت جدید را نبرد.
  - `destroy`/`cancel`/`stop` عمومی → `dispose()`: شش alias منسوخ‌شونده با
    `deprecate()` — ZEN-DEPR-019 (ActionRegistry)، 020 (Auth)، 021 (CrudEngine)،
    022 (FormStore)، 023 (Resource)، 024 (SWController)؛ رجیستری کدها در
    `errors/src/core.ts` + به‌روزرسانی آزمون بازه‌ها؛ حذف در 2.0 (DEC-026).
    رفتاری‌ها نگه داشته شدند و در DEC-032 allowlist شدند: `TransitionRun.cancel`
    (run-scoped)، `http.cancelRequest/cancelAllRequests`، `Zen.stop` (shutdown)،
    `schema.stop` (فیلد بولی نتیجه)، `cli/lighthouse.stop` (tooling).
  - `VirtualListController` خود یک Cleanup callable شد (`(): void` + `dispose()` —
    DEC-032)؛ `create*ها` (`createAuth/createResource/createForm/createWizardForm/
    createCrudEngine/createActionRegistry/createSWController/createTransition/
    createVirtualList/createSuspense/createStorage/createLogger/createCache`)
    مستقیم یا از طریق class/interface متناظر `dispose()` دارند.
  - گیت جدید `scripts/cleanup-hygiene.mjs` (`npm run cleanup-hygiene`؛ job deps CI):
    (۱) هر `process*`/`bind*` exportشده نوع بازگشتی Cleanup صریح؛ (۲) هر عضو
    `destroy/cancel/stop` یا alias کامل است (`@deprecated` + `deprecate(ZEN-DEPR…,
    x.<name>())` + `dispose` در فایل) یا در BEHAVIORAL_ALLOWLIST با کامنت DEC-032
    در همان فایل؛ ردیف کهنه allowlist = شکست. خروج: 36 process*/bind* و 15 عضو ✔.
    تابع pure `checkCleanupHygiene(packagesDir, read)` export شد؛
    `scripts/test/cleanup-hygiene.test.mjs` (۱۷ تست: fixture مصنوعی red-before-fix
    برای void process*، نوع غلط، destroy غیر-alias، alias صحیح، allowlist بدون
    کامنت، ردیف کهنه + acceptance روی ریپوی واقعی).
  - تست‌ها (red-before-fix، ۴۸ مورد جدید سبز): `cleanup-protocol.test.ts` در
    actions/auth/form/resource/crud/router/http/state/suspense/data/components/
    service-worker + transition/virtual-list (نشت listener/timer/observer: بعد از
    dispose صفر) + `runtime/test/process-dom-cleanup.test.ts` (توقف zen-text پس از
    cleanup + سازگاری `__zenithDisposes`). `npm test` = ۱۰۵۸ سبز (از ۱۰۱۰).
  - بهداشت #115 حفظ شد: دو `console.error` جدیدِ dispose-catch به hub منتقل شدند
    (`reportError(err, source, { phase: 'dispose' })` در walker.ts/processor.ts) —
    ceiling ۲۰۲ بدون افزایش؛ ratchet فقط رو به پایین.
  - Docs: DEC-032 (زمینه/گزینه‌ها/تصمیم/پیامدها؛ لینک #116/#117/DEC-021/026/031)؛
    READMEهای auth/resource/form/crud/actions/service-worker/http/router/state
    (انگلیسی/فارسی) با بخش «cleanup protocol — #116/DEC-032»؛ rfc-decisions آزمون
    max DEC 031→032؛ package.json اسکریپت؛ main.yml گیت در job deps.
  - گیت‌های محلی سبز: lint ۰ error / format (prettier --write روی فایل‌های جدید) /
    typecheck 41 / test ۱۰۵۸ / coverage exit 0 (هسته ≥۷۰) / error-hygiene 202/202 /
    cleanup-hygiene / peer-rule / deps:unused ۰ / dependency-cruiser ۰ نقض /
    size-limit / publint (مثل baseline — خطای zenith-vscode از قبل با --check CI
    با compile رفع می‌شود).

- #117 انجام شد — جزئی (موج ۲؛ کامیت 747d0b3): سند مبنا `docs/API-CONVENTIONS.md`
  (§۰ TL;DR، §۱ شش الگوی ساخت/ثبت/تعریف/اتصال/راه‌اندازی/رویداد با مثال + «اجرا»
  برای هر قاعده، §۲ MaybeReactive+toValue، §۳ dispose/Cleanup، §۴ خطا/گزینه‌ها،
  §۵ جدول قاعده↔lint، §۶ جدول نگاشت نام‌های فعلی→قرارداد، §۷ گیت‌ها).
  - یکدست‌سازی رفتاری: `schedule` → alias منسوخ روی `scheduleEffect`
    (ZEN-DEPR-025)؛ `installStatefulComponents()` → alias منسوخ روی مسیر مشترک
    `registerStatefulDirectives()` با نصب canonical `ZenithStatefulPlugin`
    (ZEN-DEPR-026) و بازگشت Cleanup idempotent — console.warn تکراری حذف شد ⇒
    ceiling error-hygiene ۲۰۲→۲۰۱ (DEC-031 به‌روزشد).
  - گیت قرارداد: `scripts/test/api-conventions.test.mjs` (۸ تست — هر قاعده مثال
    ``` دارد، جدول lint ≥۱۰ ردیف، §۶ همهٔ exportهای ناهمگونِ واقعیِ init/setup/
    load/cleanup/alert/confirm را فهرست می‌کند، DEPR-025/026 ثبت‌شده، تک‌مسیر بودن
    install stateful). `docs/README.md` بخش «قراردادها».
  - دلیل باز ماندن (جزئی): (۱) قوانین واقعی `@zenith/eslint-plugin`
    که جدول §۵ را اجرایی کند → **#159** (موج ۴)؛ (۲) لینک از `CONTRIBUTING.md`
    که هنوز نوشته نشده → **#107** (موج ۴؛ فعلاً docs/README ارجاع معادل است).
    تست‌های قرارداد #117 دروازهٔ میانی را قفل کرده‌اند.

- #173 انجام شد — جزئی (موج ۲): `docs/ATTRIBUTE-GRAMMAR.md` — گرامر attributeهای `zen-*`
  و رویداد CustomEvent (SPEC §۰.۳):
  - §۱ هر ۱۰ قاعده + الزام متادیتا با مثال HTML/ts و بند «اجرا» (منبع کد واقعی:
    `resource/src/directive.ts:39` zen-state، `walker.ts:904` zen-bind:،
    `events/src/modifiers.ts` BUILTIN_MODIFIERS، `stateful-button.ts:158`
    data-state، `shared/src/options.ts` parseBooleanAttr/parseDuration/`:expr`);
    §۲ استثنای‌های پارامتریک (`zen-bind:<attr>`/`zen-action:<event>.<mod>`)؛
    §۳ DirectiveMeta (شکل حداقلی #142 vs شکل کامل SPEC §۰.۳ + نمونهٔ
    defineDirectiveMeta + مسیر تولید zenith.meta.json/html.customData.json با
    `gen-zenith-meta.mjs --check`)؛ §۴ جدول طبقه‌بندی ۱۷ directive موجود
    (≥۱۰ معیار پذیرش) + فهرست ۵ مورد ناسازگار با فایل:سطر و issue مقصد
    (crud `data-body/data-ids`/`zen-bind:data-resource` → #52/#172؛
    `CustomEvent('change')` بدون bubbles در date-picker.ts:244؛ متادیتای
    ثبت‌نشدهٔ zen-crud-*/zen-router-*/zen-suspense-* → #52/#148)؛ §۵ نگاشت
    قاعده↔lint (`valid-directive`/`no-unknown-option` → #159).
  - گیت جدید `scripts/attribute-grammar.mjs` (`npm run attribute-grammar`؛ job
    deps CI): سازگاری جدول §۴ سند ↔ seed رجیستری (ثبت‌بودن نام، no-unknown-option
    با مستثنای `:param`، حداقل ۱۰ ردیف معتبر، نمونهٔ کد در هر §۱.x). تابع pure
    `checkAttributeGrammar(doc, seed)` export شده.
  - seed متادیتا از ۴ به ۱۷ directive رسید (افزودن zen-action/bind/cloak/fetch/
    html/html-trusted/key/ref/resource/show/static/text/transition + zen-state
    به attributes zen-fetch/zen-resource)؛ اسنپ‌شات‌ها بازتولید و `--check` سبز.
  - تست‌ها: `scripts/test/attribute-grammar.test.mjs` (۱۶ تست — fixture red برای
    ثبت‌نشده، گزینهٔ ناشناخته، :param، <۱۰، بند بدون مثال/گمشده، نام غیرkebab +
    acceptance روی سند/seed واقعی و لینک متقابل API-CONVENTIONS/README).
    `npm test` = ۱۰۸۸ سبز (از ۱۰۷۲).
  - لینک‌ها: از `API-CONVENTIONS.md` §۷ (سند خواهر + گیت) و `docs/README.md`
    «قراردادها»؛ لینک CONTRIBUTING → #107 (موج ۴) در header سند یادداشت شد.

- #172 انجام شد (موج ۲، کامیت 84926bb): ابزار اسکفولد `scripts/new-package.mjs`
  (`npm run new-package -- <slug> --layer=L<0..5>`):
  - تولید استاندارد `package.json` (فیلدهای #70، `zenith.layer`، `sideEffects: false`،
    `engines >=18.19.0`)، `tsconfig.json`، `src/index.ts`، `test/<slug>.test.ts`،
    `README.md`، `LICENSE`؛ قالب چک‌لیست `.github/ISSUE_TEMPLATE/new-package.md`؛
    ۵ تست در `scripts/test/new-package.test.mjs`.

- #52 انجام شد (موج ۲، کامیت b20b994): اعتبارسنجی گزینه‌ها در مرز ورودی
  (`defineOptions` از `@zenith/schema` + `DEFAULTS` منجمد):
  - پشتیبانی از اعتبارسنجی آرایه (`s.array(itemSchema)`) در `@zenith/schema`؛
  - پیاده‌سازی در ۵ پکیج هدف: `auth` (`authOptions` / `AUTH_DEFAULTS`)، `http`
    (`httpClientOptions` / `HTTP_DEFAULTS`)، `service-worker` (`swControllerOptions` /
    `SW_DEFAULTS`)، `vite-plugin` (`zenithPluginOptions` / `VITE_PLUGIN_DEFAULTS`)،
    `runtime` (`zenStartOptions` / `ZEN_START_DEFAULTS`)؛ پرتاب `ZEN-1001`/`1002`/`1004`
    با پیشنهاد Levenshtein؛ تست‌های `options-validation.test.ts` در هر ۵ پکیج.

- #147 انجام شد (موج ۲، کامیت 9657750): پکیج `@zenith/devtools-core` (L1) +
  قلاب `setSignalObserver` در `@zenith/state`:
  - حلقه‌بافر بدون تخصیص `RingBuffer<T>`، رجیستری شناسه‌های ضعیف `WeakIdRegistry`،
    پروتکل پیام تایپ‌شده `ZENITH_DEVTOOLS_PROTOCOL_VERSION`، و هستهٔ `createDevtoolsCore`
    با حالت غیرفعال zero-overhead؛ ۱۲ تست (شامل آزمون نشت حافظه با `WeakRef` و بودجهٔ حجم < 4 KB).

- #148 انجام شد (موج ۲، کامیت e9f44ef): پکیج `@zenith/runtime-core` (L3) و مدل `createApp`:
  - `createApp()` بدون تکیه به singletonهای ماژول، متدهای زنجیره‌ای `directive/use/provide/inject/mount/unmount/dispose`،
    انجماد رجیستری دایرکتیوها پس از `mount()` (`ZEN-302`)، ۵ دایرکتیو هسته (`text/bind/on/show/if`)؛
    هم‌ترازی `createApp` در `@zenith/runtime` با هشدار منسوخ‌سازی `Zen.start` (`ZEN-DEPR-027`)؛ ۱۱ تست.

- #149 انجام شد (موج ۲، کامیت 1ded9d7): پکیج چتر `zenith` (L5):
  - زیرمسیرهای `zenith`، `zenith/core`، `zenith/ssr`، `zenith/testing`، `zenith/browser`؛
    پریست‌های پلاگین `minimal` / `spa` / `full` (همراه با `Object.freeze`)؛ تابع `watch()`؛
    تولید باندل IIFE مرورگر (`dist/zenith.global.js` + `.map` + `.sri` با هش SHA-384) در `build-all.mjs`؛ ۹ تست.

- #92 انجام شد (موج ۲، کامیت 67607e3): ایزوله‌سازی کامل SSR همزمان و سازگاری با Edge:
  - `createAsyncContextStore` با fallback ایمن برای محیط‌های فاقد `node:async_hooks`؛
    ایزوله‌سازی per-request برای DOM، state/effects، route، componentRegistry، actionRegistry،
    serverComponents و locale؛ پشتیبانی از `options.createDOM` برای محیط‌های Edge؛
    محافظت از `HTMLElement` در زمان import ماژول؛ تست ۱۰۰ درخواست همزمان بدون نشت در `packages/ssr/test/concurrent-isolation.test.ts`.

- #48 و #49 انجام شدند (موج ۲، کامیت e297f26): حذف وابستگی معکوس و قفل‌کردن معماری لایه‌ای L0–L5:
  - #48: حذف وابستگی `@zenith/router` از `@zenith/events` و جایگزینی با تزریق callback
    `setLinkNavigationHandler` در `@zenith/runtime`؛ تست محافظ `packages/events/test/reverse-deps.test.ts`.
  - #49: تدوین سند رسمی `docs/ARCHITECTURE-LAYERS.md` (لایه‌های L0 تا L5 و Tooling) و
    قوانین مسدودکنندهٔ `forbidden` در `.dependency-cruiser.cjs` (۱۹۰ ماژول، ۰ نقض، ۰ چرخه).

- #28 انجام شد (موج ۳ / P0، کامیت 926b3c0): مجموعه تست‌های واحد DOM برای هر ۱۰ پکیج وابسته به DOM:
  - افزودن تست‌های jsdom برای `runtime` (`directives-dom.test.ts`)، `events` (`events-dom.test.ts`)،
    `router` (`router-dom.test.ts`)، `components` (`components-dom.test.ts`)، `ssr` (`ssr-dom.test.ts`)،
    `data-table` (`data-table-dom.test.ts`) و `error-boundary` (`error-boundary-dom.test.ts`) در کنار
    تست‌های `transition`، `virtual-list` و `suspense` (۳۳ فایل تست / ۹۷ تست سبز در پکیج‌های DOM).

- #29 انجام شد (موج ۳، کامیت 0315380): افزایش پوشش تست پکیج‌های هسته به ≥۸۰٪ و اعمال گیت CI در `vitest.config.ts`:
  - `state` (۸۸٫۰۳٪ statements / ۸۵٫۱۴٪ lines)، `scheduler` (۸۲٫۵۸٪ statements / ۸۲٫۵۸٪ lines)،
    `expressions` (۹۲٫۱۱٪ statements / ۹۲٫۰۲٪ lines)، `compiler` (۸۲٫۹۲٪ statements / ۸۳٫۲۱٪ lines)؛
    افزودن تست‌های هدفمند در `packages/{state,compiler,expressions}/test/coverage-80.test.ts`.

- #15 انجام شد (موج ۳، کامیت e8febd1): رفع کامل ۵ مورد باز در `BUG_REPORT.md`:
  - `actions` (#5): snapshot کردن زنجیرهٔ middleware، قفل re-entrancy (`ZEN-ACT-004`) و سیاست صریح ثبت مجدد (`allowOverride` / `ZEN-ACT-003`)؛
  - `crud` (#15): retry نمایی محدود با پشتیبانی از `AbortSignal` و تفکیک خطاهای retryable در `fetchWithRetry`؛
  - `components` (#17): اضافه‌کردن `AbortController` و پاک‌سازی تایمر در `createAsyncComponent`؛
  - `ssr` (#25): تکمیل `renderToStream` با قلاب `onFlush` و بررسی `AbortSignal` در مرزهای تگ؛
  - `vite-plugin` (#29): کش محتوامحور LRU کامل برای `compile` به همراه آمار hit/miss.

- #12 انجام شد (موج ۳، کامیت 3d6d675): جدول ردیابی کامل ۱۳۶ شناسهٔ `BUG-*` / `IMP-*` / `SEC-*`:
  - اسکریپت ممیزی خودکار `scripts/check-traceability.mjs` (همراه با گیت CI در `.github/workflows/main.yml`)،
    سند `docs/TRACEABILITY.md`، تکمیل تست‌های مستقیم برای شناسه‌های بدون تست در `dependency-graph`،
    `devtools` و `permission`، و تست گیت `scripts/test/traceability.test.mjs`.

- #73 انجام شد (موج ۳ / P0، کامیت 9daf006): جایگزینی اسکریپت انتشار ناایمن `scripts/release.mjs`:
  - خط لولهٔ انتشار ایمن با حالت پیش‌فرض `--dry-run`، ترتیب توپولوژیکی از `getPackageOrder()`،
    گیت‌های پیش‌پروازی (تست، بیلد، publint، گیت تمیز)، بررسی نسخه‌های منتشرشده در رجیستری برای
    اجتناب از انتشار مجدد در انتشارهای ناتمام، تولید گزارش JSON و خلاصهٔ Markdown، پیکربندی
    `.changeset/config.json`، مستندسازی گام‌های انسانی در `docs/MANUAL-STEPS.md`، و ۶ تست واحد در `scripts/test/release.test.mjs`.

- #77 و #61 انجام شدند (موج ۳ / P0، کامیت 0b7c594):
  - #77: ممیزی زندهٔ رجیستری npm و اسکریپت برنامه‌ریز مهاجرت اسکوپ `scripts/check-npm-scope.mjs` +
    سند `docs/release/NPM-SCOPE-AUDIT.md` + ثبت گام انسانی رزرو `@zenithjs` در `docs/MANUAL-STEPS.md` + ۵ تست.
  - #61: بستهٔ جامع ممیزی امنیتی مستقل `docs/security/AUDIT-PACKAGE.md` (مدل تهدید، سطوح حملهٔ P0/P1،
    invariants امنیتی، دستورات بازتولید) + اسکریپت اعتبارسنجی مستمر `scripts/security-audit-check.mjs`
    (همراه با گیت CI) + ثبت گام انسانی انتخاب ممیز خارجی در `docs/MANUAL-STEPS.md` + ۴ تست.

- #9 انجام شد (موج ۳): پیاده‌سازی مدیریت موجودی کالا (`inventory`) و مستندسازی `ecommerce-demo`:
  - افزودن وضعیت `inventory` و اکشن‌های `getStock` / `isInStock` / `setStock` / `checkoutOrder` در
    `ecommerce-demo/src/store.js`، بررسی موجودی پیش از افزودن به سبد و کسر موجودی هنگام ثبت سفارش،
    ثبت اکشن `checkout` در `ecommerce-demo/src/main.js`، مستندسازی در `ecommerce-demo/README.md` و
    تست واحد در `packages/store/test/ecommerce-demo-cart.test.ts`.

- موج ۴ — دستهٔ ۱ از P1 (`#8`, `#18`, `#21`, `#22`, `#71` — کامیت 4505671):
  - `#8`: پاک‌سازی ارجاع‌های ازکارافتادهٔ `examples/` و اصلاح قالب خروجی `cli` (`createApp`)؛
  - `#18`: ابطال و هرس کش اندازه‌های `virtual-list` (`invalidateMeasurements`, `remeasure`)؛
  - `#21`: تکمیل اعتبارسنجی یکپارچهٔ گزینه‌های ورودی (`ZEN-1001`..`ZEN-1004`)؛
  - `#22`: راهنمای جامع گزارش خطا، تلمتری و حریم خصوصی (`docs/ERROR-REPORTING.md`)؛
  - `#71`: اسکفولد خودکار پکیج جدید (`npm run new:package` / `scripts/new-package.mjs`).

- موج ۴ — دستهٔ ۲ از P1 (`#41`, `#50`, `#54`, `#55`, `#58` — کامیت 17ee3ee):
  - `#41`: راهنمای جامع دستیارهای کدنویسی و مدل‌های زبانی (`docs/LLM-GUIDE.md`)؛
  - `#50`: ممیزی یکتایی نام نوع‌های عمومی و کاتالوگ پیشوندهای قراردادی (`scripts/check-unique-type-names.mjs`, `docs/API-CONVENTIONS.md`)؛
  - `#54`: گرامر رسمی BNF برای دایرکتیوهای HTML (`docs/ATTRIBUTE-GRAMMAR.md`)؛
  - `#55`: تبدیل توابع بیش از ۲ پارامتر به امضای شیء تنظیمات با حفظ سازگاری (`ZEN-DEPR-035`..`041`)؛
  - `#58`: سیاست رسمی پایداری API عمومی و منسوخ‌سازی (`docs/DEPRECATION-POLICY.md`).

- موج ۴ — دستهٔ ۳ از P1 (`#63`, `#65`, `#75`, `#87`, `#93`, `#96` — کامیت 807ae9b):
  - `#63`: راهنمای استقرار با Content Security Policy سخت‌گیرانه بدون `unsafe-eval` (`docs/CSP-GUIDE.md`)؛
  - `#65`: گردش‌کارهای امنیتی CI شامل CodeQL، اسکن اسرار و Dependency Review (`.github/workflows/security.yml`)؛
  - `#75`: ارتقای افزونهٔ VS Code برای پشتیبانی کامل از همهٔ دایرکتیوها و تشخیص خطا؛
  - `#87`: مهار خودکار تشخیص نشت حافظه در چرخه‌های mount/unmount (`npm run test:leak`)؛
  - `#93`: پشتیبانی از گزارشگرهای خارجی خطا (Sentry/OpenTelemetry) در `@zenith/error-boundary`؛
  - `#96`: مکانیزم Kill-Switch اضطراری و بازیابی خودکار در `@zenith/service-worker` (`sw-kill.js`).

- موج ۴ — دستهٔ ۴ از P1 (`#31`, `#32`, `#34`, `#35`, `#53` — کامیت bfc4bde):
  - `#31`: گردش‌کارهای CI برای بررسی لینک‌ها، قالب PR، برچسب‌گذاری خودکار و مدیریت Stale؛
  - `#32`: ماتریس رسمی سازگاری مرورگرها (`browserslist`) و موتورهای Playwright (`docs/BROWSER-SUPPORT.md`)؛
  - `#34`: گزارشگر خلاصهٔ پوشش کد در GitHub Actions (`scripts/coverage-summary.mjs`)؛
  - `#35`: تست‌های یکپارچهٔ زنجیرهٔ تأمین بین‌پکیجی (`scripts/test/cross-package-integration.test.mjs`)؛
  - `#53`: استانداردسازی اشیای منجمد `DEFAULTS` در ۲۸ پکیج و تولید مرجع `docs/OPTIONS-REFERENCE.md`.

- موج ۴ — دستهٔ ۵ از P1 (`#60`, `#66`, `#72`, `#74`, `#80`, `#83`, `#107` — کامیت 2ef467c):
  - `#60`: مدل تهدید جامع STRIDE (`docs/security/threat-model.md`)؛
  - `#66`: گردش‌کار انتشار مبتنی بر تگ با OIDC و `--provenance` (`.github/workflows/release.yml`)؛
  - `#72`: استراتژی نسخه‌بندی Lockstep SemVer و تولیدکنندهٔ خودکار Changelog (`scripts/changeset.mjs`)؛
  - `#74`: ممیزی محتوای tarball و شرط‌های صادراتی `types`-first (`scripts/pack-audit.mjs`)؛
  - `#80` و `#107`: اسناد حاکمیت و سلامت جامعه (`CODEOWNERS`, `MAINTAINERS.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `GOVERNANCE.md`, `ROADMAP.md`)؛
  - `#83`: بودجهٔ حجمی gzip برای تمامی ۴۸ ورودی پکیج‌ها و باندل‌ها (`.size-limit.json`, `scripts/size-report.mjs`).

- موج ۴ — دستهٔ ۶ از P1 (`#86`, `#89`, `#91`, `#98`, `#100`, `#101`, `#104`, `#105`):
  - `#86`: مجموعه بنچمارک قابل‌بازتولید (`npm run bench` / `scripts/bench.mjs`) و مقایسه با سیگنال‌های مرجع؛
  - `#89`: بهینه‌سازی O(1) و تست ۱۰۰٬۰۰۰ آیتم، ارتفاع متغیر و حالت افقی RTL در `@zenith/virtual-list`؛
  - `#91`: استخر JSDOM و کش قالب‌های `<template>`، مهلت زمانی رندر (`ZEN-1801`) و جریان واقعی Web `ReadableStream` با backpressure در `@zenith/ssr`؛
  - `#98`: ممیزی و تکمیل انطباق WCAG 2.2 AA (`prefersReducedMotion`, `renderAccessibleToast`/`Dialog`, `announceRouteChange`, `syncActiveRouteLinks`, `docs/A11Y-AUDIT.md`)؛
  - `#100` و `#101`: پشتیبانی جامع RTL، جهات منطقی CSS، ایزوله‌های دوجهتهٔ یونیکد (`isolateBidi`) و فرمت‌بندی بومی `Intl` در `@zenith/i18n` و `@zenith/jalali`؛
  - `#104` و `#105`: راهنمای شروع سریع و آموزش ۳۰ دقیقه‌ای (`docs/GETTING-STARTED.md`)، کتاب آشپزی ۱۰ دستورالعملی (`docs/COOKBOOK.md`)، سیاست چرخهٔ عمر پشتیبانی (`SUPPORT.md`) و جدول مهاجرت نسخه به نسخه (`docs/migration-guide.md`).

- موج ۴ — دستهٔ ۷ از P1 (`#33`, `#38`, `#39`, `#56`, `#57`, `#99`, `#103`):
  - `#33` و `#99`: رفع باگ امضای `Zen.start` در قالب PWA (`pwaMainTsTemplate`)، پیاده‌سازی ممیز خودکار دسترس‌پذیری `auditAccessibility` و `expectAccessible` در `@zenith/testing`، و افزودن تست‌های E2E قالب‌های `zenith create` و دموها (`packages/cli/test/templates-e2e.test.ts`, `e2e/demos-and-a11y.spec.ts`)؛
  - `#38`: حذف کامل `any` از امضاهای عمومی ۱۸ پکیج پایه/مدرن (از جمله `devtools-core`) و اسکریپت ممیزی `scripts/check-public-any.mjs`؛
  - `#39`: یکپارچه‌سازی `@zenith/logger` با حفظ بودجهٔ حجمی زیر ۲KB gzip و قانون ESLint `no-console: error`؛
  - `#56` و `#103`: تولید خودکار اسنپ‌شات سطح API عمومی (`docs/api/api-surface.snapshot.json`) و صفحات مرجع API برای تمامی ۴۳ پکیج (`docs/api/*.md`, `docs/api/INDEX.md`, `scripts/generate-api-docs.mjs`)؛
  - `#57`: افزودن متادیتای محیط هدف `zenith.target` و زیرمسیر `./package.json` به همهٔ پکیج‌ها و حذف شاخه‌های `__ZENITH_DEV__` در بیلد production (`scripts/build-package.mjs`).

- موج ۴ — دستهٔ ۸ از P1 (`#118`, `#119`, `#120`, `#121`, `#122`, `#123`, `#124`, `#125`):
  - `#118`: یکسان‌سازی کامل قرارداد ۵ متدی رجیستری‌های سراسری (`registerX` با خروجی `Cleanup` idempotent، `getX`، `hasX`، `listXs`، `unregisterX`) در `actions`، `components`، `resource`، `store` و `ssr`، به همراه `registerTestingReset` و `resetForTesting()` در `@zenith/testing`؛
  - `#119`: تعریف نام‌های غیرمبهم عمومی (`clearHttpCache`، `httpRequest`، `clearExpressionCache`، `showAlert`، `showConfirm`، `scheduleEffect`)؛
  - `#120` و `#121`: استانداردسازی دایرکتیوها با `parseConfigAttr` و مجموعه تست انطباق خودکار قرارداد (`scripts/test/api-conformance.test.mjs`)؛
  - `#122`: پیاده‌سازی `watch(source, cb, options)` در `@zenith/state` با پشتیبانی از منبع تکی/آرایه‌ای، `oldValue`/`newValue`، `immediate`، `flush: 'pre' | 'post' | 'sync'`، `deep`، `once`، `onCleanup` و `untrack` خودکار بدنهٔ `cb`؛
  - `#123`: پیاده‌سازی `createAsync` و `asyncComputed` در `@zenith/state` با سیگنال‌های `data`/`loading`/`error`، لغو خودکار درخواست‌های قبلی با `AbortSignal` و محافظت در برابر شرایط رقابتی (race conditions)؛
  - `#124` و `#125`: چرخهٔ عمر رسمی کامپوننت/دایرکتیو (`onMount`، `onUnmount`، `onUpdate`) و تزریق وابستگی درختی تایپ‌شده (`provide`، `inject`، `createInjectionKey<T>`) در `@zenith/runtime-core` و `@zenith/runtime`.

- موج ۴ — دستهٔ ۹ از P1 (`#126`, `#127`, `#128`, `#129`, `#130`, `#131`, `#132`, `#133`, `#134`, `#135`, `#136`):
  - `#126`: افزودن `afterEach`، `setScrollBehavior`، `installRouteAnnouncer` (انتقال فوکوس به `main` و `aria-live`) و انتقال مسیر در `@zenith/router`؛
  - `#127`: پشتیبانی از `$subscribe(cb, { immediate })`، `$onAction`، سیستم پلاگین (`store.use` / `useStorePlugin`) و ذخیره‌سازی پایدار `persistStore` با مهاجرت نسخه (`version`/`migrate`) و `pick`/`omit` در `@zenith/store`؛
  - `#128`: یکپارچه‌سازی ورودی `createForm(options)` برای قواعد رشته‌ای، توابع اعتبارسنجی، اسکیما و حالت چندمرحله‌ای (Wizard) در `@zenith/form`؛
  - `#129`: پشتیبانی از `onUploadProgress`/`onDownloadProgress`، ترکیب `AbortSignal` خارجی با خطای استاندارد `ZEN-1600` و `mockHttp` در `@zenith/http`؛
  - `#130`: باطل‌سازی سراسری مبتنی بر تگ (`invalidate(tags)`) در `@zenith/data` و `@zenith/resource`؛
  - `#131`: مجازی‌سازی O(1) برای ۱۰۰٬۰۰۰+ ردیف (`virtualWindow` / `setScrollTop`)، خروجی استاندارد `exportCsv` با پشتیبانی از UTF-8 BOM فارسی و رندر دسترس‌پذیر `renderAriaGrid` در `@zenith/data-table`؛
  - `#132`: صف‌بندی خودکار اعلان‌ها با سقف `maxVisible` و ادغام اعلان‌های تکراری (`deduplicate`) در `@zenith/notifications`؛
  - `#133`: احترام کامل به `prefers-reduced-motion` در `createTransition` و تابع `runRouteTransition` (`out-in` / `in-out`) در `@zenith/transition`؛
  - `#134`: تلاش مجدد خودکار با backoff نمایی (`zen-error-retry`)، `resetErrorBoundary`، رویداد `zen-error-recover` و fallback قابل‌پیکربندی در `@zenith/error-boundary`؛
  - `#135`: سیگنال‌های واکنش‌گرای `can(permission)` / `canSignal` / `hasRoleSignal` و قرارداد ۵ متدی رجیستری در `@zenith/permission`؛
  - `#136`: افزودن رسمی `passive` و `capture` به `BUILTIN_MODIFIERS` و `extractListenerOptions` در `@zenith/events`.

- موج ۴ — دستهٔ ۱۰ از P1 (`#137`, `#138`, `#139`, `#140`):
  - `#137`: تکمیل ابزارهای ارگونومیک تست در `@zenith/testing` شامل `useFakeTimers` (یکپارچه با `flushSync`)، `mockHttp`، `mockRouter`، `testDirective` و `resetForTesting`؛
  - `#138`: ثبت صریح ۶ دایرکتیو فقط-runtime (`zen-resource-view`, `zen-action-button`, `zen-auth-view`, `zen-router`, `zen-button`, `zen-if-chain`) در `RUNTIME_DIRECTIVES` کامپایلر، صادرات `COMPILABLE_DIRECTIVES`/`RUNTIME_DIRECTIVES` و مستند جدول انطباق (`docs/DIRECTIVE-PARITY.md`)؛
  - `#139`: تکمیل قرارداد ۵ متدی رجیستری در `@zenith/auth` (`hasAuth`, `listAuths`, `unregisterAuth`)، همگام‌سازی خروج بین تب‌ها (`enableCrossTabSync`) و پشتیبانی از چالش MFA/OTP (`verifyMfa`)؛
  - `#140`: اسکریپت بررسی خودکار انطباق خروجی `.d.ts` و باندل JS (`scripts/check-dts-js-parity.mjs`) در تمامی ۴۳ پکیج.

- موج ۵ — دستهٔ ۱ از NEW-PACKAGES P1 (`#150`، `#151`، `#152`، `#153`، `#154`، `#155`، `#156`، `#157`، `#158`، `#160`، `#174`):
  - `#150`: موتور چندزبانگی واکنشی در `@zenith/i18n` — `createI18n` (پیام‌های ICU شامل `plural`/`select`/`number`/`@:linked`، fallback locale، `tm`/`te`)، سیگنال‌های reactive `locale`/`dir`، `i18nPlugin`، `useI18n` و `detectLocale` (query/cookie/navigator)؛
  - `#151`: primitiveهای دسترس‌پذیری headless در `@zenith/runtime(-core)` — `createFocusTrap` (focus trapping کامل با initialFocus/returnFocus/Escape)، `createRovingTabindex` (Arrow/Home/End + سازگاری RTL با loop)، `lockScroll` (reference-counted) و `useId` (شناسهٔ قطعی SSR-safe و per-app)؛
  - `#152`: مدیریت `<head>` واکنشی — `createHead` (dedupe meta/link با الویت آخرین ورودی، titleTemplate، سقف maxTags)، `useHead`، `renderHead` و `titleFromRoute` در `@zenith/ssr`؛
  - `#153`: primitive موقعیت‌دهی headless — `computePosition` (top/bottom/left/right + flip خودکار نسبت به viewport) برای popover/tooltip/menu در `@zenith/runtime(-core)`؛
  - `#154`: کلاینت realtime در `@zenith/http` — `createRealtime`/`createWebSocket`/`createSSE` با صف آفلاین (maxSize)، سیگنال‌های status/lastMessage/messages، subscribe ژرف‌محور بر اساس topic و رد قاطع `ws://` ناامن در production (ZEN-1703/1704)؛
  - `#155`: موتور analytics در `@zenith/runtime` — `createAnalytics` با رعایت consent (opt-in)، DNT و providerهای console/beacon/gtag/plausible؛
  - `#156` + `#157` + `#174`: ادغام SSR — `renderToString/Stream` با پذیرش `app: () => App` (per-request factory)، ورودی‌های per-request `head: SSRHeadInput` و `i18n: SSRI18nInput`، تولید `headTags`/`htmlAttrs`/`bodyAttrs`/`__ZENITH_I18N__` در `SSRResult` و `generateFullPage`، اعلام `@internal` برای `domAls`/`installDOMGlobalGetters` و handlerهای آمادهٔ `createNodeHandler` (Node/Express/Connect + `healthz` + CSP nonce) و `createFetchHandler` (Cloudflare/Deno/Bun/Vercel Edge و aliasهای `createCloudflareHandler`/`createDenoHandler`)؛
  - `#158`: زیرساخت create-zenith — `getTemplateManifest(projectName, template)` (manifest داده‌محور فایل‌های `spa`/`ssr`/`pwa`/`dashboard`/`minimal`) در `@zenith/cli` به‌همراه دستور پیش‌نمایش CLI (`create-zenith-preview`)؛
  - `#160`: پکیج جدید `@zenith/language-server` (Tooling): `analyzeZenithDocument` (استخراج دایرکتیوهای `zen-*` و سیگنال‌های `$name` با موقعیت دقیق line/character)، ثابت `LSP_METHODS`، `createZenithServerCore` (اسناد در حافظه) و `createServerLifecycle` (چرخهٔ حیات initialize/shutdown) به‌عنوان پایهٔ کلاینت نازک vscode-extension.

  بازی‌گردانی انطباق monorepo پس از افزودن پکیج زبان‌سرور (۴۶ پوشهٔ packages / ۴۴ entrypoint): بروزرسانی `README.md` (ردیف جدول)، `.size-limit.json`، تست‌های `package-fields` (45)، `package-order` (45)، `root-readme` (46)، `pack-audit` (44)، `api-surface-docs` (44)، ثابت `DEFAULTS` منجمد برای `state`/`store`/`testing` (تست `defaults-tsdoc`), `docs/OPTIONS-REFERENCE.md` بازتولید، و حذف `any` از `packages/i18n/src/index.ts` (پکیج zero-any).







