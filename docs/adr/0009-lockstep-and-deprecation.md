# ADR-0009: نسخه‌گذاری lockstep `1.5.0` و سیاست deprecation (حذف فقط در ۲.۰)

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Zenith maintainers
- **Related:** [DEC-026](../decisions/DEC-026-lockstep-150-removal-200.md) • [DEC-019](../decisions/DEC-019-single-api-virtual-list-transition.md) • [DEC-020](../decisions/DEC-020-error-code-space.md)

## Context and Problem Statement

۴۹ پکیج با نسخه‌های مستقل یعنی ماتریس سازگاری که کسی نمی‌تواند نگه دارد؛
همچنین حذف نام‌های قدیمی (`processVirtualList`, `destroy`, `clearCache`) در
minor باعث شکستن برنامهٔ مصرف‌کننده می‌شود. مسئله: چگونه هم‌زمان سرعت
تغییر API را داشته باشیم و هم مصرف‌کننده غافلگیر نشود؟

## Decision Drivers

- یک نسخه برای همهٔ پکیج‌ها ⇒ یک ماتریس سازگاری.
- هیچ جریمهٔ بی‌خبری: هر تغییر شکستنی باید یک minor قبل هشدار بدهد.
- وابستگی‌های workspace نباید به رجیستری عمومی برای نسخهٔ منتشرنشده اشاره کنند.
- قابلیت ماشین‌خوان بودن: کد هشدار (`ZEN-DEPR-xxx`) + تست گیت.

## Considered Options

1. SemVer مستقل به ازای پکیج (وابستگی matrix پیچیده).
2. lockstep روی `1.4.0` و حذف نام‌های قدیمی در همان minor.
3. **lockstep روی `1.5.0` برای پکیج‌های جدید، حذف نام‌های قدیمی فقط در `2.0.0`**.

## Decision Outcome

گزینهٔ ۳ انتخاب شد. همهٔ پکیج‌ها هم‌نسخه‌اند (`1.4.0` فعلی، هدف بعدی `1.5.0`) و
وابستگی‌های داخلی با نسخهٔ دقیق پین می‌شوند. هر نام منسوخ با
`deprecate('ZEN-DEPR-xxx', oldName, replacement)` **یک‌بار در dev** هشدار می‌دهد و
فقط در `2.0.0` حذف می‌شود؛ رجیستری `DEPRECATION_CODES` منبع یکتا و
`docs/DEPRECATION-POLICY.md` سیاست را توضیح می‌دهد. کدهای خطای سه‌رقمی هرگز
renumber نمی‌شوند (DEC-020).

### Consequences

- ✅ ماتریس سازگاری ساده؛ مهاجرت پیش‌بینی‌پذیر (۲.۰ = حذف نام‌های منسوخ).
- ✅ هشدارها ماشین‌خوان و در مستندات قابل جست‌وجو هستند (هر کد یک صفحه).
- ⚠️ انتشار باید هم‌زمان باشد (`--require-lockstep` در `scripts/release.mjs`).
- ⚠️ انباشت نام‌های منسوخ تا ۲.۰؛ بودجهٔ نگهداری آگاهانه پذیرفته شد.

## Links

- [docs/DEPRECATION-POLICY.md](../DEPRECATION-POLICY.md)
- [docs/VERSIONING-STRATEGY.md](../VERSIONING-STRATEGY.md)
- [docs/migration-guide.md](../migration-guide.md)
