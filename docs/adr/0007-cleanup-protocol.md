# ADR-0007: `createApp` و پروتکل آزادسازی (فقط `dispose()`/`Cleanup`)

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Zenith maintainers
- **Related:** [DEC-032](../decisions/DEC-032-cleanup-protocol.md) • [DEC-019](../decisions/DEC-019-single-api-virtual-list-transition.md) • [DEC-026](../decisions/DEC-026-lockstep-150-removal-200.md)

## Context and Problem Statement

چرخهٔ عمر در نسخه‌های اولیه واژگان ناهمگون داشت: `destroy()`، `cancel()`،
`stop()`، `clear*()`، `cleanup*()`. مصرف‌کننده نمی‌دانست چه چیزی را چطور و چه
زمانی آزاد کند و نشت حافظه در SPAهای طولانی‌عمر رواج داشت. همچنین ثبت دایرکتیو
یا کامپوننت راه واحدی برای «قابل بازگشت» شدن نداشت.

## Decision Drivers

- یک فعل برای آزادسازی؛ یک نوع برای بازگشتی که آزاد می‌کند.
- idempotent بودن: دوبار صدا زدن نباید خطا/خرابی بدهد.
- امکان اجرای چند اپ در یک صفحه (`createApp` بدون global اجباری).
- حفظ سازگاری: نام‌های قدیمی حذف نشوند، فقط alias منسوخ (DEC-026).

## Considered Options

1. `destroy()` به‌عنوان فعل اصلی و `dispose()` به‌عنوان alias.
2. رها کردن هر پکیج با واژگان خودش + مستندسازی تفاوت‌ها.
3. **`dispose()`/`Cleanup`** به‌عنوان قرارداد واحد با allowlist واژه‌های رفتاری.

## Decision Outcome

گزینهٔ ۳ انتخاب شد. `createX(options) → X & Disposable` و
`registerX/onX/bindX/processX → Cleanup` (`() => void` idempotent).
`Zen.start()`/`createApp(...).mount(el)` یک `Cleanup` برمی‌گردانند.
`destroy/cancel/stop` فقط alias منسوخ با `deprecate('ZEN-DEPR-0xx')` هستند، به‌جز
نام‌های **رفتاری** (لغو یک اجرا/پروسه نه چرخهٔ عمر) که در allowlist DEC-032
ثبت‌اند: `TransitionRun.cancel`، `http.cancelRequest`، `Zen.stop`،
`schema.stop` (فیلد بولی). اجرای گیت: `scripts/cleanup-hygiene.mjs`.

### Consequences

- ✅ مصرف‌کننده یک قاعده را یاد می‌گیرد؛ `using test = createTestHarness()` هم کار می‌کند.
- ✅ تست‌های idempotency الزامی‌اند (`cleanup-protocol.test.ts`).
- ⚠️ هر نام رفتاری جدید باید در allowlist DEC-032 توجیه شود، وگرنه گیت قرمز می‌شود.
- ⚠️ `clear*()` رجیستری‌های سراسری باید به `resetForTesting()`/`unregisterX` هدایت شوند (ADR-0012).

## Links

- [docs/API-CONVENTIONS.md §۳](../API-CONVENTIONS.md)
- [docs/decisions/DEC-032-cleanup-protocol.md](../decisions/DEC-032-cleanup-protocol.md)
- [packages/testing/README.md](../../packages/testing/README.md)
