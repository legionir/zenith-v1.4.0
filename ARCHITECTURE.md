# معماری Zenith v1.4.0

این سند ساختار داخلی، پکیج‌ها، وابستگی‌ها و گزینه‌های (options) هر پکیج را شرح می‌دهد.
همهٔ اعداد و جدول‌ها از کد مخزن استخراج شده‌اند. بخش‌های «مشکلات و پیشنهاد» تحلیل‌اند و نه واقعیت مستند.

- مخزن: monorepo با npm workspaces (`packages/*`)، ۴۱ پوشه، ۴۰ بستهٔ دارای `package.json`
- حدود ۳۸ هزار خط TypeScript در `src` (`ES2022`، `strict`)
- خروجی هر پکیج: ESM (`dist/index.js`)، CJS (`dist/index.cjs`)، `dist/index.d.ts`؛
  پکیج‌های جدید موج ۲ (`shared` #141، `logger` #143) ESM-only هستند (DEC-027)
- نسخهٔ پکیج‌های موجود `1.4.0` (lockstep)؛ متولدهای موج ۲ از `1.5.0` (DEC-026)؛
  لایسنس اعلام‌شده `MIT`

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
L0  بنیاد (بدون وابستگی)    scheduler · errors · security · i18n · jalali · schema · shared · logger · cache
```

قاعدهٔ مطلوب: هر لایه فقط به لایه‌های پایین‌تر وابسته باشد. وضعیت فعلی در بخش ۴ آمده است.

---

## ۲. فهرست پکیج‌ها

ستون «فایل/خط» اندازهٔ `src` است. «وابستگی» فقط `@zenith/*` است. `peer:` یعنی peerDependency.

| پکیج | لایه | فایل/خط | وابستگی‌های `@zenith` | نقش |
|---|---|---|---|---|
| `scheduler` | L0 | ۲ / ۴۱۳ | — | زمان‌بند microtask و batching effectها |
| `errors` | L0 | ۱ / ۶۷۸ | — | کلاس `ZenithError`، کدهای ZEN-001..999 + بازه‌های ۴رقمی/DEPR (#171) |
| `shared` | L0 | ۷ / ۴۲۰ | errors | نوع‌ها/ابزارهای مشترک L0 (#141، DEC-021): Disposable/Cleanup، `Readable` ساختاری، mergeOptions امن، پارسر attribute، createId/secureId، invariant ZEN-1090 |
| `security` | L0 | ۳ / ۸۰۰ | errors | sanitizer، CSP، TrustedTypes |
| `logger` | L0 | ۹ / ۶۲۳ | errors, shared | لاگر مرکزی SPEC §۲.۳ (#143): createLogger/child/redact، consoleSink·bufferSink·beaconSink، warnOnce/deprecate (ZEN-DEPR)، محافظ sink خراب ZEN-1091؛ تنها مرز console ورک‌اسپیس |
| `cache` | L0 | ۵ / ۷۳۱ | errors, shared | کش مشترک SPEC §۲.۴ (#144): createCache با TTL/SWR/tags/LRU-FIFO/maxBytes، getOrLoad با dedupe، رجیستری listCaches، signal با adapter تزریقی (DEC-021)؛ تنها پیاده‌سازی cache ورک‌اسپیس |
| `jalali` | L0 | ۵ / ۷۶۹ | errors, shared | تقویم جلالی SPEC §۲.۶ (#146، DEC-028): هستۀ Borkowski (چرخهٔ ۳۳‌ساله؛ تساوی با Intl در ۱۲۰۱..۱۵۰۰)، toJalaliParts/fromJalaliParts/formatJalali/parseJalali/add*/diffDays/isLeap/monthDays/نام‌ها/ارقام؛ timeZone صریح (UTC پیش‌فرض — قطعی در SSR)؛ ZEN-1301/1302/1303؛ ESM-only 1.5.0 (DEC-026/027) |
| `schema` | L0 | ۷ / ۱۰۲۱ | errors, shared | اعتبارسنجی گزینه‌ها SPEC §۲.۲ (#142، DEC-029): سازندهٔ `s.*`، validate/safeValidate/defineOptions/parseConfigAttr، ZEN-1001/1002/1003/1004؛ warn بدون console با reporter تزریق‌شده؛ زیرمسیرهای /zod (دونگی) و /json-schema (toJsonSchema/fromJsonSchema — Draft 2020-12)؛ متادیتای directive و zenith.meta.json/html.customData.json؛ ESM-only 1.5.0 |
| `i18n` | L0 | ۱ / ۳۰۱ | errors, jalali | ارقام فارسی/عربی، قالب عدد و قیمت؛ alias سازگار تقویم جلالی با ZEN-DEPR-006..015 (#146؛ حذف در 2.0) |
| `state` | L1 | ۱۰ / ۱۶۱۳ | scheduler | signal / computed / effect |
| `expressions` | L1 | ۸ / ۱۹۸۶ | errors, cache | parser و evaluator امن عبارت‌ها (بدون `eval`) |
| `dependency-graph` | L1 | ۲ / ۲۳۶ | expressions | استخراج وابستگی signalها از عبارت‌ها |
| `http` | L2 | ۲ / ۴۱۶ | cache, errors; peer: state | کلاینت HTTP با interceptor، retry، cache |
| `actions` | L2 | ۲ / ۴۶۰ | — | رجیستری actionها برای `zen-action` |
| `error-boundary` | L2 | ۳ / ۲۷۹ | peer: state | مرز خطا و handler سراسری |
| `notifications` | L2 | ۲ / ۳۰۹ | peer: state | toast، alert، confirm |
| `router` | L2 | ۳ / ۹۳۷ | cache; peer: state | مسیریابی SPA با History API |
| `resource` | L2 | ۳ / ۹۳۶ | cache, errors, expressions; peer: state | دریافت داده با cache و dedup (شبیه TanStack Query) |
| `data` | L2 | ۲ / ۴۹۶ | cache, expressions; peer: state | دایرکتیو `zen-fetch` |
| `auth` | L2 | ۲ / ۱۳۳۱ | http (dynamic); peer: state | ورود/خروج، توکن، refresh خودکار |
| `permission` | L2 | ۳ / ۶۶۰ | security; peer: state | RBAC و `zen-permission` |
| `store` | L2 | ۲ / ۴۵۵ | peer: state | store سراسری شبیه Pinia |
| `form` | L2 | ۴ / ۱۸۵۷ | errors, schema, peer: state | فرم و اعتبارسنجی؛ adapters سه‌گانهٔ schema از #142 deprecated (ZEN-DEPR-016..018) و delegate به @zenith/schema |
| `events` | L2 | ۴ / ۱۱۷۱ | actions, error-boundary, expressions, router; peer: state, scheduler | event delegation |
| `components` | L2 | ۴ / ۱۲۰۹ | cache, expressions | کامپوننت Light DOM، props، slots |
| `suspense` | L2 | ۲ / ۵۷۰ | error-boundary, security; peer: state | ردگیری promise و حالت loading |
| `transition` | L2 | ۳ / ۹۰۹ | errors | انیمیشن enter/leave (API مبنا: `createTransition`) |
| `virtual-list` | L2 | ۳ / ۸۷۲ | errors, expressions; peer: state | لیست مجازی (API مبنا: `createVirtualList`) |
| `data-table` | L2 | ۲ / ۶۸۷ | peer: state | جدول reactive |
| `runtime` | L3 | ۲۵ / ۶۷۰۵ | ۱۶ پکیج (بخش ۴) + peer: state, scheduler | walker، directiveها، hydrate، شیء `Zen` |
| `ssr` | L3 | ۵ / ۱۴۸۷ | errors, router (dynamic), runtime (dynamic); peer: state, scheduler, jsdom | رندر سرور و استریم |
| `crud` | L4 | ۳ / ۱۴۰۲ | actions, permission, resource, runtime; peer: state | موتور CRUD |
| `stateful` | L4 | ۴ / ۱۰۲۴ | runtime, resource, auth, actions; peer: state | کامپوننت‌های loading/error/empty |
| `devtools` | L4 | ۴ / ۱۱۱۶ | components; peer: state | hook برای افزونهٔ مرورگر |
| `service-worker` | L4 | ۳ / ۱۴۴۸ | — | استراتژی‌های cache و sync |
| `testing` | L4 | ۲ / ۳۴۸ | peer: state, scheduler | ابزار تست |
| `compiler` | tooling | ۳ / ۱۱۲۵ | dependency-graph | پیش‌کامپایل قالب‌ها |
| `vite-plugin` | tooling | ۲ / ۸۵۷ | compiler, expressions, runtime, security; peer: state, vite | HMR و تزریق devtools |
| `cli` | tooling | ۴ / ۱۹۸۱ | expressions, runtime, vite-plugin; peer: state | scaffold، `check`، lighthouse |
| `vscode-extension` | tooling | ۱ / ۱۰۹۷ | runtime | پشتیبانی زبان |
| `devtools-extension` | tooling | بدون `package.json` | — | افزونهٔ مرورگر (JS ساده) |

state/scheduler همیشه `peer`اند (قاعدهٔ singleton — بخش ۴.۳). `http` در `auth` و
`router`/`runtime` در `ssr` با dynamic `import()` وارد می‌شوند و dependency واقعی‌اند.

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

### `virtual-list`، `suspense`، `transition` (یک API — رفع‌شده در #47)
| پکیج | API مبنا | لایهٔ سازگار (wrapper + ZEN-DEPR) |
|---|---|---|
| `virtual-list` | `controller.ts` — `createVirtualList` | `virtual-list.ts` — `processVirtualList` (ZEN-DEPR-001) |
| `transition` | `transition.ts` — `createTransition` (کلاس‌محور) | `enterTransition`/`leaveTransition`/`animateGroup` (ZEN-DEPR-002/003/004)؛ `animate.ts` (`zenAnimate`/`zen-animate`) قابلیت مجزای WAAPI است، نه پیاده‌سازی موازی |
| `suspense` | `suspense.ts` — `createSuspenseContext` (هستهٔ واحد) | `createSuspense` و `processSuspense` هر دو روی همان context |

دو حلقهٔ مجازی‌سازی و چهار موتور transition به یک مسیر تقلیل یافت؛ قدیمی‌ها فقط wrapperند و در dev یک‌بار هشدار `ZEN-DEPR-xxx` می‌دهند (حذف در major بعدی طبق #58). مصرف‌کنندهٔ داخلی (`runtime/directives/if.ts`) به `createTransition` مهاجرت کرد تا هشدار deprecation در برنامهٔ کاربر ظاهر نشود. جزئیات: `docs/decisions/DEC-019-*.md`.

---

## ۴. وابستگی‌ها: مشکلات و پیشنهاد

گراف وابستگی (با dev/peer) **چرخه ندارد**.

### ۴.۱ وابستگی‌های بلااستفاده (اعلام‌شده و import نشده) — رفع‌شده در #45
بررسی مجدد (grep + `scripts/unused-zenith-deps.mjs`، در CI اجباری):

| پکیج | وضعیت |
|---|---|
| `auth` | `scheduler` حذف شد؛ `http` **استفاده می‌شود** (dynamic `import()` در API کاربردی) — نگه داشته شد |
| `compiler` | `expressions` حذف شد (فقط ارجاع کامنت بود) |
| `ssr` | `router`/`runtime` **استفاده می‌شوند** (dynamic import در render/hydrate) — نگه داشته شدند |
| `stateful` | `expressions` حذف شد |
| `suspense` | `expressions` حذف شد |
| `form` | `scheduler` (dev) حذف شد |
| `permission` | `scheduler` (dev) و `router` (فقط کامنت JSDoc) حذف شد |
| `store` | `scheduler` (dev) حذف شد |
| `expressions` | `state` (dev) حذف شد |
| `testing` | `runtime` (peer) حذف شد (`scheduler`/`state` واقعاً import می‌شوند) |
| `runtime` | `permission`، `store`، `form` (dev) حذف شد |
| `service-worker` | `runtime` حذف شد (اضافه بر جدول اصلی — فقط کامنت بود) |

### ۴.۲ جهت‌های وابستگی نامناسب (تحلیل)
- `service-worker` → `runtime`: SW در context بدون DOM اجرا می‌شود.
- `events` → `router`، `error-boundary`؛ `permission` → `router`: ویژگی به ویژگی.
- `crud`، `stateful` → `runtime`: باید به هستهٔ کوچک وابسته باشند، نه بستهٔ جامع.
- `devtools` → `components`.
- `runtime` به ۱۸ پکیج وابسته است: `actions, auth, components, data, devtools, error-boundary, errors, events, expressions, jalali, notifications, resource, router, scheduler, security, state, suspense, transition` (#146: `i18n` با `jalali` جایگزین شد — date-picker روی API مبنا).

### ۴.۳ قاعدهٔ peer برای singletonهای `state`/`scheduler` — اعمال‌شده در #46
پیش‌تر `form`/`http`/`notifications`/`testing` آن را peer می‌گرفتند ولی `auth`،
`data`، `store`، `router`، `resource`، `suspense`، … مستقیم dependency داشتند؛
جداسازی نسخه دو signal graph مستقل می‌ساخت و reactivity را می‌شکست.

**قاعدهٔ اجرایی (CI: `npm run peer-rule` + job `peer-single-instance`):**
هر پکیجی جز خودِ `state`/`scheduler` باید این دو را **فقط** به‌صورت
`peerDependencies` با بازهٔ caret (`^1.4.0`) بگیرد و هرگز در `dependencies`.
تنها استثنای runtime لبهٔ `state → scheduler` است (هستهٔ پایین‌تر؛ DEC-018).
اگر `src/` پکیجی state/scheduler را import کند ولی هیچ peer/dependency برای آن
اعلام نشده باشد، peer-rule خطا می‌دهد.

`scripts/peer-single-instance.mjs` با `npm pack` روی state/scheduler + store + form
و نصب در پروژهٔ موقت اثبات می‌کند دقیقاً **یک** کپی از هر singleton در درخت
node_modules حاصل می‌شود و یک getter store به signal بیرونی (همان نمونهٔ state)
واکنش نشان می‌دهد.

---

## ۵. رابط عمومی (API) و مرزها

- فقط `exports["."]` تعریف شده؛ زیرمسیر یا `./package.json` نیست.
- `index.ts` ها بیشتر export انبوه دارند (`runtime` ۳۵ مورد، `errors` ۲۰، `expressions` ۱۴)؛ مرز عمومی/داخلی علامت‌گذاری نشده است.
- نام تکراری: `CompileOptions` در `compiler` (فقط `strict`) و در `vite-plugin` (`enabled`، `include`، `exclude`، `strict`) دو نوع متفاوتاند.
- جفت‌های مبهم: `VirtualListConfig`/`VirtualListOptions<T>` در #47 یکی شد (پل نوعی + helper ترجمهٔ واحد؛ config منسوخ است)؛ `FormOptions` / `AdvancedFormOptions` باقی مانده (#55/#52).
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
- `VirtualListOptions<T>` (API مبنا): `items`، `itemSize`، `container`، `renderItem` (اجباری)؛ `overscan?` (۵)، `direction?`، `getItemKey?`، `onScroll?`، `onVisibleRangeChange?`، `onNodeRemoved?`/`onItemUpdated?` (hookهای #47)
- `VirtualListConfig` (API قدیمی، منسوخ): `itemHeight`، `buffer`، `dynamicHeights`، `direction`، `animateMount`، `animateUnmount` — پس از #47 ساختار مستقل نیست: فیلدهای مشترک با پل نوعی به `VirtualListOptions` قفل‌اند و تنها مسیر ترجمه `virtualListConfigToOptions` است (که خودِ wrapper دایرکتیو هم از آن عبور می‌کند)؛ `dynamicHeights`/`animate*` فقط در wrapper مصرف می‌شوند.

### `suspense` — `SuspenseOptions`
`timeout?` (۰ یعنی بدون محدودیت)، `minDelay?`، `onTimeout?`.

### `jalali` — `JalaliOptions` (SPEC §۲.۶، #146)`digits?` (`'latin'|'persian'|'arabic'` — latin)، `locale?` (`'fa'|'en'` — fa)، `useIntl?` (false؛ cross-check با ICU)، `range?` (`{min,max}` — ۱۰۰۰..۳۰۰۰؛ خارج ⇒ ZEN-1301)، `timeZone?` (`'utc'|'local'|<IANA>` — utc برای قطعی بودن SSR)، `clock?` (فقط `jalaliNow`؛ قابل‌تزریق برای تست).

### `schema` — `ValidateOptions` (SPEC §۲.۲، #142)
`mode?` (`'throw'|'warn'|'result'` — dev: throw، prod: warn؛ `__ZENITH_DEV__`)، `strict?` (true — کلید ناشناخته ⇒ ZEN-1002)، `coerce?` (false؛ مسیر attribute/parseConfigAttr: true — `"5"`→5، `"30s"`→30000)، `abortEarly?` (false)، `name?` (نام API در `details.name` خطا). هشدارها بدون console از `setSchemaWarnReporter` (الگوی duck-seam DEC-021) عبور می‌کنند.

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

تصمیم‌های باز این معماری در #175 بسته شدند (۸ ADR): فضای کد خطا DEC-020، `Readable<T>`/shared DEC-021، تعویق adapter-edge DEC-022، ترتیب ui DEC-023، charts/icons جامعه DEC-024، تقسیم runtime-core با parity DEC-025، نسخه‌گذاری lockstep DEC-026، حداقل Node و فرمت ESM-first DEC-027 — همه در `docs/decisions/`.
