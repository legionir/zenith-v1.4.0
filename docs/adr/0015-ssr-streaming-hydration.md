# ADR-0015: SSR استریم‌محور با hydration دقیق و ایزولاسیون per-request

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Zenith maintainers
- **Related:** [DEC-011](../decisions/DEC-011-suspense-generation.md) • [DEC-027](../decisions/DEC-027-node-floor-dual-format.md) • [ADR-0001](./0001-html-first-no-virtual-dom.md)

## Context and Problem Statement

HTML-First یعنی سرور می‌تواند همان markup را رندر کند که کلاینت hydrate می‌کند؛
اما رندر رشته‌ای کل پاسخ را حبس می‌کند (TTFB بد) و اگر state سرور و کلاینت یکی
نباشد hydration mismatch رخ می‌دهد — خطای رایجی که در عمل «فلاش محتوا» می‌سازد.

## Decision Drivers

- TTFB کم: خروجی باید جریانی باشد (ReadableStream با backpressure).
- hydration بدون mismatch: مسیر رندر کلاینت/سرور یکی باشد (ADR-0001).
- ایزولاسیون per-request: state یک درخواست نباید به درخواست دیگر نشت کند.
- timeouts/cancel: رندر باید قابل لغو و سقف‌دار باشد.

## Considered Options

1. فقط `renderToString` (ساده، TTFB بد).
2. رندر موازی در worker جدا به ازای هر درخواست (هزینهٔ عملیاتی بالا).
3. **`renderToString` + `renderToReadableStream` با timeout/کش قالب و
   `AsyncLocalStorage` برای ایزولاسیون**.

## Decision Outcome

گزینهٔ ۳ انتخاب شد. `@zenith/ssr` (L3) هم رندر رشته‌ای و هم جریانی می‌دهد
(`timeout`، `cacheTemplates`، `chunkSize`، `signal: AbortSignal`)، و
`startFromSSR`/`hydrate` در `runtime-core` همان state سریالایز‌شده را مصرف
می‌کند. ایزولاسیون per-request روی `AsyncLocalStorage` (و در مرورگر:
`process.getBuiltinModule` وقتی موجود نیست، fallback محلی) بنا شده است؛ همین
نیاز، کف نسخهٔ Node را به `>=18.19` می‌رساند (ADR-0011). suspense داخلی برای
پرامیس‌های رندر، نسل‌دار است (DEC-011) تا نتیجهٔ نسل قبلی به نسل جدید نشت نکند.

### Consequences

- ✅ TTFB پایین با حفظ hydration دقیق؛ محتوای سرور و کلاینت یکی است.
- ✅ timeout/cancel قابل تنظیم؛ کش قالب هزینه را کاهش می‌دهد.
- ⚠️ hydration mismatch کد خطای اختصاصی (`ZEN-304`/`ZEN-908`) دارد و باید در تست SSR پوشش بگیرد.
- ⚠️ پکیج‌های SSR باید بدون DOM واقعی هم تست شوند (jsdom یا DOM سازگار تزریقی).

## Links

- [packages/ssr/README.md](../../packages/ssr/README.md)
- [playwright.config.ts](../../playwright.config.ts) — سناریوهای مرورگری
- [docs/ARCHITECTURE-GRAPH.md](../ARCHITECTURE-GRAPH.md)
