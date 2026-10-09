# Zenith v1.4.0 — برنامهٔ تکمیل قابلیت‌ها و استانداردسازی سبک (سطح پروژه)

این سند حاصل بررسی **هر ۳۶ پوشهٔ `packages/`** است. سطح API هر پکیج با کامپایلر TypeScript از `src/index.ts` استخراج شد
(برای ۳۴ پکیج دارای index) و برای سه پکیج بدون index (`cli`، `vscode-extension`، `devtools-extension`) manifest و دستورها بررسی شد.
جدول ۱ همهٔ پکیج‌ها را پوشش می‌دهد. بخش‌هایی که «تحلیل» نام دارند نظر ارزیابی‌اند و نه واقعیت مستند.
معماری در `ARCHITECTURE.md` و چک‌لیست انتشار در `PRODUCTION-READINESS.md` است و اینجا تکرار نمی‌شود.

---

## ۱. پوشش بررسی (همهٔ پکیج‌ها)

ستون «انحراف از سبک» موارد تأییدشده در کد است. ستون «شکاف قابلیت» تحلیل است.

| # | پکیج | exportهای عمومی | شکاف قابلیت (تحلیل) | انحراف از سبک (تأییدشده) |
|---|---|---|---|---|
| 1 | `actions` | ۱۴ | وسط‌افزار (middleware) دارد؛ شکاف مهمی دیده نشد | `registerAction` تابع سراسری و `ActionRegistry` کلاس هر دو هست؛ `getAction` برای نبودن `undefined` می‌دهد |
| 2 | `auth` | ۳۲ | بدون همگام‌سازی چندتب (storage event) و بدون MFA/OTP (در کد یافت نشد) | دو API موازی (کلاس `createAuth` و تابعی `configureAuth/initAuth`)، رجیستری `registerAuth`؛ `login/logout/register` به‌صورت تابع سراسری |
| 3 | `cli` | ۰ (bin) | دستورها: `create`، `generate`، `info`، `check`، `lighthouse`؛ بدون `dev/build/test/upgrade` | `--version` هاردکد `0.1.0` |
| 4 | `compiler` | ۱۱ | مجموعهٔ `COMPILABLE_DIRECTIVES` دارد؛ طبق مقایسهٔ رشته‌های `zen-*` در `walker.ts` و `compiler.ts` این ۶ مورد فقط در runtime‌اند: `zen-resource-view`، `zen-action-button`، `zen-auth-view`، `zen-router`، `zen-button`، `zen-if-chain` | فقط `compileTemplate`؛ ابزار parity با نام `run*` |
| 5 | `components` | ۱۸ | slot دارد؛ بدون lifecycle رسمی | `register/unregister/get/is/clear` با `Map` سراسری؛ `processComponent` و `processAsyncComponent` |
| 6 | `crud` | ۶ | بدون بارگذاری تنبل | `registerCrudActions()` اثر جانبی سراسری؛ config با `JSON.parse` از attribute |
| 7 | `data` | ۶ | cache ساده، بدون invalidation | `processFetch*`؛ cache مستقل از `http` و `resource` (`getCachedData/setCachedData/clearFetchCache`) |
| 8 | `data-table` | ۸ | بدون virtualization و export | `createDataTable(options)` — منطبق با سبک هدف |
| 9 | `dependency-graph` | ۵ | فقط استخراج وابستگی از رشته | نام `DependencyGraph` با کلاس دیگری در `devtools` تداخل مفهومی دارد |
| 10 | `devtools` | ۳۰ | timeline هست؛ بازپخش (time-travel) رسمی نیست | `registerSignal`/`recordStateChange` همنام با `state` ولی با امضای متفاوت (بند ۳.۶) |
| 11 | `devtools-extension` | بدون index | MV3، بدون build/test | `manifest.json` شامل کامنت است و JSON استاندارد نیست |
| 12 | `error-boundary` | ۹ | بازیابی با `recoverFromError`؛ بدون retry خودکار | `onError`/`reportError` همنام `state`؛ `processErrorBoundary` مقدار `void` |
| 13 | `errors` | ۱۹ | کاتالوگ کد خطا هست | فقط ۵ مورد `throw new ZenithError`؛ مصرف‌کنندگان بیشتر `Error` ساده می‌اندازند |
| 14 | `events` | ۱۹ | modifierها سفارشی‌پذیرند | `initEventDelegation` → `() => void` (خوب)؛ `clearEventModifiers`، `clearBindingCache` |
| 15 | `expressions` | ۲۷ | بدون پشتیبانی tagged template/pipe | **سطح داخلی افشا شده**: `Parser`، `lex`، `TokenType`، `evaluate`، `validate`؛ `clearCache` همنام `http` |
| 16 | `form` | ۴۲ | قوی؛ بدون `FieldArray` به‌عنوان API مستقل | **چند ورودی**: `createForm`، `createReactiveForm`، `createAdvancedForm`، `createWizardForm`، `createFormFromSchema`، `fromZod`، `fromJsonSchema`؛ options متفاوت |
| 17 | `http` | ۱۸ | interceptor و cache قوی؛ بدون progress آپلود (در کد یافت نشد) | `request` نام عمومی؛ `clearCache(tags)` همنام `expressions.clearCache`؛ `setHttpConfig/getHttpConfig` |
| 18 | `i18n` | ۱۵ | **فقط ابزار فارسی/جلالی**: بدون `t()`، catalog، plural، locale واکنشی | توابع بدون state و بدون پیکربندی locale |
| 19 | `notifications` | ۱۷ | toast/alert/confirm | نام `alert`/`confirm` با Web API هم‌نام؛ هم `notificationsAPI` و هم توابع جدا |
| 20 | `permission` | ۱۱ | RBAC خوب | `createPermissionManager(name)`/`getPermissionManager(name)` با رجیستری نامی؛ `createGuard` در برابر `requirePermission` |
| 21 | `resource` | ۱۱ | cache + dedup + optimistic | `createResource(name, config)` با رجیستری سراسری؛ `clearResources` در برابر `resetResourceRegistry` |
| 22 | `router` | ۲۱ | route تو در تو، guard؛ **بدون `scrollBehavior` و مدیریت focus** | سراسری: `routeSignal`، `navigate`، `beforeEach` (بدون dispose)؛ `installPopstateListener`/`cleanupRouter` |
| 23 | `runtime` | ۱۲۵ | هستهٔ DOM؛ پلاگین (`Zen.use`) و directive سفارشی دارد | سطح عمومی بسیار بزرگ؛ `login/logout/register` سراسری؛ ۱۲ تابع `hydrate*` |
| 24 | `scheduler` | ۱۸ | priority و hook | `schedule` و `scheduleEffect` هم‌معنا؛ `clearScheduler` |
| 25 | `security` | ۸ | sanitizer، CSP، TrustedTypes | سه تابع `sanitizeHTML*` با تفاوت ظریف؛ `createTrustedTypesPolicy` |
| 26 | `service-worker` | ۸ | قوی؛ SW runtime در `sw.ts` خارج از API | `registerSW(swUrl, options)` موقعیتی + options؛ `cleanupSWListeners` مرده |
| 27 | `ssr` | ۴۱ | رندر/استریم/hydrate؛ سطح عمومی بزرگ | `getEnvironment/isServer/isClient/runOnServer` تکراری؛ `hydrate` و `startFromSSR` |
| 28 | `state` | ۴۵ | **بدون `watch`، signal ناهمگام، `onMount`** | `onError/emitError/errorBoundary` و رجیستری devtools داخل `state` |
| 29 | `stateful` | ۵ | کامپوننت‌های سطح‌بالا | `installStatefulComponents()` و `ZenithStatefulPlugin` دو مسیر نصب؛ config با JSON attribute |
| 30 | `store` | ۶ | `$patch`/`$reset`؛ **بدون persist، `$subscribe`، پلاگین** | `defineStore(id, def)`/`getStore(id)`، کلید `id` (در بقیه `name`) |
| 31 | `suspense` | ۷ | ردگیری promise | `createSuspenseContext(timeoutMs, onSettle)` موقعیتی؛ `processSuspense` → `void` |
| 32 | `testing` | ۱۲ | harness، matcher، mock، `render` | بدون fake timers و mock برای `http`/`router` |
| 33 | `transition` | ۱۸ | دو لایه: `enter/leaveTransition` و `createTransition` | `enterTransition(el, name, duration, onComplete)` موقعیتی؛ `cancelTransition` در برابر `dispose` |
| 34 | `virtual-list` | ۱۲ | کنترلر جدید | دو API (`createVirtualList` و `processVirtualList`) |
| 35 | `vite-plugin` | ۴ | HMR، compile | export پیش‌فرض و نام‌دار هر دو؛ `CompileOptions` تکراری |
| 36 | `vscode-extension` | بدون index | زبان، گرامر، snippet، ۳ دستور | بدون تست؛ یک فایل ۱۰۹۷ خطی |

---

## ۲. یافته‌های سطح پروژه

### ۲.۱ سه سیستم خطا
1. `state`: `onError`، `emitError`، `errorBoundary`، `getErrorHistory`، `setDevMode`
2. `error-boundary`: `onError`، `reportError`، `errorSignal`، `clearError`
3. `runtime`: `Zen.onError`/`Zen.reportError` (روی سیستم ۲)

علاوه بر آن `onEffectError` (`state`) و `setSchedulerHooks` (`scheduler`) راه‌های دیگری برای دریافت خطا هستند.
در `src`: ۶۹ `throw new Error` ساده در برابر ۵ مورد `ZenithError`، ۱۳۹ `console.error` و ۱۰۱ `console.warn`.
پیشوند پیام: `[Zenith` (۱۰۲)، `[zen` (۲۰)، `[ERROR` (۸)، `[CrudEngine`، `[crudBulkDelete` و …

### ۲.۲ پاکسازی (cleanup) یکدست نیست
- `dispose()` (۱۷ تعریف): `virtual-list`، `suspense`، `transition`، `computed`، `hydrate`، `date-picker`
- `destroy()` (۱۰): `auth`، `form`، `resource`، `crud-engine`، `actions`
- تابع برگشتی `() => void`: `onError`، `initEventDelegation`، بیشتر `process*`، `effect`
- آرایهٔ `disposes` به‌عنوان آرگومان: `processFetch`، `processFor`، `processSuspense`، `processVirtualList`
- بدون cleanup (`void`): `processErrorBoundary`، `processResource`، `processRouter`، `processSuspense`، `beforeEach`، `setHttpConfig`

### ۲.۳ شش الگوی ساخت
`createX(options)`، `createX(name, config)`، `defineX(...)`، `registerX(...)`، `processX(el, expr, context, ...)`، و کلاس/`configureX + initX`. فعل‌های راه‌اندازی هم متفاوت‌اند: `init`، `install`، `configure`، `register`، `load`، `start`.

### ۲.۴ رجیستری‌های سراسری با کلید و رفتار متفاوت
`componentRegistry`، `authRegistry`، `permissionRegistry`، `serverComponentRegistry`، `customDirectiveRegistry`، `pluginRegistry`، رجیستری actions/resources/stores.
- کلید گاهی `name` و گاهی `id` (`store`).
- `getX` در همهٔ موارد بررسی‌شده `undefined` می‌دهد (سازگار)، ولی راه پاک‌سازی ناهمگون است: `clearActions`، `clearAuth`، `clearComponents`، `clearResources` + `resetResourceRegistry`، `clearStores`، `clearPermissionManagers`، `clearScheduler`، `cleanupRouter`، `cleanupDevtools`.

### ۲.۵ شش cache مستقل
`http` (TTL و tags)، `data` (`getCachedData`)، `resource` (`staleTime`)، `components` (`ComponentCacheConfig`: `ttl`/`maxSize`)، `expressions` (`maxSize` + آمار)، `router` (`clearRouteCache`).
هر کدام config، نام‌های clear و آمار متفاوت دارند.

### ۲.۶ نام تکراری با امضای متفاوت
| نام | جاها | تفاوت |
|---|---|---|
| `registerSignal(sig, name?)` | `state` → `number`؛ `devtools` → `void` | نوع بازگشتی و مفهوم شناسه (`number` در برابر `string`) |
| `recordStateChange(...)` | `state(sig, old, new)`؛ `devtools(signalId: string, old, new, name?)` | ورودی اول متفاوت |
| `onError` | `state`، `error-boundary` | دو سیستم |
| `clearCache` | `http(tags?)`، `expressions()` | دو مفهوم |
| `getResource` | `resource`، `crud` (re-export) | سازگار |
| `CompileOptions` | `compiler`، `vite-plugin` | دو نوع |
| `alert` / `confirm` | `notifications` | همنام Web API |
| `login/logout/register` | `auth`، `runtime` (re-export) | نام بسیار عمومی در namespace سراسری |

### ۲.۷ re-export ناهمگون از `runtime`
`runtime` این‌ها را re-export می‌کند: `state`، `scheduler`، `actions`، `events`، `components`، `router` (بخشی)، `data` (`processFetch`)، `security`، `devtools`، `error-boundary`، `auth`، بخشی از `notifications`.
**re-export نمی‌کند:** `http`، `form`، `store`، `permission`، `i18n`، `crud`، `data-table`، `virtual-list`، `suspense`، `transition`، `ssr`، `testing`. پس «یک import برای همه» وجود ندارد و قاعدهٔ انتخاب نامشخص است.

### ۲.۸ سطح API داخلی افشا شده
`expressions` (`Parser`، `lex`، `TokenType`)، `ssr` (`domAls`، `installDOMGlobalGetters`)، `runtime` (۱۲ تابع `hydrate*`، `__injectCloakStyle`، `__removeCloakStyle`)، `devtools` (`recordRead/Write/DomUpdate`).

### ۲.۹ directive: سه سبک
- attribute بدون config: `zen-if`، `zen-show`، `zen-text`
- attribute با JSON: `zen-crud`، `zen-resource-view`
- تگ سفارشی: `zen-router`، `zen-suspense`، `zen-date-picker`
- قاعدهٔ مشترک `process*(el, expr, context, processChildren, disposes)` با امضای متفاوت بین directiveها (بعضی `state`، بعضی `_context`، بعضی `processChildren`).

### ۲.۱۰ ورودی واکنشی
فقط `virtual-list` ورودی `T[] | Signal<T[]>` می‌پذیرد. بقیه (مثلاً `data-table`) مقدار ساده می‌گیرند.

---

## ۳. استانداردهای هدف (قرارداد پروژه)

### ۳.۱ ساخت و چرخهٔ عمر
1. **نمونه‌ای:** `createX(options?) → X`، `X` همیشه `Disposable` است.
2. **سراسری (رجیستری):** `registerX(key, value)` → `Disposable`/`() => void`؛ `getX(key)` → `undefined` در صورت نبود؛ `hasX`، `listX`، `unregisterX`.
3. **تعریف اعلانی** (`defineX`) فقط برای آنچه یک شیء پیکربندی خالص برمی‌گرداند (`defineRoutes`، `defineStore`، `defineComponent`)؛ هیچ اثر جانبی ندارد.
4. **راه‌اندازی:** یک فعل ثابت `start`/`install`: `install(app)` برای پلاگین‌ها و `app.start(root)`.
5. **آزادسازی:** تنها `dispose()` روی شیء یا تابع برگشتی `() => void`. `destroy`/`cancel`/`stop` فقط alias با هشدار deprecation. `process*` همیشه `() => void`.
6. **تست و بازنشانی:** `clearX` حذف شود؛ جایگزین: `app.dispose()` و `resetForTesting()` در `@zenith/testing`.

```ts
interface Disposable { dispose(): void }
type Cleanup = () => void
type MaybeSignal<T> = T | ReadonlySignal<T>
```

### ۳.۲ گزینه‌ها
- همیشه یک آرگومان `options` (بدون آرگومان موقعیتی برای تنظیمات)؛ آرگومان اول فقط ورودی اصلی (`el`، `url`، `key`).
- هر گزینه `@default`، واحد و `@since` در TSDoc.
- پیش‌فرض‌ها در `export const DEFAULTS = Object.freeze({...})`.
- اعتبارسنجی در مرز ورودی با خطای `ZEN-xxx`.
- گزینه‌های ورودی واکنشی با `MaybeSignal<T>` و helper مشترک `toValue()` در `state`.
- گزینه‌های Zenith درون اشیای استاندارد (`RequestInit`) در زیرشیء جدا.
- callbackها: `onX` (رویداد)، `beforeX` (قابل لغو)؛ همه با `AbortSignal` یا dispose.

### ۳.۳ خطا
- خطای برنامه‌نویس (آرگومان نادرست): `throw new ZenithError(code, ...)`.
- خطای زمان اجرا (عبارت، شبکه، directive): `reportError(err, source, ctx)` به **یک** سیستم؛ `console.*` فقط داخل logger.
- یک `onError` در `@zenith/errors` (یا `state`) و بقیه re-export همان.
- پیام: `ZEN-NNN: متن` و لینک به مستندات؛ بدون پیشوند اختصاصی هر پکیج.
- `Result`-style برای APIهای ناهمگام عمومی که شکست «معمول» است (اعتبارسنجی).

### ۳.۴ cache
یک `CachePolicy` مشترک (`ttl`, `maxSize`, `staleWhileRevalidate`, `tags`) و یک `createCache()` در لایهٔ مشترک که `http`، `resource`، `data`، `components` و `expressions` بر آن بنا شوند؛ آمار و `invalidate(tags)` یکسان.

### ۳.۵ نام‌گذاری
| مفهوم | قاعده |
|---|---|
| ساخت نمونه | `createX` |
| رجیستری | `registerX` / `getX` / `hasX` / `listX` / `unregisterX` |
| اتصال به DOM | `bindX(el, ...)` (به‌جای `processX`) |
| تابع reactive | `useX()` فقط برای دسترسی به context |
| رویداد | `onX(cb) → Cleanup` |
| قابل پیش‌گیری | `beforeX` |
| ثابت | `UPPER_SNAKE` |
| نوع options | `XOptions` (یکتا در کل مخزن) |
| نوع نتیجه | `XResult` / `XApi` |

نام‌های مشکل‌دار: `alert/confirm` → `showAlert/showConfirm`، `login/logout/register` سراسری → فقط روی `auth`، `request` → `httpRequest`، `clearCache` → `clearHttpCache`/`clearExpressionCache`.

### ۳.۵.۱ ساختار export
- هر پکیج: **API پایدار** (`index.ts`)، **تجربی** (`@zenith/x/experimental`)، **داخلی** (`@zenith/x/internal`، بدون ضمانت).
- `expressions`، `ssr`، `runtime`، `devtools`: خارج کردن سطح داخلی از `index.ts`.
- `runtime` سه export داشته باشد: `@zenith/runtime` (هسته)، و بستهٔ `zenith` که همه را re-export می‌کند (قاعدهٔ واحد).

### ۳.۶ مرز ماژول‌ها
- `state` خطا و رجیستری devtools را به `errors`/`devtools-core` منتقل کند؛ `state` فقط reactivity.
- `devtools.registerSignal` و `state.registerSignal` یکی شوند (یک شناسه از یک نوع).
- `DependencyGraph` در `devtools` به نام دیگر (`RuntimeGraph`) تا با `dependency-graph` اشتباه نشود.

### ۳.۷ directive
- سه سبک بالا را به دو سبک برسانید: attribute برای رفتار، تگ سفارشی برای کامپوننت.
- config: عبارت یا JSON یکی از دو، همیشه با `parseConfig(attr)` مشترک و خطای ZEN.
- امضای ثابت: `bindX(el, ctx: BindContext): Cleanup` که `BindContext` شامل `expr`، `context`، `processChildren`، `disposes`، `state` است.

---

## ۴. قابلیت‌هایی که باید اضافه یا کامل شود

### ۴.۱ هسته
| قابلیت | پکیج | توضیح |
|---|---|---|
| `watch(source, cb, options)` | `state` | با `immediate`، `flush` |
| signal ناهمگام / `createAsync` | `state` یا `resource` | loading/error/data در یک signal |
| `onMount` / `onUnmount` / `onUpdate` | `runtime` | چرخهٔ عمر کامپوننت و directive |
| `provide` / `inject` درختی | `runtime`+`components` | context واقعی به‌جای شیء مسطح |
| `MaybeSignal` و `toValue` | `state` | ورودی واکنشی یکدست |
| `createApp()` | `runtime` | حذف singleton (بند ۵) |

### ۴.۲ پکیج به پکیج
- **`i18n`**: `createI18n({ locale, messages, fallback })`، `t()`، plural (`Intl.PluralRules`)، locale واکنشی، lazy-load catalog؛ ابزار جلالی به `@zenith/i18n/jalali` منتقل شود.
- **`router`**: `scrollBehavior`، مدیریت focus و اعلان تغییر مسیر (`aria-live`)، `afterEach`، `beforeEach` با برگرداندن cleanup، انتقال بین صفحه‌ها.
- **`store`**: `persist`، `$subscribe`، پلاگین، devtools hook.
- **`form`**: یک `createForm` با options یکپارچه (`rules` رشته‌ای، تابعی، schema، zod)؛ `fromZod` و `fromJsonSchema` در زیرمسیر اختیاری.
- **`http`**: upload/download progress، `AbortSignal` ورودی، mock پذیر برای تست.
- **`data` / `resource`**: ادغام `data` در `resource`؛ cache مشترک؛ `invalidate(tags)` سراسری.
- **`data-table`**: virtualization (با `virtual-list`)، export CSV، دسترس‌پذیری ARIA grid.
- **`notifications`**: تغییر نام، صف و محدودیت تعداد، `aria-live`.
- **`transition`**: یک API (`createTransition`)، پشتیبانی `prefers-reduced-motion`، transition مسیر.
- **`virtual-list` / `suspense`**: حذف API قدیمی و تثبیت API جدید.
- **`error-boundary`**: `retry` خودکار، `reset`، fallback قابل‌پیکربندی، ادغام با گزارش‌دهندهٔ خارجی.
- **`permission`**: یک رجیستری نامی و `can(permission)` به‌عنوان signal.
- **`events`**: modifierها مستند و تست‌شده، `once/passive/capture` رسمی.
- **`ssr`**: `renderToString/Stream` پایدار، API داخلی پنهان، پشتیبانی Edge runtime.
- **`testing`**: fake timers، `mockHttp`، `mockRouter`، `resetForTesting()`، تست directive.
- **`compiler`**: پوشش ۶ directive باقی‌مانده، گزارش parity در CI.
- **`cli`**: `dev`، `build`، `test`، `upgrade`، `doctor`، خروجی `--json`، نسخه از `package.json`.
- **`service-worker`**: جدا کردن runtime SW از API ثبت، kill switch، راهنمای ارتقا.
- **`devtools` / `devtools-extension`**: manifest JSON استاندارد، بازپخش (time-travel) مستند بر پایهٔ timeline موجود، تست.
- **`vscode-extension`**: بسته‌بندی، تست، تکمیل برای options و خطای ZEN.
- **`a11y`**: پکیج یا ماژول مشترک (focus trap، live region، مدیریت focus مسیر) برای همهٔ کامپوننت‌ها.

---

## ۵. وضعیت سراسری
- `createApp()` شامل scheduler، router، registry، error handler و cache.
- singletonهای فعلی (`routeSignal`، `navigate`، رجیستری‌ها) فقط یک نمونهٔ پیش‌فرض باشند.
- تضمین: دو `createApp` در یک صفحه و دو درخواست هم‌زمان SSR مستقل کار کنند (تست اجباری).

---

## ۶. نحوهٔ اجبار استاندارد (ابزار)

1. **ESLint با قوانین سفارشی** (`eslint-plugin-zenith`): ممنوعیت `console.*`، `throw new Error`، `destroy/cancel` در API عمومی، آرگومان موقعیتی در `create*`، نام‌های ممنوع (`alert`, `login` در namespace سراسری).
2. **`api-extractor`**: snapshot API هر پکیج؛ تغییر ناخواسته CI را می‌شکند.
3. **تست انطباق (conformance)**: برای هر `create*`/`register*`: وجود `dispose`، idempotent بودن، عدم نشت listener، رفتار SSR.
4. **تست قرارداد options:** هر `XOptions` یک schema دارد؛ تست خودکار پیش‌فرض‌ها و اعتبارسنجی.
5. **`dependency-cruiser`** برای لایه‌بندی و جلوگیری از وابستگی دایره‌ای.
6. **TypeDoc** از TSDoc؛ نبودن `@default`/`@example` برای export عمومی CI را می‌شکند.
7. **قالب PR** با چک‌لیست انطباق با قرارداد.

---

## ۷. مهاجرت بدون شکستن کاربران

- هر نام قدیمی alias می‌ماند و یک‌بار `console.warn` با کد `ZEN-DEPR-xxx` می‌دهد؛ حذف در نسخهٔ major بعدی (`2.0`).
- جدول مهاجرت در `docs/migration-guide.md`: `destroy→dispose`، `processX→bindX`، `clearX→resetForTesting`، `createReactiveForm/createAdvancedForm/createWizardForm→createForm({mode})` و …
- codemod (`zenith upgrade`) برای تغییر نام‌ها.

---

## ۸. نقشهٔ راه

| فاز | محتوا | خروجی |
|---|---|---|
| ۰ — قرارداد | نگارش `docs/API-CONVENTIONS.md` از بند ۳؛ قوانین ESLint؛ `api-extractor` | CI قرارداد را اجبار می‌کند (فقط هشدار) |
| ۱ — بنیاد | یک سیستم خطا؛ `Disposable`/`Cleanup`؛ `MaybeSignal`؛ logger؛ cache مشترک | کد قدیمی از طریق alias کار می‌کند |
| ۲ — یکدست‌سازی API | `auth`، `form`، `virtual-list`، `transition`، `data→resource`؛ نام‌ها؛ `bindX` | alias + deprecation |
| ۳ — قابلیت‌ها | `watch`، async signal، lifecycle، provide/inject، `i18n` واقعی، `router` (scroll/focus)، `store` persist | مثال و تست برای هر کدام |
| ۴ — مرز ماژول | `createApp()`، سطح export پایدار/تجربی/داخلی، تقسیم `runtime`، بستهٔ umbrella | حذف singletonها |
| ۵ — سخت‌سازی | conformance، a11y، SSR هم‌زمان، مستندات کامل، codemod | آمادهٔ RC |

---

## ۹. معیار پذیرش

- [ ] همهٔ `create*` یک `dispose()` دارند و تست conformance آن را پوشش می‌دهد.
- [ ] هیچ `console.*` یا `throw new Error` ساده در `src` پکیج‌ها نیست (به‌جز logger).
- [ ] فقط یک `onError` و یک `registerSignal` عمومی وجود دارد.
- [ ] هیچ نام تکراری با امضای متفاوت بین پکیج‌ها نیست (اسکریپت بررسی export).
- [ ] یک پیاده‌سازی cache مشترک.
- [ ] هر `XOptions` دارای `@default`، اعتبارسنجی و تست.
- [ ] `index.ts` هر پکیج فقط API پایدار را export می‌کند؛ snapshot `api-extractor` در CI.
- [ ] `i18n` دارای `t()`، plural و locale واکنشی.
- [ ] `onMount/onUnmount`، `watch`، `provide/inject` مستند و تست‌شده.
- [ ] README برای هر ۳۶ پکیج (الان ۱۲ پکیج ندارند).
- [ ] دو `createApp` و دو درخواست SSR هم‌زمان بدون تداخل.
- [ ] راهنمای مهاجرت و codemod منتشر شده.
