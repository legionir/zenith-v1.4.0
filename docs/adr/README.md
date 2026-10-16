# تصمیم‌های معماری Zenith (ADR — `#108`)

این پوشه تصمیم‌های **معماری** را با قالب [MADR](https://adr.github.io/madr/)
نگه می‌دارد: چرا این‌گونه ساخته شده، چه گزینه‌هایی رد شدند و پیامدها چیست.
تصمیم‌های ریزتر و عملیاتی در [`docs/decisions/`](../decisions/) (`DEC-0xx`) ثبت
می‌شوند و هر ADR به DECهای مرتبط لینک می‌دهد؛ DEC = «what we decided this wave»،
ADR = «چرا این معماری، در نگاه بلندمدت».

## فهرست

<!-- ADR-INDEX:START -->
| ADR | عنوان | وضعیت |
|---|---|---|
| [ADR-0001](./0001-html-first-no-virtual-dom.md) | رندر HTML-First بدون Virtual DOM | Accepted |
| [ADR-0002](./0002-signal-graph-owner-tree.md) | گراف واکنش‌گرا بر پایهٔ Signal با درخت Owner | Accepted |
| [ADR-0003](./0003-deterministic-scheduler.md) | زمان‌بند قطعی و batch خودکار | Accepted |
| [ADR-0004](./0004-sandboxed-expressions.md) | موتور عبارت sandboxed به‌عنوان مرز امنیتی | Accepted |
| [ADR-0005](./0005-layered-monorepo.md) | مونوریپوی لایه‌ای L0–L5 + Tooling با اجرای dependency-cruiser | Accepted |
| [ADR-0006](./0006-unified-error-model.md) | مدل خطای واحد — یک ZenithError، یک hub، کدهای چهاررقمی و صفحهٔ مستندات | Accepted |
| [ADR-0007](./0007-cleanup-protocol.md) | `createApp` و پروتکل آزادسازی (فقط `dispose()`/`Cleanup`) | Accepted |
| [ADR-0008](./0008-dual-esm-cjs-exports.md) | انتشار دوگانه ESM/CJS، شکل `exports` و یک `.d.ts` تجمیع‌شده برای هر ورودی | Accepted |
| [ADR-0009](./0009-lockstep-and-deprecation.md) | نسخه‌گذاری lockstep `1.5.0` و سیاست deprecation (حذف فقط در ۲.۰) | Accepted |
| [ADR-0010](./0010-test-strategy-vitest.md) | راهبرد تست — vitest واحد، آستانهٔ پوشش و گیت‌های مستندات | Accepted |
| [ADR-0011](./0011-platform-support-matrix.md) | کف پشتیبانی — Node ≥18.19 و ماتریس مرورگر، بدون API نود در پکیج‌های رانتایم | Accepted |
| [ADR-0012](./0012-registry-contract.md) | قرارداد رجیستری — `registerX → Cleanup`, `resetForTesting()`، بدون `clear*` سراسری | Accepted |
| [ADR-0013](./0013-generated-docs-and-gates.md) | مستندات تولیدشده و گیت‌های تازگی در CI | Accepted |
| [ADR-0014](./0014-privacy-and-opt-in-telemetry.md) | حریم خصوصی به‌صورت پیش‌فرض — telemetry فقط با opt-in صریح | Accepted |
| [ADR-0015](./0015-ssr-streaming-hydration.md) | SSR استریم‌محور با hydration دقیق و ایزولاسیون per-request | Accepted |
<!-- ADR-INDEX:END -->

## قالب (MADR)

```md
# ADR-0000: عنوان تصمیم

- **Status:** Accepted            <!-- Proposed | Accepted | Deprecated | Rejected | Superseded by ADR-NNNN -->
- **Date:** YYYY-MM-DD
- **Deciders:** Zenith maintainers
- **Related:** [DEC-0xx](../decisions/DEC-0xx-*.md)

## Context and Problem Statement

چه مسئله‌ای بود و چه چیزی آن را اجباری می‌کرد؟

## Decision Drivers

- معیارهای تصمیم (کارایی، سازگاری، امنیت، هزینهٔ نگهداری…)

## Considered Options

1. گزینهٔ الف
2. گزینهٔ ب
3. گزینهٔ ج

## Decision Outcome

کدام گزینه انتخاب شد، چطور پیاده شده و کجا اجرا/گیت می‌شود.

### Consequences

- ✅ سود
- ⚠️ هزینه/ریسک و مسیر جبران

## Links

- سندها، کد و گیت‌های مرتبط (لینک نسبی)
```

## افزودن ADR

1. شمارهٔ بعدی را بردار: `docs/adr/<NNNN>-<slug>.md` (بدون پرش شماره).
2. بخش‌های اجباری را پر کن و دست‌کم یک DEC موجود را لینک بده.
3. `node scripts/check-adr.mjs --write` تا فهرست بالا به‌روز شود.
4. گیت: `node scripts/check-adr.mjs` (بخشی از job `deps` در CI).

گیت بررسی می‌کند: شماره‌گذاری ترتیبی، حضور بخش‌های MADR، وضعیت معتبر، پیوند
DEC موجود، سالم بودن همهٔ لینک‌های نسبی و تازه بودن فهرست. تصمیم‌های معماری
بدون ADR/گیت، در `docs/ARCHITECTURE-LAYERS.md` و `ARCHITECTURE.md` فقط توصیف
می‌شوند؛ **منبع تصمیم** همان ADR است.

## نمودار وابستگی و هستهٔ reactive

شرح ماشین‌خوان معماری (لایه‌ها، یال‌های وابستگی، مسیر هستهٔ reactive) در
[`docs/ARCHITECTURE-GRAPH.md`](../ARCHITECTURE-GRAPH.md) است و توسط
`node scripts/generate-architecture-graph.mjs` از dependency-cruiser تولید
می‌شود؛ SVG کامل آن در هر اجرای CI به‌عنوان artifact منتشر می‌شود.
