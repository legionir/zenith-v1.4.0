# Zenith Framework — بنچمارک‌ها (#86)

> **یک دستور، همهٔ اعداد:** `npm run bench` — سوئیت را اجرا می‌کند، هر متریک را با همین سند
> مقایسه می‌کند و هر انحراف را گزارش می‌دهد (حالت مشورتی؛ با `--strict` کد خروج ۱ می‌شود).
>
> - خودِ گیت: `scripts/bench.mjs` — اجرا، مقایسه با baseline، و گزارش هر انحراف (`--strict` = کد خروج ۱)
> - ثبت مجدد baseline: `npm run bench:record` (هر پاس در فرایند جدا؛ کمینه برنده است)
> - گیت drift سند در CI: `npm run check:bench-doc`
> - اعداد DOM در مرورگر واقعی: `npm run bench:browser` (نیازمند `npx playwright install chromium`)

> ⚠️ **این سند تولیدشده است** — [`scripts/generate-benchmarks-doc.mjs`](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/scripts/generate-benchmarks-doc.mjs) از `benchmarks/results/baseline.json` (کامیت `c3b7241a`، تاریخ 2026-10-16).

## محیط ثبت‌شده

| مورد | مقدار |
|---|---|
| کامیت | `c3b7241a034607299d0864329a5e0c793c17f615` |
| CPU | Intel(R) Xeon(R) Processor @ 2.60GHz (2 هسته) |
| حافظه | 3.8 GB |
| سیستم | Linux 6.1.158+ / linux x64 |
| Node | v22.22.3 (V8 12.4.254.21-node.56) |
| موتور DOM (گروه DOM/SSR) | jsdom@24.1.3 — **مرورگر واقعی نیست**؛ ببینید «محدودیت‌ها» |
| کتابخانه‌های مقایسه | zenith@1.4.0 · solid@1.9.17 · vue@3.5.44 · preact@1.14.4 |
| بیلد solid | `solid-js/dist/solid.js (client build)` |
| بیلد vue | `@vue/reactivity (environment-agnostic)` |
| بیلد preact | `@preact/signals-core (environment-agnostic)` |

**امضای محیط (مبنای مقایسهٔ baseline):** `v22.22.3 | linux x64 | Intel(R) Xeon(R) Processor @ 2.60GHz | 2c | jsdom@24.1.3`
اگر سخت‌افزار/نسخهٔ Node/jsdom تغییر کند، `npm run bench` فقط هشدار می‌دهد و گیت را غیرفعال می‌کند (اعداد مطلق چاپ می‌شوند).

## ۱. میکرو reactive — Zenith در برابر Solid/Vue/Preact (کتابخانه‌های واقعی)

همه در یک V8 واحد و با همان حلقهٔ اندازه‌گیری (`benchmarks/suite.mjs#runReactiveSuite`): هر batch تا ۲۰ms اجرا می‌شود (اندازه‌گیری **زمان‌محور**، نه تعداد ثابت — یک batch ثابتِ ۱۰۰k برای عملیات ۲۰۰M ops/sec فقط ۰٫۴ms است و ساعت/JIT نتیجه را تا ۵ برابر جابه‌جا می‌کند). عدد هر ردیف **میانهٔ ۵ batch** است و نتیجهٔ هر فراخوانی مصرف می‌شود تا V8 حلقه را حذف نکند (DCE).

| سنجه | zenith | solid | vue | preact | واحد |
|---|---|---|---|---|---|
| signal.get() | 155,163,883 ⛔ | 125,220,450 | 112,421,648 | 140,654,250 | ops/sec |
| signal.set() (بدون subscriber) | 4,601,598 | 91,435,480 | 34,071,391 | 37,477,167 | ops/sec |
| الماسِ computed (set + read) | 3,653,335 | 1,534,357 | 4,069,301 | 5,220,116 | ops/sec |
| اجرای effect برای 10,000 نوشتن متوالی | 1 | 9,999 | 9,999 | 9,999 | runs |
سقف اندازه‌گیری این محیط (یک عملیات بی‌هزینه در همان حلقه/closure): **165,899,386 ops/sec** — هر عددی که به آن نزدیک باشد (≥۸۵٪، علامت ⛔) **کفِ واقعی** است، نه نرخ واقعی کتابخانه؛ در آن ناحیه هارنس گلوگاه است نه کتابخانه.

جزئیات و لینک هر عدد:

| متریک | مقدار | نمونه | بازتولید مشاهده‌شده | آستانه | وضعیت | منبع (اسکریپت + کامیت) | بازتولید یک عدد |
|---|---|---|---|---|---|---|---|
| `reactive.harness.ceiling` | 165,899,386 | — | 96.51% | 15% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only reactive.harness.ceiling` |
| `reactive.zenith.signal-write-batched-effect` | 760,991 | — | 90.02% | 15% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only reactive.zenith.signal-write-batched-effect` |
| `reactive.zenith.signal-read` | 155,163,883 | — | 18.63% | 15% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only reactive.zenith.signal-read` |
| `reactive.solid.signal-read` | 125,220,450 | — | 91.77% | 15% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only reactive.solid.signal-read` |
| `reactive.vue.signal-read` | 112,421,648 | — | 59.62% | 15% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only reactive.vue.signal-read` |
| `reactive.preact.signal-read` | 140,654,250 | — | 91.91% | 15% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only reactive.preact.signal-read` |
| `reactive.zenith.signal-write` | 4,601,598 | — | 99.15% | 15% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only reactive.zenith.signal-write` |
| `reactive.solid.signal-write` | 91,435,480 | — | 97.3% | 15% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only reactive.solid.signal-write` |
| `reactive.vue.signal-write` | 34,071,391 | — | 18.1% | 15% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only reactive.vue.signal-write` |
| `reactive.preact.signal-write` | 37,477,167 | — | 60.78% | 15% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only reactive.preact.signal-write` |
| `reactive.zenith.computed-diamond` | 3,653,335 | — | 117.2% | 15% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only reactive.zenith.computed-diamond` |
| `reactive.solid.computed-diamond` | 1,534,357 | — | 14.26% | 15% | ✅ گیت‌شده | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only reactive.solid.computed-diamond` |
| `reactive.vue.computed-diamond` | 4,069,301 | — | 15.76% | 15% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only reactive.vue.computed-diamond` |
| `reactive.preact.computed-diamond` | 5,220,116 | — | 68.94% | 15% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only reactive.preact.computed-diamond` |
| `reactive.zenith.effect-runs-per-10k-writes` | 1 | — | 0% | 5% | ✅ گیت‌شده | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only reactive.zenith.effect-runs-per-10k-writes` |
| `reactive.solid.effect-runs-per-10k-writes` | 9,999 | — | 0% | 5% | ✅ گیت‌شده | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only reactive.solid.effect-runs-per-10k-writes` |
| `reactive.vue.effect-runs-per-10k-writes` | 9,999 | — | 0% | 5% | ✅ گیت‌شده | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only reactive.vue.effect-runs-per-10k-writes` |
| `reactive.preact.effect-runs-per-10k-writes` | 9,999 | — | 0% | 5% | ✅ گیت‌شده | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only reactive.preact.effect-runs-per-10k-writes` |

## ۲. عملیات لیست js-framework-benchmark (jsdom)

همان ۹ عملیات استاندارد روی `<table><tbody>` واقعی، ولی موتور DOM این محیط **jsdom** است (مرورگر واقعی → `npm run bench:browser`). عملیات سبک K بار تکرار می‌شوند و عدد گزارش‌شده **زمان هر یک بار** است؛ عدد هر ردیف **کمینهٔ نمونه‌ها** است (نویز فقط زمان اضافه می‌کند).

| متریک | زمان هر بار | نمونه | تکرار/نمونه | بازتولید مشاهده‌شده | آستانه | وضعیت | منبع (اسکریپت + کامیت) | بازتولید یک عدد |
|---|---|---|---|---|---|---|---|---|
| `dom.append-1k-to-10k` | 126.14 ms | 7 | x1 | 10.03% | 16% | ✅ گیت‌شده | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only dom.append-1k-to-10k` |
| `dom.clear-1k` | 0.129 ms | 7 | x128 | 18.6% | 28% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only dom.clear-1k` |
| `dom.create-10k` | 1.92s | 5 | x1 | 15.16% | 23% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only dom.create-10k` |
| `dom.create-1k` | 143.895 ms | 7 | x1 | 45.17% | 45% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only dom.create-1k` |
| `dom.partial-update-1k` | 9.559 ms | 7 | x10 | 29.62% | 45% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only dom.partial-update-1k` |
| `dom.remove-row-1k` | 0.078 ms | 7 | x500 | 6.41% | 15% | ✅ گیت‌شده | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only dom.remove-row-1k` |
| `dom.replace-all-1k` | 138.319 ms | 5 | x2 | 40.34% | 45% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only dom.replace-all-1k` |
| `dom.select-1k` | 0.093 ms | 7 | x500 | 12.9% | 20% | ✅ گیت‌شده | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only dom.select-1k` |
| `dom.swap-rows-1k` | 0.419 ms | 7 | x100 | 18.14% | 28% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only dom.swap-rows-1k` |

## ۳. حافظه

delta هیپ جاوااسکریپت به‌ازای هر signal — تخمین از پروب فرزند با `--expose-gc` (نه اندازهٔ دقیق).

| متریک | مقدار | توضیح | بازتولید مشاهده‌شده | آستانه | وضعیت | منبع (اسکریپت + کامیت) | بازتولید یک عدد |
|---|---|---|---|---|---|---|---|
| `memory.bytes-per-signal` | 506 B | — | 17.98% | 27% | ✅ گیت‌شده | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only memory.bytes-per-signal` |

## ۴. SSR (Node)

رندر یک صفحهٔ ۵۰ آیتمی با `renderToString` — میانهٔ ۳ اجرا پس از گرم‌کردن.

| متریک | مقدار | توضیح | بازتولید مشاهده‌شده | آستانه | وضعیت | منبع (اسکریپت + کامیت) | بازتولید یک عدد |
|---|---|---|---|---|---|---|---|
| `ssr.pages-per-sec` | 165 | — | 13.79% | 15% | ✅ گیت‌شده | [benchmarks/suite.mjs@c3b7241a](https://github.com/legionir/zenith-v1.4.0/blob/c3b7241a034607299d0864329a5e0c793c17f615/benchmarks/suite.mjs) | `npm run bench -- --only ssr.pages-per-sec` |

## بازتولیدپذیری — چه چیزی تضمین می‌شود؟

- هر متریک با **کمینهٔ چند نمونه** (نه میانگین) گزارش می‌شود؛ نویز GC/زمان‌بندی فقط زمان اضافه می‌کند، پس کمترین زمان پایدارترین برآورد است.
- `baseline.json` با `npm run bench:record -- --passes 3` ساخته شده و برای هر متریک **درصد بازتولید مشاهده‌شده** ثبت شده است.
- **10 متریک گیت‌شده** و **19 متریک اطلاعاتی** در این baseline ثبت شده است. از متریک‌های گیت‌شده، **4 عدد با بازتولید ≤۵٪** و بقیه با آستانهٔ خودشان (کفِ گروه: ۵٪ برای `reactive`/`ssr`، ۱۵٪ برای `dom`، ۲۵٪ برای `memory`) بررسی می‌شوند.
- `npm run bench` روی **همان محیط** هر متریک گیت‌شده را با آستانهٔ ثبت‌شده‌اش مقایسه می‌کند. متریک‌های اطلاعاتی (⚠️) فقط گزارش می‌شوند — عددشان «بهترین مشاهده» است و ادعای بازتولید برایشان مطرح نیست.
- **حالت مشورتی پیش‌فرض است** (`npm run bench` با کد ۰ برمی‌گردد و انحراف‌ها را ❌ چاپ می‌کند)؛ برای گیت سخت روی ماشین کنترل‌شده: `npm run bench -- --strict`. چرا؟ روی یک ماشین مشترک، افت سرعتِ خود محیط هم همین علامت را می‌دهد: در همین ثبت، `ssr.pages-per-sec` در یک ساعت از ۱۷۰ به ۱۰۱ افت کرد و بعد دوباره ۱۴۳ شد، در حالی که حلقهٔ مرجع CPU ثابت ماند (۱۴۲M↔۱۶۶M). گیتِ سختِ مخزن همان بودجه‌های `bench:ci` (#84) روی رانر CI است.
- ادعای «≤۵٪» فقط با `npm run bench:reference` آزموده می‌شود: برنامهٔ ازپیش‌تعریف‌شدهٔ حداقل ۵ پاس مستقل (هر پاس یک فرایند تازه — انتخاب بهترین ران پس از دیدن نتیجه ممنوع)، انحراف قدرمطلق هر پاس نسبت به baseline برای **همهٔ** متریک‌های گیت‌شده (اطلاعاتی‌ها در رأی شمرده نمی‌شوند)، امتناع fail-closed روی محیط متفاوت (کد خروج ۲، بدون تنزل مشورتی)، شاهد خام هر پاس در `benchmarks/results/reference-*.json` و کنترل منفی `--self-check` (انحراف عمدی ‎+۵۰٪ باید از همان مسیر ارزیابی گیت را قرمز کند).
- متریک‌های اطلاعاتی عمدتاً عملیات زیر ~۱۰ns هستند (مثل `signal.get()`): V8 در همین یک اجرا بین ۵ns و ۱۵ns می‌لرزد (پراکندگی ثبت‌شده تا 117.2٪). این عدد در سند می‌ماند چون «کفِ» عملکرد مفید است، ولی برای تصمیم‌گیری به آستانه گره نمی‌خورد.
- روی محیط دیگر، مقایسه غیرفعال می‌شود و فقط اعداد مطلق چاپ می‌شوند — «۵٪» یک ادعای محیط‌وابسته است، نه یک تضمین جهانی.

## محدودیت‌ها (صادقانه)

1. **مرورگر واقعی ثبت نشده است.** گروه DOM روی `jsdom@24.1.3` اجرا شده، چون محیط ثبت (`Linux 6.1.158+`) مرورگر نصب ندارد. برای اعداد مرورگری: `npx playwright install chromium && npm run bench:browser` (نسخهٔ مرورگر در `benchmarks/results/browser.json` ثبت می‌شود).
2. **بدون layout/paint.** هزینهٔ style/layout/composite مرورگر در این اعداد نیست؛ فقط هزینهٔ ساخت و جهش DOM.
3. **حافظه از یک پروب فرزند می‌آید** (`node --expose-gc` + دو `gc()` صریح + ۱۰۰k سیگنال تا `benchmarks/memory-probe.mjs`) و چون تخمین هیپ است، آستانهٔ گروه ۲۵٪ است.
4. **تک‌رشته‌ای.** هیچ عددی هم‌زمانی/چند‌هسته‌ای را نمی‌سنجد.
5. اعداد v1.0.0 قبلی (Node 24 + Chrome Headless) بازتولیدپذیر نبودند و حذف شدند؛ در تاریخ گیت (`git log -- docs/BENCHMARKS.md`) باقی‌اند.

---

بازتولید کامل: `npm run bench` · گیت مرجع ≤۵٪: `npm run bench:reference` · گیت بودجهٔ عملکرد CI: `npm run bench:ci` (`benchmarks/budgets.json`) · سند: `docs/BENCHMARKS.md`
