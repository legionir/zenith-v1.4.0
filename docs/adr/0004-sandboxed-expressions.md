# ADR-0004: موتور عبارت sandboxed به‌عنوان مرز امنیتی

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Zenith maintainers
- **Related:** [DEC-015](../decisions/DEC-015-security-fuzz-corpus.md) • [SECURITY.md](../../SECURITY.md)

## Context and Problem Statement

attributeهای `zen-*` عبارت‌های کاربر/قالب را اجرا می‌کنند
(`zen-if="user.age > 18"`). اگر این عبارت‌ها با `eval`/`new Function` اجرا شوند،
هر XSS در قالب به اجرای کد در origin تبدیل می‌شود و CSP سخت‌گیرانه هم بی‌اثر
می‌شود.

## Decision Drivers

- اجرای کد دینامیک ممنوع (`eval`/`new Function`) — الزام بند ۱۰ دستورالعمل و SECURITY.md.
- فقط خواندن داده از context؛ دسترسی به `window`/`document`/prototype باید مسدود باشد.
- خطاها باید ساختاریافته و قابل‌اقدام باشند (ZEN-002/ZEN-003/ZEN-004).
- کارایی: پارس نشود اگر بی‌مصرف است؛ نتیجه کش شود.

## Considered Options

1. `new Function` روی رشتهٔ عبارت (سریع، ناامن).
2. `eval` در iframe/sandbox جدا (پیچیدگی، ناهم‌زمانی).
3. **پارسر و مفسر اختصاصی AST** در `@zenith/expressions` با allowlist عضو/شناسه.

## Decision Outcome

گزینهٔ ۳ انتخاب شد. `@zenith/expressions` (L1) عبارت‌ها را AST-محور پارس و
interpret می‌کند: هیچ دسترسی به prototype زنجیره (`__proto__`, `constructor`),
هیچ شناسهٔ ممنوع، و خطای صریح `ZEN-002`/`ZEN-003`/`ZEN-004` با موقعیت. مرز
امنیتی با corpus مشترک XSS (۴۴ payload) و fuzz قطعی seed-محور در CI تست می‌شود
(DEC-015)؛ `fuzz-nightly.yml` نسخهٔ ۲ میلیون ورودی را شبانه اجرا می‌کند.

### Consequences

- ✅ CSP سخت‌گیرانه بدون `unsafe-eval` ممکن است (docs/CSP-GUIDE.md).
- ✅ خطاهای عبارت قابل انتساب به موقعیت دقیق‌اند.
- ⚠️ نبود برخی قابلیت‌های JS (مثل closure/nested arrow) پذیرفته شده؛ هر گسترش باید در AST و fuzz پوشش بگیرد.
- ⚠️ پارسر باید در برابر ورودی خصمانه مقاوم بماند؛ بودجهٔ زمانی و تست DoS لازم است (DEC-015).

## Links

- [SECURITY.md](../../SECURITY.md)
- [docs/CSP-GUIDE.md](../CSP-GUIDE.md)
- [packages/expressions/README.md](../../packages/expressions/README.md)
