# ADR-0001: رندر HTML-First بدون Virtual DOM

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Zenith maintainers
- **Related:** [DEC-025](../decisions/DEC-025-runtime-core-split-parity.md) • [ARCHITECTURE.md §۱](../../ARCHITECTURE.md)

## Context and Problem Statement

Zenith برای برنامه‌های فارسی/RTL با قالب‌های HTML موجود طراحی شده است. مدل‌های
موجود یا Virtual DOM دارند (React/Vue) یا کامپایل به imperative DOM (Svelte/Solid).
Virtual DOM یعنی یک لایهٔ diff در هر update و markup نهایی که با HTML دست‌نویس
یکی نیست؛ کامپایل کامل هم یعنی markup باید داخل کامپوننت باشد، نه در سند HTML.

## Decision Drivers

- markup موجود (HTML سرور/قالب طراح) باید بدون بازنویسی کار کند.
- هر تغییر signal فقط باید گرهٔ وابسته را به‌روزرسانی کند (بدون diff کل درخت).
- SSR باید همان markup را بدهد که کلاینت hydrate می‌کند (بدون mismatch).
- سطح API برای کاربر جدید: `zen-*` attribute + `Zen.start`، بدون DSL جدید.

## Considered Options

1. Virtual DOM با diff درخت.
2. کامپایل به imperative DOM (کامپوننت‌محور، markup داخل JS).
3. **HTML-First**: قالب HTML موجود + attributeهای `zen-*` + walker رانتایم و کامپایلر اختیاری.

## Decision Outcome

گزینهٔ ۳ انتخاب شد. دایرکتیوهای `zen-*` روی DOM واقعی bind می‌شوند
(`bindX(el, ctx) → Cleanup`)، کامپایلر فقط برای سرعت (حذف walker و inline کردن
updateها) استفاده می‌شود و **رفتار** در هر دو مسیر یکی است
(`docs/DIRECTIVE-PARITY.md`). `Zen.start(root, state)` / `createApp(...).mount(el)`
ورودی‌های عمومی‌اند و `runtime-core` مرز مشترک رانتایم/SSR است (DEC-025).

### Consequences

- ✅ markup قالبی موجود بدون بازنویسی کار می‌کند؛ هیچ diff روی کل درخت اجرا نمی‌شود.
- ✅ SSR و کلاینت یک مسیر کد دارند؛ hydration فقط attributeخوانی است.
- ⚠️ کارایی به کیفیت bind گره‌محور وابسته است؛ هر جایگزینی `innerHTML` کل زیردرخت را می‌سوزاند.
- ⚠️ دو مسیر (walker/کامپایلر) باید parity داشته باشند؛ گیت `docs/DIRECTIVE-PARITY.md`.

## Links

- [ARCHITECTURE.md](../../ARCHITECTURE.md) — لایه‌ها و مسیر رندر
- [docs/DIRECTIVE-PARITY.md](../DIRECTIVE-PARITY.md) — تعهد parity
- [docs/ATTRIBUTE-GRAMMAR.md](../ATTRIBUTE-GRAMMAR.md) — گرامر attributeهای `zen-*`
