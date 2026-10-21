# DEC-005 — package-order: لبه‌های dev وارد گراف، چرخهٔ فقط-dev با هشدار شکسته می‌شود

- **تاریخ:** 2026-10-09
- **وضعیت:** پذیرفته‌شده
- **issue:** #25 (AUDIT.md §3.9)

## زمینه

`scripts/package-order.mjs` ترتیب build/typecheck را فقط از `dependencies` +
`peerDependencies` می‌ساخت، درحالی‌که ۵ پکیج به‌صورت واقعی به `.d.ts` هم‌پکیج‌ها
در زمان type-check نیاز دارند و این را در `devDependencies` ورک‌اسپیس اعلام
کرده‌اند (expressions→state، form/permission/store→scheduler،
runtime→permission/store/form). در checkout تمیز این یعنی احتمال ساختن
پکیج پایین‌دست قبل از declarationهای بالادست. از طرف دیگر هر چرخه (حتی
چرخهٔ فقط-dev که عملاً بی‌ضرر است) exception می‌داد و کل build را می‌خواباند.

## تصمیم

1. گراف ورودی = `dependencies` + `peerDependencies` (لبهٔ runtime) +
   `devDependencies` ورک‌اسپیس (لبهٔ dev). هر لبه kind دارد.
2. چرخهٔ **فقط-dev**: هشدار با نام پکیج‌های چرخه، لبه حذف و گراف پیمایش
   می‌شود — ترتیب بین لبه‌های dev چرخه‌ای ذاتاً قابل ارضاست (هیچ‌کدام
   declaration یکدیگر را در runtime لازم ندارند) و نباید build را بخواباند.
3. چرخه‌ای که حداقل یک لبهٔ runtime/peer دارد: همچنان **throw** با پیام روشن
   شامل هر نام پکیج چرخه (خطر واقعی؛ dependency-cruiser هم همین را در CI
   #79 نگهبانی می‌کند).
4. تابع injectable شد (`packagesDir`, `logger`) تا با fixture موقت در vitest
   قابل تست باشد؛ تست‌ها در `scripts/test/package-order.test.mjs` (۶ سناریو:
   بدون چرخه، چرخهٔ runtime throw، devDep به‌عنوان لبهٔ ترتیب، چرخهٔ فقط-dev
   هشدار+ادامه، چرخهٔ mixed throw، گراف واقعی ۳۵ پکیج).

## بررسی واقعی

در مخزن فعلی چرخهٔ فقط-dev وجود ندارد (هشدارها صفر) و ترتیب جدید، build و
typecheck را روی درخت تمیز سبز نگه می‌دارد؛ تصمیم فقط از خواباندن کل pipeline
به‌خاطر چرخه‌های declaration-محور آینده جلوگیری می‌کند.
