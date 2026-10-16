# Zenith Framework — بنچمارک‌ها (#86)

> **یک دستور، همهٔ اعداد:** `npm run bench` — سوئیت را اجرا می‌کند، هر متریک را با همین سند
> مقایسه می‌کند و اگر متریکی از آستانهٔ بازتولیدپذیری خودش بیرون بزند با کد خطای ۱ برمی‌گردد.
>
> - خودِ گیت: `scripts/bench.mjs` — اجرا، مقایسه با baseline، و `exit 1` در صورت انحراف
> - ثبت مجدد baseline: `npm run bench:record` (هر پاس در فرایند جدا؛ کمینه برنده است)
> - گیت drift سند در CI: `npm run check:bench-doc`
> - اعداد DOM در مرورگر واقعی: `npm run bench:browser` (نیازمند `npx playwright install chromium`)

> ⚠️ **این سند تولیدشده است** — [`scripts/generate-benchmarks-doc.mjs`](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/scripts/generate-benchmarks-doc.mjs) از `benchmarks/results/baseline.json` (کامیت `9b6b2698`، تاریخ 2026-10-16).

## محیط ثبت‌شده

| مورد | مقدار |
|---|---|
| کامیت | `9b6b2698772ee983faf5abe8224c70e12a569c2e` |
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
| signal.get() | 161,785,820 ⛔ | 127,302,332 ⛔ | 129,999,081 ⛔ | 136,540,573 ⛔ | ops/sec |
| signal.set() (بدون subscriber) | 4,456,355 | 79,984,402 | 32,121,658 | 44,164,893 | ops/sec |
| الماسِ computed (set + read) | 3,477,959 | 1,479,492 | 4,281,382 | 5,604,150 | ops/sec |
| اجرای effect برای 10,000 نوشتن متوالی | 1 | 9,999 | 9,999 | 9,999 | runs |
سقف اندازه‌گیری این محیط (یک عملیات بی‌هزینه در همان حلقه/closure): **142,662,157 ops/sec** — هر عددی که به آن نزدیک باشد (≥۸۵٪، علامت ⛔) **کفِ واقعی** است، نه نرخ واقعی کتابخانه؛ در آن ناحیه هارنس گلوگاه است نه کتابخانه.

جزئیات و لینک هر عدد:

| متریک | مقدار | نمونه | بازتولید مشاهده‌شده | آستانه | منبع (اسکریپت + کامیت) | بازتولید یک عدد |
|---|---|---|---|---|---|---|
| `reactive.harness.ceiling` | 142,662,157 | — | 14.61% | 15% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only reactive.harness.ceiling` |
| `reactive.zenith.signal-write-batched-effect` | 863,137 | — | 12.61% | 15% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only reactive.zenith.signal-write-batched-effect` |
| `reactive.zenith.signal-read` | 161,785,820 | — | 4.12% | 7% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only reactive.zenith.signal-read` |
| `reactive.solid.signal-read` | 127,302,332 | — | 0.73% | 5% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only reactive.solid.signal-read` |
| `reactive.vue.signal-read` | 129,999,081 | — | 6.55% | 10% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only reactive.vue.signal-read` |
| `reactive.preact.signal-read` | 136,540,573 | — | 8.86% | 14% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only reactive.preact.signal-read` |
| `reactive.zenith.signal-write` | 4,456,355 | — | 19.29% | 15% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only reactive.zenith.signal-write` |
| `reactive.solid.signal-write` | 79,984,402 | — | 14.7% | 15% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only reactive.solid.signal-write` |
| `reactive.vue.signal-write` | 32,121,658 | — | 10.27% | 15% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only reactive.vue.signal-write` |
| `reactive.preact.signal-write` | 44,164,893 | — | 2.39% | 5% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only reactive.preact.signal-write` |
| `reactive.zenith.computed-diamond` | 3,477,959 | — | 2.67% | 5% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only reactive.zenith.computed-diamond` |
| `reactive.solid.computed-diamond` | 1,479,492 | — | 12.19% | 15% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only reactive.solid.computed-diamond` |
| `reactive.vue.computed-diamond` | 4,281,382 | — | 11.55% | 15% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only reactive.vue.computed-diamond` |
| `reactive.preact.computed-diamond` | 5,604,150 | — | 14.47% | 15% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only reactive.preact.computed-diamond` |
| `reactive.zenith.effect-runs-per-10k-writes` | 1 | — | 0% | 5% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only reactive.zenith.effect-runs-per-10k-writes` |
| `reactive.solid.effect-runs-per-10k-writes` | 9,999 | — | 0% | 5% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only reactive.solid.effect-runs-per-10k-writes` |
| `reactive.vue.effect-runs-per-10k-writes` | 9,999 | — | 0% | 5% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only reactive.vue.effect-runs-per-10k-writes` |
| `reactive.preact.effect-runs-per-10k-writes` | 9,999 | — | 0% | 5% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only reactive.preact.effect-runs-per-10k-writes` |

## ۲. عملیات لیست js-framework-benchmark (jsdom)

همان ۹ عملیات استاندارد روی `<table><tbody>` واقعی، ولی موتور DOM این محیط **jsdom** است (مرورگر واقعی → `npm run bench:browser`). عملیات سبک K بار تکرار می‌شوند و عدد گزارش‌شده **زمان هر یک بار** است؛ عدد هر ردیف **کمینهٔ نمونه‌ها** است (نویز فقط زمان اضافه می‌کند).

| متریک | زمان هر بار | نمونه | تکرار/نمونه | بازتولید مشاهده‌شده | آستانه | منبع (اسکریپت + کامیت) | بازتولید یک عدد |
|---|---|---|---|---|---|---|---|
| `dom.append-1k-to-10k` | 115.617 ms | 7 | x1 | 2.12% | 15% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only dom.append-1k-to-10k` |
| `dom.clear-1k` | 0.121 ms | 7 | x128 | 12.4% | 19% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only dom.clear-1k` |
| `dom.create-10k` | 1.40s | 5 | x1 | 9.77% | 15% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only dom.create-10k` |
| `dom.create-1k` | 127.812 ms | 7 | x1 | 15.18% | 23% | ⚠️ اطلاعاتی | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only dom.create-1k` |
| `dom.partial-update-1k` | 8.973 ms | 7 | x10 | 8.57% | 15% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only dom.partial-update-1k` |
| `dom.remove-row-1k` | 0.069 ms | 7 | x500 | 1.45% | 15% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only dom.remove-row-1k` |
| `dom.replace-all-1k` | 130.875 ms | 5 | x2 | 4.13% | 15% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only dom.replace-all-1k` |
| `dom.select-1k` | 0.087 ms | 7 | x500 | 6.9% | 15% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only dom.select-1k` |
| `dom.swap-rows-1k` | 0.421 ms | 7 | x100 | 2.61% | 15% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only dom.swap-rows-1k` |

## ۳. حافظه

delta هیپ جاوااسکریپت به‌ازای هر signal — تقریبی (بدون `--expose-gc`).

| متریک | مقدار | توضیح | بازتولید مشاهده‌شده | آستانه | منبع (اسکریپت + کامیت) | بازتولید یک عدد |
|---|---|---|---|---|---|---|
| `memory.bytes-per-signal` | 527 B | — | 13.28% | 25% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only memory.bytes-per-signal` |

## ۴. SSR (Node)

رندر یک صفحهٔ ۵۰ آیتمی با `renderToString` — میانهٔ ۳ اجرا پس از گرم‌کردن.

| متریک | مقدار | توضیح | بازتولید مشاهده‌شده | آستانه | منبع (اسکریپت + کامیت) | بازتولید یک عدد |
|---|---|---|---|---|---|---|
| `ssr.pages-per-sec` | 170 | — | 5.29% | 8% | ✅ گیت‌شده | [benchmarks/suite.mjs@9b6b2698](https://github.com/legionir/zenith-v1.4.0/blob/9b6b2698772ee983faf5abe8224c70e12a569c2e/benchmarks/suite.mjs) | `npm run bench -- --only ssr.pages-per-sec` |

## بازتولیدپذیری — چه چیزی تضمین می‌شود؟

- هر متریک با **کمینهٔ چند نمونه** (نه میانگین) گزارش می‌شود؛ نویز GC/زمان‌بندی فقط زمان اضافه می‌کند، پس کمترین زمان پایدارترین برآورد است.
- `baseline.json` با `npm run bench:record -- --passes 3` ساخته شده و برای هر متریک **درصد بازتولید مشاهده‌شده** ثبت شده است.
- **27 متریک گیت‌شده** و **2 متریک اطلاعاتی** در این baseline ثبت شده است. از متریک‌های گیت‌شده، **12 عدد با بازتولید ≤۵٪** و بقیه با آستانهٔ خودشان (کفِ گروه: ۵٪ برای `reactive`/`ssr`، ۱۵٪ برای `dom`، ۲۵٪ برای `memory`) بررسی می‌شوند.
- `npm run bench` روی **همان محیط** هر متریک گیت‌شده را با آستانهٔ ثبت‌شده‌اش مقایسه می‌کند و در صورت عبور، exit 1 می‌دهد. متریک‌های اطلاعاتی (⚠️) فقط گزارش می‌شوند — عددشان «بهترین مشاهده» است و ادعای بازتولید برایشان مطرح نیست.
- متریک‌های اطلاعاتی عمدتاً عملیات زیر ~۱۰ns هستند (مثل `signal.get()`): V8 در همین یک اجرا بین ۵ns و ۱۵ns می‌لرزد (پراکندگی ثبت‌شده تا 19.29٪). این عدد در سند می‌ماند چون «کفِ» عملکرد مفید است، ولی برای تصمیم‌گیری به آستانه گره نمی‌خورد.
- روی محیط دیگر، مقایسه غیرفعال می‌شود و فقط اعداد مطلق چاپ می‌شوند — «۵٪» یک ادعای محیط‌وابسته است، نه یک تضمین جهانی.

## محدودیت‌ها (صادقانه)

1. **مرورگر واقعی ثبت نشده است.** گروه DOM روی `jsdom@24.1.3` اجرا شده، چون محیط ثبت (`Linux 6.1.158+`) مرورگر نصب ندارد. برای اعداد مرورگری: `npx playwright install chromium && npm run bench:browser` (نسخهٔ مرورگر در `benchmarks/results/browser.json` ثبت می‌شود).
2. **بدون layout/paint.** هزینهٔ style/layout/composite مرورگر در این اعداد نیست؛ فقط هزینهٔ ساخت و جهش DOM.
3. **حافظه تقریبی است** (`process.memoryUsage().heapUsed` بدون `--expose-gc`) و آستانهٔ ۲۵٪ برای همین است.
4. **تک‌رشته‌ای.** هیچ عددی هم‌زمانی/چند‌هسته‌ای را نمی‌سنجد.
5. اعداد v1.0.0 قبلی (Node 24 + Chrome Headless) بازتولیدپذیر نبودند و حذف شدند؛ در تاریخ گیت (`git log -- docs/BENCHMARKS.md`) باقی‌اند.

---

بازتولید کامل: `npm run bench` · گیت بودجهٔ عملکرد CI: `npm run bench:ci` (`benchmarks/budgets.json`) · سند: `docs/BENCHMARKS.md`
