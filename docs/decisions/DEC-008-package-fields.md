# DEC-008 — فیلدهای package.json: sideEffects صریح برای router/cli، بقیه false

- **تاریخ:** 2026-10-09
- **وضعیت:** پذیرفته‌شده
- **issue:** #70 (PRODUCTION-READINESS §6/§8)

## تصمیم

- `repository {type,url,directory: packages/<dir>}`، `homepage`، `bugs.url`،
  `publishConfig {access:'public', provenance:true}` در هر ۳۵ پکیج.
  - استثنا: `zenith-vscode` بدون `provenance` (artifact بازار است، npm publish
    با provenance نیست) — access/public همچنان ثبت می‌شود تا یکدستی حفظ شود.
- `sideEffects`:
  - `false` در ۳۳ پکیج — با **اسکن ایستا** اثبات شد: هیچ statement در سطح
    ماژول (call در ستون ۰، انتساب به globalThis/window/self) ندارند
    (اسکنر template literalها را حذف می‌کند تا رشته‌قالب‌های cli اشتباه
    نزند).
  - glob صریح `[./dist/index.js]` در `router` (فراخوانی top-level
    `installPopstateListener()` هنگام import) و `cli` (top-level
    `program.parse(process.argv)` در entry باندل‌شده). در این دو، `false`
    دروغین کدِ لازم را در bundler حذف و اپ را بی‌صدا می‌شکست.

## گیت‌ها

- `scripts/validate-package-fields.mjs` در CI (job Package-lint) یکسانی را
  چک می‌کند؛ تست‌های معادل در `scripts/test/package-fields.test.mjs`
  (۱۴۲ تست پارامتریک) و `side-effects.test.mjs` (راست‌گویی flag + اثبات
  tree-shaking با esbuild روی scheduler dist: import تکیِ `Priority` بدون
  flushSync/runnerهای داخلی باندل می‌شود).

## چرا ابزار standardize-packages.mjs استفاده نشد

اسکریپت یک‌بارمصرف قدیمی است (fuzz روی exports/scripts) و قابل تست نیست؛
اعمال با اسکریپت throwaway + گیت ماندگار جای آن بهتر است (#71/#74 همان‌ها را
می‌گیرند).
