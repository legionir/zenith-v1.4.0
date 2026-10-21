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

### ۱.۷ یک نام، یک معنا (#119؛ DEC-035)

**قاعده:** یک نام export عمومی در دو پکیج نباید **دو معنا** داشته باشد. نام
تکراری فقط در سه حالت مجاز است:

1. **facade** — پکیج چتر (`zenith` → بقیه) چیزی را دوباره export می‌کند؛ تعریف
   یکی است.
2. **هم‌معنا در دو لایه** — مثل `isReadable` در `@zenith/shared` (ساختاری،
   DEC-021) و `@zenith/state` (برنددار، DEC-009). نام یکسان، پرسش یکسان.
3. **قرارداد پکیج‌محور** — `DEFAULTS` در هر پکیج پیش‌فرض‌های *همان پکیج* است
   (§۳).

هر چیز دیگری باید **تغییر نام** بدهد: نام جدید canonical می‌شود و نام قدیمی
یک alias با JSDoc `@deprecated` + `deprecate('ZEN-DEPR-0xx', …)` می‌شود
(DEC-026: حذف در ۲.۰).

```ts
// قبل: دو معنای متفاوت با یک نام
import { validate } from '@zenith/expressions'; // AST را برای sandbox بررسی می‌کند
import { validate } from '@zenith/schema';      // داده را با Schema بررسی می‌کند
// بعد:
import { validateAst } from '@zenith/expressions'; // ZEN-DEPR-049
import { validate } from '@zenith/schema';
```

**اجرا:** `npm run check:unique-exports` (`scripts/check-unique-export-names.mjs`)
روی AST سطح عمومی همهٔ پکیج‌ها؛ استثناها فقط با دلیل در
`scripts/unique-export-names.allowlist.json` (وضعیت‌های `same-meaning` /
`layered` / `convention`) ثبت می‌شوند و ردیف بی‌استفاده خطاست.

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

**اجرا:** `scripts/error-hygiene.mjs`؛ `scripts/positional-config-audit.mjs`
(`npm run check:positional-config`)؛ قاعدهٔ ESLint `zenith/options-object`؛
`@zenith/options-single-arg` و `@zenith/frozen-defaults` (#159).

### ۴.۱ پیکربندی positional ممنوع (#55)

هر تابع عمومی که بیش از یک ورودیِ **پیکربندی** دارد باید `fn(main, options?)`
باشد. امضاهای موجود که هنوز مهاجرت نکرده‌اند در
`scripts/positional-config.allowlist.json` دسته‌بندی و مستدل شده‌اند؛ امضای جدید
خارج از آن فهرست، گیت و lint را قرمز می‌کند (یخ‌زدگی + مهاجرت تدریجی).

| قبل (positional) | بعد (options object) | کد deprecation |
|---|---|---|
| `createSuspenseContext(timeoutMs, onSettle)` | `createSuspenseContext({ timeoutMs, onSettle })` | `ZEN-DEPR-065` |
| `processFetchWithCache(url, ttl)` | `processFetchWithCache(url, { ttl })` | `ZEN-DEPR-066` |
| `enterTransition(el, name, duration, onComplete)` | `enterTransition(el, { name, duration, onComplete })` | `ZEN-DEPR-002` |
| `leaveTransition(el, name, duration, onComplete)` | `leaveTransition(el, { name, duration, onComplete })` | `ZEN-DEPR-003` |
| `animateGroup(els, direction, name, duration, stagger)` | `animateGroup(els, { direction, name, duration, staggerDelay })` | `ZEN-DEPR-004` |
| `createMutation(fn, options)` / `createInfiniteQuery(key, fn, opts)` | `createMutation({ fn, ... })` / `createInfiniteQuery({ key, fn, ... })` | `ZEN-DEPR-035/036` |

هر overload قدیمی TSDoc `@deprecated` دارد و یک‌بار با `deprecate()` هشدار
می‌دهد؛ حذف در ۲.۰ (DEC-026).

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
| `setupSW` / `setupKillSwitchSW` | `setup*` | `install`/`start` | #118 |
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
| unique-export-names (#119) | `npm run check:unique-exports` | deps |
| positional-config (#55) | `npm run check:positional-config` | deps |
| options-object lint (#55) | `zenith/options-object` | lint |
| peer-rule | `npm run peer-rule` | deps |
| no-console ratchet | `scripts/test/no-console-ratchet.test.mjs` | unit |
| eslint-plugin قراردادها (#159) | `@zenith/eslint-plugin` rules | lint |

این سند **منبع واحد قرارداد API** است؛ هر قاعدهٔ جدید باید قبل از کد، اینجا با مثال و
کلید lint بنویسد و سپس در `@zenith/eslint-plugin` (#159) یا یک `scripts/*.mjs`
اجرا شود. گرامر attributeهای HTML و رویدادهای `CustomEvent` در سند خواهر
[ATTRIBUTE-GRAMMAR.md](./ATTRIBUTE-GRAMMAR.md) (#173) ثابت شده‌اند و با گیت
`scripts/attribute-grammar.mjs` به رجیستری `zenith.meta.json` قفل می‌شوند.

## پیشنهاد در انتظار پذیرش — محتوای owned و Menu مشترک (۲۰۲۶-۱۰-۱۷)

این بخش **قرارداد مصوب تازه محسوب نمی‌شود**؛ تغییرهای candidate در Core/UI را برای
بازبینی API و release ثبت می‌کند و نباید برای ادعای API-identical بودن #40 مصرف شود.

- `BindContext.skipChildren?(): void`: فقط descent خودکار همان bind را متوقف می‌کند؛
  دایرکتیوهای دیگر همان element و `processChildren` صریح برقرارند. تصمیم بین mountها
  ذخیره نمی‌شود. fixture مرجع: `runtime-core/test/owned-children.test.ts`.
- Tooltip با expression مالک presentation فرزندان و Text node مستقل است؛ fallback
  bind نمی‌شود و شاخهٔ arrow decorative/inert باقی می‌ماند. host بدون این قابلیت
  برای expression پیش از mutation با ZEN-1603 رد می‌شود، نه fallback ناامن/خاموش.
  Tooltip بدون expression محتوای authored و binding عادی را حفظ می‌کند.
- Menu مشترک فقط یک منبع config دارد؛ borrower می‌تواند گزینه را حذف کند، همان
  readable را بدهد یا concrete مطابق config فعلی بدهد. readable متفاوت/تعارض config
  با ZEN-1603 رد می‌شود. selector خراب/trigger متفاوت ZEN-1601 است. lease والد برای
  child ازپیش‌ساخته منبع child را عوض نمی‌کند؛ فقط child جدید از والد ارث می‌برد.
- role ثابت Tooltip/Menu در type و schema محدود به `tooltip`/`menu` است؛ role ناسازگار
  نباید پذیرفته و سپس نادیده گرفته شود. Popover عمومی همچنان role قابل تنظیم دارد.
- generation گزارش‌ها و اجرای fixtureهای این بخش تا فاز اعتبارسنجی نهایی انجام نشده
  است. سیاست remount/borrow و تنگ‌شدن type/API نیازمند پذیرش سازگاری است.

### Authored continuation: Form and unknown writable capabilities (unvalidated)

Canonical Form bags and bridges are proposed as:

| API | Canonical | Warning |
| --- | --- | --- |
| `validateField` | `(value, { rules, allValues })` | 095 |
| `validateFieldAsync` | `(value, { rules, allValues, signal })` | 096 |
| `validateFormAsync` | `({ values, rules, signal })` | 097 |
| `validateWithLifecycle` | `(values, { rules, lifecycle, async })` | 098 |
| `FormStore.moveItem` | `(field, { from, to })` | 099 |
| `FormStore.addField` | `({ name, initial, rules })` | 100 |

Old signatures remain deprecated and separately evaluated; canonical validation
must not accidentally validate/warn again through a positional overload.
Checking setter existence does not validate its input domain: the State guard
exposes only an unknown setter capability (`never` input), not a readable or
universally writable Signal. Known `Signal<T>` types retain typed writes. Native
runtime DOM/storage/hydration writes are explicit unchecked domain boundaries,
not response decoders. See the migration ledger for compatibility distinctions,
remaining work and the absence of any current-tree acceptance evidence.

### Owned reactive/Form lifecycle candidate (2026-10-18)

Ownership changes are behavior/source-contract changes even when implemented in
new private modules. Omitted owners inherit; explicit null detaches; disposed
owners cannot acquire live children. Scope entry restores the caller in `finally`;
late teardown must not restore an unrelated creation-time owner. Keep owner-bound
`onCleanup`, per-effect dependency cleanup, and per-watch callback cleanup distinct.
A lazy derived value must not invent `T` for an uninitialized placeholder or restart
a disposed owner. Form validators/autosave/submission use current-run leases before
state writes; arbitrary promise cancellation/domain decoding is not implied. New
Advanced/Wizard `dispose` and reset/navigation semantics require lifecycle/migration
review. All related runtime/type/export fixtures remain unrun.

### Factory data and rest-tuple review (candidate, 2026-10-18)

A default empty record is not a populated generic T. Factories must retain a real
initial value's field types, expose a dynamic/union result when dispatch cannot be
proven from static names, and return the API their overload actually advertises
(including empty collections). Callback callability checks do not decode callback
results or payload domains. Dirty comparison must not require JSON-serializable
application fields; conservative identity/bounded comparison behavior must be
recorded as a contract change, not a mechanical move.

Direct rest tuples and each union branch count as their actual positional inputs;
a single `...args` spelling does not evade the rule. Source/lint syntax inventories
cannot resolve imported/generic aliases; published declaration inspection remains
required. Expansion is bounded/fail-closed. A data-operand callback exemption must
be qualified and signature-bound, with an actual independent-operand rationale;
it cannot exempt new method overloads or extra configuration. State/Form protocol
leases and their negative fixtures are authored, not gate evidence.

### Internal self facades and native host capture (candidate, 2026-10-18)

An internal subpath has an explicit entry release level; a new subpath does not
magically remove legacy root exposure. Keep compatibility bridges until removal
is approved, classify their real origin, and do not relabel them public to clear a
gate. An independently built internal facade must reference the canonical package
owner rather than bundle another implementation/nominal declaration graph. The
State bridge uses the external self-specifier for both formats and declarations;
that is not proof of pre-existing mixed-format root constructor identity.

Owner/tracking context selection must agree. Host context binding is a synchronous,
argument/result/exception-preserving protocol that captures native async context
at registration. One snapshot of the first consumer of a shared request context
cannot stand in for per-registration snapshots. Pure State scopes never hold a
global synchronous override across a Promise. A Node renderer can keep a root
owner in its isolated native request store across awaits, and must retire that
owner before releasing request resources, including error/cancel/stream paths.
Explicit detached ownership and arbitrary user Promise side effects remain explicit
limits, not implicit cancellation guarantees. All new fixtures remain unrun.

### Diagnostic capability/host policy candidate (2026-10-18, unvalidated)

Inspection APIs may require a real readable capability without claiming a writable
nominal class. State naming observer accepts ReadonlySignal<T>; modern Core keeps
explicit generics with UntypedSignal<T>. Unknown defaults do not authorize setters
or arbitrary result casts. Getter/event capture is untracked, not side-effect-free.
Observer/listener registrations require identity-token cleanup, not callback-value
identity. Context diagnostic lifetime is host-owned, not the first observing child.
The new internal global-observation policy separates Node request-local legacy
inspection from realm-global observers. This changes contracts/defaults and belongs
in the proposed major migration, not the compatible-refactor category. Root bridges,
release peer floors and all final declaration/format gates remain unresolved.

### Diagnostic options and capability transport (candidate, 2026-10-18)

| API | Canonical options form | Deprecated code |
| --- | --- | --- |
| `RuntimeGraph.addSignal` / hook | `(id, { name, value })` | 101 |
| `RuntimeGraph.addDirective` / hook | `(id, { directiveType, elementSelector, expression })` | 102 |
| `recordPanelStateChange` | `(id, { oldValue, newValue, signalName })` | 103 |
| hook `addStaticFor` | `(id, { expr, itemCount })` | 104 |
| hook `recordResourceDestroy` | `(name, { url, stack })` | 105 |

Only each deprecated overload is exempt; the old panel's broad name waiver is
removed. Unknown raw oldValue objects are never treated as options by property
heuristics. Foreign hooks use native capability checks/receiver-preserving calls
with ignored results; a claimed interface or callback-result cast is not a decoder.
The internal walker uses protocol marker 2 for canonical metadata and preserves the
unmarked foreign positional transport. These type/default/lifecycle/retention
changes are proposed contracts, not #40 compatible-refactor evidence. New public
option types are explicitly tagged; internal holder/reset/policy types stay off
facades. Existing internal root bridges and peer-floor approvals remain open.
All associated fixtures are authored, unrun and uncompiled.
