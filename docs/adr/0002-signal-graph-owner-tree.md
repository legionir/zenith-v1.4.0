# ADR-0002: گراف واکنش‌گرا بر پایهٔ Signal با درخت Owner

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Zenith maintainers
- **Related:** [DEC-009](../decisions/DEC-009-readable-brand.md) • [DEC-021](../decisions/DEC-021-readable-shared.md) • [DEC-018](../decisions/DEC-018-state-scheduler-peer-singleton.md)

## Context and Problem Statement

یک فریم‌ورک بدون Virtual DOM به یک مدل واکنش‌گرای دقیق نیاز دارد: تغییر یک مقدار
باید دقیقاً به effectهای وابسته برسد، بدون walk کردن درخت DOM و بدون نشت حافظه
در برنامه‌های طولانی‌عمر. همچنین کامپوننت/دایرکتیو باید بتواند مشترکین خود را
با یک فراخوان پاک کند.

## Decision Drivers

- گرانولاریتی در سطح **گرهٔ DOM** (به‌جای کامپوننت) و به‌روزرسانی کشی.
- آزادسازی قطعی: هیچ لیسنری نباید بدون مالک باقی بماند (ADR-0007).
- تشخیص «مقدار واکنشی» به‌صورت ساختاری، بدون وابستگی چرخه‌ای بین پکیج‌ها.
- سازگاری با SSR/hydration و اجرای هم‌زمان چند اپ در یک صفحه.

## Considered Options

1. Observables مبتنی بر push با subscription دستی (RxJS-style).
2. Proxy-based reactivity (Vue-style) با ردیابی خودکار دسترسی‌ها.
3. **Signal/Computed + effect با owner tree** (pull-based خواندن، push زمان‌بندی‌شده).

## Decision Outcome

گزینهٔ ۳ انتخاب شد: `signal`/`computed` در `@zenith/state` (L1)، اجرای effectها در
`@zenith/scheduler` (L0)، و `createRoot`/owner tree برای مالکیت. خواندن مقدار با
`get()` (pull) و اعلام تغییر با `set()` که effectهای وابسته را در صف زمان‌بند
می‌گذارد (ADR-0003). تشخیص «قابل‌خواندن» با brand `Symbol.for('zenith.readable')`
است (DEC-009) تا contextها مقدار `computed` را بدون snapshot کردن unwrap کنند، و
`Readable<T>` ساختاری در `@zenith/shared` تعریف شده تا چرخهٔ `shared ↔ state`
ساخته نشود (DEC-021).

### Consequences

- ✅ به‌روزرسانی گره‌محور و کشی؛ بدون diff و بدون walk.
- ✅ `dispose`/`Cleanup` روی owner tree یک نقطهٔ آزادسازی می‌دهد.
- ⚠️ قوانین مصرف‌کننده (untrack برای callbackهای کاربر، بلوغ dependency) باید رعایت شود؛ DEC-010 نمونه است.
- ⚠️ `state`/`scheduler` باید singleton باشند (peer rule؛ DEC-018) وگرنه دو گراف موازی ساخته می‌شود.

## Links

- [docs/ARCHITECTURE-GRAPH.md](../ARCHITECTURE-GRAPH.md) — نمودار وابستگی و مسیر هستهٔ reactive
- [ARCHITECTURE.md](../../ARCHITECTURE.md) — توصیف هستهٔ Reactive
- [packages/state/README.md](../../packages/state/README.md)
