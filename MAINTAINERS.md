# نگه‌دارندگان پروژهٔ Zenith (`MAINTAINERS.md` — `#80`, `#107`)

برای کاهش Bus Factor و تضمین تداوم انتشار و پاسخ‌گویی امنیتی، حداقل دو نگه‌دارنده با دسترسی کامل به مخزن گیت‌هاب و سازمان `@zenith` در npm تعریف شده‌اند.

---

## نگه‌دارندگان فعال (Active Maintainers with Release Access)

| نام / شناسهٔ گیت‌هاب | نقش | حوزه‌های مالکیت | دسترسی انتشار (npm / GitHub Release) |
|---|---|---|---|
| **@legionir** (Lead Maintainer) | معمار اصلی و مسئول انتشار | هستهٔ Reactive (`state`, `scheduler`, `runtime-core`), معماری `L0–L5`, زیرساخت انتشار | بله (با 2FA اجباری + OIDC) |
| **@zenith-framework/core-maintainers** (Co-Maintainer) | نگه‌دارندهٔ ارشد و ممیز کد | روتر، SSR، لایهٔ داده (`http`, `resource`, `data`, `cache`)، کامپایلر و ابزارهای CLI | بله (با 2FA اجباری + OIDC) |
| **@zenith-framework/security-reviewers** (Security Lead) | تیم امنیت و پاسخ‌گویی به آسیب‌پذیری | `security`, `auth`, `permission`, `expressions`, `.github/workflows` | بازبین اجباری مسیرهای امنیتی |

---

## سیاست دسترسی و جانشینی (Bus Factor & Continuity)

1. **حداقل دو مالک فعال**: سازمان npm و مخزن گیت‌هاب همواره حداقل دو ادمین فعال با احراز هویت دومرحله‌ای سخت‌افزاری (WebAuthn/TOTP) دارند.
2. **انتشار فقط از طریق OIDC در CI**: هیچ نگه‌دارنده‌ای از توکن شخصی بلندمدت برای انتشار استفاده نمی‌کند؛ انتشار از طریق `.github/workflows/release.yml` و محیط محافظت‌شدهٔ `release` انجام می‌شود.
3. **جانشینی در صورت عدم فعالیت**: مطابق [`GOVERNANCE.md`](GOVERNANCE.md)، در صورت عدم فعالیت یک نگه‌دارنده بیش از ۹۰ روز، دسترسی انتشار به نگه‌دارندهٔ جایگزین منتقل می‌شود.
