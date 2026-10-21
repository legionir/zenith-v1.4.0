# ADR-0003: زمان‌بند قطعی و batch خودکار

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Zenith maintainers
- **Related:** [DEC-002](../decisions/DEC-002-vitest-runner.md) • [ADR-0002](./0002-signal-graph-owner-tree.md)

## Context and Problem Statement

اگر هر `set()` فوراً همهٔ effectهای وابسته را اجرا کند، یک به‌روزرسانی چند
سیگنالی (مثلاً مرتب‌سازی + صفحه‌بندی) چند بار رندر می‌کند. از طرف دیگر، اجرای
دستی `batch()` در کد کاربر API اضافی و منبع باگ است؛ در نسخهٔ قبل `batch()`
deprecate شد چون زمان‌بند خودش دسته‌بندی می‌کند.

## Decision Drivers

- یک به‌روزرسانی منطقی = یک رندر (بدون torn state).
- تست‌های deterministic: بدون `setTimeout` واقعی و بدون شبکه.
- امکان flush اجباری در تست و در مرز SSR/hydration (`flushSync`).
- اولویت‌دهی: رندر پیش از کار پاک‌سازی/کم‌اهمیت.

## Considered Options

1. اجرای فوری effectها در `set`.
2. `batch()` صریح در API عمومی (الگوی قدیمی).
3. **صف داخلی زمان‌بند** با microtask/rAF و `flushSync` برای مرزهای قطعی.

## Decision Outcome

گزینهٔ ۳ انتخاب شد. `@zenith/scheduler` (L0) صف اثرها را با اولویت و کولسینگ
اداره می‌کند؛ `flushSync()` در تست‌ها و در SSR، و `nextTick()` برای انتظار
غیرمسدودکننده استفاده می‌شود. `schedule()` به `scheduleEffect()` تغییر نام یافت
(ZEN-DEPR-025، DEC-019) چون «schedule» ناقص و در تضاد با `setTimeout` بود.

### Consequences

- ✅ بدون رندر تکراری؛ API عمومی کوتاه‌تر (بدون `batch`).
- ✅ `flushSync` مرز قطعی تست/SSR می‌دهد؛ `useFakeTimers` در `@zenith/testing` زمان را تزریق می‌کند (DEC-002).
- ⚠️ اثرهای نوشتنی (مثل `zen-model`) باید idempotent باشند، نه فرض «یک بار اجرا».
- ⚠️ رندر هنگام idle (rAF) ممکن است در تب پس‌زمینه دیر شود؛ fallback timer در ADR مربوط به transition (DEC-013) همین را پوشش می‌دهد.

## Links

- [docs/performance-tuning.md](../performance-tuning.md)
- [packages/scheduler/README.md](../../packages/scheduler/README.md)
- [docs/ARCHITECTURE-GRAPH.md](../ARCHITECTURE-GRAPH.md)
