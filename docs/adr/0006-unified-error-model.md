# ADR-0006: مدل خطای واحد — یک ZenithError، یک hub، کدهای چهاررقمی و صفحهٔ مستندات

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Zenith maintainers
- **Related:** [DEC-020](../decisions/DEC-020-error-code-space.md) • [DEC-031](../decisions/DEC-031-unified-error-hub.md) • [DEC-033](../decisions/DEC-033-telemetry-cli-console.md)

## Context and Problem Statement

پیش از این تثبیت، هر پکیج خطای خودش را می‌ساخت: کلاس‌های اختصاصی، `Error` ساده،
`console.error` مستقیم و کدهای بی‌شماره. نتیجه: مصرف‌کننده نمی‌توانست خطا را
غربال کند، هیچ مسیر واحدی برای reporting نبود و اضافه‌شدن `console.*` جدید در
هر PR قابل کنترل نبود.

## Decision Drivers

- یک نقطهٔ انتشار برای خطای زمان اجرا (قابل اتصال به Sentry/OTel).
- کد پایدار و قابل استناد در مستندات/پشتیبانی (با صفحهٔ اختصاصی و لینک).
- پیام دوزبانه (fa پیش‌فرض، en برای ابزارها) بدون شکستن کدهای موجود.
- خطای برنامه‌نویس باید `throw` شود، خطای runtime به hub برود (بدون `console.*`).

## Considered Options

1. کلاس خطای اختصاصی به ازای پکیج + `console.error` پراکنده.
2. یک کلاس عمومی `Error` با `message` رشته‌ای و کد داخل متن.
3. **`ZenithError` واحد + لیسنر hub + کاتالوگ کد + گیت‌های hygiene**.

## Decision Outcome

گزینهٔ ۳ انتخاب شد. `@zenith/errors` (L0) تنها سازندهٔ خطاست:
`ZenithError(code, category, message, suggestion, details, docsUrl, cause)`,
`createReservedError(code)`, `developerError(...)`. مسیر runtime فقط
`reportError/emitError/onError` در `hub.ts` است و سقف `console.*` با ratchet
(`scripts/no-console-ratchet.mjs` + `error-hygiene`) فقط رو به پایین حرکت می‌کند.
فضای کدها دوآهنگ است: `ZEN-NNN` سه‌رقمی کلاسیک (هرگز renumber نمی‌شود) و بازه‌های
`ZEN-1NNN..2NNN` برای پکیج‌های جدید (DEC-020). هر کد `docsUrl` دارد و صفحهٔ
`docs/errors/<code>.md` از همان کاتالوگ تولید می‌شود (#112).

### Consequences

- ✅ error-boundary فقط یک adapter نازک است؛ reporting یک مسیر دارد.
- ✅ کدها قابل استناد و مستندند؛ `docs/ERROR-CODES.md` از کاتالوگ تولید می‌شود.
- ⚠️ کد سه‌رقمی تاریخی حفظ می‌شود (dual-space) تا سازگاری نشکند.
- ⚠️ سقف `console.*` باید هر بار فقط کاهش یابد؛ `scripts/no-console-ratchet.mjs` جلوی رشد را می‌گیرد.

## Links

- [docs/ERROR-CODES.md](../ERROR-CODES.md)
- [docs/ERROR-REPORTING.md](../ERROR-REPORTING.md)
- [docs/errors/README.md](../errors/README.md)
