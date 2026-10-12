# DEC-001: پاک‌سازی listenerها در global scope سرویس‌ورکر

- وضعیت: پذیرفته‌شده • 2026-10-09 • issueهای مرتبط (#6)

## زمینه
`packages/service-worker/src/sw.ts` پنج listener رویداد (install/activate/fetch/sync/message) را با `swSelf.addEventListener` مستقیم ثبت می‌کرد. توابع `addSWListener`/`cleanupSWListeners` وجود داشتند ولی هرگز به handlerها وصل نمی‌شدند؛ `cleanupSWListeners` هیچ‌وقت صدا زده نمی‌شد و لیستش همیشه خالی بود (۵ add در برابر ۰ remove واقعی). `addSWListener` استفاده‌نشده باعث TS6133 و شکست typecheck/build می‌شد (issue #6).

## گزینه‌ها
1. **حذف `addSWListener`/`cleanupSWListeners` و کامنت‌های ردیابی** — ساده؛ ولی `cleanupSWListeners` از API عمومی export شده و حذف آن breaking change است (قانون سازگاری رو به جلو، AGENT-INSTRUCTIONS بند ۴.۳).
2. **وصل‌کردن handlerها از طریق `addSWListener` و نگه‌داشتن `cleanupSWListeners` به‌عنوان escape hatch** — API حفظ می‌شود، ادعای «listener cleanup واقعی» درست می‌شود، build سبز.

## تصمیم و دلیل
گزینهٔ ۲. همهٔ پنج handler در `setupSW` از مسیر `addSWListener` (همان `swSelf` با guard `typeof self`) ثبت می‌شوند و در `swHandlers` ذخیره می‌گردند؛ `cleanupSWListeners()` آن‌ها را با همان رفرنس حذف می‌کند.

تصمیم دامنهٔ عمر: در SW واقعی، global scope توسط مرورگر با هر بار start دوباره ساخته می‌شود و خودِ scope دورریز است؛ بنابراین cleanup دستی برای جلوگیری از نشت حافظه **لازم نیست**. اما برای تست‌های Node (mock self)، داکیومنت‌کردن رفتار hot-reload، و سناریوهای «unregister→register مجدد در همان page» که setup چندبار صدا زده می‌شود، ثبت از طریق رجیستری و وجود `cleanupSWListeners()` مفید و بی‌خطر است. این موضع در TSDoc و تست `packages/service-worker/test/sw-listeners-test.ts` مستند شد.

## پیامدها
- `npm run typecheck` و `npm run build` سبز (۳۴ ساخته، ۰ شکست).
- تست جدید: ثبت ۵ listener و حذف دقیق آن‌ها با تطبیق رفرنس + idempotency.
- بدون تغییر breaking؛ `cleanupSWListeners` همچنان export می‌شود.
