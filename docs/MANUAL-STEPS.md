# Manual Steps (needs-human)

Things the autonomous run could not or should not do itself. Each item lists
the exact manual action.

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

## (baseline) Branch protection روی audit/consolidated-report

- [ ] اگر لازم است: Settings → Branches → protection rule با الزام
      checks جدید (lint/format/typecheck/unit/audit/deps/build/publint/size/e2e).
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



