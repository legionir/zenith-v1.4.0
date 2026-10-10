# DEC-014: secureId در @zenith/security و ممنوعیت Math.random در سورس پکیج‌ها

- وضعیت: پذیرفته‌شده • ۲۰۲۶-10-10 • issueهای مرتبط: #64

## زمینه

`Math.random` در چند سورس وجود داشت (suspense innerId، service-worker jitter).
auth پس از SEC-A13 دیگر Math.random ندارد (بررسی شد). PRNG غیرکریپتو برای
شناسه/توکن/nonce قابل‌حدس‌زدن است (OWASP Predictable Value Range).

## گزینه‌ها

1. تابع `secureId(bytes)` در `@zenith/security` با `crypto.getRandomValues` و خطای صریح در نبود crypto.
2. `crypto.randomUUID()` — فقط مرورگر secure-context/Node 19+؛ بدون کنترل طول و بدون پیام راهنما.
3. fallback به Math.random در محیط‌های قدیمی — خلاف اصل «بدون fallback غیرامن».

## تصمیم و دلیل

گزینهٔ ۱ با کد خطای جدید ZEN-403 (`SECURITY_RANDOM_SOURCE_UNAVAILABLE`).
لایه: security L0 است و فقط به errors (L0) وابسته شد — جهت وابستگی حفظ می‌شود
(تأیید dependency-cruiser). اجبار: قانون ESLint `no-restricted-syntax` روی
`Math.random` در `packages/**/src`؛ استفاده‌های غیرامنیتی باید با
`eslint-disable-next-line` + کامنت دلیل (NON-SECURITY) باشند — backoff jitter
در service-worker تنها استثی مستند است.

## پیامدها

- suspense به security وابسته شد (runtime edge جدید، بدون چرخه).
- شناسه‌ها hex با آنتروپی قابل‌تنظیم؛ پیش‌فرض ۱۶ بایت.
- هر Math.random تازه در سورس، lint را می‌شکند (قانون اجباری در CI).
