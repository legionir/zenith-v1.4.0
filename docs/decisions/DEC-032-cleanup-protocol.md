# DEC-032: پروتکل cleanup — dispose/Cleanup به‌عنوان قرارداد واحد؛ واژه‌های رفتاری cancel/stop نگه داشته می‌شوند

- وضعیت: پذیرفته‌شده (موج ۲، P0)
- تاریخ: 2026-10-12
- مرتبط: #116 (این تصمیم)، #115/DEC-031 (hub)، #141/DEC-021 (Disposable/Cleanup در shared)، DEC-019 (registry ZEN-DEPR)، DEC-026 (حذف فقط در ۲.۰)، #117 (API-CONVENTIONS)

## زمینه

#116: آزادسازی منابع یکدست نیست — `dispose()` (۱۷ تعریف)، `destroy()` (۱۰)، `cancel()` (۸)، `reset()/clear()`، تابع برگشتی `() => void` و آرایهٔ ورودی `disposes`. معیار پذیرش: «جدول exportهای عمومی هیچ destroy/cancel/stop غیر-alias ندارد (اسکریپت)» و «همهٔ process* نوع بازگشتی `() => void` دارند». دو پرسش باز مانده بود:

1. واژه‌های `cancel`/`stop` که **نام رفتار** هستند (نه چرخهٔ عمر مالکیت) تکلیفشان چیست؟
   - `TransitionRun.cancel()` — لغو یک *اجرای* در حال انجام؛ run پس از لغو هنوز object معتبری است و خودِ `TransitionController` متد `dispose()` دارد.
   - `http.cancelRequest(key)`/`cancelAllRequests()` — لغو *درخواست‌های شبکه* با key; هیچ مالکیتی آزاد نمی‌شود (controllerها در map سراسری مدیریت می‌شوند).
   - `Zen.stop(root)` — فرمان خاموش‌کردن کامل اپ (teardown سند، delegation، registryها)؛ semantics آن «shutdown» است نه «release this instance».
2. آرایهٔ ورودی `disposes: (() => void)[]` در همهٔ process*ها مصرف‌کنندهٔ داخلی/خارجی زیاد دارد؛ حذف یکبارهٔ آن breaking است.

## گزینه‌ها

- **الف) تبدیل همه‌چیز به `dispose`** — `TransitionRun.cancel` ⇒ `dispose` معنی «لغو animate» را گم می‌کند؛ `Zen.stop` ⇒ `dispose` با `Zen.start` جفت نمی‌شود. ❌ (نام‌های رفتاری بار معنایی دارند.)
- **ب) قرارداد دوشاخه: چرخهٔ عمر ⇒ `dispose()`/`Cleanup`؛ افعال رفتاری حفظ می‌شوند ولی در allowlist مستندِ گیت قفل می‌شوند.** ✅
- **ج) بدون گیت اسکریپتی** — معیار پذیرش #116 صریحاً «اسکریپت» می‌خواهد. ❌

## تصمیم و دلیل

گزینهٔ ب:

1. **Lifecycle**: هر کلاس/سازندهٔ دارای آزادسازی، `dispose()` idempotent دارد (`Disposable` در `@zenith/shared` — DEC-021). `destroy()` فقط alias با `@deprecated` + `deprecate('ZEN-DEPR-019..024', …)` است؛ حذف در ۲.۰ (DEC-026).
2. **Registration/processing**: هر `process*`/`bind*`/`register*`/`on*`/`beforeEach`/`setHttpConfig` یک `Cleanup` (**idempotent**) برمی‌گرداند. آرایهٔ `disposes` ورودی برای سازگاری همچنان پر می‌شود و در ۲.۰ حذف می‌شود (DEC-026). `processVirtualList` (deprecated از #47) controller‌ای برمی‌گرداند که **خود تابعِ قابل‌صدازدن** است (`ctl()` ≡ `ctl.dispose()`) تا شرط «نوع بازگشتی `() => void`» معنای واقعی‌اش — «قابل teardown بودن خروجی» — حفظ شود.
3. **افعال رفتاری allowlist می‌شوند** (با کامنت DEC-032 در فایل + ردیف در `scripts/cleanup-hygiene.mjs`):
   - `TransitionRun.cancel` — لغو run، نه آزادسازی مالکیت؛ controller خودش `dispose()` دارد.
   - `Zen.stop` — shutdown کامل اپ، جفتِ `Zen.start`.
   - `http.cancelRequest`/`cancelAllRequests` — این‌ها عضو export با نام `cancel*` هستند (نه `cancel`) و «ثبت»ی برای حذف نیستند؛ گیت فقط عضو دقیق `destroy/cancel/stop` را می‌بیند. برای شفافیت: لغو request با AbortController رفتار است، teardown ماژول http با آن تغییر نمی‌کند.
   - `schema validate` فیلد `stop: boolean` و `cli/lighthouse stop()` (tooling) — اصلاً lifecycle نیستند.
4. **گیت**: `npm run cleanup-hygiene` (CI deps job) دو شرط acceptance #116 را اسکریپت‌محور چک می‌کند: امضای بازگشتی process*/bind* و alias/allowlist بودن اعضای destroy/cancel/stop. allowlistها خودسند (باید کامنت DEC-032/#116 در فایل باشد) و ضد‌زباله (ردیف بی‌عضو fail می‌شود) هستند.
5. **`registerCleanup` (state)**: contract ثبت cleanup در بدنهٔ effect به `reg(cleanup) => Cleanup | void` ارتقا یافت تا `onCleanup` بتواند حذف واقعی از صف ارائه دهد؛ سازگاری type برای registerهای void قدیمی حفظ شده (`?? noop`).

## پیامدها

- مصرف‌کننده یک مسیر دارد: `dispose()` برای نمونه‌ها، خروجی `Cleanup` برای ثبت/processing؛ نام‌های قدیمی تا ۲.۰ کار می‌کنند با یک هشدار ZEN-DEPR.
- فرادادهٔ `Cleanup` در TSDoc API-CONVENTIONS (#117) مستند می‌شود؛ جدول export در #117 همین allowlist را منعکس می‌کند.
- تغییر breaking برای typeها نیست (void → `() => void` در مقدار بازگشتی برای مصرف‌کننده‌ای که آن را نادیده می‌گیرد سازگار است؛ TS فقط void را assignable به هیچ نمی‌کند و اینجا برعکس است).
- هزینه: گیت جدید + allowlistهای مستند؛ در عوض drift نام‌گذاری (destroy/cancel/stop جدید) در CI رد می‌شود.
- `ZenithError` در errors و hub (DEC-031) تغییری نکرد؛ `dispose`ها خطای hub را با `reportError` در مسیرهای directive گزارش می‌دهند (بدون double-emit — MARK routed #115).
