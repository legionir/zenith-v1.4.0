# DEC-007 — حداقل Node به ≥18.19 افزایش یافت (نه ≥20)

- **تاریخ:** 2026-10-09
- **وضعیت:** پذیرفته‌شده
- **issue:** #14 (AUDIT.md A10، PRODUCTION-READINESS §6)

## زمینه

`process.getBuiltinModule` — تنها راه دسترسی sync به `node:async_hooks` برای
ایزولاسیون per-request روتر در SSR (packages/router/src/router.ts:96) — از
Node 18.19 موجود است. با `engines: ">=18"` روی 18.0–18.18 ایزولاسیون بی‌صدا
(فقط با یک console.warn) غیرفعال می‌شد: دو رندر همزمان SSR روی یک routeSignal
مشترک می‌نوشتند. گزینه‌های issue: `>=18.19` یا `>=20`.

## تصمیم و دلیل

**`>=18.19`.** دلایل:

1. شکاف واقعی همان 18.19 است؛ با کف جدید، fallback بی‌صدا عملاً فقط برای
   مرورگر (که AsyncLocalStorage لازم ندارد) باقی می‌ماند، نه Node نیمه‌کاره.
2. پرش به 20 یک breaking change بزرگ‌تر برای مصرف‌کننده‌های Node 18.19+ است
   بدون اینکه مشکل را فراتر از حل کند؛ #14 ادعای «کف» را درست می‌کند، نه
   استراتژی EOL را. سیاست کلی‌تر upgrade به 20 باید در #71 (release policy)
   تصمیم گرفته شود.
3. Node 18 در GitHub Actions runner به newest 18.x (≥18.20) resolve می‌شود،
   پس ماتریس `['18','22']` همان کف جدید را واقعاً تمرین می‌کند.

## اجرا

- `engines.node = ">=18.19"` در package.json ریشه + هر ۳۵ پکیج
  (vscode-extension که نداشت اضافه شد) + lockfile (با `npm install` sync).
- کامنت ماتریس CI در main.yml به کف جدید اشاره می‌کند.
- سیاست پشتیبانی در README ریشه (#69) و docs/README.md مستند می‌شود.
- قرارداد اجرایی: `scripts/test/engines.test.mjs` (۴ تست: ریشه، همهٔ پکیج‌ها،
  lockfile، ماتریس CI) — red قبل از fix، green بعد از آن.

## پیامد برای مصرف‌کننده

کسانی که روی Node <18.19 قفل هستند با `npm install --engine-strict` رد
می‌شوند (پیش‌تر هم عملاً SSR-isolation نداشتند؛ حالا صریح‌اند). بازمهاجرت:
ارتقای Node به 18.19+ یا حذف وابستگی به isolation.
