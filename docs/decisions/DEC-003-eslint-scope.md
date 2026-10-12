# DEC-003: دامنهٔ قوانین ESLint/Prettier و انحراف‌های توجیه‌شده

- وضعیت: پذیرفته‌شده • 2026-10-09 • issueهای مرتبط (#36, #38, #39, #27, #143) — اجرای ratchet no-console در #143 (بخش «اجرای #143»)

## زمینه
`npm run lint` فقط `echo` بود. #36 خواستار eslint+typescript-eslint (قوانین `no-floating-promises`، `no-explicit-any` برای API عمومی، `consistent-type-imports`)، Prettier، `.editorconfig`، اجرا در CI و «رفع یا مستندکردن با eslint-disable توجیه‌شده خطاهای اولیه» است. اولین اجرای واقعی ۸۴۲ مشکل داد (۱۸۳ error).

## گزینه‌ها
1. قوانین کامل recommended از همان ابتدا ⇒ تغییر ۱۸۳ error در کد موجود؛ یا rule‌های اصلی را خاموش کردن (رد شده: lint صوری).
2. تنظیم دقیق دامنه: **errorها اصلاح/رفع شدند (۰ error)** و موارد باقی‌مانده با صریح‌ترین دلیل ثبت و در issueهای خودشان قفل شدند.

## تصمیم و دلیل
قوانین الزامی (`no-floating-promises`، `consistent-type-imports` statements، `no-unused-vars`، `no-empty(catch)`، `no-useless-escape`، `no-control-regex`، `ban-ts-comment`، `no-require-imports` و…) **error**اند و همهٔ تخلفات رفع شد:

- ۳۱ floating promise → با `void` صریح (fire-and-forget عمدی؛ همان بار semantics ولی خوانا برای lint).
- ۳ `require()` در `cli/lighthouse.ts` → import ESM استاندارد (`node:http`/`node:url` و `createRequire` برای بارگذاری اختیاری lighthouse). این تبدیل چند error نوعیِ از پیش موجود را آشکار کرد که همان‌جا رفع شد.
- useles escapeها در regexهای اعتبارسنجی/URL، پارامترهای بی‌استفاده، `import()` type annotation، `recordStateChange` بی‌استفاده در تست.

انحراف‌های مستند (در config با کامنت):

| مورد | تصمیم | دلیل / issue |
|---|---|---|
| `no-explicit-any` = **warn** (۶۵۹ مورد) | فعلاً warn، error پس از صفر شدن | #38 دقیقاً همین کار را تعریف کرده؛ lint قرمز بی‌دلیل، مسیر P0 را می‌بندد |
| `no-unsafe-function-type` off | `Function` کلید ست‌های گراف reactive است (signal/effect) | بازطراحی امضا = #38/#40 |
| `no-unused-vars` caughtErrors:none | `catch (err) {}` best-effort الگوی موجود است | اجبار `_` ارزش افزوده ندارد |
| `no-empty allowEmptyCatch` | بلاک‌های catch عمدی | همان بالا |
| `no-control-regex` off برای `security/sanitizer.ts` و `runtime/bind.ts` | این regexها **عمداً** کاراکترهای کنترلی (\x00) را برای دفع XSS تطبیق می‌دهند | قانون برای کد امنیتی false positive است؛ در دو فایل مشخص، نه سراسری |
| `no-undef` off برای TS | type checker خودش undefined را می‌گیرد |Docs tseslint |
| `no-console` — **از #143 به بعد `error`** برای `packages/*/src/**` (نه سراسری off) | central logger = #39؛ کد بدهی در ratchet | بلوک پایین: «اجرای #143 (no-console ratchet)» |
| prettier exclude: `**/*.html`, `*.md` | html fixtureها markup نامتوازنِ XSS در inline script دارند (parse نمی‌شوند)؛ md گزارش‌های prose است | churn > value؛ تست‌های مرورگری #28/#30 فایل‌محور می‌شوند |

## اجرای #143 (۲۰۲۶-۱۰-۱۰) — no-console: «off until #39» منقضی شد؛ الگوی ratchet

- **تصمیم:** `no-console: 'error'` برای `packages/*/src/**.{ts,mts}` فعال شد (پیش از مهاجرت کد!)؛ ۶۲ فایل بدهیِ موجود در `scripts/no-console-ratchet.mjs` (**منبع واحد**) با یک override `'off'` تنها معافیت‌اند. رد شده‌ها: (الف) صبر تا #39 — SPEC §۲.۳ قانون را الزامی می‌کند و هر روز تأخیر فراخوانی جدید می‌سازد؛ (ب) سطح warn — warn در CI blocker نیست و عملاً همان off است.
- **گیت ضدلغزش:** `scripts/test/no-console-ratchet.test.mjs` (در `npm test`) بررسی می‌کند: config دقیقاً یک `'off'` دارد و از رچت import می‌کند؛ هیچ فایل src خارج از فهرست console ندارد (افزودن فایل جدید به فهرست ⇒ offender ⇒ تست می‌شکند)؛ هیچ ورودی کهنه‌ای فهرست نیست. یعنی فهرست **فقط کوتاه می‌شود** — با مهاجرت‌های #39.
- **استثنای مشروع:** `packages/logger/src/sinks.ts` — `consoleSink` خودِ مرز رسمی console طبق SPEC §۲.۳ است؛ file-level `/* eslint-disable no-console */` با دلیل، نه عضو ratchet (گیت فایل‌های logger را از فهرست مجاز بیرون می‌گذارد).
- **اثبات عملکرد:** probe موقت (`no-console` در src بدون فهرست) lint را قرمز کرد؛ سپس حذف شد.
- **تصمیم‌های جانبی #143 که اینجا ثبت می‌شوند** (مالکشان همین DEC/بند SPEC است): `beaconSink` فقط `fetch` با ndjson + هدر content-type (sendBeacon رد شد: هر دو محیط هدف — Node≥18 و مرورگر — fetch بومی دارند، DEC-027؛ بودجهٔ ≤۲KB gzip هم با fallback افزوده شد — اندازهٔ فشردهٔ src نهایی 2042B)؛ گزارش sink خراب با `createReservedError('ZEN-1091')` و dispatch با `report=false` (سقف عمق ۲ ⇒ حلقهٔ خطا ناممکن — معیار پذیرش #143)؛ `deprecate()` رشتهٔ پیام انگلیسی (تطابق دقیق با `errors.deprecate` قدیمی؛ یکنواختی i18n کار #39 است) و کد `ZEN-DEPR-*` از رجیستری `DEPRECATION_CODES` (DEC-020) با fallback `ZEN-DEPR-999`؛ اتصال به مسیر گزارش خطا بدون یال runtime به error-boundary (ممنوعیت L0→L2 — DEC-021) از طریق duck `globalThis.reportError` best-effort.

## پیامدها
- `npm run lint` روی کل مخزن: exit 0، ۶۵۹ warn (همه `any`).
- CI دو مرحلهٔ `npm run lint` و `npm run format:check` را قبل از test/blocking اجرا می‌کند.
- آستانه‌ها فقط سخت‌تر می‌شوند (any→error در #38)؛ شل کردن ممنوع (AGENT-INSTRUCTIONS بند ۲.۳).
