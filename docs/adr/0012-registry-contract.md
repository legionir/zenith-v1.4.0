# ADR-0012: قرارداد رجیستری — `registerX → Cleanup`, `resetForTesting()`، بدون `clear*` سراسری

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Zenith maintainers
- **Related:** [DEC-032](../decisions/DEC-032-cleanup-protocol.md) • [DEC-031](../decisions/DEC-031-unified-error-hub.md) • [ADR-0007](./0007-cleanup-protocol.md)

## Context and Problem Statement

رجیستری‌های سراسری (component/auth/permission/server-component/directive/plugin/
action/resource/store) کلید و امضای ناهمگون داشتند: کلید گاهی `name` و گاهی `id`؛
پاک‌سازی با `clearActions`/`clearAuth`/`cleanupRouter`/`resetResourceRegistry`؛
بعضی `has/list` نداشتند. تست‌ها با همین توابع سراسری بین هم نشت می‌کردند و
مصرف‌کننده هم راهی جز صدا زدن `clear*` نداشت.

## Decision Drivers

- پنج متد یکسان روی هر رجیستری: `registerX/getX/hasX/listX/unregisterX`.
- ثبت باید قابل بازگشت باشد (identity-guard) و idempotent.
- تست‌ها باید با یک فراخوان همهٔ حالت سراسری را ریست کنند (`resetForTesting()`).
- سازگاری: نام‌های قدیمی بمانند (alias منسوخ با کد ZEN-DEPR).

## Considered Options

1. نگه‌داشتن `clear*` به‌عنوان API عمومی اصلی.
2. رجیستری per-App اجباری (بدون هیچ حالت ماژولی) — شکستن سازگاری.
3. **قرارداد واحد + `resetForTesting()` در `@zenith/testing` + alias منسوخ برای `clear*`**.

## Decision Outcome

گزینهٔ ۳ انتخاب شد: `registerX(key, value) → Cleanup` (حذف فقط ثبت خودش؛ دوبار
صدا زدن بی‌خطر)، `getX` در نبود کلید `undefined` می‌دهد (نه throw)، و
`hasX/listX/unregisterX` برای بررسی/فهرست/حذف صریح. `resetForTesting()` در
`@zenith/testing` (L4) همهٔ هوک‌های ریست ثبت‌شده + هشدارهای منسوخ‌شده + تاریخچهٔ
خطاها را پاک می‌کند تا تست‌ها بین هم نشت نکنند. `clear*()`/`cleanup*()` قدیمی
aliasهای منسوخ‌اند (`@deprecated` + کد ZEN-DEPR) و در ۲.۰ حذف می‌شوند. مسیر
تولیدی برای آزادسازی، `dispose()` روی همان اپ/شیء است (`createApp`).

### Consequences

- ✅ تست‌ها با `resetForTesting()` ایزوله می‌شوند؛ نشت بین فایل‌های تست از بین می‌رود.
- ✅ APIهای رجیستری قابل پیش‌بینی و قابل بازبینی با یک تست قرارداد.
- ⚠️ رجیستری‌های ماژول‌سطحی باقی می‌مانند تا ۲.۰؛ انتقال کامل به `App` (وابسته به `createApp`) کار آینده است.
- ⚠️ هر رجیستری جدید باید هر پنج متد را داشته باشد و در گیت قرارداد ثبت شود.

## Links

- [docs/API-CONVENTIONS.md §۱.۲](../API-CONVENTIONS.md)
- [docs/ATTRIBUTE-GRAMMAR.md](../ATTRIBUTE-GRAMMAR.md)
- [scripts/cleanup-hygiene.mjs](../../scripts/cleanup-hygiene.mjs)
