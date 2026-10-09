# DEC-004 — ساختار پایپ‌لاین CI: jobهای موازی مستقل به‌جای یک job بزرگ

- **تاریخ:** 2026-10-09
- **وضعیت:** پذیرفته‌شده
- **issue:** #79 (بخشی از #16 — هماهنگی CI.md)

## زمینه

`main.yml` قبلی همه‌چیز (lint، format، تست، typecheck، build) را داخل یک job
ماتریسی Node 18/22 اجرا می‌کرد: هر check فقط به‌صورت «Build (Node 18/22)» دیده
می‌شد، شکست هر مرحله کل job را قرمز می‌کرد و تکرار work در دو نسخهٔ Node هزینه
وقت اضافه داشت. معیار پذیرش #79: هر مرحله check مستقل در UI، شکست هرکدام
بلو‌ک‌کننده، زمان کل زیر ~۱۰ دقیقه، و هماهنگی مستندات.

## تصمیم

1. **هر gate یک job مستقل:** lint، format، typecheck، unit(+coverage)، audit،
   dependency-graph، build(ماتریس 18/22)، package-lint(publint)، size-budget،
   browser-e2e، release.
2. **ماتریس Node فقط برای build:** gate‌های منبع‌محور روی Node 22 LTS اجرا
   می‌شوند؛ سازگاری Node 18 (کف engines) همان‌جا که واقعی است — خروجی build —
   بررسی می‌شود.
3. **jobهای وابسته به build خودکفا هستند:** package-lint/size/e2e با
   `needs: build` پشت build سبز می‌نشینند ولی build را در runner خودشان
   دوباره اجرا می‌کنند (به‌جای جابه‌جایی چند صد مگابایت dist با artifact —
   هزینهٔ download/upload بیشتر از ~۲ دقیقه build محلی بود).
4. **e2e حداقل واقعی:** یک smoke test Playwright/Chromium که **باندل ESM
   ساخته‌شدهٔ واقعی** (`packages/state/dist`) را از یک static server بدون
   وابستگی (`scripts/e2e-server.mjs`) لود می‌کند و واکنش‌پذیری signal→computed→
   effect را از طریق DOM اثبات می‌کند. گسترش e2e دموها/hydration در #28/#33.
5. **dependency-cruiser baseline:** چرخه‌های *استاتیکی* runtime ممنوع
   (post-compilation deps؛ importهای type-only که esbuild حذف می‌کند شمرده
   نمی‌شوند — مثل state/registry↔signal). lazy import عمدی
   registry→processor (dynamic) از گراف خارج است. قواعد لایه‌بندی کامل → #49.
6. **audit فقط production با آستانهٔ high:** درخت dev پر advisory از vite/vitest
   است (رفعشان #13/#65); گیت فعلی باید سبز و بی‌معطل‌کننده باشد. dev audit +
   secret scanning → #65.
7. **publint: خطاها blocking، هشدارها گزارش.** `scripts/publint-all.mjs`؛
   `sideEffects` و types شرطی CJS مربوط به #70/#74. `zenith-vscode` با
   `compile -w zenith-vscode` ساخته می‌شود چون بیرون pipeline esbuild است.
8. **size-limit gzip با سرجمع فعلی + حاشیه (runtime 50kb، state 4kb، …):**
   بودجه‌های دقیق per-package → #83.

## پیامدها

- هر gate چک جداگانه است؛ شکست هرکدام PR/branch push را قرمز می‌کند.
- موازی‌سازی + حذف تکرار ماتریسی، زمان کل را در بودجه نگه می‌دارد.
- `.github/CI.md` با همین جدول jobها بازنویسی شد (#16 را هم پوشش می‌دهد).
- انحراف‌های موقت (dev audit، بودجهٔ خام، e2e حداقل) هرکدام به issue مالک خود
  گره خورده‌اند تا گیت‌ها بعداً سخت‌تر شوند، نه شل‌تر.
