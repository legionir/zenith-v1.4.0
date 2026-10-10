# DEC-018 — قاعدهٔ singleton peer برای `state`/`scheduler` و بازهٔ caret

- **تاریخ:** 2026-10-10
- **وضعیت:** پذیرفته‌شده
- **مرتبط:** Issue #46، `scripts/peer-rule.mjs`، `scripts/peer-single-instance.mjs`، `standardize-packages.mjs`، DEC-017

## زمینه

`@zenith/state` و `@zenith/scheduler` «نمونهٔ مشترک» دارند: یک signal graph و یک
صف microtask سراسری. اگر دو نسخه از هرکدام در درخت نصب شود، دو گراف مستقل
ساخته می‌شود و reactivity بی‌صدا می‌شکند. پیش‌تر بعضی پکیج‌ها اینها را `dependency`
مستقیم می‌گرفتند و بعضی `peer` — ناسازگاری ARCHITECTURE §۴.۳.

## تصمیم

1. **قاعدهٔ CI (`scripts/peer-rule.mjs`، `npm run peer-rule`، در job `deps`):**
   هر پکیج جز خودِ state/scheduler نباید این دو را در `dependencies` داشته باشد؛
   اگر peer اعلام شده باشند باید بازهٔ **caret هماهنگ با نسخهٔ repo** (`^1.4.0`)
   باشد (نه pin دقیق `1.4.0`، نه `>=`). اگر `src/` پکیجی state/scheduler را import
   کند و هیچ peer/dependency برای آن نداشته باشد، خطا می‌گیرد. بازهٔ caret از
   `collectUsed` مشترک با #45 استفاده می‌کند (import واقعی، بدون شمارش کامنت).

2. **استثنای `state → scheduler`:** state همچنان scheduler را dependency مستقیم
   می‌گیرد (هستهٔ پایین‌تر؛ اگر peer می‌شد، مصرف‌کنندهٔ state مجبور به نصب
   دستی scheduler می‌شد که تجربهٔ install را می‌شکست). این لبه در اسکریپت
   صراحتاً allow-list است.

3. **بازهٔ caret به‌جای pin دقیق:** issue §«تنظیم بازهٔ peer (`^1.x`)» خواست caret.
   Pin `1.4.0` باعث می‌شد در monorepo با نسخه‌های هم‌زمان، npm نسخهٔ دوم تودرتو
   بکند. `^1.4.0` اجازهٔ hoist یک نمونه را می‌دهد. `standardize-packages.mjs`
   طوری اصلاح شد که peerها را به `^1.4.0` نرمال کند نه `1.4.0` (وگرنه قاعده را
   خودِ اسکریپت استانداردساز خراب می‌کرد).

4. **اثبات «یک نمونه» (`scripts/peer-single-instance.mjs`، job مستقل
   `peer-single-instance`، needs build):** با `npm pack` روی state/scheduler +
   store + form و نصب همه در یک پروژهٔ موقت، شمارش می‌کند که دقیقاً یک کپی از
   هر singleton در کل درخت node_modules هست، سپس با یک getter که به signal
   بیرونی (از همان نمونهٔ state) وابسته است، واکنش‌مندی بین‌پکیجی را چک می‌کند
   (flushSync پس از set). این job عمداً جدا از unit است چون npm install واقعی
   و network دارد و نباید merge را کند/شکننده کند؛ در CI موازی اجرا می‌شود.

## پیامدها

- ۲۲ مصرف‌کننده به peer تبدیل شدند؛ lockfile بازتولید شد. testها چون در
  ورک‌اسپیس با alias vitest اجرا می‌شوند، از حذف dependency اثری ندیدند.
- «import در test» peer لازم ندارد (در ورک‌اسپیس اجرا می‌شود) — صراحتاً
  فقط `src` شمرده می‌شود.
- اگر نسخهٔ repo بالا برود، caret و `standardize-packages` هماهنگ‌اند؛ peer-rule
  بازهٔ هدف را از `version` ریشه می‌خواند، نه hard-code.
