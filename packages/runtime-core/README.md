# @zenith/runtime-core

هستهٔ کوچک L3 زمان اجرای DOM فریم‌ورک Zenith (SPEC §۲.۸ / `#148`).

- مدل نمونهٔ مستقل `createApp(options)` (بدون حالت سراسری؛ چند نمونهٔ هم‌زمان روی یک صفحه و در SSR).
- اولویت اجرای قطعی دایرکتیوها (`zen-for` 1000 → `zen-if` 900 → `zen-memo` 800 → `zen-ref` 700 → دایرکتیوهای عادی 500 → `zen-action` 100) و تشخیص تداخل ساختاری (`ZEN-2302`) و الزام `zen-key` (`ZEN-2303`).
- قلاب‌های چرخهٔ عمر (`onMount`, `onUnmount`, `onUpdate` — خارج از محدوده `ZEN-2301`) و تزریق وابستگی درختی (`provide` / `inject`).
- Hydration سمت کلاینت (`hydrate` / `startFromSSR` با نشانگر `data-zen-h` و کد `ZEN-2310`).
