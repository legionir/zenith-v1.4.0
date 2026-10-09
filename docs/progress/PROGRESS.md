# Progress Tracker (AGENT-INSTRUCTIONS §2)

آخرین issue کامل: #6
issue در حال انجام: #27 (تست سبز، typecheck/build سبز، coverage هسته 78%≥70 — در حال commit)
بعدی: #36, #79, #25, #26, #14, #70, #68, #69, #59 سپس موج ۱
مسدود/نیازمند انسان: —
آخرین run موفق CI: — (workflow #79 هنوز بازسازی نشده)

## وضعیت شناخته‌شدهٔ baseline
- 181 issue باز (#6..#186).
- #27 انجام شد: vitest + coverage-v8 در ریشه (`vitest.config.ts`)، `npm test`=`vitest run`.
  - اسکریپت‌های test مرده از ۱۴ پکیج حذف شد؛ `scripts/test-all.mjs` حذف شد.
  - ۹۱ تست؛ پوشش statements هسته ≥۷۰٪ (state 77.9, scheduler 86.3, expressions 77.9, compiler 75.7).
  - DEC-001 (SW listener)، DEC-002 (runner) ثبت شد.
- typecheck/build از baseline سبز است (۳۴/۳۴).
