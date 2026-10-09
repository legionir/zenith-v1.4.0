# DEC-002: انتخاب runner تست (vitest) و پیکربندی سراسری

- وضعیت: پذیرفته‌شده • 2026-10-09 • issueهای مرتبط (#27, #29, #79)

## زمینه
`npm test` سراسری عملاً وجود نداشت: ۱۴ پکیج اسکریپت `test` به فایل‌های `test/*.ts` اشاره می‌کردند که در مخزن نبود (ERR_MODULE_NOT_FOUND) و ۲۱ پکیج هیچ تستی نداشتند. #27 یک runner مشترک، اجرای سراسری و پوشش هسته را الزامی می‌کند؛ #7 به تست‌های P0 هسته نیاز دارد.

## گزینه‌ها
1. **node:test** — بدون وابستگی؛ ولی jsdom/environment switching، coverage یکپارچه و alias resolution برای monorepo باید دستی ساخته شوند.
2. **vitest + @vitest/coverage-v8** (پیشنهاد سند) — environment قابل‌تعویض (node/jsdom)، coverage v8 داخلی، alias Vite برای resolution مستقیم `src` در monorepo، watch و determinism با fake timers. هزینه: ~45 پکیج devDependency.

## تصمیم و دلیل
vitest، طبق پیشنهاد صریح `AGENT-INSTRUCTIONS` بند ۷ و #27. یک `vitest.config.ts` در ریشه:
- `include: packages/*/test/**/*.test.ts` — همهٔ تست‌ها از ریشه با `npm test` (=`vitest run`).
- alias regex `^@zenith/<pkg>$` → `packages/<pkg>/src/index.ts` (و ساب‌مسیر `service-worker/sw`) تا تست‌ها مستقیم روی **src** اجرا شوند و coverage فایل‌های واقعی منبع را اندازه بگیرد، نه `dist/`.
- `coverage.include` = ۴ پکیج هسته (`state`, `scheduler`, `expressions`, `compiler`) با آستانهٔ statements ≥ ۷۰٪ (معیار پذیرش #27؛ هدف ۸۰٪ در #29 ارتقا می‌یابد و طبق بند ۷ آستانه فقط بالا می‌رود).
- اسکریپت‌های `test` مرده در ۱۴ پکیج حذف شد و `scripts/test-all.mjs` (اسپاونر npm-per-package) حذف/جایگزین گردید؛ `npm test` حالا خودِ vitest است.

## پیامدها
- ۹۱ تست سبز؛ پوشش statements هسته: state 77.9٪، scheduler 86.3٪، expressions 77.9٪، compiler 75.7٪ (کل 78٪ ≥ 70٪).
- CI (#79) متوالی اجرا می‌کند: typecheck (dist d.tsها را برای exports تولید می‌کند) → `npm test`؛ بنابراین `dist` قبل از importهای workspace موجود است و alias مسیر src مستقل از آن عمل می‌کند.
- بقیهٔ پکیج‌ها فعلاً بیرون از آستانهٔ coverage‌اند (فقط هسته الزامی است؛ گسترش در #29).
