# Zenith v1.4.0 — چک‌لیست Production Readiness

این چک‌لیست جدا از رفع باگ‌های `AUDIT.md` است و معماری را در `ARCHITECTURE.md` می‌بینید.
اولویت‌ها: **P0** مانع انتشار · **P1** قبل از نسخهٔ پایدار · **P2** برای بلوغ محصول.

## وضعیت پایه (اندازه‌گیری‌شده)

| معیار | وضعیت |
|---|---|
| `npm ci` | ✅ |
| `npm run typecheck` | ❌ ۱ خطا (`service-worker`) |
| `npm run build` | ❌ ۳۳ از ۳۴ |
| `npm test` | ❌ ۰ موفق، ۱۴ شکست، ۲۱ skip (پوشهٔ `test/` وجود ندارد) |
| `npm audit --omit=dev` | ✅ صفر آسیب‌پذیری |
| `lint` | ❌ فقط `echo` |
| `LICENSE`، `README.md` ریشه، `SECURITY.md` | ❌ وجود ندارند |
| `any` در `src` | حدود ۳۵۰ مورد |
| `console.*` در `src` | حدود ۳۷۰ مورد |

---

## ۱. تست و کیفیت (P0)
- [ ] تست واحد برای هسته: `state`، `scheduler`، `expressions`، `compiler`، سپس بقیه
- [ ] تست DOM واقعی (jsdom یا Playwright) برای directiveها، hydration، router، transition، virtual-list
- [ ] آستانهٔ coverage در CI (هدف ≥ ۸۰٪ برای هسته)
- [ ] تست امنیتی: corpus XSS و mXSS برای `sanitizer`؛ fuzz برای parser/evaluator
- [ ] تست regression برای هر `BUG-xxx` که مستندات ادعای رفعش را دارد
- [ ] تست سازگاری مرورگر (Chrome، Firefox، Safari) و Node 18/20/22
- [ ] e2e برای دموها (`ecommerce-demo`، `dashboard`، `demos/*`) و قالب‌های `zenith create` (حالت PWA هم)
- [ ] تست سازگاری نسخهٔ بین پکیج‌ها (مثلاً یک نسخهٔ `state` برای همه)
- [ ] تست نشت حافظه (mount/unmount هزاران بار)

## ۲. کیفیت کد و ابزار توسعه (P0/P1)
- [ ] ESLint (`typescript-eslint`: `no-floating-promises`، `no-explicit-any`) و Prettier
- [ ] pre-commit با `lint-staged`
- [ ] کاهش `any` در API عمومی به صفر
- [ ] logger مرکزی با سطح لاگ به‌جای `console.*` مستقیم؛ خاموشی در production
- [ ] شکستن فایل‌های بزرگ: `auth.ts` (۱۲۹۳)، `runtime/index.ts` (۱۲۳۶)، `crud-engine.ts` (۱۰۴۴)، `walker.ts` (۹۹۶)، `form.ts` (۹۲۴)
- [ ] `tsconfig.base.json` مشترک (همهٔ پکیج‌ها `noUncheckedIndexedAccess` و `noUnusedLocals` یکسان)
- [ ] یکسان‌سازی و انتقال devDependencyهای مشترک (`typescript`، `@types/node`، `tsx`) به ریشه
- [ ] حذف کد مرده و کامنت‌های ردیابی («Real cleanup:»، «Listener cleanup added»)
- [ ] انتقال `ai-office-backup/` و `ecommerce-preview.png` از ریشه

## ۳. معماری و ساختار پکیج‌ها (P0/P1)
جزئیات در `ARCHITECTURE.md`.
- [ ] حذف وابستگی‌های بلااستفاده (۱۱ پکیج، بخش ۴.۱)
- [ ] قاعدهٔ یکسان peer برای `state` و `scheduler`
- [ ] حذف یا deprecate پیاده‌سازی قدیمی `virtual-list` (`processVirtualList`) و موازی‌های `transition`
- [ ] تقسیم `runtime` (هستهٔ کوچک + directiveهای اختیاری + بستهٔ umbrella)
- [ ] مستقل کردن `service-worker` از `runtime`
- [ ] لایه‌بندی اجباری با `dependency-cruiser`
- [ ] `createApp()` و حذف وابستگی به singleton سراسری
- [ ] یکتا کردن نام `CompileOptions`؛ ادغام `FormOptions`/`AdvancedFormOptions` و `VirtualListConfig`/`VirtualListOptions`
- [ ] قرارداد نام‌گذاری (`createX`/`defineX`/`processX`/`initX`)
- [ ] قرارداد رسمی ثبت directive و hookهای چرخهٔ عمر؛ هر controller یک `dispose()`
- [ ] انتقال `vscode-extension` و `devtools-extension` به `tools/`

## ۴. API عمومی و گزینه‌ها (P0/P1)
- [ ] اعتبارسنجی گزینه‌ها با schema و خطای ZEN-xxx: `AuthConfig`، `HttpRequestOptions`، `SWConfig`، `ZenithPluginOptions`، `ZenStartOptions`
- [ ] پیش‌فرض‌ها در یک شیء frozen برای هر پکیج (الان فقط ۷ ثابت `DEFAULT_*`)
- [ ] TSDoc با `@default` و واحد (ms/s) برای همهٔ گزینه‌ها
- [ ] گزینه‌های Zenith در `HttpRequestOptions` در زیرشیء جدا (جلوگیری از نشت به `fetch`)
- [ ] آرگومان‌های موقعیتی (مثل `retryCount` در `fetcher`) به options object
- [ ] `@public/@internal/@experimental` و `api-extractor` با snapshot API در CI
- [ ] `exports` شرطی: `development`/`production`، `browser`/`node`/`worker`، زیرمسیرها، `./package.json`
- [ ] سیاست deprecation با warning یک‌باره و مستند
- [ ] کدهای خطای `ZEN-xxx` همه‌جا؛ بدون `Error` ساده

## ۵. امنیت (P0/P1)
- [ ] `SECURITY.md` (کانال گزارش، زمان پاسخ)
- [ ] مدل تهدید مکتوب: عبارت‌ها، `zen-html`/`html-trusted`، SSR، auth، service worker
- [ ] ممیزی امنیتی مستقل برای `sanitizer`، `expressions`، `auth`
- [ ] راهنمای رسمی ذخیرهٔ توکن (کوکی HttpOnly سمت سرور)، CSRF و چرخش refresh token؛ پیش‌فرض فعلی `memory` است
- [ ] راهنمای CSP سخت‌گیرانه (بدون `unsafe-eval`) و تست اجرا زیر CSP؛ تست TrustedTypes
- [ ] `Math.random` در مسیرهای امنیتی (`auth`، `suspense`، `sw`) جایگزین `crypto.getRandomValues`
- [ ] Dependabot/Renovate، `npm audit` در CI (dev هم)، اسکن secret (`gitleaks`)
- [ ] publish با `--provenance` و OIDC بدون توکن بلندمدت
- [ ] کاهش `host_permissions` در `devtools-extension` و بازبینی CSP/webview در `vscode-extension`

## ۶. بسته‌بندی و انتشار (P0)
- [ ] فایل `LICENSE` (ریشه و هر پکیج؛ `package.json`ها `MIT` اعلام کرده‌اند)
- [ ] `README.md` ریشه: معرفی، نصب، شروع سریع، جدول پکیج‌ها، معماری
- [ ] فیلدهای `repository`، `homepage`، `bugs`، `publishConfig`، `sideEffects` در همهٔ پکیج‌ها
- [ ] `engines` به `>=18.19`؛ تصمیم دربارهٔ EOL بودن Node 18
- [ ] نسخهٔ `0.1.0` هاردکد CLI از `package.json` خوانده شود
- [ ] CHANGELOG خودکار و استراتژی نسخه‌گذاری (Changesets یا release-please)
- [ ] جایگزینی `scripts/release.mjs` (بدون dry-run، بدون تست، بدون بررسی git تمیز، publish نیمه‌کاره)
- [ ] `publint` و `arethetypeswrong` و `npm pack --dry-run` در CI
- [ ] تصمیم دربارهٔ dual ESM/CJS (خطر دو نمونهٔ state)
- [ ] باندل مرورگری با SRI، minify و sourcemap جدا
- [ ] رزرو scope `@zenith` در npm و بررسی تعارض نام
- [ ] SBOM (CycloneDX) و بررسی لایسنس وابستگی‌ها

## ۷. CI/CD (P0/P1)
- [ ] پایپ‌لاین: lint → typecheck → test → build → publint → e2e → artifact
- [ ] branch protection، CODEOWNERS، merge فقط با CI سبز
- [ ] ماتریس OS (ubuntu/windows/macos) برای CLI
- [ ] cache وابستگی‌ها
- [ ] بودجهٔ حجم (`size-limit`) برای هر پکیج و باندل
- [ ] benchmark خودکار برای کشف regression (پوشهٔ `benchmarks/` دستی است)
- [ ] release خودکار با تگ و GitHub Release
- [ ] هماهنگی `.github/CI.md` با workflow واقعی (`main.yml`، نه `ci.yml`)
- [ ] قالب Issue و PR

## ۸. عملکرد (P1)
- [ ] benchmarkهای بازتولیدپذیر و مقایسه با Solid/Vue/Preact signals؛ ادعاهای `BENCHMARKS.md` با اسکریپت پشتیبانی شوند
- [ ] tree-shaking: `sideEffects`، بررسی اینکه import یک تابع کل `runtime` (۱٫۳MB با `.d.ts`) را نمی‌آورد
- [ ] lazy loading برای directiveهای سنگین (`date-picker`، `data-table`، `crud`)
- [ ] تست `virtual-list` با ۱۰۰ هزار آیتم، ارتفاع متغیر، RTL
- [ ] Core Web Vitals دموها با throttling موبایل
- [ ] SSR: استریم واقعی، backpressure، سقف زمان رندر، کش قالب؛ جایگزین سبک‌تر برای `jsdom`
- [ ] تست SSR هم‌زمان (ایزولاسیون درخواست‌ها)، شامل Edge runtime

## ۹. پایداری و مشاهده‌پذیری (P1)
- [ ] ادغام `error-boundary` با گزارش‌دهنده‌های خارجی (Sentry و مشابه)
- [ ] telemetry اختیاری با opt-in
- [ ] حالت‌های تنزل: بدون JS، بدون service worker، IndexedDB غیرفعال
- [ ] service worker: راهنمای ارتقا، پاک‌سازی cache قدیمی، kill switch
- [ ] انتشار devtools-extension در فروشگاه‌ها با بازبینی حریم خصوصی

## ۱۰. دسترس‌پذیری و i18n (P1)
- [ ] ممیزی WCAG 2.2 AA: `date-picker`، `data-table`، `crud`، `virtual-list`، `transition` (کیبورد، focus، `prefers-reduced-motion`، screen reader)
- [ ] تست خودکار `axe-core` در e2e
- [ ] RTL و جهت‌دهی دوسویه؛ `Intl` برای جمع و تاریخ
- [ ] تست صحت تقویم جلالی (سال کبیسه، مرز ۱۶۰۰ میلادی)؛ رفتار تعریف‌شده به‌جای فقط هشدار
- [ ] پیام‌های خطا با کد پایدار و قابل ترجمه

## ۱۱. مستندات (P1)
- [ ] مرجع API تولیدشده (TypeDoc) برای هر پکیج؛ الان ۱۲ سند دستی
- [ ] راهنمای شروع، آموزش گام‌به‌گام، cookbook (فرم، auth، SSR، PWA)
- [ ] راهنمای مهاجرت با جدول breaking changes؛ سیاست پشتیبانی نسخه/مرورگر/Node
- [ ] تست خودکار مثال‌های مستندات
- [ ] `CONTRIBUTING.md`، `CODE_OF_CONDUCT.md`، `GOVERNANCE`، رودمپ
- [ ] ADR برای تصمیم‌های معماری
- [ ] هر ادعای «FIX» در مستندات به یک تست مرتبط باشد

## ۱۲. تجربهٔ توسعه‌دهنده (P2)
- [ ] CLI: `dev`، `build`، `test`، `doctor`، `upgrade`؛ خروجی `--json` و کد خروج درست
- [ ] vite-plugin: HMR کامل، sourcemap، سازگاری با Vite 6/7/8 (هشدار dev فعلی `vite ≤ 6.4.2`)
- [ ] VS Code: بسته‌بندی `vsce`، تست، انتشار
- [ ] بررسی نوع عبارت‌های قالب در زمان کامپایل
- [ ] پیام‌های خطای قابل‌اقدام با لینک مستندات

## ۱۳. حاکمیت و حقوقی (P0/P1)
- [ ] LICENSE (بند ۶)، CODEOWNERS، حداقل دو نگه‌دارنده
- [ ] سیاست حریم خصوصی برای افزونه‌ها و telemetry
- [ ] بررسی لایسنس وابستگی‌ها

## ۱۴. دموها (P2)
- [ ] `ecommerce-demo`: backend، پرداخت و inventory ندارد؛ یا «demo» اعلام شود یا کامل شود
- [ ] `dashboard`: داده‌های نمونه، permission واقعی نیست
- [ ] دموها در CI ساخته و روی GitHub Pages منتشر شوند

---

## معیار خروج (Definition of Done)

| معیار | الان | هدف |
|---|---|---|
| typecheck / build | ❌ | سبز روی Node 18/20/22 |
| پوشش تست هسته | ۰٪ | ≥ ۸۰٪ |
| lint | غیرفعال | بدون خطا، بدون `any` در API عمومی |
| `npm audit` (prod) | ✅ صفر | صفر + اسکن دوره‌ای |
| LICENSE / README / SECURITY | ❌ | موجود |
| ممیزی امنیتی مستقل | ❌ | انجام‌شده برای sanitizer/expressions/auth |
| a11y | بررسی نشده | WCAG 2.2 AA |
| وابستگی‌های بلااستفاده | ۱۱ پکیج | صفر |
| اعتبارسنجی options | ندارد | همهٔ پکیج‌های اصلی |
| انتشار | اسکریپت دستی | خودکار با provenance |

## ترتیب پیشنهادی

1. **هفتهٔ ۱:** رفع build (`AUDIT.md` بخش ۱)، LICENSE/README/SECURITY، ESLint، اسکلت تست، حذف وابستگی‌های بلااستفاده
2. **هفتهٔ ۲–۴:** تست هسته، CI کامل، جایگزینی release، اعتبارسنجی options
3. **ماه ۲:** ممیزی امنیتی، a11y، بودجهٔ حجم، تقسیم `runtime`، `createApp()`
4. **قبل از ۱٫۰ پایدار:** نسخهٔ beta/RC عمومی و جمع‌آوری بازخورد
