# DEC-006 — typecheck-all: noEmit + paths به src؛ نوشتن دیست از دستور بررسی حذف شد

- **تاریخ:** 2026-10-09
- **وضعیت:** پذیرفته‌شده
- **issue:** #26 (AUDIT.md §3.10)

## زمینه

`scripts/typecheck-all.mjs` عملاً `tsc --declaration --emitDeclarationOnly`
اجرا می‌کرد تا پکیج‌های پایین‌دست declarationهای بالادست را در `dist/`
پیدا کنند. عوارض: `npm run typecheck` درخت را کثیف می‌کرد (write در dist)، و
declaration **کهنه** می‌توانست خطای تایپ پایین‌دست را بپوشاند (بررسی با src
به‌روز انجام می‌شد ولی import با .d.ts قدیمی resolve می‌شد).

## تصمیم

- برای هر پکیج یک tsconfig موقت در `.tsbuild/` تولید می‌شود که:
  - `extends` کانفیگ خود پکیج (تمام strict flagها همانجا می‌مانند)،
  - `noEmit: true` و `declaration/declarationMap/sourceMap: false`،
  - `paths` نگاشت `@zenith/*` → `../packages/*/src` (و ساب‌پت
    `@zenith/service-worker/sw`) — یعنی typecheck همیشه **src جاری**
    هم‌پکیج‌ها را می‌بیند، نه dist.
  - `rootDir: '..'` چون فایل‌های src چند پکیج در یک program هستند (بدون آن
    TS6059 می‌دهد). مسیرهای `paths` نِسبی‌اند و `baseUrl` حذف شده (TS6
    forward-compat).
- `.tsbuild/` ابتدای هر اجرا wipe می‌شود؛ بعد از اجرا برای دیباگ می‌ماند و در
  `.gitignore` ثبت شد. کامپایلر از `typescript/bin/tsc` ورک‌اسپیس spawn می‌شود
  (createRequire) تا `npx` با cwd متفاوت نسخهٔ دیگری را انتخاب نکند.
- ترتیب پکیج‌ها دیگر مهم نیست (src-resolved) ولی برای لاگ مرتب پیمایش می‌شود؛
  گراف #25 همچنان برای `build` (که emit می‌کند) حیاتی است.

## شاهد (acceptance)

1. `npm run typecheck` هیچ فایلی در dist تغییر نمی‌دهد (mtime ثابت قبل/بعد؛
   روی درخت با dist خالی هم dist ایجاد نمی‌کند).
2. با `rm -rf packages/*/dist` کل ۳۵ پکیج typecheck سبز ⇒ وابستگی بین‌پکیجی
   از مسیر src حل می‌شود.
3. تست `scripts/test/typecheck-all.test.mjs`: declaration کهنهٔ `a/dist` با
   `x: string` در برابر `a/src` با `x = 1` ⇒ پکیج b **شکست می‌خورد** (TS2322)؛
   یعنی کهنه دیگر نمی‌تواند خطا را پنهان کند. (۴ تست، جزئی `npm test`.)

## چرا `tsc -b` با project references نشد

کانفیگ‌های پکیج `composite` ندارند و افزودنش به ۳۵ پکیج، build esbuild فعلی
را با اجبار declaration-outDir درگیر می‌کرد؛ `paths→src` کوچک‌ترین تغییر
با همان نتیجه است (گزینهٔ «یا» در خود issue).
