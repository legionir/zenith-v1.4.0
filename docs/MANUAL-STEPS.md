# Manual Steps (needs-human)

Things the autonomous run could not or should not do itself. Each item lists
the exact manual action.

## #68 — LICENSE: مالک حقوقی

- [ ] تأیید مالک MIT با تیم حقوقی: فایل `LICENSE` با کپی‌رایت
      `2026 Zenith Team` ساخته شد. اگر شخص/شرکت حقیقی مالک است، نام و سال را
      در **ریشه و هر ۳۶ پکیج** (یا با ویرایش ریشه + اجرای
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
