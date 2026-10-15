# ADR-0011: کف پشتیبانی — Node ≥18.19 و ماتریس مرورگر، بدون API نود در پکیج‌های رانتایم

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Zenith maintainers
- **Related:** [DEC-007](../decisions/DEC-007-node-floor.md) • [DEC-027](../decisions/DEC-027-node-floor-dual-format.md) • [DEC-030](../decisions/DEC-030-storage-l0.md)

## Context and Problem Statement

کف پشتیبانی باید صریح باشد وگرنه هر پکیج محدودیت خودش را تحمیل می‌کند: یک جا
`structuredClone`، جایی `process.getBuiltinModule`، جایی Buffer. مصرف‌کننده هم
نمی‌داند کدام مرورگر پشتیبانی می‌شود.

## Decision Drivers

- حداقل نسخه باید توسط CI اجرا شود (ماتریس Node)، نه فقط نوشته شود.
- پکیج‌های رانتایم (L0–L5) باید در مرورگر و SSR **یک** کد داشته باشند (بدون fork).
- ابزارهای build/IDE می‌توانند به API نود وابسته باشند (Tooling).
- SSR per-request به `AsyncLocalStorage`/`process.getBuiltinModule` نیاز دارد ⇒ کف نسخه را تعیین می‌کند.

## Considered Options

1. کف Node 20 (ساده، اما کاربران 18.19 را از دست می‌دهیم).
2. کف Node 16/18.0 (نیاز به polyfill برای APIهای جدید).
3. **Node ≥18.19** با CI روی 18.19/20/22 و browserslist صریح برای مرورگر.

## Decision Outcome

گزینهٔ ۳ انتخاب شد (DEC-007/DEC-027). `engines.node = ">=18.19"` در ریشه و همهٔ
پکیج‌ها، ماتریس CI روی 18.19/20/22، و `browserslist` (Chrome/Edge ≥109،
Firefox ≥115، Safari/iOS ≥16.4) با `docs/BROWSER-SUPPORT.md` هم‌گام. پکیج‌های
رانتایم نباید به `node:*` وابسته شوند؛ جای آن سازگاری ساختاری (مثل
`readable`/`storage` adapter) استفاده می‌شود و وابستگی dev-محور هم ممنوع است.

### Consequences

- ✅ یک کد برای مصرف‌کنندهٔ سرور و کلاینت؛ SSR با همان مسیر.
- ✅ job `unit-os-matrix` رفتار ویندوز/macOS را هم می‌سنجد.
- ⚠️ استفاده از APIهای جدیدتر نود نیازمند یا ارتقای کف نسخه یا polyfill است.
- ⚠️ تست‌های وابسته به build در job یونیت باید با `isFullyBuilt()` skip شوند.

## Links

- [docs/BROWSER-SUPPORT.md](../BROWSER-SUPPORT.md)
- [SUPPORT.md](../../SUPPORT.md)
- [docs/decisions/DEC-027-node-floor-dual-format.md](../decisions/DEC-027-node-floor-dual-format.md)
