# Progress Tracker (AGENT-INSTRUCTIONS §2)

آخرین issue کامل: #79
issue در حال انجام: —
بعدی: #25, #26, #14, #70, #68, #69, #59 سپس موج ۱
مسدود/نیازمند انسان: —
آخرین run موفق CI: 37878247149 (#36)

## وضعیت شناخته‌شدهٔ baseline
- 181 issue باز (#6..#186).
- #27 انجام شد: vitest + coverage-v8 در ریشه (`vitest.config.ts`)، `npm test`=`vitest run`.
  - اسکریپت‌های test مرده از ۱۴ پکیج حذف شد؛ `scripts/test-all.mjs` حذف شد.
  - ۹۱ تست؛ پوشش statements هسته ≥۷۰٪ (state 77.9, scheduler 86.3, expressions 77.9, compiler 75.7).
  - DEC-001 (SW listener)، DEC-002 (runner) ثبت شد.
- #36 انجام شد: ESLint 9 flat config + typescript-eslint (typed via `tsconfig.eslint.json`)،
  Prettier 3 + `.editorconfig` + `.prettierignore`؛ `lint`/`lint:fix`/`format`/`format:check` در ریشه.
  - همهٔ خطاهای lint رفع شد (کد خروج ۰)؛ ۶۵۹ هشدار `no-explicit-any` موقتاً warn تا #38.
  - DEC-003 (دامنهٔ lint و انحراف‌ها) ثبت شد.
  - مراحل Lint + Format check به CI اضافه شد؛ README docs/README.md بخش دستورهای توسعه.
- #79 انجام شد: main.yml بازسازی شد به ۱۱ job موازی مستقل (lint، format، typecheck،
  unit+coverage، audit(prod/high)، dependency-graph، build Node18/22، publint، size-limit،
  browser-e2e Playwright/Chromium روی باندل واقعی، release).
  - ابزارهای stage: publint، @playwright/test 1.56، dependency-cruiser 16، size-limit 11 + @size-limit/file (Node 18 سازگار).
  - اسکریپت‌های جدید: scripts/publint-all.mjs، scripts/e2e-server.mjs؛ کانفیگ‌ها:
    .dependency-cruiser.cjs (چرخه استاتیکی post-compilation)، .size-limit.json، playwright.config.ts، e2e/browser-smoke.spec.ts + e2e/fixture.html.
  - zenith-vscode با compile -w ساخته می‌شود تا publint سبز شود؛ DEC-004 ثبت شد؛ .github/CI.md بازنویسی شد (#16 را هم پوشش می‌دهد).
  - dev-dep audit/secret-scan → #65؛ بودجه دقیق per-package → #83؛ لایه‌بندی کامل → #49؛ publint+attw کامل → #74.
- typecheck/build از baseline سبز است (۳۴/۳۴).
