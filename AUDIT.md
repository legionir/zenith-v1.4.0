# Zenith v1.4.0 — گزارش یکپارچهٔ Code Review و ممیزی

این فایل جایگزین همهٔ گزارش‌ها و ممیزی‌های قبلی است
(`BUG_REPORT`، `DEEP_BUG_REPORT`، `NEW_FINDINGS`، `FINAL_AUDIT`، `BUILD-REPORT`،
`ACTION_PLAN`، `COMPREHENSIVE_PLAN`، `ELEVATION_PLAN` و `dashboard/EXPERIENCE`).
ادعاهای آن‌ها با کد فعلی مقایسه شد و فقط موارد **باقی‌مانده یا ناقص** اینجا آمده‌اند،
در کنار Code Review جدید.

روش: خواندن کد منبع، `grep` برای هر ادعا، و اجرای `npm ci` / `typecheck` / `build` / `test`.
وضعیت‌ها: ✅ تأییدشده در کد · ⚠️ ناقص · ❌ ادعا نادرست یا رگرسیون.

---

## ۱. وضعیت فعلی Build

| مرحله | ادعای BUILD-REPORT | وضعیت واقعی |
|---|---|---|
| `npm ci` | ✅ | ✅ موفق |
| `npm run typecheck` | ۰ خطا | ❌ **۱ خطا** — `service-worker/src/sw.ts:695` (`TS6133: 'addSWListener' is declared but its value is never read`) |
| `npm run build` | ۳۴ ساخته، ۰ شکست | ❌ **۳۳ ساخته، ۱ شکست** (`@zenith/service-worker`، همان خطا) |
| `npm test` | ۰ pass، ۱۴ fail | ❌ بدون تغییر: ۰ pass، ۱۴ fail، ۲۱ skip |

**ریشه:** کد «listener cleanup» اضافه‌شده در `sw.ts` (خطوط ۶۹۲–۷۱۲) هیچ‌جا استفاده نمی‌شود؛
همهٔ handlerهای `install/activate/fetch/sync/message` مستقیم با `swSelf.addEventListener`
ثبت می‌شوند. پس هم build را می‌شکند و هم ادعای «cleanup واقعی» نادرست است.
**اقدام:** یا `addSWListener` را در ثبت handlerها به کار بگیرید یا هر دو تابع را حذف کنید.

---

## ۲. مقایسهٔ ادعاهای گزارش‌ها با کد

### ✅ تأییدشده (در کد موجود است)

- `eval()` / `new Function()`: هیچ استفادهٔ اجرایی در `packages/*/src` نیست؛ فقط رشته‌های lint در `cli/check.ts` و پیام‌ها.
- `validator.ts`: `setInterval` وجود ندارد.
- `parser.ts`: حلقهٔ خط ۳۲۹ guard EOF دارد؛ حلقهٔ خط ۴۹۹ با `break` خارج می‌شود.
- `sanitizer.ts`: `ALLOWED_TAGS`، deny برای `TEMPLATE` و پاک‌سازی محتوای template (SEC-01..04).
- `permission.ts`: `deepFreeze()` و فراخوانی آن در `freeze()` (PRM-01).
- `graph-viewer.html`: برچسب‌ها با `textContent` escape می‌شوند (DEVTEXT-01، فقط برای زمینهٔ متن).
- `hook.ts`، `date-picker.ts`: listenerها نگه‌داری و حذف می‌شوند.
- CLI: تشخیص package manager (CLI-04) و نرمال‌سازی NFC (CLI-05).
- `data/fetcher.ts` (abort، سقف retry)، `router` (حذف `popstate`/`mouseover`)، `store` (WeakSet دورانی)،
  `expressions/cache.ts` (`MAX_CACHE_SIZE`)، `scheduler` (`MAX_FLUSH_ITERATIONS`)، `i18n` (هشدار قبل از ۱۶۰۰)،
  `form` (بررسی محدودهٔ `removeItem`/`moveItem`)، `error-boundary` (log کردن خطا).
- `.github/workflows/main.yml` (build matrix) و `bundle.yml` اکنون وجود دارند.

### ⚠️ ناقص یا باقی‌مانده

| # | مورد | شواهد | اقدام |
|---|---|---|---|
| A1 | **CLI-03 — directory traversal** در `zenith create` | `cli/src/index.ts:82-83`: `path.join(cwd, projectName)` بدون بررسی؛ `../x` یا مسیر مطلق پذیرفته می‌شود | رد `..`، مسیر مطلق و جداکننده در نام پروژه |
| A2 | **تست‌ها: پوشش صفر** | هیچ پوشهٔ `test/` نیست؛ `package.json`ها به `tsx test/*.ts` اشاره می‌کنند → ۱۴ شکست | نوشتن تست یا حذف اسکریپت‌های مرده؛ سپس افزودن به CI |
| A3 | **listenerهای `sw.ts`** | ۷ `addEventListener` در برابر ۱ `removeEventListener`؛ `cleanupSWListeners` هرگز با handlerها پر نمی‌شود (بخش ۱) | رفع همراه با بخش ۱ |
| A4 | **`host_permissions` در devtools-extension** | `manifest.json:33`: هنوز `http://*/*` و `https://*/*`؛ BUG-DEVTEXT-01 «محدود شد» فقط یک کامنت است | استفاده از `optional_host_permissions` یا دامنهٔ مشخص |
| A5 | **فروشگاه دمو — inventory** | `store.ts` فقط `persistCart/restoreCart` دارد؛ هیچ `stock`/`inventory` در `ecommerce-demo` نیست، در حالی که ELEVATION_PLAN «inventory check (exists)» می‌گوید | پیاده‌سازی یا حذف ادعا |
| A6 | **`parser.ts` — null-deref** | `this.current().value` بدون guard در مسیر arrow function (حدود خط ۴۵۸) و آرایه (خط ۴۸۹)؛ با EOF ناگهانی TypeError می‌دهد | استفاده از `this.current()?.value` |
| A7 | **listenerهای تولیدشده** در `compiler.ts:447` | `addEventListener('input')` در کد تولیدی بدون مسیر پاک‌سازی | ثبت disposer در context رندر |
| A8 | **فاصلهٔ مستند و کد** | ادعاهایی مثل «BUG-xx FIX» و «۴۳ باگ در `audit/all.md`»؛ `audit/` در مخزن **وجود ندارد** | هر ادعا یا با تست پوشش داده شود یا حذف شود |
| A9 | **آسیب‌پذیری dev** | `esbuild <=0.24.2` از طریق `vite <=6.4.2` (فقط dev) | ارتقا به `vite@8` (breaking) |
| A10 | **`engines`** | `>=18`، ولی `process.getBuiltinModule` از Node 18.19+ است | `engines` را `>=18.19` کنید |
| A11 | **BUG_REPORT — موارد بدون بررسی** | `actions` (middleware race)، `crud` (fetch loop)، `components/async-loader` (timeout)، `ssr` (stream flush)، `vite-plugin` (cache فقط برای `hasZenithDirectives`) | بررسی جداگانه؛ در این ممیزی ردیابی نشد |

### ❌ ادعاهای نادرست در گزارش‌های قبلی

- «۳۴ ساخته، ۰ شکست / ۰ خطای typecheck» — اکنون نادرست است (بخش ۱).
- «sw.ts: کد واقعی cleanup با removeEventListener» — کد مرده است.
- «ci.yml push نشد» — workflow با نام `main.yml` وجود دارد؛ `.github/CI.md` را با نام درست هماهنگ کنید.

---

## ۳. Code Review جدید

### `virtual-list` — `packages/virtual-list/src/controller.ts`
1. **خط ۱۸۷ — محتوای کهنه:** نودهای رندرشده بر اساس key کش می‌شوند و با تغییر آیتم همان key دوباره رندر نمی‌شوند. با key پیش‌فرض (index)، مرتب‌سازی یا `items.set(newArray)` محتوای قدیمی را نشان می‌دهد.
2. **خط ۱۱۱ — اندازه‌گیری منقضی:** `measurements` هرگز باطل یا پاک نمی‌شود؛ بعد از تعویض لیست، ارتفاع آیتم قبلی به آیتم جدید می‌چسبد (offset و `totalSize` غلط) و keyهای حذف‌شده نشت می‌کنند.
3. **خط ۲۵۳ — وابستگی ناخواسته:** `update()` داخل `effect()` است؛ سیگنال‌هایی که `renderItem` یا `onVisibleRangeChange` می‌خوانند وابستگی effect می‌شوند → بازسازی کامل یا حلقه. این callbackها را در `untracked()` بپیچید.

### `suspense` — `packages/suspense/src/suspense.ts`
4. **خط ۳۴۰:** `track()` محافظ چرخه ندارد؛ پرامیس‌های قبل از `reset()` بعد از تسویه هنوز `stopLoading`/`notifyReady` را صدا می‌زنند (`onReady` زودهنگام). پرامیس ردشده از `loadingSet` پاک نمی‌شود.
5. **خط ۲۸۹:** خطای جدید با مقایسهٔ `message` تشخیص داده می‌شود؛ دو خطای متفاوت با پیام یکسان فقط یک‌بار گزارش می‌شوند.
6. **خط ۳۱۱:** effect سیگنال‌هایی را می‌خواند که خودش می‌نویسد (`loading`/`error`) و اجرای اضافی دارد؛ شاخهٔ `minDelay` در برخی حالت‌ها تایمر را فعال نمی‌کند.

### `transition` — `packages/transition/src/transition.ts`
7. **خط ۵۵۲:** با اولین `transitionend`/`animationend` تمام می‌شود، بدون بررسی property یا نام انیمیشن؛ با opacity (۰٫۱s) و transform (۰٫۵s) المان زودتر حذف می‌شود.
8. **خط ۵۸۴:** تایمر fallback فقط بعد از دو `requestAnimationFrame` فعال می‌شود؛ در تب پس‌زمینه rAF متوقف است و `finished` هرگز resolve نمی‌شود.

### اسکریپت‌های build — `scripts/`
9. **`package-order.mjs:44-49`:** ترتیب فقط از `dependencies`/`peerDependencies` ساخته می‌شود و `devDependencies` را نادیده می‌گیرد؛ هر چرخه exception می‌دهد و کل build/typecheck را متوقف می‌کند.
10. **`typecheck-all.mjs:23`:** به‌جای `--noEmit` فایل declaration در `dist` می‌نویسد؛ side-effect در دستور بررسی که ممکن است خطاهای پایین‌دست را با declarationهای کهنه بپوشاند.

---

## ۴. ترتیب پیشنهادی رفع

1. **فوری:** رفع `sw.ts` تا `typecheck` و `build` سبز شوند (بخش ۱).
2. **بالا:** موارد ۱، ۳، ۴ و ۸ از Code Review؛ A1 (traversal)؛ A6 (parser).
3. **متوسط:** A2 (تست‌ها)، A4، A5، A7، موارد ۲، ۵–۷، ۹–۱۰.
4. **پایین:** A8–A11 و هماهنگی `.github/CI.md`.

---

## ۵. بازتولید

```bash
npm ci
npm run typecheck   # اکنون: 1 error (service-worker)
npm run build       # اکنون: 33 built, 1 failed
npm test            # اکنون: 0 passed, 14 failed, 21 skipped
```
