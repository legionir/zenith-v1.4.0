# Manual Steps (needs-human)

Things the autonomous run could not or should not do itself. Each item lists
the exact manual action.

## پیگیری زندهٔ remediation — ۲۰۲۶-۱۰-۱۶

«مسئول موردانتظار» در این جدول assignee یا تأیید دسترسی نیست؛ مالک مخزن `legionir`
باید فرد واقعی را تعیین کند. هیچ credential/کد 2FA در issue یا چت ارسال نشود.
هیچ تنظیم دسترسی/انتشار از طرف عامل تغییر داده نشده و npm publish واقعی انجام نشده است.

| issue | مسئول موردانتظار | اقدام و شاهد موردنیاز | وضعیت/آخرین بررسی |
|---|---|---|---|
| #77 | مالک npm؛ تعیین توسط مالک مخزن | تأیید scope نهایی، دو مالک واقعی و 2FA؛ 404 نام پکیج شاهد آزادبودن scope نیست | نیازمند انسان؛ ۲۰۲۶-۱۰-۱۶، بدون شاهد مالکیت |
| #107 | مالک مخزن | دو حساب واقعی، نقش/write/release access، اصلاح تیم‌های تأییدنشدهٔ CODEOWNERS؛ شاهد بدون اطلاعات حساس | نیازمند انسان؛ ۲۰۲۶-۱۰-۱۶، assignee تعیین نشده |
| #80 | ادمین مخزن | حفاظت `main` و محیط release، PR کنترل‌شدهٔ بدون review و با check قرمز باید قابل merge نباشد | نیازمند انسان؛ protection API=403، نه اثبات فعال/غیرفعال بودن |
| #61 | مسئول امنیت/ممیز مستقل؛ تعیین توسط مالک | انتخاب ممیز، دامنه و SHA تحویل، گزارش امضاشده و پیگیری یافته‌ها؛ بستهٔ داخلی گواهی ممیزی نیست | نیازمند انسان؛ گزارش مستقل دریافت نشده |
| #66 | مالک npm + ادمین GitHub | Trusted Publisher صحیح و محیط release دارای review؛ شاهد provenance فقط پس از انتشار مجاز توسط مالک | نیازمند انسان؛ workflow موجود، تنظیم واقعی تأییدنشده |
| #97 | مجری افزونه سپس مالک حساب فروشگاه | ابتدا packaging/lint/Firefox ناقص تکمیل؛ سپس ثبت و لینک تأیید Chrome/AMO | ترکیبی؛ نه آمادهٔ ارسال، نه منتشرشده |

تلاش ثبت درخواست در #77 با `Resource not accessible by integration` رد شد؛ **هیچ
کامنت یا برچسبی ثبت نشده است**. متن آمادهٔ #61/#66/#77/#80/#107 در
[OWNER-REQUESTS-2026-10-16.md](progress/OWNER-REQUESTS-2026-10-16.md) نگه‌داری می‌شود؛
مالک باید مجوز نوشتن issue در اتصال GitHub را اصلاح کند. پاسخ و شاهد بیرونی تا دریافت
واقعی، «تأییدشده» محسوب نمی‌شوند. نام‌های تیم در MAINTAINERS/CODEOWNERS
هنوز ادعای دسترسی معتبر نیستند. `NPM_TOKEN` راه‌حل پیشنهادی این remediation نیست؛
مسیر انتشار هدف OIDC است. نیاز تاریخی به توکن در گزارش‌های قدیمی وضعیت جاری نیست.

## #68 — LICENSE: مالک حقوقی

- [ ] تأیید مالک MIT با تیم حقوقی: فایل `LICENSE` با کپی‌رایت
      `2026 Zenith Team` ساخته شد. اگر شخص/شرکت حقیقی مالک است، نام و سال را
      در **ریشه و هر ۴۱ پکیج** (یا با ویرایش ریشه + اجرای
      `node scripts/sync-license.mjs`) اصلاح کنید.

## #59 — SECURITY.md: فعال‌سازی Private Vulnerability Reporting

- [ ] در GitHub: Settings → Code security and analysis →
      **Private vulnerability reporting** را enable کنید (این تنظیم فقط از UI
      قابل تغییر است؛ token موجود آن را تغییر نمی‌دهد). تا آن زمان، راه
      جایگزین (ایمیل) در SECURITY.md توضیح داده شده است.
- [ ] آدرس `security@zenith-framework.dev` در SECURITY.md یک placeholder
      مالک-محور است؛ آدرس واقعی تیم امنیتی را جایگزین کنید (تست
      `scripts/test/security.test.mjs` وجود `ZENITH-SEC` را بررسی می‌کند، نه
      آدرس را).

## Branch protection روی شاخهٔ اصلی main

- [ ] اگر لازم است: Settings → Branches → protection rule با الزام
      checks جدید روی `main` (lint/format/typecheck/unit/audit/deps/build/publint/size/e2e و Vite integration).
      AGENT-INSTRUCTIONS اجازه تغییر تنظیمات repo را به agent نداد.

## #77 — رزرو سازمان / Scope در npm (`@zenith`)

- [ ] بررسی زندهٔ `registry.npmjs.org` و اسکریپت `scripts/check-npm-scope.mjs` در [`docs/release/NPM-SCOPE-AUDIT.md`](release/NPM-SCOPE-AUDIT.md) مستند شد.
- [ ] مالک پروژه باید در [npmjs.com](https://www.npmjs.com) مالکیت سازمان `@zenith` را با حداقل دو مالک و 2FA اجباری تأیید/ثبت کند؛ در صورت عدم دسترسی به سازمان `@zenith`، با اجرای `node scripts/check-npm-scope.mjs` برنامهٔ مهاجرت به `@zenithjs` آماده است.

## #61 — ممیزی امنیتی مستقل (External Security Audit)

- [ ] بستهٔ کامل ممیزی امنیتی (دامنه، مدل تهدید، یافته‌های رفع‌شدهٔ `SEC-A1..A13` و دستورهای بازتولید) در [`docs/security/AUDIT-PACKAGE.md`](security/AUDIT-PACKAGE.md) و گیت خودکار `scripts/security-audit-check.mjs` آماده شد.
- [ ] تیم/ممیز امنیتی مستقل بیرونی را انتخاب کرده، بستهٔ `docs/security/AUDIT-PACKAGE.md` را در اختیارشان قرار دهید و پس از دریافت گزارش نهایی، لینک گواهی ممیزی را در همان فایل ثبت کنید.

## #65 — فعال‌سازی Secret Scanning و Push Protection در تنظیمات GitHub

- [ ] فایل‌های `.github/dependabot.yml`، `.gitleaks.toml`، اسکریپت `scripts/secret-scan.mjs` و گام‌های CI (`npm audit` + `gitleaks/gitleaks-action@v2`) اضافه شدند.
- [ ] در GitHub: Settings → Code security and analysis → **Secret scanning** و **Push protection** را روی مخزن فعال کنید.

## #66 — پیکربندی Trusted Publishing (OIDC) در npm و محیط `release` در GitHub

- [ ] ورک‌فلوی `.github/workflows/release.yml` با `id-token: write`، `environment: release` و پرچم `--provenance` ساخته شد.
- [ ] در GitHub: Settings → Environments → یک محیط به نام **`release`** با Required reviewers (حداقل یک نگه‌دارنده از `MAINTAINERS.md`) بسازید و هرگونه Secret قدیمی `NPM_TOKEN` را حذف کنید.
- [ ] در npmjs.com: در تنظیمات پکیج‌های `@zenith/*` و `zenith`، گزینهٔ **Trusted Publisher** را به مخزن `legionir/zenith-v1.4.0` و فایل ورک‌فلوی `release.yml` (محیط `release`) متصل کنید.

## #80 — فعال‌سازی قوانین Branch Protection در تنظیمات GitHub

- [ ] فایل‌های `.github/CODEOWNERS`، `MAINTAINERS.md`، `CONTRIBUTING.md`، `CODE_OF_CONDUCT.md`، `GOVERNANCE.md` و `ROADMAP.md` ایجاد شدند.
- [ ] در GitHub: Settings → Branches → Branch protection rules روی شاخهٔ اصلی (`main`) گزینه‌های زیر را فعال کنید:
  - **Require a pull request before merging** + **Require review from Code Owners** (حداقل ۱ تأییدیه)
  - **Require status checks to pass before merging** (تمام چک‌های `.github/workflows/main.yml`)
  - **Require linear history** و مسدودسازی **Allow force pushes**



