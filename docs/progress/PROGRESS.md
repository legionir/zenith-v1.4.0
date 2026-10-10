# Progress Tracker (AGENT-INSTRUCTIONS §2)

آخرین issue کامل: #46
issue در حال انجام: #47
بعدی: #47 (باقی موج ۱) سپس موج ۲
مسدود/نیازمند انسان: #68 (تأیید مالک MIT — docs/MANUAL-STEPS.md)، #59 (فعال‌سازی Private vulnerability reporting از UI — docs/MANUAL-STEPS.md)
آخرین run موفق CI: 38018912934 (روی HEAD #46 — sha 6fe84ff)

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
