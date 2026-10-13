# راهنمای مشارکت در Zenith (`CONTRIBUTING.md` — `#80`, `#107`)

از مشارکت شما در توسعهٔ فریم‌ورک **Zenith** سپاسگزاریم! این سند پیش‌نیازها، قراردادهای کدنویسی، گیت‌های کیفیت و فرایند ارسال Pull Request را شرح می‌دهد.

---

## ۱. پیش‌نیازها و راه‌اندازی محیط توسعه

- **Node.js**: نسخهٔ `>= 18.19` (پیشنهادی: `Node 22 LTS`)
- **npm**: نسخهٔ ۱۰ یا بالاتر (پکیج‌ها در قالب npm workspaces مدیریت می‌شوند)

```bash
git clone https://github.com/legionir/zenith-v1.4.0.git
cd zenith-v1.4.0
npm ci
```

### دستورهای کلیدی توسعه و بررسی کیفیت

```bash
npm test                 # اجرای تمام تست‌های واحد و اسکریپت‌های گیت با Vitest
npm run typecheck        # بررسی تایپ تمام ۴۴ پکیج بدون تولید فایل اضافی
npm run lint             # اجرای ESLint 9
npm run format:check     # بررسی فرمت کد با Prettier
npm run deps             # بررسی قوانین لایه‌بندی L0–L5 با dependency-cruiser
npm run error-hygiene    # بررسی مدل واحد ZenithError و سقف console.*
npm run cleanup-hygiene  # بررسی قرارداد Disposable و Cleanup
npm run traceability     # بررسی نگاشت شناسه‌های BUG-*/IMP-*/SEC-* به تست‌ها
npm run build            # بیلد کامل تمام پکیج‌ها به ترتیب توپولوژیک
```

---

## ۲. قراردادهای معماری و کدنویسی

پیش از نوشتن کد، لطفاً اسناد زیر را مطالعه کنید:

1. **قراردادهای API ([`docs/API-CONVENTIONS.md`](docs/API-CONVENTIONS.md))**:
   - تمام خطاها باید نمونهٔ `ZenithError` از `@zenith/errors` با کد چهاررقمی (`ZEN-xxxx`) باشند.
   - تمام کنترلرها و کلاس‌های دارای چرخهٔ عمر باید اینترفیس `Disposable` (`dispose(): void` ایدمپوتنت) را پیاده‌سازی کنند و توابع ثبت شنونده/دایرکتیو باید `Cleanup` (`() => void`) برگردانند.
   - توابع عمومی حداکثر ۲ آرگومان موقعیتی می‌پذیرند؛ تنظیمات بیشتر باید در قالب شیء `options` همراه با `export const DEFAULTS = Object.freeze({...})` ارائه شوند.
   - استفاده از `any` در امضای عمومی و فراخوانی مستقیم `console.*` در کد منبع پکیج‌ها ممنوع است.
2. **لایه‌بندی معماری ([`docs/ARCHITECTURE-LAYERS.md`](docs/ARCHITECTURE-LAYERS.md))**:
   - وابستگی‌ها صرفاً رو به پایین (`L5 → L4 → L3 → L2 → L1 → L0`) مجاز هستند و چرخهٔ وابستگی در CI مسدود می‌شود.

---

## ۳. فرایند ارسال Pull Request، Changesets و Merge (`#80`)

1. **ثبت تست برای هر تغییر رفتاری**: هر رفع باگ یا ویژگی جدید باید همراه با تست واحد یا E2E باشد. کاهش آستانه‌های پوشش تست یا غیرفعال کردن تست‌ها (`it.skip`) مجاز نیست.
2. **ثبت Changeset**: برای هر تغییر مؤثر بر پکیج‌ها، یک فایل در پوشهٔ [`.changeset/`](.changeset/README.md) اضافه کنید.
3. **قوانین حفاظت شاخه و Merge (`Branch Protection`)**:
   - ادغام (Merge) در شاخهٔ اصلی صرفاً زمانی مجاز است که **تمام چک‌های CI** (`lint`, `format`, `typecheck`, `unit`, `audit`, `secret-scan`, `deps`, `build`, `package-lint`, `peer-single-instance`, `size`, `e2e`) سبز باشند.
   - حداقل یک تأییدیه از مالکین کد ([`.github/CODEOWNERS`](.github/CODEOWNERS)) الزامی است و تغییرات در پکیج‌های امنیتی (`security`, `auth`, `permission`, `expressions`, `ssr`) نیازمند تأیید تیم امنیت است.
   - Force-push روی شاخهٔ اصلی مسدود است.
