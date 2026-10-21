# سیاست پشتیبانی و چرخهٔ عمر نسخه‌های Zenith (`SUPPORT.md` — `#105`)

این سند چرخهٔ عمر پشتیبانی نسخه‌ها (Release Support Lifecycle)، پیش‌نیازهای محیط اجرا و کانال‌های رسمی دریافت پشتیبانی برای فریم‌ورک Zenith را مشخص می‌کند.

---

## ۱. جدول چرخهٔ عمر پشتیبانی نسخه‌ها (Version Support Matrix)

| شاخهٔ نسخه | وضعیت فعلی | نوع پشتیبانی | حداقل نسخهٔ Node.js | پایان پشتیبانی فعال | پایان وصله‌های امنیتی (EOL) |
|-----------|------------|--------------|---------------------|---------------------|------------------------------|
| **v1.4.x / v1.5.x** (Current) | 🟢 Active LTS | ویژگی‌های جدید، رفع باگ، بهینه‌سازی و وصله‌های امنیتی | `>= 18.19.0` (پیشنهادی: Node 20/22 LTS) | ۶ ماه پس از انتشار `v2.0.0` | ۱۲ ماه پس از انتشار `v2.0.0` |
| **v1.3.x** | 🟡 Maintenance | فقط رفع باگ‌های بحرانی (P0) و وصله‌های امنیتی | `>= 18.19.0` |2026-12-31 | 2027-06-30 |
| **v1.0.x – v1.2.x** | 🟠 Security Only | فقط وصله‌های آسیب‌پذیری‌های امنیتی با شدت بالا/بحرانی | `>= 18.0.0` | پایان یافته | 2026-12-31 |
| **v0.x** | 🔴 End-of-Life (EOL) | بدون پشتیبانی — ارتقا به `v1.4.0+` الزامی است | — | پایان یافته | پایان یافته |

---

## ۲. سیاست نسخه‌بندی و سازگاری پیش‌رو

- **Semantic Versioning (SemVer 2.0.0)**: تمامی ۴۳ پکیج `@zenith/*` به‌صورت Lockstep منتشر می‌شوند ([`docs/VERSIONING-STRATEGY.md`](./docs/VERSIONING-STRATEGY.md)).
- **سیاست منسوخ‌سازی (`ZEN-DEPR-*`)**: هر API عمومی پیش از حذف در نسخهٔ Major بعدی، حداقل در یک نسخهٔ Minor با هشدار یک‌بارهٔ `ZEN-DEPR-NNN` و جایگزین مستند حفظ می‌شود ([`docs/DEPRECATION-POLICY.md`](./docs/DEPRECATION-POLICY.md)).
- **ماتریس مرورگرها و محیط‌های اجرا**: جزئیات کامل در [`docs/BROWSER-SUPPORT.md`](./docs/BROWSER-SUPPORT.md) ثبت شده است.

---

## ۳. کانال‌های دریافت راهنمایی و گزارش مشکل

| موضوع | مسیر اقدام |
|-------|------------|
| **شروع سریع و آموزش** | [`docs/GETTING-STARTED.md`](./docs/GETTING-STARTED.md) و [`docs/COOKBOOK.md`](./docs/COOKBOOK.md) |
| **مهاجرت بین نسخه‌ها** | [`docs/migration-guide.md`](./docs/migration-guide.md) |
| **گزارش باگ یا درخواست ویژگی** | ثبت Issue در [GitHub Issues](https://github.com/legionir/zenith-v1.4.0/issues) طبق قالب‌های استاندارد |
| **گزارش آسیب‌پذیری امنیتی (CVE/XSS)** | **هرگز در Issue عمومی ثبت نکنید** — طبق [`SECURITY.md`](./SECURITY.md) و [`docs/security/threat-model.md`](./docs/security/threat-model.md) از طریق Private Vulnerability Reporting اقدام کنید (SLA پاسخ اولیه: ۴۸ ساعت). |
