# ADR-0010: راهبرد تست — vitest واحد، آستانهٔ پوشش و گیت‌های مستندات

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Zenith maintainers
- **Related:** [DEC-002](../decisions/DEC-002-vitest-runner.md) • [DEC-015](../decisions/DEC-015-security-fuzz-corpus.md) • [DEC-005](../decisions/DEC-005-package-order.md)

## Context and Problem Statement

پکیج‌ها هرکدام runner خودشان را داشتند (`node:test`, اسکریپت دستی، بدون DOM)،
پوشش تست اندازه‌گیری نمی‌شد و تست‌های رفتاری مثل SSR/دایرکتیو به jsdom نیاز
داشتند. همچنین اعداد و ادعاهای مستندات (مثال‌های کد، جدول‌ها) جایی تست نمی‌شدند
و بی‌سروصدا کهنه می‌شدند.

## Decision Drivers

- یک runner برای همه (source-map، شبیه‌سازی DOM، snapshot، coverage v8).
- آستانهٔ پوشش **اجباری** برای هسته: ≥۸۰٪ در `state/scheduler/expressions/compiler`.
- تست‌ها deterministic: بدون 시간/شبکهٔ واقعی (clock تزریقی).
- ادعاهای مستندات باید آزمون‌پذیر باشند: مثال‌های کد، کدهای خطا، لایه‌ها، نسخه‌ها.

## Considered Options

1. `node:test` بومی + jsdom دستی.
2. Jest (شبیه‌سازی ESM سخت، کندتر، پیکربندی پیچیده).
3. **vitest 3 + @vitest/coverage-v8** با alias به src و آستانه‌های پوشش.

## Decision Outcome

گزینهٔ ۳ انتخاب شد (DEC-002). `vitest.config.ts` همهٔ `@zenith/*` را به `src`
alias می‌کند (بدون نیاز به dist)، پوشش با v8 و آستانهٔ ۸۰٪ برای چهار پکیج هسته
اجبار می‌شود، و تست‌های سناریوی واقعی مرورگر جداگانه با Playwright (Chromium،
Firefox، WebKit) اجرا می‌شوند. گیت‌های مستندات/متادیتا هم بخشی از اجرای تست
هستند: مثال‌های علامت‌خورده (#106)، صفحهٔ کدهای خطا (#112)، کدهای deprecation،
جدول لایه‌ها، اسنپ‌شات سطح API و `docs/TRACEABILITY.md`.

### Consequences

- ✅ یک دستور (`npm test`) همهٔ قراردادها را می‌سنجد؛ افت پوشش build را می‌شکند.
- ✅ تست‌های اضافه‌شده در eslint/cruiser نادیده گرفته نمی‌شوند (پوشش معیار است، نه تعداد فایل).
- ⚠️ alias به src یعنی تست‌ها روی باندل منتشرشده اجرا نمی‌شوند؛ برای آن jobهای `dts-parity`/`install-import`/e2e وجود دارد.
- ⚠️ تست‌های وابسته به dist باید با `isFullyBuilt()` skip شوند (job یونیت dist نمی‌سازد).

## Links

- [docs/README.md](../README.md) — دستورهای توسعه
- [CONTRIBUTING.md](../../CONTRIBUTING.md)
- [playwright.config.ts](../../playwright.config.ts)
