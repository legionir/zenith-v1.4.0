# فهرست تصمیم‌های معماری (DEC index)

این فهرست **خودکار** از روی نام و تیتر فایل‌های `docs/decisions/DEC-*.md` ساخته می‌شود:
`node scripts/generate-dec-index.mjs` برای بازتولید و `npm run check:dec-index` برای اطمینان از
هم‌گامیِ فهرست با پوشه (هر دو در CI از طریق `scripts/test/rfc-decisions.test.mjs`).

آخرین شماره: **DEC-041** — تعداد تصمیم‌ها: **41** (بدون شمارهٔ تکراری).

| # | فایل | عنوان |
|---|------|-------|
| DEC-001 | [`DEC-001-sw-listener-cleanup.md`](./DEC-001-sw-listener-cleanup.md) | پاک‌سازی listenerها در global scope سرویس‌ورکر |
| DEC-002 | [`DEC-002-vitest-runner.md`](./DEC-002-vitest-runner.md) | انتخاب runner تست (vitest) و پیکربندی سراسری |
| DEC-003 | [`DEC-003-eslint-scope.md`](./DEC-003-eslint-scope.md) | دامنهٔ قوانین ESLint/Prettier و انحراف‌های توجیه‌شده |
| DEC-004 | [`DEC-004-ci-pipeline.md`](./DEC-004-ci-pipeline.md) | ساختار پایپ‌لاین CI: jobهای موازی مستقل به‌جای یک job بزرگ |
| DEC-005 | [`DEC-005-package-order.md`](./DEC-005-package-order.md) | package-order: لبه‌های dev وارد گراف، چرخهٔ فقط-dev با هشدار شکسته می‌شود |
| DEC-006 | [`DEC-006-typecheck-noemit.md`](./DEC-006-typecheck-noemit.md) | typecheck-all: noEmit + paths به src؛ نوشتن دیست از دستور بررسی حذف شد |
| DEC-007 | [`DEC-007-node-floor.md`](./DEC-007-node-floor.md) | حداقل Node به ≥18.19 افزایش یافت (نه ≥20) |
| DEC-008 | [`DEC-008-package-fields.md`](./DEC-008-package-fields.md) | فیلدهای package.json: sideEffects صریح برای router/cli، بقیه false |
| DEC-009 | [`DEC-009-readable-brand.md`](./DEC-009-readable-brand.md) | Brand «readable» با Symbol.for برای Signal/Computed |
| DEC-010 | [`DEC-010-virtual-list-untrack.md`](./DEC-010-virtual-list-untrack.md) | untrack کردن همهٔ callbackهای کاربر در virtual-list |
| DEC-011 | [`DEC-011-suspense-generation.md`](./DEC-011-suspense-generation.md) | شمارندهٔ نسل/چرخه در createSuspense و پاک‌سازی id ردشده |
| DEC-012 | [`DEC-012-transition-longest-duration.md`](./DEC-012-transition-longest-duration.md) | پایان transition بر اساس طولانی‌ترین duration محاسبه‌شده از computed style |
| DEC-013 | [`DEC-013-immediate-fallback-timer.md`](./DEC-013-immediate-fallback-timer.md) | fallback timer فوری (همزمان با شروع run) به‌جای بعد از دو rAF |
| DEC-014 | [`DEC-014-secure-id.md`](./DEC-014-secure-id.md) | secureId در @zenith/security و ممنوعیت Math.random در سورس پکیج‌ها |
| DEC-015 | [`DEC-015-security-fuzz-corpus.md`](./DEC-015-security-fuzz-corpus.md) | fuzz قطعی با seed مشترک در CI و corpus مرورگر-محور برای XSS |
| DEC-016 | [`DEC-016-auth-storage-dev-warning.md`](./DEC-016-auth-storage-dev-warning.md) | هشدار dev ذخیرهٔ ناامید توکن با کد ZEN-404 (شامل sessionStorage) |
| DEC-017 | [`DEC-017-unused-deps-gate.md`](./DEC-017-unused-deps-gate.md) | گیت «وابستگی بلااستفاده»: اسکریپت هدفمند به‌جای depcheck/knip |
| DEC-018 | [`DEC-018-state-scheduler-peer-singleton.md`](./DEC-018-state-scheduler-peer-singleton.md) | قاعدهٔ singleton peer برای `state`/`scheduler` و بازهٔ caret |
| DEC-019 | [`DEC-019-single-api-virtual-list-transition.md`](./DEC-019-single-api-virtual-list-transition.md) | تثبیت یک API برای virtual-list و transition؛ wrapper + ZEN-DEPR به‌جای حذف |
| DEC-020 | [`DEC-020-error-code-space.md`](./DEC-020-error-code-space.md) | فضای کد خطا — حفظ ZEN-NNN سه‌رقمی برای کدهای موجود + بازهٔ ۴رقمی برای پکیج‌های جدید |
| DEC-021 | [`DEC-021-readable-shared.md`](./DEC-021-readable-shared.md) | `Readable<T>` ساختاری در `shared` — ساخت روی brand موجود (DEC-009) + الزام تست نوع |
| DEC-022 | [`DEC-022-adapter-edge-deferred.md`](./DEC-022-adapter-edge-deferred.md) | `adapter-edge` به تعویق موکول شد — تا تحقق انتزاع DOM-implementation در `ssr` |
| DEC-023 | [`DEC-023-ui-component-order.md`](./DEC-023-ui-component-order.md) | ترتیب کامپوننت‌های `ui` — dialog, popover, tooltip, tabs سپس بقیه |
| DEC-024 | [`DEC-024-charts-icons-community.md`](./DEC-024-charts-icons-community.md) | `charts` و `icons` — community/اختیاری تا بازخورد مصرف‌کنندگان |
| DEC-025 | [`DEC-025-runtime-core-split-parity.md`](./DEC-025-runtime-core-split-parity.md) | تقسیم `runtime-core` — گروگان تست parity پیش از هر انتقال |
| DEC-026 | [`DEC-026-lockstep-150-removal-200.md`](./DEC-026-lockstep-150-removal-200.md) | نسخه‌گذاری — lockstep روی `1.5.0` برای پکیج‌های جدید؛ حذف نام‌های قدیمی فقط در `2.0.0` |
| DEC-027 | [`DEC-027-node-floor-dual-format.md`](./DEC-027-node-floor-dual-format.md) | حداقل Node همان `18.19` می‌ماند؛ ESM-first با CJS فقط برای ابزارها |
| DEC-028 | [`DEC-028-jalali-algorithm.md`](./DEC-028-jalali-algorithm.md) | الگوریتم جلالی مرجع = چرخهٔ حسابی ۳۳‌سالهٔ Borkowski؛ `@zenith/jalali` L0 با خروجی قطعی UTC |
| DEC-029 | [`DEC-029-schema-boundaries.md`](./DEC-029-schema-boundaries.md) | مرزهای @zenith/schema — بدون console با reporter تزریق‌شده، zod دونگی، subpathها و امضای سازگار form |
| DEC-030 | [`DEC-030-storage-l0.md`](./DEC-030-storage-l0.md) | مرزهای @zenith/storage — سیگنال ساختاری خودکفا، دادهٔ میراث v0، لاگ ASCII و SyncBus تزریق‌پذیر |
| DEC-031 | [`DEC-031-unified-error-hub.md`](./DEC-031-unified-error-hub.md) | مدل خطای واحد و hub سراسری |
| DEC-032 | [`DEC-032-cleanup-protocol.md`](./DEC-032-cleanup-protocol.md) | پروتکل cleanup — dispose/Cleanup به‌عنوان قرارداد واحد؛ واژه‌های رفتاری cancel/stop نگه داشته می‌شوند |
| DEC-033 | [`DEC-033-telemetry-cli-console.md`](./DEC-033-telemetry-cli-console.md) | دو console.error جدید در CLI برای دستور `zenith telemetry` — بالارفتن سقف error-hygiene از 201 به 203 |
| DEC-034 | [`DEC-034-exports-shape-dts-bundle-require-esm.md`](./DEC-034-exports-shape-dts-bundle-require-esm.md) | شکل `exports` (انواع جدا برای CJS)، یک `.d.ts` تجمیع‌شده به‌ازای هر ورودی، و `require(esm)` برای پکیج‌های ESM-only |
| DEC-035 | [`DEC-035-unique-public-export-names.md`](./DEC-035-unique-public-export-names.md) | «یک نام، یک معنا» در سطح عمومی پکیج‌ها (گیت AST + allowlist مستند) |
| DEC-036 | [`DEC-036-options-object-signatures.md`](./DEC-036-options-object-signatures.md) | پیکربندی positional یخ‌زده شد؛ فقط `fn(main, options?)` |
| DEC-037 | [`DEC-037-public-subpath-table-and-global-reset-placement.md`](./DEC-037-public-subpath-table-and-global-reset-placement.md) | زیرمسیرهای عمومی از یک جدولِ تنها؛ جایگاه رِجیستری ریستِ فرایند در `@zenith/errors` |
| DEC-038 | [`DEC-038-extension-message-schema-and-csp.md`](./DEC-038-extension-message-schema-and-csp.md) | مرز امنیتی افزونه‌ها — یک ماژول schema، «نادیده‌گرفتنِ» پیام نامعتبر، CSP غیرِ inline |
| DEC-039 | [`DEC-039-benchmark-methodology-and-reproducibility-gate.md`](./DEC-039-benchmark-methodology-and-reproducibility-gate.md) | روش‌شناسی بنچمارک و گیت بازتولیدپذیری — «عددِ صادق» به‌جای «عددِ بزرگ» |
| DEC-040 | [`DEC-040-secure-development-toolchain.md`](./DEC-040-secure-development-toolchain.md) | ابزارهای توسعهٔ رفع‌شده و تفکیک کف Node ابزارها از کتابخانه |
| DEC-041 | [`DEC-041-subpath-per-environment-no-export-conditions.md`](./DEC-041-subpath-per-environment-no-export-conditions.md) | تفکیک محیط با زیرمسیر، نه شرط‌های exports (conditions-by-design) |

## قواعد ثبت

1. شماره بعدی = بزرگ‌ترین شمارهٔ موجود + ۱؛ شمارهٔ تکراری خطاست
   (`scripts/test/rfc-decisions.test.mjs`).
2. قالب: تیتر `# DEC-NNN: …` و بخش‌های `## زمینه`، `## گزینه‌ها`،
   `## تصمیم و دلیل`، `## پیامدها` (+ لینک issueهای تحت‌تأثیر).
3. تصمیم‌های جزئی در پیام کامیت کافی است؛ فقط تصمیم معماری/قرارداد DEC می‌گیرد
   (AGENT-INSTRUCTIONS §4).
4. هر DEC جدید باید در این فهرست دیده شود و در `docs/progress/PROGRESS.md`
   شرح داده شود.
