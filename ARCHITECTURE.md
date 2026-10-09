# معماری Zenith v1.4.0

این سند ساختار داخلی، پکیج‌ها، وابستگی‌ها و گزینه‌های (options) هر پکیج را شرح می‌دهد.
همهٔ اعداد و جدول‌ها از کد مخزن استخراج شده‌اند. بخش‌های «مشکلات و پیشنهاد» تحلیل‌اند و نه واقعیت مستند.

- مخزن: monorepo با npm workspaces (`packages/*`)، ۳۶ پوشه، ۳۵ بستهٔ دارای `package.json`
- حدود ۳۸ هزار خط TypeScript در `src` (`ES2022`، `strict`)
- خروجی هر پکیج: ESM (`dist/index.js`)، CJS (`dist/index.cjs`)، `dist/index.d.ts`
- نسخهٔ همهٔ پکیج‌ها `1.4.0` (lockstep) و لایسنس اعلام‌شده `MIT`

---

## ۱. نمای کلی لایه‌ها

```
                ┌───────────────────────── ابزار (Tooling) ─────────────────────────┐
                │ cli · vite-plugin · compiler · dependency-graph · vscode-extension │
                │ devtools-extension                                                 │
                └───────────────────────────────────────────────────────────────────┘

L4  ویژگی‌های سطح‌بالا   crud · stateful · devtools · service-worker · testing
L3  رانتایم DOM / SSR      runtime · ssr
L2  سرویس‌ها و ویژگی‌ها     router · events · components · resource · data · http · actions
                           auth · permission · store · form · notifications
                           error-boundary · suspense · transition · virtual-list · data-table
L1  هستهٔ reactive         state · expressions
L0  بنیاد (بدون وابستگی)    scheduler · errors · security · i18n
```

قاعدهٔ مطلوب: هر لایه فقط به لایه‌های پایین‌تر وابسته باشد. وضعیت فعلی در بخش ۴ آمده است.

---

## ۲. فهرست پکیج‌ها

ستون «فایل/خط» اندازهٔ `src` است. «وابستگی» فقط `@zenith/*` است. `peer:` یعنی peerDependency.

| پکیج | لایه | فایل/خط | وابستگی‌های `@zenith` | نقش |
|---|---|---|---|---|
| `scheduler` | L0 | ۲ / ۴۱۳ | — | زمان‌بند microtask و batching effectها |
| `errors` | L0 | ۱ / ۶۷۸ | — | کلاس `ZenithError` و کدهای ZEN-001..999 |
| `security` | L0 | ۳ / ۸۰۰ | — | sanitizer، CSP، TrustedTypes |
| `i18n` | L0 | ۱ / ۲۳۸ | — | ارقام فارسی/عربی، تقویم جلالی، قالب عدد و قیمت |
| `state` | L1 | ۱۰ / ۱۶۱۳ | scheduler | signal / computed / effect |
| `expressions` | L1 | ۸ / ۱۹۸۶ | errors | parser و evaluator امن عبارت‌ها (بدون `eval`) |
| `dependency-graph` | L1 | ۲ / ۲۳۶ | expressions | استخراج وابستگی signalها از عبارت‌ها |
| `http` | L2 | ۲ / ۴۱۶ | peer: state | کلاینت HTTP با interceptor، retry، cache |
| `actions` | L2 | ۲ / ۴۶۰ | — | رجیستری actionها برای `zen-action` |
| `error-boundary` | L2 | ۳ / ۲۷۹ | state | مرز خطا و handler سراسری |
| `notifications` | L2 | ۲ / ۳۰۹ | peer: state | toast، alert، confirm |
| `router` | L2 | ۳ / ۹۳۷ | state | مسیریابی SPA با History API |
| `resource` | L2 | ۳ / ۹۳۶ | errors, expressions, state | دریافت داده با cache و dedup (شبیه TanStack Query) |
| `data` | L2 | ۲ / ۴۹۶ | state, expressions | دایرکتیو `zen-fetch` |
| `auth` | L2 | ۲ / ۱۳۳۱ | state, scheduler*, http* | ورود/خروج، توکن، refresh خودکار |
| `permission` | L2 | ۳ / ۶۶۰ | router, security, state | RBAC و `zen-permission` |
| `store` | L2 | ۲ / ۴۵۵ | state | store سراسری شبیه Pinia |
| `form` | L2 | ۴ / ۱۶۹۶ | state (peer و dependency) | فرم و اعتبارسنجی |
| `events` | L2 | ۴ / ۱۱۷۱ | actions, error-boundary, expressions, router, scheduler, state | event delegation |
| `components` | L2 | ۴ / ۱۲۰۹ | expressions | کامپوننت Light DOM، props، slots |
| `suspense` | L2 | ۲ / ۵۷۰ | error-boundary, expressions*, state | ردگیری promise و حالت loading |
| `transition` | L2 | ۳ / ۹۰۹ | — | انیمیشن enter/leave |
| `virtual-list` | L2 | ۳ / ۸۷۲ | state, expressions | لیست مجازی |
| `data-table` | L2 | ۲ / ۶۸۷ | state | جدول reactive |
| `runtime` | L3 | ۲۵ / ۶۷۰۵ | ۱۸ پکیج (جدول بخش ۴) | walker، directiveها، hydrate، شیء `Zen` |
| `ssr` | L3 | ۵ / ۱۴۸۷ | errors, router*, runtime*, scheduler, state; peer: jsdom | رندر سرور و استریم |
| `crud` | L4 | ۳ / ۱۴۰۲ | actions, permission, resource, runtime, state | موتور CRUD |
| `stateful` | L4 | ۴ / ۱۰۲۴ | runtime, resource, state, auth, actions, expressions* | کامپوننت‌های loading/error/empty |
| `devtools` | L4 | ۴ / ۱۱۱۶ | state, components | hook برای افزونهٔ مرورگر |
| `service-worker` | L4 | ۳ / ۱۴۴۸ | runtime | استراتژی‌های cache و sync |
| `testing` | L4 | ۲ / ۳۴۸ | peer: state, scheduler, runtime* | ابزار تست |
| `compiler` | tooling | ۳ / ۱۱۲۵ | dependency-graph, expressions* | پیش‌کامپایل قالب‌ها |
| `vite-plugin` | tooling | ۲ / ۸۵۷ | compiler, expressions, runtime, security, state; peer: vite | HMR و تزریق devtools |
| `cli` | tooling | ۴ / ۱۹۸۱ | expressions, runtime, state, vite-plugin | scaffold، `check`، lighthouse |
| `vscode-extension` | tooling | ۱ / ۱۰۹۷ | runtime | پشتیبانی زبان |
| `devtools-extension` | tooling | بدون `package.json` | — | افزونهٔ مرورگر (JS ساده) |

\* وابستگی اعلام‌شده که در `src` استفاده نمی‌شود (بخش ۴).

---

## ۳. ساختار داخلی پکیج‌های مهم

### `runtime` (هستهٔ DOM)
```
src/
  index.ts          شیء Zen، ZenStartOptions، re-export پکیج‌ها (۱۲۳۶ خط)
  walker.ts         پیمایش DOM و اتصال directiveها (۹۹۶ خط)
  context.ts        Context رندر
  attributes.ts     پارس attributeهای zen-*
  hydrate.ts        hydration
  parity-check.ts   مقایسهٔ SSR و کلاینت
  directives/       bind cloak date-picker for html html-trusted if intersection
                    island memo model optimistic portal ref show stateful-button
                    text track virtual-repeat
```

### `state`
signal، computed، effect، batch و owner/context. `scheduler` را برای batching خودکار به کار می‌گیرد. به DOM وابسته نیست.

### `expressions`
`parser` → AST → `validator` (لیست سیاه شناسه‌ها از `security-constants`) → `evaluator`، با `cache` (حداکثر ۵۰۰ ورودی). هیچ `eval`/`new Function` ندارد.

### `compiler` و `vite-plugin`
`compiler` قالب HTML را به تابع رندر JS تبدیل می‌کند (`strict` برای خطا روی directive ناشناخته). `vite-plugin` آن را با `include/exclude` به Vite وصل می‌کند.

### `ssr`
`render.ts` (رشته و استریم)، `hydrate.ts`، `dom-context.ts` (ایزولاسیون هر درخواست با `AsyncLocalStorage`)، `server-component.ts`. `jsdom` peer است.

### `virtual-list`، `suspense`، `transition` (دو لایهٔ موازی)
| پکیج | API جدید | API قدیمی |
|---|---|---|
| `virtual-list` | `controller.ts` — `createVirtualList` | `virtual-list.ts` — `processVirtualList` |
| `transition` | `transition.ts` — controllerهای قابل‌استفادهٔ مجدد | `animate.ts` — WAAPI |
| `suspense` | `suspense.ts` — `track()` و context | — |

---

## ۴. وابستگی‌ها: مشکلات و پیشنهاد

گراف وابستگی (با dev/peer) **چرخه ندارد**.

### ۴.۱ وابستگی‌های بلااستفاده (اعلام‌شده و import نشده)
| پکیج | بلااستفاده |
|---|---|
| `auth` | `scheduler`، `http` |
| `compiler` | `expressions` |
| `ssr` | `router`، `runtime` |
| `stateful` | `expressions` |
| `suspense` | `expressions` |
| `form` | `scheduler` (dev) |
| `permission` | `scheduler` (dev) |
| `store` | `scheduler` (dev) |
| `expressions` | `state` (dev) |
| `testing` | `runtime` (peer) |
| `runtime` | `permission`، `store`، `form` (dev) |

### ۴.۲ جهت‌های وابستگی نامناسب (تحلیل)
- `service-worker` → `runtime`: SW در context بدون DOM اجرا می‌شود.
- `events` → `router`، `error-boundary`؛ `permission` → `router`: ویژگی به ویژگی.
- `crud`، `stateful` → `runtime`: باید به هستهٔ کوچک وابسته باشند، نه بستهٔ جامع.
- `devtools` → `components`.
- `runtime` به ۱۸ پکیج وابسته است: `actions, auth, components, data, devtools, error-boundary, errors, events, expressions, i18n, notifications, resource, router, scheduler, security, state, suspense, transition`.

### ۴.۳ ناهماهنگی peer و dependency برای `state`
`form`، `http`، `notifications`، `testing` آن را peer می‌گیرند. `auth`، `data`، `store`، `router`، `resource`، `suspense`، … مستقیم dependency دارند. اگر نسخه‌ها از هم جدا شوند دو signal graph مستقل ساخته می‌شود. **قاعده:** پکیج‌هایی که نمونهٔ مشترک (singleton) دارند (`state`، `scheduler`) همیشه peer باشند.

---

## ۵. رابط عمومی (API) و مرزها

- فقط `exports["."]` تعریف شده؛ زیرمسیر یا `./package.json` نیست.
- `index.ts` ها بیشتر export انبوه دارند (`runtime` ۳۵ مورد، `errors` ۲۰، `expressions` ۱۴)؛ مرز عمومی/داخلی علامت‌گذاری نشده است.
- نام تکراری: `CompileOptions` در `compiler` (فقط `strict`) و در `vite-plugin` (`enabled`، `include`، `exclude`، `strict`) دو نوع متفاوتاند.
- جفت‌های مبهم: `VirtualListConfig` / `VirtualListOptions<T>`، و `FormOptions` / `AdvancedFormOptions`.
- نام‌گذاری: `createX`، `defineX`، `processX`، `initX`، `installX` بدون قرارداد.

---

## ۶. مرجع گزینه‌ها (Options) به تفکیک پکیج

`?` یعنی اختیاری. «پیش‌فرض» فقط وقتی آمده که در کد دیده شده؛ در غیر این صورت `—`.

### `runtime` — `ZenStartOptions`
| گزینه | نوع | پیش‌فرض | توضیح |
|---|---|---|---|
| `devtools?` | `boolean` | — | فعال‌سازی hook ابزار توسعه |
| `delegationRoot?` | `Document \| ShadowRoot \| HTMLElement` | — | ریشهٔ event delegation |
| `ssr?` | `{ preloadState?, validateHydration? }` | — | تنظیمات hydration |
| `onError?` | `ErrorHandler` | — | handler خطای سراسری |
| `strictParity?` | `boolean` | — | سخت‌گیری مقایسهٔ SSR و کلاینت |

### `auth` — `AuthConfig`
| گزینه | نوع | پیش‌فرض |
|---|---|---|
| `loginUrl` | `string` (اجباری) | — |
| `logoutUrl?`، `refreshUrl?`، `meUrl?` | `string` | — |
| `tokenStorage?` | `'localStorage' \| 'sessionStorage' \| 'cookie' \| 'memory'` | `'memory'` |
| `tokenKey?`، `refreshTokenKey?` | `string` | — |
| `autoRefresh?` | `boolean` | — |
| `refreshThreshold?` | `number` (ثانیه پیش از انقضا) | — |
| `tokenField?`، `refreshTokenField?`، `userField?`، `expiresInField?` | `string` | — |
| `headers?` | `Record<string,string>` | — |

`FunctionalAuthConfig`: `endpoints?`، `storageKey?`، `autoRefresh?`، `loginRedirect?`، `logoutRedirect?`، `loginPath?`.

### `http` — `HttpRequestOptions` (extends `Omit<RequestInit,'cache'>`)
| گزینه | نوع | پیش‌فرض |
|---|---|---|
| `baseURL?` | `string` | — |
| `timeout?` | `number` (ms) | `30000` |
| `retry?` | `RetryConfig` | `maxAttempts 3`، `initialDelay 500`، `backoffMultiplier 2` |
| `cache?` | `CacheConfig` (`enabled?`، `ttl?`، `key?`) | `ttl 60000` |
| `tags?` | `string[]` | — |
| `skipInterceptors?` | `boolean` | — |

`RetryConfig`: `maxAttempts?`، `initialDelay?`، `backoffMultiplier?`، `retryOn?: number[]`.

### `resource` — `ResourceConfig`
`url` (اجباری)، `staleTime?` (۶۰۰۰۰)، `retryCount?` (۳)، `retryDelay?` (۱۰۰۰)، `optimistic?`، `headers?`، `credentials?`، `swCacheName?`.

### `router` — `NavigateOptions`
`replace?: boolean`. پیش‌فرض stale time در outlet: ۵ دقیقه.

### `form`
- `FormOptions<T>`: `initialValues?`، `validation?`، `onSubmit?`
- `AdvancedFormOptions<T>`: `initialValues` (اجباری)، `validate?`، `validateForm?`، `schema?`، `onSubmit?`، `autoSave?`، `validateOnChange?`، `validateOnBlur?`؛ debounce پیش‌فرض ۳۰۰ms

### `crud` — `CrudEngineConfig`
`resource`، `columns` (اجباری)، `searchFields?`، `filters?`، `pageSize?` (۱۰)، `searchable?`، `rowActions?`، `tableActions?`، `permission?`.

### `data-table` — `DataTableOptions<T>`
`columns` (اجباری)، `data?`، `rowKey?`، `pagination?`، `sorting?`، `filtering?`، `selection?`، `editing?`، `columnGroups?`.

### `virtual-list`
- `VirtualListOptions<T>` (API جدید): `items`، `itemSize`، `container`، `renderItem` (اجباری)؛ `overscan?` (۵)، `direction?`، `getItemKey?`، `onScroll?`، `onVisibleRangeChange?`
- `VirtualListConfig` (API قدیمی): `itemHeight`، `buffer`، `dynamicHeights`، `direction`، `animateMount`، `animateUnmount`

### `suspense` — `SuspenseOptions`
`timeout?` (۰ یعنی بدون محدودیت)، `minDelay?`، `onTimeout?`.

### `transition` — `TransitionOptions`
`duration?` (۳۰۰)، `name?`، `classes?`، `onComplete?`، `onBeforeEnter?`، `onAfterEnter?`، `onBeforeLeave?`، `onAfterLeave?`.

### `components` — `ComponentCacheConfig`
`ttl` (۵ دقیقه)، `maxSize` (۶۴).

### `notifications`
- `NotifyOptions`: `type?` (`'info'`)، `title?`، `duration?` (۴۰۰۰)، `position?` (`'top-right'`)، `persistent?`، `actions?`
- `ConfirmOptions`: `message`، `title?`، `confirmText?`، `cancelText?`، `type?`
- `AlertOptions`: `message`، `title?`، `type?`، `closeText?`

### `security`
- `SanitizeOptions`: `allowTags?`، `forbidTags?`، `allowForms?`
- `CSPOptions`: `allowInlineScript?`، `allowInlineStyle?`، `nonce?`، `extraScriptSrc?`، `extraStyleSrc?`، `extraImgSrc?`، `allowWebSockets?`

### `service-worker`
- `SWConfig`: `routes`، `precache` (اجباری)؛ `swUrl?`، `scope?`، `defaultStrategy?`، `skipWaiting?` (false)، `clientsClaim?`
- `RouteConfig`: `urlPattern`، `strategy` (اجباری)؛ `method?`، `cacheName?`، `timeout?`
- `RegisterSWOptions`: `scope?`، `onUpdateFound?`، `onControllerChange?`، `onError?`
- `SWRuntimeConfig` (داخل SW): `precache`، `routes`؛ `defaultCacheName?`، `cachePrefix?`، `defaultStrategy?`، `backgroundSyncQueueName?`، `skipWaiting?`، `clientsClaim?`

### `ssr` — `StreamOptions`
`route?`، `head?`، `signal?: AbortSignal`.

### `events` — `InitEventDelegationOptions`
`root?: DelegationRoot`.

### `compiler` / `vite-plugin`
- `compiler.CompileOptions`: `strict?`
- `vite-plugin.ZenithPluginOptions`: `watchPatterns?`، `autoInjectDevtools?`، `enableHtmlHMR?`، `compile?`
- `vite-plugin.CompileOptions`: `enabled?`، `include?`، `exclude?`، `strict?`

### `cli` — `LighthouseOptions`
`port?`، `ci?`، `minScore?`، `chromePath?`، `verbose?`.

### بدون options صریح
`actions`، `data`، `dependency-graph`، `devtools`، `error-boundary`، `errors`، `expressions`، `i18n`، `permission`، `scheduler`، `state`، `stateful`، `store`، `testing`.
`state` فقط `EffectOptions` دارد.

---

## ۷. وضعیت سراسری و ایزولاسیون

- حدود ۴۲ متغیر سطح ماژول و ۴۴ دسترسی `as any` به `window`/`globalThis`.
- نشانه‌های سراسری: `__ZENITH_DEV__`، `__ZENITH_CONTEXT__`، `__zenCleanupHandlers` و …
- singletonها: scheduler، router، error handler، cache عبارت‌ها.
- ایزولاسیون SSR با `AsyncLocalStorage` (`process.getBuiltinModule`، Node ≥ 18.19).

پیامدها (تحلیل): دو برنامه در یک صفحه تداخل می‌کنند؛ تست‌ها باید وضعیت را reset کنند؛ محیط‌هایی بدون `AsyncLocalStorage` (بعضی Edge runtimeها) ایزولاسیون ندارند.

---

## ۸. Build و بسته‌بندی

- `scripts/build-all.mjs`: ترتیب بر اساس گراف وابستگی (`scripts/package-order.mjs`)، سپس `esbuild` (bundle) و `tsc` (declaration).
- `cli`، `ssr`، `vite-plugin` با `platform: 'node'`، بقیه `neutral`؛ همهٔ peerDependencyها external.
- `scripts/typecheck-all.mjs`، `scripts/collect-artifacts.mjs`، `scripts/build-browser-bundle.mjs` (باندل مرورگری)، `scripts/release.mjs` (publish).
- CI: `.github/workflows/main.yml` (build ماتریس Node 18/22) و `bundle.yml`.

---

## ۹. معماری هدف (پیشنهاد)

1. **لایه‌بندی اجباری:** قوانین `dependency-cruiser` برای جلوگیری از وابستگی رو به بالا.
2. **تقسیم `runtime`:** `runtime-core` (walker، directiveهای پایه، hydrate) + directiveهای اختیاری + بستهٔ `zenith` (umbrella).
3. **`service-worker` مستقل:** بدون وابستگی به `runtime`.
4. **قاعدهٔ peer:** `state` و `scheduler` همه‌جا peer.
5. **حذف وابستگی‌های بلااستفاده** (بخش ۴.۱).
6. **یک API برای هر قابلیت:** `virtual-list`، `transition` را روی API جدید یکی کنید و قدیمی را deprecate کنید.
7. **`createApp()`:** نگهداری همهٔ وضعیت در یک context صریح؛ singleton فعلی فقط نمونهٔ پیش‌فرض.
8. **اعتبارسنجی گزینه‌ها:** schema برای `AuthConfig`، `HttpRequestOptions`، `SWConfig`، `ZenithPluginOptions`، `ZenStartOptions`، با پیام خطای ZEN-xxx.
9. **API عمومی رسمی:** TSDoc با `@public/@internal`، `api-extractor` و snapshot در CI، `exports` شرطی (`development`/`production`، `browser`/`node`/`worker`).
10. **پکیج‌های ابزار** (`vscode-extension`، `devtools-extension`) به `tools/` منتقل شوند.
