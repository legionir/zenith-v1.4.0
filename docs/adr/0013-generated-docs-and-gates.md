# ADR-0013: مستندات تولیدشده و گیت‌های تازگی در CI

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Zenith maintainers
- **Related:** [DEC-003](../decisions/DEC-003-eslint-scope.md) • [ADR-0005](./0005-layered-monorepo.md) • [ADR-0010](./0010-test-strategy-vitest.md)

## Context and Problem Statement

فهرست‌ها و جدول‌های مرجع (کد کدهای خطا، سطح API، لایه‌ها، متادیتای `zen-*`،
مثال‌های کد) وقتی دستی نگه داشته شوند کهنه می‌شوند؛ و کهنه‌شدنشان تا زمانی که
مصرف‌کننده به آن بربخورد دیده نمی‌شود. مکانیزم قدیمی «به‌یاد‌داشتن به‌روزرسانی»
در یک مخزن ۴۹ پکیجی شکست خورده است.

## Decision Drivers

- هیچ فهرست مرجعی نباید دستی نگه داشته شود اگر می‌توان از منبع تولید کرد.
- کهنه‌شدن باید **بلوکه‌کنندهٔ CI** باشد، نه یادآوری در PR.
- تولید نباید به build وابسته باشد (جاب‌های سبک بدون dist).
- خروجی تولیدشده باید diff-friendly و قابل بازبینی باشد.

## Considered Options

1. دستی‌نگهداری + بازبینی در code review.
2. تولید در زمان build و publish به سایت (بدون گیت در مخزن).
3. **تولید در مخزن + حالت `--check` به‌عنوان گیت CI** (الگوی `sync-license --check`).

## Decision Outcome

گزینهٔ ۳ انتخاب شد. هر سند مشتق‌شده توسط یک اسکریپت با حالت `--check` تولید
می‌شود و در job `deps` (سبک، بدون dist) یا job `package-lint` اجرا می‌گردد:

| سند | تولیدکننده | گیت CI |
|---|---|---|
| `docs/ERROR-CODES.md` + `docs/errors/*` | `scripts/generate-error-docs.mjs` | `npm run check:error-docs` |
| `docs/api/*` + `api-surface.snapshot.json` | `scripts/generate-api-docs.mjs` | `npm run docs:api -- --check` |
| `docs-site/api` (مرجع TypeDoc نسخهٔ جاری، latest-only) | `typedoc` (`typedoc.json`, `npm run docs:reference`) | استقرار `.github/workflows/docs-pages.yml` (تازگی INDEX در job `deps`) |
| لینک‌های نسبی `docs/api/*` + ورودی‌های مرجع | `scripts/check-doc-links.mjs` | `npm run check:doc-links` |
| `docs/meta/zenith.meta.json` | `scripts/gen-zenith-meta.mjs` | `node scripts/gen-zenith-meta.mjs --check` |
| `docs/ARCHITECTURE-GRAPH.md` | `scripts/generate-architecture-graph.mjs` | `npm run check:architecture-graph` |
| `LICENSE` پکیج‌ها | `scripts/sync-license.mjs` | `node scripts/sync-license.mjs --check` |
| مثال‌های کد مستندات | `scripts/check-docs-examples.mjs` (#106) | `npm run check:docs-examples` |

### Consequences

- ✅ کهنه‌شدن مستند مرجع = build قرمز؛ کسی مجبور نیست فهرست‌ها را یادآوری کند.
- ✅ تولید بدون build؛ جاب‌های سبک بدون نصب artifact سنگین اجرا می‌شوند.
- ⚠️ هر تغییر کد که فهرست را تغییر دهد باید با یک دستور تولید را به‌روز کند (چند ثانیه).
- ⚠️ فایل‌های تولیدشده در `files` نشر نیستند؛ فقط در مخزن/سایت مصرف می‌شوند.

## Links

- [scripts/generate-error-docs.mjs](../../scripts/generate-error-docs.mjs)
- [scripts/generate-api-docs.mjs](../../scripts/generate-api-docs.mjs)
- [scripts/check-doc-links.mjs](../../scripts/check-doc-links.mjs)
- [docs/DOC-EXAMPLES.md](../DOC-EXAMPLES.md)
