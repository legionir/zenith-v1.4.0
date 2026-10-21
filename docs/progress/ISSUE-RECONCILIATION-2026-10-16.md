# تطبیق issueهای باز با کد و گزارش‌ها — ۲۰۲۶-۱۰-۱۶

## نتیجهٔ اجرایی

مبنای بررسی: commit `734f80b7e13d7d3fc96693b38df9dba95459a3f6`، شاخهٔ کاری `arena/ff992be5-zenith-v1-4-0`؛ ۶۳ issue باز در GitHub (۵۲ issue اجرایی و ۱۱ epic/index/roadmap). این بررسی فقط گزارش است؛ هیچ issue، تنظیم GitHub یا کد اجرایی تغییر نکرده است.

**چهار issue از نظر معیار پذیرشِ قابل بررسی در مخزن، تکمیل شده و پیشنهاد بسته‌شدن دارند: #106، #108، #112، #119.** همه در زمان بررسی همچنان در GitHub باز بودند. منظور از «تکمیل» صرف وجود تابع یا پاس‌شدن یک smoke test نیست؛ معیارهای issue، کد، تست و گیت CI با هم بررسی شده‌اند.

- **#67 و #132 نزدیک به تکمیل‌اند**، اما شواهد مرورگری/دسترس‌پذیریِ مورد درخواست هنوز کامل نیست؛ فعلاً باز بمانند.
- **#61، #66، #77، #80، #97 و #107** به شواهد بیرون مخزن/اقدام مالک نیاز دارند؛ وجود فایل سیاست یا workflow اثبات اجرای آن نیست.
- **هیچ‌کدام از #176 تا #185 آمادهٔ بسته‌شدن نیستند.** #186 نیز نگاشت تاریخی مفیدی است، نه سند تکمیل کار.
- ادعاهای «انجام شد» در `docs/progress/PROGRESS.md` در چند مورد فقط به زیرمجموعهٔ پیاده‌سازی اشاره دارند، نه تمام معیار پذیرش.

## روش و شواهد اجرایی

بدنهٔ هر ۶۳ issue از GitHub دریافت شد؛ endpoint کامنت‌ها نیز بررسی شد (کامنتی برای این issueهای باز برنگشت). معیارهای پذیرش با source، manifest، تست‌ها، workflowها و گزارش‌ها تطبیق داده شدند. مقایسهٔ این گزارش با معیارها سخت‌گیرانه است؛ تغییر دامنه یا جایگزینی فناوری بدون تصمیم صریح، به‌عنوان تکمیل تمام issue حساب نشده است.

### اجرای مجدد محلی

محیط: Linux، Node `v22.22.3`، npm `10.9.8`.

| دستور | نتیجهٔ واقعی این بررسی |
|---|---|
| `npm ci --no-audit --no-fund` | موفق |
| `npm run lint` | exit 0؛ **۰ خطا، ۹۳۸ هشدار**؛ «بدون خطا» با «بدون بدهی کیفیت» فرق دارد |
| `npm run typecheck` | موفق؛ **۵۰ پکیج + ۱ فایل type-test**، بدون emit |
| `npm run build` | موفق؛ **۴۹ built، ۰ failed**؛ `vscode-extension` به علت نداشتن `src/index.ts` در این اسکریپت skip می‌شود |
| `npm test` | **۲۱۶ فایل، ۱۸۴۱ تست پاس؛ بدون fail/skip گزارش‌شده** |
| `npm audit --json` | exit 1؛ **۱۰ آسیب‌پذیری: ۲ critical، ۵ high، ۳ moderate** |
| `npm audit --omit=dev --json` | صفر آسیب‌پذیری |
| `node scripts/check-public-any.mjs` | سبز؛ فقط entrypointها، نه کل API تولیدشده؛ عدد entrypoint any=0 |
| `auditSrcAnyTotals()` از همان اسکریپت | **۴۷۶ مورد** طبق الگوی شمارش خود مخزن، بالاتر از هدف ≤۱۰۰ |
| `node scripts/check-error-docs.mjs` | سبز؛ ۸۱ کد چهاررقمی + ۴۶ کد سه‌رقمی + ۶۴ deprecation |
| `node scripts/check-unique-export-names.mjs` | سبز؛ ۱۳ نام مشترک با ۱۳ استثنای مستدل |
| `node scripts/check-adr.mjs` | سبز؛ **۱۵ ADR** معتبر |
| `node scripts/generate-architecture-graph.mjs --check` | سبز؛ نمودار تازه |
| `node scripts/attribute-grammar.mjs` | سبز؛ ۴۸ directive ثبت‌شده، ۳۷ نام سطح attribute؛ بدون JSON.parse مستقیم attribute طبق گیت |
| `node scripts/positional-config-audit.mjs` | سبز؛ ۸۶۱ امضا، اما **۱۱۳ مورد allowlist** |
| `node scripts/generate-api-docs.mjs --check` | سبز؛ ۴۹ پکیج + ۱۱ زیرمسیر؛ این گیت جای api-extractor کامل نیست |
| `node scripts/generate-benchmarks-doc.mjs --check` | سبز؛ سند با baseline همخوان است، نه اثبات بازتولید همهٔ اعداد با خطای ≤۵٪ |

لاگ‌های خام در محیط بررسی، خارج از Git، در `/home/user/issue-review/` نگه داشته شدند. تعدادهای grep/regex معیار اثبات نبودن همهٔ خطاها نیستند؛ مثال نقض مشخص برای نتیجه‌گیری‌های اصلی آورده شده است.

### CI روی همان commit

[CI run 38894573919](https://github.com/legionir/zenith-v1.4.0/actions/runs/38894573919) روی SHA مبنا **success** است: ۱۷ job موفق (از جمله build روی Node 18.19/20/22، تست Windows/macOS و browser e2e با Chromium/Firefox/WebKit)، یک job اتصال bundle به release نیز skipped بود.

در این بررسی browser e2e، coverage، ممیزی مستقل و benchmark کامل مجدداً اجرا نشدند؛ برای شواهد مرورگریِ موجود به run بالا رجوع شده است. سبز بودن browser e2e فقط سناریوهای موجود را تأیید می‌کند، نه سناریویی که اصلاً نوشته نشده است.

## ۱. پیشنهاد بسته‌شدن: ۴ issue

| issue | دلیل تکمیل | شواهد مشخص و حدود ادعا |
|---|---|---|
| [#106](https://github.com/legionir/zenith-v1.4.0/issues/106) تست مثال‌های مستندات | استخراج fenceهای علامت‌خورده، typecheck واقعی TypeScript و اجرای مثال‌های `test-run`/`test-dom` در CI برقرار است؛ تست منفی شکستن API هم وجود دارد. | `scripts/lib/docs-examples.mjs`، `scripts/check-docs-examples.mjs`، `scripts/test/docs-examples.test.mjs` (۴ تست)، `scripts/test/docs-examples-dom.test.mjs` (۱ تست)، job `deps`. در وضعیت فعلی هر **۱۴ مثال علامت‌خورده TS** است. محدودیت: پشتیبانی آیندهٔ `html test` فقط بررسی خالی/بی‌تگ نبودن است، نه اجرای directive؛ ادعای پوشش همهٔ مثال‌های بدون علامت نداریم. |
| [#108](https://github.com/legionir/zenith-v1.4.0/issues/108) ADR و نمودار معماری | ۱۵ ADR با قالب MADR، فهرست کنترل‌شده، نمودار از گراف واقعی، توضیح هستهٔ reactive و گیت تازگی در CI وجود دارد. | `docs/adr/0001..0015`، `docs/ARCHITECTURE-GRAPH.md`، `scripts/check-adr.mjs`، `scripts/generate-architecture-graph.mjs`، `scripts/test/adr-and-graph.test.mjs` (۹ تست). |
| [#112](https://github.com/legionir/zenith-v1.4.0/issues/112) خطاهای دارای راهنما | `ZenithError.docsUrl` پیش‌فرض دارد؛ `toUserString()` لینک چاپ می‌کند؛ صفحات علت/نمونه/رفع از catalog تولید می‌شوند؛ گیت drift و صفحهٔ یتیم با تست منفی اجرا می‌شود. | `packages/errors/src/core.ts:102-123`، `scripts/generate-error-docs.mjs`، `scripts/check-error-docs.mjs`، `scripts/test/error-docs-pages.test.mjs`، `docs/errors/`. این نتیجه وجود صفحات و لینک‌های تولیدی را تأیید می‌کند، نه دسترس‌پذیری زندهٔ دامنهٔ `zenith.dev`. |
| [#119](https://github.com/legionir/zenith-v1.4.0/issues/119) نام‌های عمومی مبهم | نام‌های canonical و aliasهای مهاجرت موجودند؛ گیت «یک نام، یک معنا» برخوردهای محلی جدید را می‌گیرد؛ facadeها و موارد هم‌معنا/لایه‌ای مستند شده‌اند. | `scripts/check-unique-export-names.mjs`، `scripts/unique-export-names.allowlist.json`، `scripts/test/unique-export-names.test.mjs` (۱۱ تست)، تست‌های deprecation در `api-conformance.test.mjs`؛ ۱۳ برخورد مستدل، صفر تخلف/ردیف stale. این نتیجه به معنی صفر بودن تمام نام‌های مشترک یا تکمیل یکی‌سازی auth در #139 نیست. |

برای کامنت بستن این چهار مورد می‌توان از SHA مبنا، نام تست‌های بالا و لینک CI بالا استفاده کرد. این گزارش خودش issueها را نبسته است.

## ۲. نزدیک به تکمیل، اما هنوز فاقد شواهد کامل

| issue | چه چیزی واقعاً انجام شده | چه چیزی مانع اعلام تکمیل است |
|---|---|---|
| [#67](https://github.com/legionir/zenith-v1.4.0/issues/67) CSP و پیام‌های افزونه | nonce تصادفی webview، حذف inline handler و innerHTMLهای خطرناک، schema/allowlist/cap پیام‌ها و CSP صریح. `scripts/test/devtools-message-schema.test.mjs` **۱۷ تست** و `packages/vscode-extension/test/webview.test.ts` **۱۱ تست** پاس شدند. | تست فعلی schema/رشتهٔ HTML/کد را می‌سنجد؛ شاهد اجرای واقعی webview و extension با **صفر CSP violation** در مرورگر/VS Code پیدا نشد. CSP هنوز برای style، `unsafe-inline` دارد؛ این را نباید «بدون هیچ unsafe-inline» گزارش کرد. |
| [#132](https://github.com/legionir/zenith-v1.4.0/issues/132) notifications | `showAlert/showConfirm` و هشدار alias، صف ۱۰۰ اعلان و سقف `maxVisible`، ARIA، pause hover/focus، reduced-motion و focus trap با **۲۲ تست** پیاده شده‌اند. | تستی که نامش «axe» است، در `packages/notifications/test/notifications.test.ts:157-178` در واقع `expectAccessible` داخلی را صدا می‌زند، نه axe-core. axe مرورگری موجود صفحه‌های اولیهٔ دمو را می‌سنجد، نه لزوماً دیالوگ/صف فعال این API. شاهد خوانده‌شدن اعلان توسط screen reader هم موجود نیست. علاوه بر آن، focus trap محلی است و پکیج مشترک a11yِ درخواستی هنوز ساخته نشده است. |

## ۳. سایر issueهای اجرایی: باز بمانند

جدول زیر همهٔ ۴۶ issue اجرایی باقی‌مانده را پوشش می‌دهد. «نیازمند تأیید بیرونی» یعنی از روی کد نمی‌توان تحقق معیار پذیرش را ثابت کرد، نه اینکه الزاماً تنظیم بیرونی وجود ندارد.

| issue | حکم | تطبیق با کد / باقی‌ماندهٔ مشخص |
|---|---|---|
| [#13](https://github.com/legionir/zenith-v1.4.0/issues/13) | ناقص؛ امنیت | `packages/vite-plugin/package.json` هنوز devDependency `vite:^5.4.0` و peer `^5 || ^6` دارد؛ audit هنوز `esbuild<=0.24.2`/`vite<=6.4.2` را گزارش می‌دهد. تست حداقل دو major سالم وجود ندارد. audit فعلی علاوه بر مورد اولیه، ۹ مدخل آسیب‌پذیر دیگر نیز دارد. |
| [#33](https://github.com/legionir/zenith-v1.4.0/issues/33) | ناقص | `packages/cli/test/templates-e2e.test.ts` تست jsdom و بررسی رشتهٔ template است؛ install/build/بارگذاری مرورگری پروژهٔ تولیدشده نیست. `e2e/demos-and-a11y.spec.ts` fixture را بررسی می‌کند، نه جریان واقعی login/cart/checkout/dashboard. |
| [#38](https://github.com/legionir/zenith-v1.4.0/issues/38) | ناقص | entrypointها صفرند، اما گیت فقط `src/index.ts` را با regex می‌بیند؛ re-export به معنای اسکن نوع نهایی نیست. `packages/auth/dist/index.d.ts:94,123` هنوز `AuthEventListener(...data?:any)` و `login(credentials:Record<string,any>)` دارد؛ شمار داخلی گیت ۴۷۶ است، نه ≤۱۰۰. `no-explicit-any` همچنان warn است. |
| [#39](https://github.com/legionir/zenith-v1.4.0/issues/39) | ناقص | logger و `no-console:error` برقرارند، اما `scripts/no-console-ratchet.mjs` هنوز **۹ فایل معاف** دارد (CLI/compiler/Vite/VS Code). grep در src هنوز console پیدا می‌کند؛ شرط «فقط consoleSink» برقرار نیست. نمونه: `packages/vite-plugin/src/index.ts` و `packages/compiler/src/compiler.ts`. |
| [#40](https://github.com/legionir/zenith-v1.4.0/issues/40) | انجام نشده در دامنهٔ خواسته‌شده | فایل‌ها هنوز بزرگ‌اند: auth=۱۵۷۴، runtime/index=۱۴۱۸، crud-engine=۱۱۱۸، walker=۱۰۴۳، form=۱۰۶۸ خط. `runtime-core/index.ts` هم ۱۷۶۹ خط است. قانون max-lines یافت نشد؛ snapshot برابری قبل/بعد refactor ارائه نشده است. |
| [#51](https://github.com/legionir/zenith-v1.4.0/issues/51) | انجام نشده | هر دو extension هنوز زیر `packages/` هستند؛ devtools-extension هنوز package.json ندارد؛ build ریشه vscode-extension را skip می‌کند. compile جدا در CI، انتقال خواسته‌شده و رفع ابهام ساختار را جایگزین نمی‌کند. |
| [#55](https://github.com/legionir/zenith-v1.4.0/issues/55) | پیشرفت زیاد، ناقص | overloadهای options و deprecation برای مثال‌های اصلی، تست سازگاری و قانون محلی ESLint موجود است؛ اما گیت **۱۱۳ امضای allowlist** را مجاز می‌کند. همهٔ آنها بدهی نیستند (مثلاً آرگومان‌های سال/ماه/روز داده‌اند)، ولی `formatDateTime(date, locale, options)` در `i18n/src/index.ts:426` هنوز locale تنظیماتیِ positional و بدون deprecation دارد. خود predicate گیت هم وجود هر پارامتر Options را کافی می‌گیرد. برای بستن، استثناهای formatting باید صریحاً به‌عنوان تغییر دامنهٔ معیار پذیرفته شوند یا این امضاها نیز مهاجرت کنند؛ سبزشدن ratchet به‌تنهایی کافی نیست. |
| [#56](https://github.com/legionir/zenith-v1.4.0/issues/56) | ناقص | snapshot سفارشی AST وجود دارد، نه `@microsoft/api-extractor` و `*.api.md` برای هر پکیج. `packages/ssr/src/index.ts:40-42` هنوز `domAls` و `installDOMGlobalGetters` را export می‌کند؛ Parser/lex و سایر داخلی‌ها نیز نیازمند ممیزی سطح نهایی‌اند. |
| [#57](https://github.com/legionir/zenith-v1.4.0/issues/57) | ناقص | target، `./package.json`، import/require و برخی زیرمسیرها درست‌اند؛ جدول `scripts/lib/exports-shape.mjs` فقط ۱۱ زیرمسیر عمومی دارد. شرط‌های development/production/browser/node/worker، buildهای متمایز و ماتریس resolve خواسته‌شده کامل نیستند. |
| [#61](https://github.com/legionir/zenith-v1.4.0/issues/61) | نیازمند ممیز مستقل | `docs/security/AUDIT-PACKAGE.md` بستهٔ تحویل و گیت داخلی است، نه گزارش امضاشدهٔ ممیز بیرونی و رفع یافته‌های او. `docs/MANUAL-STEPS.md` همین را تأیید می‌کند. |
| [#63](https://github.com/legionir/zenith-v1.4.0/issues/63) | ناقص | `docs/CSP-GUIDE.md` و helper امنیتی موجودند؛ تست e2e اجرای دمو با CSP سخت و TrustedTypes enforced یافت نشد. HTML تولیدی و nonce ثابت adapterها نیز نیازمند رفع/اعتبارسنجی‌اند. |
| [#66](https://github.com/legionir/zenith-v1.4.0/issues/66) | نیازمند تنظیم/شاهد بیرونی | `.github/workflows/release.yml` دارای id-token/environment/provenance است؛ Trusted Publisher واقعی، حفاظت محیط، نبود توکن بلندمدت و بستهٔ منتشرشده دارای provenance از کد قابل اثبات نیستند. انتشار واقعی در این بررسی انجام نشد. |
| [#77](https://github.com/legionir/zenith-v1.4.0/issues/77) | نیازمند مالک npm | `docs/release/NPM-SCOPE-AUDIT.md` طرح fallback دارد؛ پاسخ 404 یک پکیج اثبات آزادبودن scope یا مالکیت سازمان نیست. تأیید دو مالک و 2FA و نام نهایی لازم است. |
| [#80](https://github.com/legionir/zenith-v1.4.0/issues/80) | نیازمند تأیید تنظیمات GitHub | CODEOWNERS/سیاست‌ها موجودند. خواندن protection شاخهٔ main در این بررسی **HTTP 403** داد؛ API rulesets فهرست خالی برگرداند. بنابراین حفاظت را نه فعال فرض می‌کنیم نه غیرفعال؛ تست PR قرمز/بدون review لازم است. |
| [#86](https://github.com/legionir/zenith-v1.4.0/issues/86) | ناقص نسبت به پذیرش ≤۵٪ | هارنس واقعی، رقبا، محیط و baseline/سند تولیدی وجود دارد؛ اما خود `docs/BENCHMARKS.md` می‌گوید از ۲۹ متریک، ۱۹ اطلاعاتی‌اند و فقط ۴ مورد از ۱۰ گیت‌شده بازتولید ≤۵٪ دارند. `bench` پیش‌فرض مشورتی است؛ `--strict` هم آستانه‌های متفاوت دارد. یا باید معیار issue رسماً اصلاح شود یا شاهد محیط کنترل‌شده فراهم گردد. |
| [#88](https://github.com/legionir/zenith-v1.4.0/issues/88) | انجام نشده برای directiveهای سنگین | walker/index هنوز importهای eager دارند؛ loader پویا هنگام کشف attribute، تست شبکهٔ عدم دانلود و parity eager/lazy پیدا نشد. lazy async component معادل lazy کردن date-picker/data-table/crud نیست. |
| [#90](https://github.com/legionir/zenith-v1.4.0/issues/90) | فاقد اجرای خواسته‌شده | دستور Lighthouse وجود دارد؛ job موبایل برای هر دو دمو با بودجهٔ LCP/INP/CLS، artifact و امتیاز ≥۹۰ در workflowهای بررسی‌شده نیست. benchmark سیگنال/SSR جای CWV مرورگر را نمی‌گیرد. |
| [#95](https://github.com/legionir/zenith-v1.4.0/issues/95) | ناقص | fallbackهای storage و guardهای SSR/SW بخش‌هایی را پوشش می‌دهند؛ تست Playwright با JS خاموش، SW ناموجود و IndexedDB/localStorage مسدود و ماتریس رفتار جامع پیدا نشد. |
| [#97](https://github.com/legionir/zenith-v1.4.0/issues/97) | بخش فنی ناقص + اقدام بیرونی | manifest/privacy/تست افزونه موجود است؛ pipeline بسته‌بندی و lint zip فروشگاهی و تنظیمات Firefox کامل نیست. لینک ثبت/تأیید Chrome Web Store و AMO در شواهد موجود نیست. |
| [#100](https://github.com/legionir/zenith-v1.4.0/issues/100) | ناقص | `i18n/test/bidi-intl-rtl.test.ts` و `virtual-list/test/scale-100k-rtl.test.ts` مفیدند، اما تست سیستماتیک هر دو جهت برای date-picker/data-table/notifications و کلیدهای جهتی همهٔ کامپوننت‌ها کامل نیست. date-picker هنوز در ساخت container به‌طور ثابت dir=rtl می‌گذارد. |
| [#103](https://github.com/legionir/zenith-v1.4.0/issues/103) | ناقص | README/صفحات API موجودند؛ مولد فعلی جدول symbol/kind/tag می‌سازد، نه مرجع TypeDoc کامل با امضا/توضیح/مثال. گیت export بدون TSDoc/@example و انتشار خودکار سایت مستندات کامل نیست؛ `bundle.yml` شاخهٔ bundle/CDN را می‌سازد، نه سایت API. |
| [#107](https://github.com/legionir/zenith-v1.4.0/issues/107) | اسناد کامل؛ دسترسی‌ها نیازمند تأیید | CONTRIBUTING/COC/GOVERNANCE/ROADMAP/MAINTAINERS/CODEOWNERS موجودند؛ ولی دو عبارت `@zenith-framework/core-maintainers` و `security-reviewers` اثبات وجود تیم معتبر با write/release access در مخزن شخصی `legionir/...` نیستند. Community/access و دو نگه‌دارندهٔ واقعی باید تأیید شوند؛ ادعای قطعی 2FA/OIDC در MAINTAINERS نیز شاهد بیرونی می‌خواهد. |
| [#109](https://github.com/legionir/zenith-v1.4.0/issues/109) | انجام نشده در دامنهٔ خواسته‌شده | CLI هنوز دستورهای create/generate/info/check/lighthouse و telemetry/ssg/preview دارد، نه dev/build/test/upgrade/doctor و --json/exit-code جامع. `doctor` برای duplicate state پیاده نشده است. |
| [#110](https://github.com/legionir/zenith-v1.4.0/issues/110) | ناقص | cache compile و custom HMR event موجود است؛ fallback reload نیز وجود دارد. sourcemap واقعی قالب، حفظ state/عدم نشت در تست و ماتریس Vite 6/7/8 هنوز کامل نیست؛ peer فعلی ۵/۶ است. |
| [#111](https://github.com/legionir/zenith-v1.4.0/issues/111) | انجام نشده | strict directive validation با typecheck متصل به نوع state تفاوت دارد؛ قرارداد ورودی نوع و شکست build برای متغیر ناشناخته/نوع ناسازگار با file/line در compiler/LSP پیدا نشد. |
| [#113](https://github.com/legionir/zenith-v1.4.0/issues/113) | ناقص | dashboard همچنان `src/store.ts` و داده‌های نمایشی دارد؛ mock API کاربران/نقش‌ها + auth واقعی + تست deny مسیر و دکمهٔ نقش نامجاز/README شفاف کامل نیست. |
| [#114](https://github.com/legionir/zenith-v1.4.0/issues/114) | انجام نشده در دامنهٔ خواسته‌شده | axe روی بعضی دموها هست؛ build تمام دموها و deploy Pages پس از merge به main با فهرست و لینک زنده وجود ندارد. انتشار bundle روی branch `bundles` معادل deploy دموها نیست. |
| [#118](https://github.com/legionir/zenith-v1.4.0/issues/118) | ناقص | پنج متد/cleanup و reset hook در چند registry و تست conformance موجودند، اما `authRegistry` در `auth.ts:1066` و `storeRegistry` در `store.ts:249` هنوز module-global هستند؛ شرط همهٔ registryها در App برآورده نیست. reset سراسری ایزولاسیون دو App را ثابت نمی‌کند. |
| [#120](https://github.com/legionir/zenith-v1.4.0/issues/120) | ناقص | گرامر/جدول/seed و parseConfigAttr و metadata پیشرفت واقعی‌اند؛ اما بایندرهای همهٔ directiveهای legacy به `bindX(el,ctx):Cleanup` مهاجرت نکرده‌اند. وجود BindContext برای custom directive و سبزشدن گیت JSON.parse، این شرط را ثابت نمی‌کند؛ دستهٔ directive-binder در allowlist #55 نیز بدهی را ثبت می‌کند. |
| [#139](https://github.com/legionir/zenith-v1.4.0/issues/139) | ناقص | cross-tab/MFA و registry اضافه شده؛ اما همان `auth.ts` هنوز دو config و state مستقل دارد (`functionalConfig/functionalUser/functionalTokens` در کنار کلاس Auth). functional API wrapper روی یک Auth واحد نشده؛ تست مرورگری logout واقعی دو تب لازم است (تست storage-cross-tab عمومی کافی نیست). |
| [#151](https://github.com/legionir/zenith-v1.4.0/issues/151) | جزئی، نه پکیج کامل | focus trap/roving/lockScroll/useId در `runtime-core/src/index.ts` هستند؛ `@zenith/a11y` وجود ندارد. پشتهٔ trap، مجموعهٔ کامل API/directiveها، no-op SSR و useId همسان SSR/client و پذیرش عمومی پکیج نیازمند تکمیل‌اند. |
| [#152](https://github.com/legionir/zenith-v1.4.0/issues/152) | جزئی | HeadManager/dedupe/render در `ssr/src/render.ts:895+` هست؛ پکیج head، binding واکنشی DOM/directiveها و reuse hydration کامل نیست. `_activeHead` module-global است؛ تست دو context همزمان لازم است. |
| [#153](https://github.com/legionir/zenith-v1.4.0/issues/153) | بسیار جزئی | computePosition در runtime-core جای پکیج `@zenith/ui` و dialog/popover/tooltip/menu/tabs/accordion/combobox/date-picker با subpath و تست keyboard/RTL/stacking/axe نیست. |
| [#154](https://github.com/legionir/zenith-v1.4.0/issues/154) | اسکلت؛ transport واقعی ندارد | `http/src/http.ts:889+`: `open()` فقط status را open می‌کند و outbox را دور می‌ریزد؛ `send()` در حالت open ارسال واقعی نمی‌کند؛ ورودی از `receiveMockMessage` می‌آید. نه WebSocket/EventSource واقعی ساخته می‌شود، نه reconnect/jitter/heartbeat اجرا می‌شود. گزینهٔ reconnect صرفاً type است. پکیج مستقل و directiveها هم نیستند. |
| [#155](https://github.com/legionir/zenith-v1.4.0/issues/155) | جزئی | consent/DNT/provider در `runtime/src/directives/track.ts:148+` هست؛ پکیج analytics، batch/sampling/flush/router plugin و اتصال کامل legacy zen-track به موتور جدید کامل نیست. `try { void provider.send(...) } catch` نیز reject ناهمگام provider را مهار نمی‌کند. |
| [#156](https://github.com/legionir/zenith-v1.4.0/issues/156) | جزئی؛ یافتهٔ امنیتی | handler در `ssr/src/render.ts:1055+` هست؛ نه پکیج adapter-node، نه createNodeServer/static/compression/backpressure/shutdown کامل. AbortController ساخته می‌شود اما به render داده نمی‌شود. nonce ثابت است (بازتولید پایین). |
| [#157](https://github.com/legionir/zenith-v1.4.0/issues/157) | جزئی؛ Edge اثبات نشده | fetch handler همان renderToString Node را فراخوانی می‌کند و createDOM سبک را از گزینه‌های adapter عبور نمی‌دهد؛ پکیج adapter-edge، تست Miniflare/Deno و شاهد bundle بدون jsdom/async_hooks و ≤۱MB نیست. nonce این مسیر نیز ثابت است. |
| [#158](https://github.com/legionir/zenith-v1.4.0/issues/158) | جزئی | manifest قالب و دستور `create-zenith-preview` داریم، نه پکیج اجرایی create-zenith و templates داده‌محور مستقل با پنج قالب و تمام flagها. install/build/browser CI هر قالب و --dry-run/--json جامع کامل نیست. |
| [#159](https://github.com/legionir/zenith-v1.4.0/issues/159) | جزئی | فقط rule محلی `options-object` در `eslint.config.mjs` و ruleهای عمومی ESLint موجودند؛ پکیج eslint-plugin، processor قالب، configهای چهارگانه و ≥۵ valid/invalid برای هر قانون پیاده نشده‌اند. |
| [#160](https://github.com/legionir/zenith-v1.4.0/issues/160) | جزئی | پکیج language-server هست؛ index فعلی regex analysis + in-memory document store و چند lifecycle method است. LSP واقعی با diagnostics/completion/hover/rename/transport، کلاینت نازک، vsix و integration/fuzz/Marketplace کامل نیست. |
| [#163](https://github.com/legionir/zenith-v1.4.0/issues/163) | جزئی | prerender/concurrency/sitemap/robots/CLI در ssr و cli با تست موجودند؛ `@zenith/ssg` مستقل و همهٔ گزینه‌ها/معیار عمومی پکیج نیست. تست اصلی `scripts/test/wave5-batch3-ssg.test.mjs` از echoRenderer استفاده می‌کند؛ build و hydrate واقعی سایت چندمسیره را ثابت نمی‌کند. |
| [#164](https://github.com/legionir/zenith-v1.4.0/issues/164) | انجام نشده | unplugin-zenith و زیرمسیرهای پنج bundler و ماتریس compile/run آنها وجود ندارند؛ vite-plugin wrapper نازک روی unplugin نشده است. |
| [#165](https://github.com/legionir/zenith-v1.4.0/issues/165) | انجام نشده؛ utility محدود موجود | `mockHttp()` در testing جای پکیج mock، REST/WS handlers، Service Worker، latency/record/reset و ادغام دموها نیست. |
| [#166](https://github.com/legionir/zenith-v1.4.0/issues/166) | انجام نشده؛ helperهای محلی موجود | e2e/helpers و axe helper داریم؛ پکیج testing-e2e و fixtureهای mountApp/waitForHydration/getSignal/setSignal/snapshotDevtools و مصرفشان وجود ندارد. |
| [#167](https://github.com/legionir/zenith-v1.4.0/issues/167) | انجام نشده | codemod مبتنی بر AST، دستور upgrade با dry/check/report، fixtureهای قبل/بعد/idempotency و مهاجرت buildشدهٔ دمو وجود ندارد. داشتن migration guide کافی نیست. |
| [#174](https://github.com/legionir/zenith-v1.4.0/issues/174) | ناقص | app factory/head/i18n در renderToString و serialization اضافه شده‌اند؛ اما internal exports در index باقی‌اند، api-extractor نیست و تست همزمان head/locale همراه hydration بدون mismatch کامل نیست. قابلیت موجود را می‌توان جزئی تأیید کرد، نه تمام قرارداد issue. |

## ۴. وضعیت epicها، roadmap و index

| issue | نتیجه و وابستگی باز نمونه |
|---|---|
| [#176](https://github.com/legionir/zenith-v1.4.0/issues/176) ممیزی | باز؛ #13 حل نشده. چک‌لیست هنوز ۲۲ مورد unchecked دارد؛ وضعیت زیرissueهای بسته باید همگام شود. |
| [#177](https://github.com/legionir/zenith-v1.4.0/issues/177) کیفیت/تست | باز؛ #33/#38/#39/#40 ناقص‌اند. |
| [#178](https://github.com/legionir/zenith-v1.4.0/issues/178) معماری/API | باز؛ #51/#55/#56/#57 ناقص‌اند. |
| [#179](https://github.com/legionir/zenith-v1.4.0/issues/179) امنیت | باز؛ #61/#63/#66 و تأیید نهایی #67 مانده‌اند. |
| [#180](https://github.com/legionir/zenith-v1.4.0/issues/180) بسته‌بندی/CI | باز؛ مالکیت #77 و protection #80 هنوز اثبات نشده‌اند. |
| [#181](https://github.com/legionir/zenith-v1.4.0/issues/181) عملکرد/پایداری/a11y/i18n | باز؛ #86/#88/#90/#95/#97/#100 مانده‌اند. |
| [#182](https://github.com/legionir/zenith-v1.4.0/issues/182) مستندات/DX/حاکمیت/دمو | باز؛ حتی پس از بستن #106/#108/#112، #103/#107/#109/#110/#111/#113/#114/#160 و مسائل بیرونی باقی‌اند. |
| [#183](https://github.com/legionir/zenith-v1.4.0/issues/183) استانداردسازی | باز؛ حتی پس از #119، registry/directive/auth و plugin کامل نیستند (#118/#120/#139/#159). |
| [#184](https://github.com/legionir/zenith-v1.4.0/issues/184) پکیج‌های جدید | باز؛ APIهای جاسازی‌شده در runtime/http/ssr را نباید پکیج مستقل دارای معیار §۶.۲ حساب کرد. |
| [#185](https://github.com/legionir/zenith-v1.4.0/issues/185) roadmap | باز؛ شرط خود issue «بسته‌شدن همهٔ زیرissueهای فاز + CI سبز + ثبت نتیجه» است، نه فقط سبز بودن CI. |
| [#186](https://github.com/legionir/zenith-v1.4.0/issues/186) index | به‌عنوان نگاشت تاریخی نگه داشته شود؛ ادعای پایان برنامه نیست. بهتر است کنار هر نگاشت، وضعیت و شواهد این بررسی ثبت شود؛ بستن کلی آن اکنون توصیه نمی‌شود. |

## ۵. راستی‌آزمایی گزارش‌های نوشته‌شده

### `AUDIT.md` — به‌عنوان «وضعیت فعلی» کهنه است

- بخش build و بازتولید هنوز یک خطای SW، ۳۳/۳۴ build و ۰ تست موفق/۱۴ شکست را «اکنون» می‌نامد؛ اجرای جدید خلاف آن است.
- ادعای نبود `test/`، traversal بدون validation و cleanup مرده در SW مربوط به baseline قدیم است، نه SHA این بررسی. تست‌های فعلی و issueهای بستهٔ مربوط وجود دارند.
- ردیف A9 (آسیب‌پذیری dev) همچنان مسئلهٔ واقعی است، اما فهرست آسیب‌پذیری‌ها بزرگ‌تر شده است.
- پیشنهاد: گزارش قدیم حفظ شود، ولی بالای آن تاریخ/SHA baseline و لینک این reconciliation بیاید؛ یافته‌های رفع‌شده از یافته‌های باز جدا شوند. بازنویسی گذشته به‌عنوان نتیجهٔ امروز درست نیست.

### `PRODUCTION-READINESS.md` — چک‌لیست طراحی است، نه گزارش زنده

- جدول پایه هنوز lint=echo و LICENSE/README/SECURITY=ناموجود را گزارش می‌کند؛ هر سه فایل و ابزار lint واقعی موجودند.
- بسیاری از checkboxها با issueهای بسته همگام نشده‌اند. برعکس، سبزشدن ابزارها دلیلی برای تیک زدن معیارهای ناقص این گزارش نیست.
- باید baseline تاریخی از جدول «وضعیت تأییدشده روی SHA» جدا شود؛ معیارهای خروج مثل audit مستقل و مالکیت انتشار همچنان واقعی‌اند.

### `ARCHITECTURE.md` و `STANDARDIZATION-PLAN.md` — اعداد و snapshotها نیازمند تاریخ‌اند

- ARCHITECTURE هنوز «۴۲ پوشه، ۴۱ manifest» می‌گوید؛ در SHA فعلی **۵۱ زیرپوشهٔ مستقیم packages و ۵۰ package.json** هست.
- STANDARDIZATION بر بررسی «۳۶ پوشه» و تعداد exportهای قدیم استوار است. جهت معماری/قرارداد پیشنهادی همچنان مفید است، ولی توصیف «فعلی» باید از snapshot تازه جدا شود.
- `docs/ARCHITECTURE-GRAPH.md` و `docs/api/api-surface.snapshot.json` برای وضعیت تولیدشدنی قابل اتکاترند؛ البته محدودیت نوع snapshot پایین مهم است.

### `NEW-PACKAGES-SPEC.md` — وجود نام API معیار تکمیل پکیج نیست

- این سند specification هدف است؛ تعداد زیادی از قابلیت‌ها فعلاً داخل پکیج دیگری جاسازی شده‌اند یا صرفاً اسکلت‌اند.
- برای #151–#159/#163–#167 باید manifest، exports، README، تست قرارداد/SSR/dispose، size و سناریوهای پذیرش هر پکیج سنجیده شود. API محلی یا catalog کد خطا، پکیج ساخته‌شده نیست.

### `docs/progress/PROGRESS.md` — مهم‌ترین منبع ادعای بیش از شواهد

- سربرگ هنوز موج ۳، ۱۸۱ issue باز و CI قدیم را می‌گوید، درحالی‌که بدنه تا موج ۱۰ ادامه دارد و اکنون ۶۳ issue باز است.
- «#77 و #61 انجام شدند» در موج ۳ فقط آماده‌سازی سند/بسته را نشان می‌دهد؛ خود MANUAL-STEPS کار مالک/ممیز را باز گذاشته است.
- ادعای #38 صفرشدن any عمومی از اسکن barrel می‌آید؛ d.ts واقعی مثال نقض دارد و any داخلی ۴۷۶ است.
- توضیح #154 «reconnect با backoff+jitter» با implementation واقعی سازگار نیست: حتی transport شبکه ایجاد نمی‌شود.
- عنوان تکمیل #156/#157 با nonce ثابت و محدودیت‌های handler سازگار نیست.
- #67 در گزارش «۲۰ تست schema» آمده، ولی سوئیت فعلی **۱۷ تست** دارد؛ #132 ادعای «axe سبز» از checker داخلی می‌آید، نه axe-core آن سناریو.
- عدد پایان موج ۱۰، ۲۱۴ فایل/۱۷۸۱ تست است؛ اجرای فعلی **۲۱۶/۱۸۴۱** بود. این عدد می‌تواند تاریخی باشد، ولی نباید به‌عنوان آخرین وضعیت نمایش داده شود.

### سایر گزارش‌ها

- **`docs/BENCHMARKS.md`:** سند با baseline همخوان و دربارهٔ محدودیت‌ها شفاف است؛ اما همین شفافیت نشان می‌دهد #86 با پذیرش ≤۵٪ کامل نیست. متن حافظه یک‌جا «بدون expose-gc» می‌گوید و پایین‌تر پروب `--expose-gc` را توضیح می‌دهد؛ متن باید یکدست شود. CIِ freshness فقط همخوانی مولد و خروجی را ثابت می‌کند، نه صحت تمام توصیف روش.
- **`docs/A11Y-AUDIT.md`:** وجود axe-core واقعی و CI چندمرورگری تأیید می‌شود؛ ولی axe بدون serious/critical روی صفحات اولیه معادل «ممیزی کامل WCAG» یا تأیید دستی screen reader، همهٔ stateها و همهٔ مسیرهای کیبورد نیست.
- **`docs/MANUAL-STEPS.md`:** تفکیک کار درون/بیرون مخزن درست است؛ اما توصیهٔ قدیمی NPM_TOKEN/شاخهٔ قدیم با مسیر OIDC/main یکدست نیست. تیک‌نخوردن موارد بیرونی باید در خلاصهٔ progress دیده شود.
- **`docs/release/NPM-SCOPE-AUDIT.md`:** HTTP 404 نام پکیج، مالکیت/آزادی scope را ثابت نمی‌کند؛ 2FA/دو مالک باید جداگانه تأیید شوند.
- **`MAINTAINERS.md`:** نقش‌ها و سیاست نوشته شده‌اند؛ ادعای قطعی «دسترسی انتشار/دو مالک فعال/2FA/OIDC» بدون شاهد مدیریت دسترسی قابل تأیید نیست.
- **`docs/api/*`:** جدول سطح نام‌ها مفید است، ولی snapshot سفارشی با تمام امضاها و release-tag enforcement در api-extractor برابر نیست. تغییر نوع پارامتر بدون تغییر نام می‌تواند از چنین فهرستی عبور کند.

## ۶. یافته‌های مشخص که نباید زیر CI سبز پنهان بمانند

### nonce ثابت در adapterهای SSR (#156/#157، مرتبط با #63)

در `packages/ssr/src/render.ts`:

```ts
const nonce = options.csp?.nonce ? 'zen-ssr-nonce' : undefined; // Node
const nonce = options.csp?.nonce ? 'zen-edge-nonce' : undefined; // Edge
```

روی build همین SHA، دو درخواست مستقل به `createNodeHandler({ template:'<main>hello</main>', csp:{nonce:true} })` اجرا شدند. هر دو پاسخ این مقدار را داشتند:

```text
request 1: script-src 'self' 'nonce-zen-ssr-nonce'; nonce="zen-ssr-nonce"
request 2: script-src 'self' 'nonce-zen-ssr-nonce'; nonce="zen-ssr-nonce"
```

nonce باید در هر پاسخ با CSPRNG تولید شود و همان مقدار در header/HTML استفاده شود. این یافته به معنی exploit تأییدشده نیست، اما خاصیت امنیتی nonce تصادفی/غیرقابل‌پیش‌بینی را نقض می‌کند. `createNonce()` افزونهٔ VS Code تصادفی است و با این باگ adapterها اشتباه نشود.

### `createRealtime` شبکه نیست (#154)

در `packages/http/src/http.ts:889-999`، open فقط signal را تغییر می‌دهد؛ send در حالت open عملاً چیزی نمی‌فرستد؛ داده از helper mock وارد می‌شود. پاس‌شدن تست queue/status/security URL برای اثبات WS/SSE واقعی یا reconnect کافی نیست. تست integration با server واقعی/transport تزریقی باید عدم ارسال فعلی را آشکار کند.

### گیت‌های محدود، نتیجهٔ کلی نمی‌دهند

- any در index=0 ≠ any در API نهایی=0.
- نام export یکسان/تازه ≠ امضای API یکسان.
- داشتن option در interface ≠ اجرای آن option (نمونه: reconnect).
- schema/HTML string test ≠ اجرای webview زیر CSP.
- checker داخلی accessibility ≠ axe-core ≠ تأیید screen reader.
- workflow OIDC ≠ Trusted Publisher فعال یا provenance واقعی در npm.

## ۷. اقدام پیشنهادی

1. چهار مورد #106/#108/#112/#119 با شواهد بالا قابل بستن‌اند؛ در #106 محدودیت HTML و در #119 استثناهای لایه‌ای صریح بماند.
2. #67/#132 با افزودن اجرای واقعی CSP/axe و شواهد اعلان زنده نهایی شوند؛ از بستن صرفاً بر اساس اسم تست خودداری شود.
3. nonce ثابت SSR و audit dev در اولویت رفع قرار گیرند؛ سپس transport واقعی #154 و ایزولاسیون registry/head/auth تکمیل شوند.
4. برای #55/#56/#57/#86 توافق صریح دربارهٔ تغییر دامنه/معیار گرفته شود، یا دقیقاً همان معیار اصلی تکمیل گردد؛ ratchet/ابزار جایگزین بدون ثبت تصمیم، اتمام کامل نیست.
5. مالک، شواهد بیرونی #61/#66/#77/#80/#97/#107 را ارائه کند. خطای 403 این بررسی نشانهٔ نیاز به سطح دسترسی/تأیید مدیر است، نه شاهد نبود تنظیمات.
6. ابتدا خلاصهٔ زندهٔ PROGRESS و baseline اسناد تاریخ‌دار شوند، سپس checkboxهای epicها با زیرissueهای واقعاً تکمیل‌شده همگام گردند. گزارش تاریخی و specification حذف نشوند؛ نقش هرکدام روشن شود.

**محدودهٔ اطمینان:** این یک reconciliation برای تمام issueهای بازِ مشاهده‌شده است، نه ممیزی مستقل امنیتی یا تضمین production-ready بودن کل مخزن. در مواردی که شاهد اجرا وجود نداشت، «تأیید نشده» از «انجام نشده» جدا شده است.
