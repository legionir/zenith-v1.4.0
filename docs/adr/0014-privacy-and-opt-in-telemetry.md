# ADR-0014: حریم خصوصی به‌صورت پیش‌فرض — telemetry فقط با opt-in صریح

- **Status:** Accepted
- **Date:** 2026-10-15
- **Deciders:** Zenith maintainers
- **Related:** [DEC-033](../decisions/DEC-033-telemetry-cli-console.md) • [SECURITY.md](../../SECURITY.md)

## Context and Problem Statement

ابزارهای CLI معمولاً آمار مصرف را پیش‌فرض می‌فرستند (بدون اطلاع کاربر) و همین
الگو در اکوسیستم‌های npm دردسر حقوقی/اعتماد ساخته است. همزمان، تیم توسعه برای
اولویت‌بندی به آمار نیاز دارد.

## Decision Drivers

- هیچ داده‌ای بدون رضایت صریح ارسال نشود؛ هیچ endpoint پیش‌فرضی نباشد.
- حتی وقتی کاربر opt-in کرد، هیچ PII/مسیر/نام پروژه ارسال نشود.
- قابلیت off کردن دائمی (env + فایل کانفیگ) و سیاست مستند.
- شکست telemetry نباید تجربهٔ CLI را خراب کند.

## Considered Options

1. opt-out (پیش‌فرض روشن، `--no-telemetry` برای خاموش‌کردن).
2. opt-in بدون مستندسازی و بدون sanitize.
3. **opt-in کامل + sanitize سخت‌گیرانه + endpoint فقط از env + سیاست مکتوب**.

## Decision Outcome

گزینهٔ ۳ انتخاب شد (DEC-033). پیش‌فرض همیشه خاموش است. الویت فعال‌سازی:
`ZENITH_TELEMETRY=0` (kill-switch) > فایل `~/.zenith/telemetry.json` (یا
`ZENITH_CONFIG_HOME`) > off. ارسال فقط با `ZENITH_TELEMETRY_ENDPOINT` امن
(`https`) انجام می‌شود؛ payload مینیمال (`TELEMETRY_FIELDS`) است و
`sanitizeTelemetryProps` کلیدهای حساس (path/dir/file/home/name/user/email/
token/secret/key/url/host/repo/project/cwd)، مقادیر مسیر و اشیای تودرتو را حذف
می‌کند. شکست ارسال خاموش است (fire-and-forget با سقف pending). سیاست کامل در
`docs/PRIVACY.md` و دستور `zenith telemetry on|off|status`.

### Consequences

- ✅ هیچ داده‌ای بدون رضایت نمی‌رود؛ حتی با رضایت هم PII نمی‌رود.
- ✅ kill-switch قابل اتکا برای CI/شرکت‌ها.
- ⚠️ آمار مصرف کمتر از opt-out است (هزینهٔ آگاهانه).
- ⚠️ دو `console.error` UX جدید برای دستور telemetry سقف error-hygiene را بالا برد (۲۰۱→۲۰۳؛ DEC-033) و بازگشت آن در #39 پیگیری می‌شود.

## Links

- [docs/PRIVACY.md](../PRIVACY.md)
- [docs/decisions/DEC-033-telemetry-cli-console.md](../decisions/DEC-033-telemetry-cli-console.md)
- [SECURITY.md](../../SECURITY.md)
