# DEC-015: fuzz قطعی با seed مشترک در CI و corpus مرورگر-محور برای XSS

- وضعیت: پذیرفته‌شده • ۲۰۲۶-10-10 • issueهای مرتبط: #30

## زمینه

sanitizer و expressions مرز امنیتی‌اند ولی تست امنیتی نداشتند. نیاز:
(۱) corpus OWASP XSS/mXSS که در **مرورگر واقعی** راستی‌آزمایی شود،
(۲) fuzz parser/validator/evaluator با ≥۱۰۰٬۰۰۰ ورودی بدون crash/hang،
(۳) اجرای دوره‌ای طولانی‌تر.

## گزینه‌ها

1. fuzz با تصادف واقعی (random seed) + coverage-guided (afl/libfuzzer):
   قوی‌تر ولی nondeterministic و نیازمند toolchain زنجیره‌ای؛ شکست CI را
   بازتولیدناپذیر می‌کند.
2. fuzz با PRNG قطعی (mulberry32) و seed ثابت در تست واحد: قابل‌تکرار،
   بدون وابستگی خارجی، قابل‌افزایش با env متغیر.
3. corpus به‌عنوان فایل JSON جدا و duplicate در مرورگر: دو منبع حقیقت.

## تصمیم و دلیل

گزینهٔ ۲ برای fuzz + به‌اشتراک‌گذاری فایل corpus (`xss-corpus.mjs`) بین
vitest و fixture مرورگر (گزینهٔ ۱ از دو-منبع-حقیقت). حجم CI = ۱۰۰٬۰۰۰ ورودی
(اجرا ≈ ۳ ثانیه؛ اثبات در لاگ تست). اجرای nightly طولانی (۲٬۰۰۰٬۰۰۰ ورودی
با seed چرخشی) در `fuzz-nightly.yml` — طبق بند ۷ دستورالعمل، merge با همان
CI معمولی (اجباری) و شکست fuzz merge را مسدود می‌کند چون fuzz بخشی از
`npm test` در job unit است.

## پیامدها

- تست‌ها deterministic‌اند (بدون Math.random/زمان/شبکه) — seed ثابت.
- اگر payload تازه‌ای کشف شود، فقط با افزودن یک خط به corpus به هر دو لایه (unit+browser) اضافه می‌شود.
- workflow جدید nightly فقط reporting است و gate اصلی را ضعیف‌تر نمی‌کند.
