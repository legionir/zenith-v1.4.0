# قرارداد API Zenith (API-CONVENTIONS)

> **#117** — سند مبنا برای نام‌گذاری، الگوی ساخت، فعل‌ها، ورودی واکنشی و
> ثبت/نصب در سراسر `@zenith/*`. ریشه در `STANDARDIZATION-PLAN.md` §۲.۳/§۲.۱۰/§۳.۱/§۳.۵
> و `PRODUCTION-READINESS.md` §۳ دارد.
>
> **لینک از CONTRIBUTING:** این سند از [docs/README.md](./README.md) فهرست شده است.
> لینک از `CONTRIBUTING.md` پس از نگارش آن در **#107** افزوده می‌شود (این سند در
> موج ۲ نوشته می‌شود؛ CONTRIBUTING در موج ۴). تا آن زمان ارجاع معادل در
> `docs/README.md` و `ARCHITECTURE.md §۹` است.

هر قاعده یک «مثال» دارد و یک «اجرا» (gate/قاعده lint) که آن را قفل می‌کند. جدول
پایین‌تر تمام exportهای فعلیِ ناهمگون را با هدف و شمارهٔ migration فهرست می‌کند.

---

## ۰. خلاصهٔ قوانین (TL;DR)

| مفهوم | قاعده | مثال کوتاه |
|---|---|---|
| ساخت نمونه | `createX(options?) → X & Disposable` | `createAuth({...})` |
| رجیستری | `registerX/getX/hasX/listX/unregisterX` | `registerAction(name, fn) → Cleanup` |
| تعریف اعلانی | `defineX` بدون اثر جانبی | `defineRoutes([...])` |
| اتصال DOM | `bindX(el, ctx) → Cleanup` (هدف؛ `processX` فعلی alias است) | `bindIf(el, ctx)` |
| راه‌اندازی | `install(app)` برای پلاگین / `app.start(root)` | `Zen.use(statefulPlugin)` |
| رویداد | `onX(cb) → Cleanup`، قابل‌لغو `beforeX` | `onCleanup(fn) → Cleanup` |
| context | `useX()` فقط برای دسترسی به context | `useRoute()` |
| آزادسازی | فقط `dispose()`؛ `destroy/cancel/stop` alias منسوخ | `resource.dispose()` |
| ورودی واکنشی | `MaybeReactive<T>` + `toValue()` | `items: MaybeReactive<T[]>` |
| نوع | `XOptions`/`XResult`/`XApi` (یکتا در مخزن) | `AuthOptions`, `CrudEngineApi` |

---

## ۱. ساخت و چرخهٔ عمر

### ۱.۱ نمونه‌سازی: `createX(options) → X & Disposable`

هر سازندهٔ نمونه یک آبجکت برمی‌گرداند که `Disposable` است (`dispose()` idempotent).
ورودی تنظیمات همیشه در **یک** آرگومان `options` است (نه آرگومان‌های موقعیتی).

```ts
import { createAuth } from '@zenith/auth';
const auth = createAuth({ endpoints: { login: '/login' } });
// ...
auth.dispose(); // idempotent؛ چند فراخوان بی‌اثر است
```

**اجرا:** قاعدهٔ lint `@zenith/create-disposable` (#159)؛ هم‌اکنون `dispose()`
روی همهٔ `createX` در تست‌های `cleanup-protocol.test.ts` سنجیده می‌شود.

### ۱.۲ رجیستری سراسری: `registerX / getX / hasX / listX / unregisterX`

- `registerX(key, value)` → یک `Cleanup` (`() => void`) برمی‌گرداند که فقط ثبت
  خودش را حذف می‌کند (identity-guard) و idempotent است.
- `getX(key)` در نبود کلید `undefined` می‌دهد (نه throw).
- `hasX`/`listX`/`unregisterX` برای بررسی، فهرست و حذف صریح.

```ts
import { registerAction } from '@zenith/actions';
const unregister = registerAction('save', handler);
// ...
unregister(); // فقط اگر handler همچنان ثبت‌شده باشد، حذف می‌کند
```

**اجرا:** `scripts/cleanup-hygiene.mjs` نوع بازگشتی ثبت‌ها را قفل می‌کند؛
`@zenith/register-returns-cleanup` (#159) نام فعل‌ها را.

### ۱.۳ تعریف اعلانی: `defineX` بدون اثر جانبی

`defineX` فقط یک شیء پیکربندی خالص می‌سازد و هیچ رجیستری/global را لمس نمی‌کند.

```ts
import { defineRoutes } from '@zenith/router';
const routes = defineRoutes([{ path: '/', component: Home }]); // ثبت نمی‌کند
```

**اجرا:** `@zenith/define-pure` (#159) — بدنهٔ `defineX` نباید register/global
داشته باشد.

### ۱.۴ اتصال DOM: `bindX(el, ctx) → Cleanup` (هدف)

نام پایدار آینده `bindX` است؛ امضای ثابت `bindX(el, ctx: BindContext)` که در آن
`BindContext` شامل `expr`، `context`، `processChildren`، `disposes` و `state` است
و خروجی یک `Cleanup` idempotent. دایرکتیوهای `processX` فعلی همان نقش را دارند و
به‌تدریج به `bindX` نگاشت می‌شوند (جدول §۶؛ migration شکستهٔ API = alias + deprecate).

```ts
import { bindIf } from '@zenith/runtime';
const cleanup = bindIf(el, ctx); // در آینده؛ امروز: processIf(...) → () => void
```

**اجرا:** `scripts/cleanup-hygiene.mjs` (همهٔ `process*`/`bind*` نوع بازگشتی
Cleanup)؛ `@zenith/bind-signature` (#159) امضای `BindContext`.

### ۱.۵ راه‌اندازی: `install(app)` / `app.start(root)`

فعل راه‌اندازی ثابت است: پلاگین‌ها `install(zen)` دارند و اپ `start(root)`.
دیگر `init`/`configure`/`load`/`setup` به‌عنوان فعل راه‌اندازی عمومی مجاز نیست؛
`configureX` فقط برای ست‌کردن گزینه‌های یک ماژول (بدون راه‌اندازی) است.

```ts
import { Zen } from '@zenith/runtime';
import { ZenithStatefulPlugin } from '@zenith/stateful';
Zen.use(ZenithStatefulPlugin); // تک‌مسیر نصب (alias منسوخ: installStatefulComponents)
```

**اجرا (رفتاری، در همین #117):** `installStatefulComponents()` شد alias منسوخ‌شونده
روی `ZenithStatefulPlugin.install` (ZEN-DEPR-026). باقی فعل‌ها (`initAuth` و …) در
جدول §۶ برای migration ثبت‌اند.

### ۱.۶ رویداد: `onX(cb) → Cleanup` / `beforeX`

`onX` برای اشتراک رویداد و همیشه `Cleanup` برمی‌گرداند. `beforeX` قابل‌لغو است
(با `AbortSignal` یا بازگشت `false`).

```ts
import { beforeEach } from '@zenith/router';
const off = beforeEach((to) => to.meta.requiresAuth); // off() گارد را برمی‌دارد
```

**اجرا:** `scripts/cleanup-hygiene.mjs`؛ `@zenith/on-returns-cleanup` (#159).

---

## ۲. ورودی واکنشی: `MaybeReactive<T>` + `toValue()`

هر گزینه‌ای که می‌تواند هم مقدار ساده و هم Signal باشد، با نوع
`MaybeReactive<T>` (`T | Readable<T>`، `@zenith/shared`) اعلام می‌شود و با
`toValue()` خوانده می‌شود. این الگو که پیش‌تر فقط در `virtual-list` بود، به همهٔ
مصرف‌کننده‌های ورودی-واکنشی (مثل `data-table`) تعمیم می‌یابد.

```ts
import type { MaybeReactive } from '@zenith/shared';
import { toValue } from '@zenith/shared';

interface TableOptions<T> {
  data: MaybeReactive<T[]>; // آرایه ساده یا Signal<T[]>
}

function resolveData<T>(o: TableOptions<T>): T[] {
  return toValue(o.data); // هر دو حالت را می‌خواند
}
```

- `Readable<T>` ساختاری است (فقط `get(): T`) تا چرخهٔ `shared ↔ state` ساخته نشود (DEC-021).
- `state` همین نوع را با نام `MaybeSignal` re-export می‌کند؛ `createVirtualList`
  و `createDataTable` از همین الگو پیروی می‌کنند.
- نوشتن هنوز Signal لازم دارد؛ `toValue` فقط خواندن است.

**اجرا:** `@zenith/reactive-input` (#159) — گزینه‌های فهرست‌پذیرِ ورودی باید
`MaybeReactive<T>` باشند نه `T[] | Signal<T[]>` دستی.

---

## ۳. آزادسازی: dispose/Cleanup (DEC-032)

- تنها فعل آزادسازی `dispose()` (روی شیء) یا تابع برگشتی `() => void` (روی
  ثبت/اتصال) است.
- `destroy`/`cancel`/`stop` فقط alias منسوخ‌شونده با `deprecate('ZEN-DEPR-…')` و
  حذف در ۲.۰ (DEC-026). نام‌های **رفتاری** (لغو یک اجرا نه چرخهٔ عمر) حفظ
  می‌شوند و در DEC-032 allowlist شده‌اند: `TransitionRun.cancel`،
  `http.cancelRequest/cancelAllRequests`، `Zen.stop`، `schema.stop` (فیلد بولی)،
  `cli/lighthouse.stop`.
- `process*`/`register*`/`on*`/`beforeEach` همیشه `Cleanup` idempotent برمی‌گردانند.

```ts
resource.dispose();          // alias منسوخ: resource.destroy() → ZEN-DEPR-023
const cleanup = registerComponent('x-card', tpl);
cleanup(); cleanup();        // idempotent
```

**اجرا:** `scripts/cleanup-hygiene.mjs` (`npm run cleanup-hygiene`) — نوع بازگشتی
`process*`/`bind*` و عضوهای `destroy/cancel/stop` (alias یا allowlist). تست‌های
نشت/idempotency: `packages/*/test/cleanup-protocol.test.ts`.

---

## ۴. خطا (DEC-031) و گزینه‌ها (DEC-029)

- خطای برنامه‌نویس ⇒ `throw ZenithError`/`developerError` با کد `ZEN-…`.
- خطای زمان اجرا ⇒ `reportError(err, source, ctx)` به **یک** hub (بدون `console.*`
  در error-path؛ ratchet `scripts/no-console-ratchet.mjs`).
- گزینه‌ها: یک آرگومان `options`؛ `DEFAULTS` فریزشده (`defineDefaults`)؛ اعتبارسنجی
  در مرز با `@zenith/schema`؛ TSDoc `@default/@unit`.

```ts
import { defineDefaults } from '@zenith/shared';
export const DEFAULTS = defineDefaults({ ttl: 0, maxSize: 100 });
```

**اجرا:** `scripts/error-hygiene.mjs`؛ `@zenith/options-single-arg` و
`@zenith/frozen-defaults` (#159).

---

## ۵. جدول نگاشت قاعده ↔ lint

قاعده‌های سند یا امروز با گیت `scripts/*` قفل‌اند یا در پکیج
`@zenith/eslint-plugin` (**#159**، P1/موج ۴) پیاده می‌شوند:

| قاعدهٔ سند | کلید lint (#159) | گیت فعلی |
|---|---|---|
| `createX → Disposable` | `@zenith/create-disposable` | `cleanup-protocol.test.ts` |
| `registerX → Cleanup` | `@zenith/register-returns-cleanup` | `scripts/cleanup-hygiene.mjs` |
| `defineX` بدون اثر جانبی | `@zenith/define-pure` | — (بازبینی کد) |
| `bindX(el, ctx) → Cleanup` | `@zenith/bind-signature` | `scripts/cleanup-hygiene.mjs` (نوع بازگشتی) |
| `onX/beforeX → Cleanup` | `@zenith/on-returns-cleanup` | `scripts/cleanup-hygiene.mjs` |
| ورودی واکنشی `MaybeReactive` | `@zenith/reactive-input` | `types.test-d.ts` (shared) |
| فقط `dispose()`؛ بقیه alias | `@zenith/dispose-verb` | `scripts/cleanup-hygiene.mjs` (allowlist DEC-032) |
| خطا فقط از hub | `@zenith/no-console-in-error` | `scripts/error-hygiene.mjs` + ratchet |
| گزینهٔ تکی + DEFAULTS فریز | `@zenith/options-single-arg` / `frozen-defaults` | schema/mergeOptions tests |
| نام نوع `XOptions/XResult/XApi` | `@zenith/type-naming` | — (بازبینی کد) |

---

## ۶. جدول نگاشت نام‌های فعلی → قرارداد

همهٔ exportهای ناهمگونِ امروزی، هدف قرارداد و شمارهٔ migration. «رفتاری» یعنی
نام عامداً می‌ماند. «alias منسوخ» یعنی همین حالا deprecate شده است.

### ۶.۱ انجام‌شده در این موج

| فعل/نام فعلی | قرارداد | کد | وضعیت |
|---|---|---|---|
| `schedule(fn, …)` | `scheduleEffect(fn, …)` | ZEN-DEPR-025 | alias منسوخ (#117) |
| `installStatefulComponents()` | `Zen.use(ZenithStatefulPlugin)` | ZEN-DEPR-026 | alias منسوخ (#117) |
| `Resource/FormStore/Auth/CrudEngine/ActionRegistry/SWController.destroy()` | `.dispose()` | ZEN-DEPR-019..024 | alias منسوخ (#116) |

### ۶.۲ فعل‌های راه‌اندازی ناهمگون (migration هدف: `install`/`start`)

| نام فعلی | الگو | هدف | شماره |
|---|---|---|---|
| `initAuth` / `initEventDelegation` / `initDevTools` | `init*` | `configureAuth`+`start` / `install` | #118 |
| `configureX` (auth/scheduler/cache/analytics/componentCache) | `configure*` | نگه‌داشته (تنظیم گزینه، نه راه‌اندازی) — رفتار مجاز | — |
| `setupSW` | `setup*` | `install`/`start` | #118 |
| `loadComponent` / `loadComponents` / `loadPreloadedState` / `startFromSSR` | `load*/start*` | `install`/`hydrate` | #118 |
| `installPrefetch` / `installPopstateListener` / `installDOMGlobalGetters` | `install*` | سازگار با `install` — نگه‌داشته | — |

### ۶.۳ پاک‌سازی/ریست (`clearX`/`cleanupX` → `dispose()`/`resetForTesting()`)

| نام فعلی | هدف | شماره |
|---|---|---|
| `clearActions`/`clearComponents`/`clearAuth`/`clearStores`/`clearResources`/`clearPermissionManagers`/`clearServerComponents`/`clearEventModifiers`/`clearCustomDirectives`/`clearScheduler`/`clearRegistry` | روی شیء/registry: `dispose()` یا `unregisterX` | #118 |
| `cleanupRouter`/`cleanupDevtools`/`cleanupSWListeners` | `dispose()` | #118 |
| مسیرهای تست‌محور | `resetForTesting()` در `@zenith/testing` | #118 |

### ۶.۴ اتصال DOM: `processX` → `bindX` (نگاشت نام، بدون تغییر رفتار)

همۀ `process*` دایرکتیوها (`processIf`، `processShow`، `processText`، `processHtml`،
`processModel`، `processBind`، `processFor`، `processRouter`، `processResource`،
`processSuspense`، `processComponent`، `processDOM`، …) در قرارداد هدف معادل
`bind*(el, ctx) → Cleanup` می‌گیرند. **رفتار/نوع بازگشتی از پیش در #116 Cleanup است؛**
تنها تغییر، نام فعل است و به‌صورت alias + deprecate در #159/#118 انجام می‌شود.
`processFetchWithCache` یک utility داده (Promise) است و نامش استثنا ثبت شده
(DEC-032 / PROCESS_NAME_ALLOWLIST).

### ۶.۵ نام‌های problem‌دار (§۳.۵ plan)

| نام فعلی | مشکل | هدف | شماره |
|---|---|---|---|
| `alert` / `confirm` (notifications) | تصادم با Web API | `showAlert`/`showConfirm` | #118 |
| `request` (http) | بسیار عمومی | `httpRequest` | #118 |
| `login`/`logout`/`register` سراسری | namespace عمومی | فقط روی `auth` | #118 |
| `clearCache` در `http` و `expressions` | دو مفهوم | `clearHttpCache`/`clearExpressionCache` | #118 |
| `registerSignal` (state→number، devtools→void) | امضای متفاوت | یکی‌سازی شناسه | #118 |

---

## ۷. اجرای گیت‌ها

| گیت | دستور | CI job |
|---|---|---|
| cleanup-hygiene | `npm run cleanup-hygiene` | deps |
| error-hygiene | `npm run error-hygiene` | deps |
| attribute-grammar (#173) | `npm run attribute-grammar` | deps |
| peer-rule | `npm run peer-rule` | deps |
| no-console ratchet | `scripts/test/no-console-ratchet.test.mjs` | unit |
| eslint-plugin قراردادها (#159) | `@zenith/eslint-plugin` rules | lint |

این سند **منبع واحد قرارداد API** است؛ هر قاعدهٔ جدید باید قبل از کد، اینجا با مثال و
کلید lint بنویسد و سپس در `@zenith/eslint-plugin` (#159) یا یک `scripts/*.mjs`
اجرا شود. گرامر attributeهای HTML و رویدادهای `CustomEvent` در سند خواهر
[ATTRIBUTE-GRAMMAR.md](./ATTRIBUTE-GRAMMAR.md) (#173) ثابت شده‌اند و با گیت
`scripts/attribute-grammar.mjs` به رجیستری `zenith.meta.json` قفل می‌شوند.
