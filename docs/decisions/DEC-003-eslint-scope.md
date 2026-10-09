# DEC-003: دامنهٔ قوانین ESLint/Prettier و انحراف‌های توجیه‌شده

- وضعیت: پذیرفته‌شده • 2026-10-09 • issueهای مرتبط (#36, #38, #39, #27)

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
| `no-console` off | central logger = #39 | تا #39 خطا نکنیم |
| prettier exclude: `**/*.html`, `*.md` | html fixtureها markup نامتوازنِ XSS در inline script دارند (parse نمی‌شوند)؛ md گزارش‌های prose است | churn > value؛ تست‌های مرورگری #28/#30 فایل‌محور می‌شوند |

## پیامدها
- `npm run lint` روی کل مخزن: exit 0، ۶۵۹ warn (همه `any`).
- CI دو مرحلهٔ `npm run lint` و `npm run format:check` را قبل از test/blocking اجرا می‌کند.
- آستانه‌ها فقط سخت‌تر می‌شوند (any→error در #38)؛ شل کردن ممنوع (AGENT-INSTRUCTIONS بند ۲.۳).
