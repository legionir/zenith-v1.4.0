# DEC-022: `adapter-edge` به تعویق موکول شد — تا تحقق انتزاع DOM-implementation در `ssr`

- وضعیت: پذیرفته‌شده • ۲۰۲۶-۱۰-۱۰ • issueهای مرتبط: #175 (main)، #92 (SSR هم‌زمان/بدون jsdom)، #153+ (پکیج‌های P1 طبق SPEC)

## زمینه

`NEW-PACKAGES-SPEC.md` ریسک ۳: `adapter-edge` رندر بدون `jsdom` (با `linkedom`/`happy-dom` به‌عنوان peer) و بدون `AsyncLocalStorage` می‌خواهد، چون در Cloudflare Workers/Deno Deploy در دسترس نیستند. خود SPEC شرط گذاشته: «اگر `ssr` با `linkedom` سازگار نشود، پکیج به تعویق می‌افتد». بررسی کد `ssr`:
- `render.ts` مستقیماً `await import('jsdom')` و `new JSDOM` می‌کند (ZEN-301) — هیچ نقطهٔ تزریق DOM وجود ندارد.
- `dom-context.ts` در سطح ماژول `AsyncLocalStorage` را از `node:async_hooks` import می‌کند؛ در محیط edge این import در top-level شکست می‌دهد.
نتیجه: امروز «سازگاری با linkedom» نه تست شده نه امکان‌پذیر است — شرط SPEC فعال می‌شود.

## گزینه‌ها

- **الف) ساخت adapter-edge حالا با fork کردن مسیر رندر** — دومین پیاده‌سازی SSR؛ خلاف #47 (تک‌مسیر). ❌
- **ب) تعویق تا #92: همان جا DOM implementation انتزاع می‌شود (`domImpl` injector با پیش‌فرض jsdom) و ALS با fallback به context صریح؛ adapter-edge پس از سبز شدن تست رندر روی linkedom در CI آزاد می‌شود.** ✅
- **ج) حذف همیشگی adapter-edge** — هدف معماری SPEC (edge deploy) را می‌کشد؛ فقط تعویق لازم است، نه حذف. ❌

## تصمیم و دلیل

گزینهٔ ب. طبق بند «اگر سازگار نشود → به تعویق» SPEC و §4.3 دستورالعمل (پذیرش پیش‌فرض SPEC مگر قید فنی خلاف نشان دهد — اینجا قید فنی اثبات‌شده: وابستگی hard به jsdom + async_hooks). #92 دقیقاً همان workload را دارد (SSR هم‌زمان/چند‌محیطی) و انتزاع DOM محل درست آن است.

## پیامدها

- ردیف `adapter-edge` در SPEC/نقشهٔ راه علامت «deferred — blocked by #92 (DEC-022)» می‌گیرد؛ #153–#160 (موج ۴) آن را به‌جای «ساخت»، «ارزیابی پس از #92» می‌خوانند.
- #92 دو DoD اضافه می‌گیرد: (۱) `renderToString(html, { domImpl })` با تست سبز روی linkedom، (۲) مسیر ALS-free با context صریح (تست بدون `node:async_hooks`).
- هیچ کدی امروز تغییر نمی‌کند؛ این ADR فقط ترتیب و گره‌بندی وابستگی را ثبت می‌کند.
- ریسک حجم (`≤ 6 KB`) و تست Miniflare/Deno به زمان آزادسازی منتقل می‌شود.
