# مشخصات پکیج‌های جدید Zenith

این سند مشخصات فنی پکیج‌هایی است که در `STANDARDIZATION-PLAN.md` پیشنهاد شد. هر پکیج لایه، وابستگی‌ها، API، گزینه‌ها،
attributeهای HTML، رفتار SSR، کدهای خطا، دسترس‌پذیری، تست و مهاجرت دارد.
لایه‌ها طبق `ARCHITECTURE.md` (بخش ۱) و سبک‌ها طبق `STANDARDIZATION-PLAN.md` (بخش ۳) هستند.

> **وضعیت:** همهٔ APIها، نام‌ها، پیش‌فرض‌ها و بودجهٔ حجم **پیشنهاد طراحی**اند، نه کد موجود. فقط بخش‌های «استخراج از» به کد فعلی مخزن اشاره دارند.
> نام‌ها و مقادیر پیش‌فرض هنگام پیاده‌سازی و بازبینی API نهایی می‌شوند.

---

## فهرست

0. [قراردادهای مشترک](#۰-قراردادهای-مشترک)
1. [نقشهٔ لایه‌ها و وابستگی‌ها](#۱-نقشهٔ-لایه‌ها-و-وابستگی‌ها)
2. [P0 — زیرساخت](#۲-p0--زیرساخت): `shared` · `schema` · `logger` · `cache` · `storage` · `jalali` · `devtools-core` · `runtime-core` · `zenith`
3. [P1 — قابلیت‌ها](#۳-p1--قابلیت‌ها): `i18n` · `a11y` · `head` · `ui` · `realtime` · `analytics` · `adapter-node` · `adapter-edge` · `create-zenith` · `eslint-plugin` · `language-server`
4. [P2 — اکوسیستم](#۴-p2--اکوسیستم): `theme` · `auth-oauth` · `ssg` · `unplugin-zenith` · `mock` · `testing-e2e` · `codemod` · `feature-flags` · `charts` · `icons`
5. [تأثیر بر پکیج‌های موجود](#۵-تأثیر-بر-پکیج‌های-موجود)
6. [قالب package.json و معیار پذیرش](#۶-قالب-packagejson-و-معیار-پذیرش)
7. [ترتیب پیاده‌سازی](#۷-ترتیب-پیاده‌سازی)

---

## ۰. قراردادهای مشترک

### ۰.۱ چرخهٔ عمر
- هر `createX(options?)` یک `X & Disposable` برمی‌گرداند. `dispose()` idempotent است و همهٔ listener/timer/observerها را آزاد می‌کند.
- هر `registerX(key, value)` یک `Cleanup` (`() => void`) برمی‌گرداند. `getX(key)` در نبود مقدار `undefined` می‌دهد.
- هر `onX(cb)` یک `Cleanup` برمی‌گرداند.
- `bindX(el, ctx)` (اتصال به DOM) همیشه `Cleanup` برمی‌گرداند.
- هیچ API جدیدی از `destroy`/`cancel`/`stop` برای آزادسازی استفاده نمی‌کند.

### ۰.۲ گزینه‌ها
- یک آرگومان `options` اختیاری؛ ورودی اصلی آرگومان اول است.
- هر پکیج `DEFAULTS` (`Object.freeze`) و یک schema (`@zenith/schema`) برای `XOptions` export می‌کند.
- ورودی‌های واکنشی `MaybeSignal<T>` هستند و با `toValue()` خوانده می‌شوند.
- هر گزینه در TSDoc دارای `@default`، `@unit` (برای زمان: `ms`) و `@since` است.
- مدت‌زمان در attribute: `500ms`، `30s`، `5m`، `1h`، یا عدد (= ms). مقدار `never` یعنی بدون انقضا.

### ۰.۳ گرامر attributeهای HTML
برگرفته از سبک فعلی (`zen-fetch` / `zen-fetch-method` / `zen-state`):

| قاعده | مثال |
|---|---|
| attribute اصلی `zen-<name>`؛ مقدارش یک expression Zenith است (بدون `eval`) | `zen-dialog="isOpen"` |
| گزینه‌ها `zen-<name>-<option>` به‌صورت kebab-case | `zen-dialog-modal="false"` |
| boolean: وجود attribute = `true`؛ `"false"` غیرفعال می‌کند | `zen-tabs-lazy`، `zen-tabs-lazy="false"` |
| عدد/مدت: literal یا expression با پیشوند `:` | `zen-tooltip-delay="300"`، `zen-tooltip-delay=":cfg.delay"` |
| نام state خروجی با `zen-state` (پیش‌فرض `data`) | `zen-ws="url" zen-state="feed"` |
| پیکربندی ساخت‌یافته: `zen-<name>-options='{"a":1}'` (JSON) که با schema اعتبارسنجی می‌شود | `zen-chart-options='{"legend":true}'` |
| رویداد: `zen-action:<event>.<modifier>` (سبک فعلی `@zenith/events`) | `zen-action:zen-dialog-close="save()"` |
| رویدادهای سفارشی کامپوننت‌ها `CustomEvent` با نام `zen-<name>-<event>` و `bubbles: true` | `zen-dialog-open` |
| وضعیت بصری برای CSS: `data-state`، `data-placement`، `data-disabled` | `[data-state="open"]` |
| متغیرهای CSS: `--zen-<pkg>-<token>` | `--zen-ui-z-index` |

هر directive یک **متادیتای attribute** (`DirectiveMeta`) ثبت می‌کند. `language-server`، `eslint-plugin`، `compiler` و مستندات از همان تولید می‌شوند:

```ts
interface DirectiveMeta {
  name: string;                 // 'zen-dialog'
  kind: 'attribute' | 'element';
  package: string;              // '@zenith/ui'
  since: string;
  priority?: number;            // ترتیب اجرا (بند ۲.۸)
  structural?: boolean;
  value: { type: 'expression' | 'string' | 'none'; required: boolean; description: string };
  options: Array<{ attr: string; type: 'boolean'|'number'|'duration'|'string'|'enum'|'expression'|'json';
                   default?: unknown; values?: string[]; description: string }>;
  events?: string[];            // CustomEventها
  ssr: 'render' | 'skip' | 'client-only';
  compilable: boolean;          // آیا compiler می‌تواند پیش‌کامپایل کند؟
}
```

### ۰.۴ خطا
- فقط `ZenithError` (از `@zenith/errors`). خطای برنامه‌نویس `throw`، خطای زمان اجرا `reportError`.
- فضای `ZEN-001..999` پر است. پکیج‌های جدید از بازهٔ ۴رقمی استفاده می‌کنند و در `@zenith/errors` ثبت می‌شوند:

| بازه | دامنه |
|---|---|
| `ZEN-1000..1099` | schema / options |
| `ZEN-1100..1199` | storage |
| `ZEN-1200..1299` | cache |
| `ZEN-1300..1399` | i18n / jalali |
| `ZEN-1400..1499` | a11y |
| `ZEN-1500..1599` | head |
| `ZEN-1600..1699` | ui |
| `ZEN-1700..1799` | realtime |
| `ZEN-1800..1899` | adapters / ssg |
| `ZEN-1900..1999` | analytics |
| `ZEN-2000..2099` | theme |
| `ZEN-2100..2199` | auth-oauth |
| `ZEN-2200..2299` | feature-flags |
| `ZEN-2300..2399` | createApp / runtime-core |
| `ZEN-2400..2499` | devtools-core |
| `ZEN-2500..2599` | tooling (codemod / unplugin / cli) |
| `ZEN-DEPR-xxx` | هشدار deprecation |

- هر خطا: `code`، `message` فارسی، `suggestion`، `details`، لینک مستندات (`https://zenith.dev/errors/ZEN-1001`).

### ۰.۵ SSR و محیط
- هر API در سرور یا باید کار کند یا صراحتاً `client-only` باشد و بی‌صدا no-op شود (با `logger.debug`). هرگز در import به `window`/`document` دست نمی‌زند.
- وضعیت هر درخواست داخل `App` (بند runtime-core) نگه‌داری می‌شود، نه متغیر ماژول.

### ۰.۶ بسته‌بندی
- ESM اولویت دارد؛ CJS فقط برای ابزارها. `sideEffects: false`. `exports` شرطی (`development` / `production` / `browser` / `node` / `worker`).
- `@zenith/state` و `@zenith/scheduler` همیشه `peerDependencies`اند (به‌جز در خود `state`).
- بودجهٔ حجم (gzip، پیشنهادی) در هر پکیج آمده و با `size-limit` در CI اجبار می‌شود.

---

## ۱. نقشهٔ لایه‌ها و وابستگی‌ها

قاعده: وابستگی فقط به لایهٔ هم‌سطح یا پایین‌تر، بدون چرخه. وابستگی هم‌لایه در جدول صراحتاً آمده است.

```
L5   zenith (umbrella)
L4   adapter-node · adapter-edge · ssg · stateful · crud · service-worker · devtools · testing
L3   runtime-core · runtime · ssr
L2   i18n · a11y · head · ui · realtime · analytics · theme · auth-oauth · feature-flags · charts · icons
     + موجود: router · events · components · resource · data · http · actions · auth · permission · store
              form · notifications · error-boundary · suspense · transition · virtual-list · data-table
L1   state · expressions · dependency-graph · devtools-core
L0   errors · shared · logger · cache · storage · schema · jalali · scheduler · security
Tooling   unplugin-zenith · create-zenith · eslint-plugin · language-server · codemod · mock · testing-e2e
          + موجود: compiler · vite-plugin · cli · vscode-extension · devtools-extension
```

ترتیب درون L0 (بدون چرخه): `errors` → `shared` → `logger`، `cache`، `jalali`، `storage` → `schema`.

| پکیج | لایه | `dependencies` | `peerDependencies` | بودجه (gz) |
|---|---|---|---|---|
| `shared` | L0 | errors | — | ≤ ۲ KB |
| `logger` | L0 | shared | — | ≤ ۲ KB |
| `cache` | L0 | shared | — | ≤ ۳ KB |
| `jalali` | L0 | shared | — | ≤ ۴ KB |
| `storage` | L0 | shared, errors, logger | — | ≤ ۴ KB |
| `schema` | L0 | shared, errors | zod (اختیاری) | ≤ ۴ KB |
| `devtools-core` | L1 | shared | state | ≤ ۵ KB |
| `i18n` | L2 | shared, cache, schema, errors | state, scheduler; اختیاری: jalali, storage | ≤ ۸ KB |
| `a11y` | L2 | shared | state, scheduler | ≤ ۵ KB |
| `head` | L2 | shared, schema | state, scheduler | ≤ ۳ KB |
| `ui` | L2 | shared, a11y, jalali, transition | state, scheduler | ≤ ۱۵ KB (کل)، هر کامپوننت tree-shake |
| `realtime` | L2 | shared, errors, logger, schema | state, scheduler | ≤ ۵ KB |
| `analytics` | L2 | shared, logger | state, scheduler | ≤ ۳ KB |
| `theme` | L2 | shared, storage, schema | state, scheduler | ≤ ۳ KB |
| `auth-oauth` | L2 | shared, errors, storage, schema | auth, http, state, scheduler | ≤ ۸ KB |
| `feature-flags` | L2 | shared, storage | state, scheduler | ≤ ۲ KB |
| `charts` | L2 | shared, schema | state, scheduler | ≤ ۲۰ KB |
| `icons` | L2 | shared | state | ≤ ۱ KB (هسته) |
| `runtime-core` | L3 | shared, logger, errors, security, expressions, events, error-boundary | state, scheduler | ≤ ۲۵ KB |
| `ssg` | L4 | shared, ssr | state, scheduler | tooling |
| `adapter-node` | L4 | shared, ssr, runtime-core, logger | state, scheduler | tooling |
| `adapter-edge` | L4 | shared, ssr, runtime-core, logger | state, scheduler | ≤ ۶ KB |
| `zenith` | L5 | همهٔ پکیج‌های اصلی (re-export) | — | بسته به preset |

---

## ۲. P0 — زیرساخت

### ۲.۱ `@zenith/shared` — L0 — **تازه**

**نقش:** نوع‌ها و ابزارهای مشترکی که الان در هر پکیج تکرار شده‌اند. صفر اثر جانبی.

**API**
| export | امضا | توضیح |
|---|---|---|
| `Disposable` | `interface { dispose(): void }` | قرارداد آزادسازی |
| `Cleanup` | `type () => void` | |
| `Readable<T>` | `interface { get(): T }` | ساختاری؛ `ReadonlySignal` آن را برآورده می‌کند (جلوگیری از چرخهٔ `shared ↔ state`) |
| `MaybeReactive<T>` | `type T \| Readable<T>` | `state` نام `MaybeSignal<T>` را re-export می‌کند |
| `toValue` | `<T>(v: MaybeReactive<T>) => T` | خواندن مقدار |
| `isReadable` | `(v: unknown) => v is Readable<unknown>` | |
| `createDisposer` | `() => Disposable & { add(c: Cleanup \| Disposable): void; run(): void }` | جمع‌کنندهٔ cleanup |
| `defineDefaults` | `<T>(d: T) => Readonly<T>` | فریز عمیق |
| `mergeOptions` | `<T>(defaults: T, user?: Partial<T>) => T` | ادغام امن (بدون `__proto__`) |
| `parseDuration` | `(v: string \| number) => number \| 'never'` | `"30s"` ← `30000` |
| `parseBooleanAttr` | `(v: string \| null, def: boolean) => boolean` | قاعدهٔ بند ۰.۳ |
| `parseNumberAttr` | `(v: string \| null, def: number) => number` | |
| `isServer` / `hasDOM` / `hasWindow` | `() => boolean` | تشخیص محیط، یک منبع |
| `createId` | `(prefix?: string) => string` | شناسهٔ غیرامنیتی، قطعی در SSR (شمارندهٔ per-app) |
| `secureId` | `(bytes?: number) => string` | `crypto.getRandomValues`، بدون `Math.random` |
| `invariant` | `(cond: unknown, code: ZenCode, details?: object) => asserts cond` | |
| `ZenithGlobals` | `interface` | `declare global` برای `__ZENITH_DEV__` و … با declaration merging |

**گزینه‌ها:** ندارد (توابع خالص).
**attribute:** ندارد.
**SSR:** همهٔ توابع isomorphic. `createId` شمارنده را از context برنامه می‌گیرد تا hydration یکسان شود.
**خطا:** `ZEN-1090` (آرگومان نامعتبر).
**تست:** `mergeOptions` در برابر prototype pollution؛ `parseDuration` مرزها (`"0"`, `"1.5s"`, `"-1"`, `"abc"`)؛ `createDisposer` ترتیب LIFO و idempotency.
**مهاجرت:** تعریف‌های تکراری `Disposable`/`Cleanup`/`DEFAULT_*` در پکیج‌ها حذف و import می‌شود.

---

### ۲.۲ `@zenith/schema` — L0 — **استخراج** از `form` (`fromZod`, `fromJsonSchema`) + تازه

**نقش:** اعتبارسنجی گزینه‌ها و config با خطای `ZEN-1xxx`، و تولید متادیتا برای ابزار.

**API**
| export | امضا |
|---|---|
| `s` | سازندهٔ schema: `s.string()`, `s.number({min,max,int})`, `s.boolean()`, `s.enum([...])`, `s.duration()`, `s.fn()`, `s.signal<T>()`, `s.element()`, `s.array(x)`, `s.record(x)`, `s.object({...})`, `s.union([...])`, `s.optional(x)`, `s.default(x, v)`, `s.custom(fn)` |
| `defineOptions` | `<T>(name: string, schema: Schema<T>, defaults?: Partial<T>) => { DEFAULTS: Readonly<T>; resolve(user?: unknown): T; schema: Schema<T> }` |
| `validate` | `<T>(schema, input, opts?: ValidateOptions) => T` |
| `safeValidate` | `(schema, input) => { ok: true; value: T } \| { ok: false; issues: Issue[] }` |
| `parseConfigAttr` | `<T>(el: Element, attr: string, schema: Schema<T>) => T` (JSON از attribute) |
| `defineDirectiveMeta` | `(meta: DirectiveMeta) => DirectiveMeta` |
| `toJsonSchema` | `(schema) => JsonSchema` (برای ویرایشگر و مستندات) |
| `toDirectiveManifest` | `(metas: DirectiveMeta[]) => object` (فایل `zenith.meta.json` و `html.customData.json`) |
| `@zenith/schema/zod` | `fromZod`, `validateWithZod` |
| `@zenith/schema/json-schema` | `fromJsonSchema` |

**گزینه‌های `ValidateOptions`**
| گزینه | نوع | پیش‌فرض | توضیح |
|---|---|---|---|
| `mode` | `'throw' \| 'warn' \| 'result'` | dev: `'throw'`، prod: `'warn'` | |
| `strict` | `boolean` | dev: `true` | کلید ناشناخته خطا بدهد |
| `coerce` | `boolean` | `false` (attribute: `true`) | `"5"` → `5`، `"true"` → `true` |
| `abortEarly` | `boolean` | `false` | |
| `name` | `string` | — | نام API برای پیام خطا |

**attribute:** ندارد؛ فقط `parseConfigAttr` را directiveها برای `zen-<name>-options` به کار می‌گیرند.
**SSR:** isomorphic.
**خطا:** `ZEN-1001` گزینهٔ نامعتبر (مسیر، نوع مورد انتظار، مقدار)؛ `ZEN-1002` کلید ناشناخته؛ `ZEN-1003` JSON خراب در attribute؛ `ZEN-1004` مقدار خارج از بازه.
**تست:** هر `XOptions` موجود یک تست «پیش‌فرض‌ها + مقدار نامعتبر»؛ ابزار تولید `zenith.meta.json` در CI با snapshot.
**مهاجرت:** `form` دو export را از `@zenith/schema` re-export می‌کند (alias + deprecation).

---

### ۲.۳ `@zenith/logger` — L0 — **استخراج** (حدود ۳۷۰ `console.*`)

**API**
| export | امضا | توضیح |
|---|---|---|
| `createLogger` | `(opts?: LoggerOptions) => Logger & Disposable` | |
| `logger` | `Logger` | نمونهٔ پیش‌فرض (scope `zen`) |
| `Logger` | `debug/info/warn/error(msgOrError, details?)`, `child(scope)`, `isEnabled(level)` | |
| `setLogLevel` | `(level) => void` | |
| `addSink` | `(sink: LogSink) => Cleanup` | |
| `consoleSink` | `(opts?) => LogSink` | |
| `bufferSink` | `(opts?: { maxEntries }) => LogSink & { entries(): LogEntry[]; clear(): void }` | برای devtools و تست |
| `beaconSink` | `(opts: { url; batchSize; flushInterval; headers? }) => LogSink` | |
| `warnOnce` | `(key: string, msg: string) => void` | یک‌بار در هر نمونه |
| `deprecate` | `(oldName: string, newName: string, since: string) => void` | `ZEN-DEPR-xxx` یک‌بار |

**گزینه‌ها (`LoggerOptions`)**
| گزینه | نوع | پیش‌فرض | توضیح |
|---|---|---|---|
| `scope` | `string` | `'zen'` | پیشوند `[zen:scope]` |
| `level` | `'debug'\|'info'\|'warn'\|'error'\|'silent'` | dev: `'debug'`، prod: `'warn'` | |
| `sinks` | `LogSink[]` | `[consoleSink()]` | |
| `redact` | `string[]` | `['token','password','authorization','secret','cookie']` | کلیدهایی که در `details` پوشیده می‌شوند |
| `format` | `(entry) => string` | `[zen:scope] CODE: message` | |
| `clock` | `() => number` | `Date.now` | |

**attribute:** ندارد.
**SSR:** sinkها per-app. در سرور پیش‌فرض خروجی ساخت‌یافته (JSON خط‌به‌خط) با `requestId`.
**خطا:** `logger.error(zenithError)` کد، پیام و suggestion را چاپ و در صورت وجود به `error-boundary` ارسال می‌کند. `ZEN-1091` sink خراب (فقط یک‌بار گزارش، حلقه نمی‌سازد).
**قانون ESLint:** `no-console` برای `src` همهٔ پکیج‌ها (استثنا فقط `consoleSink`).
**مهاجرت:** جایگزینی خودکار با codemod؛ پیشوندهای `[Zenith`, `[zen`, `[ERROR`, `[CrudEngine` یکی می‌شوند.

---

### ۲.۴ `@zenith/cache` — L0 — **استخراج** از ۶ cache موجود

**API**
| export | امضا |
|---|---|
| `createCache` | `<V, K = string>(opts?: CacheOptions<V, K>) => Cache<V, K>` |
| `Cache` | `get`, `peek`, `set(key, v, o?)`, `has`, `delete`, `clear`, `invalidate(tagsOrPredicate)`, `getOrLoad(key, loader, o?)` (dedupe درحال‌اجرا)، `stats()`, `keys()`, `onEvict(cb)`, `dispose()` |
| `cache.signal` | `(key) => ReadonlySignal<V \| undefined>` (در صورت وجود `state`؛ از طریق زیرمسیر `@zenith/cache/signal`) |
| `registerCache` | `(name, cache) => Cleanup` — برای devtools |
| `listCaches` | `() => Array<{ name; stats }>` |
| `parseCacheAttr` | `(v: string) => CachePolicy` — `"30s"`, `"30s,swr=2m"`, `"never"`, `"false"` |

**گزینه‌ها (`CacheOptions`)**
| گزینه | نوع | پیش‌فرض | واحد |
|---|---|---|---|
| `ttl` | `number \| 'never'` | `'never'` | ms |
| `staleWhileRevalidate` | `number` | `0` | ms |
| `maxSize` | `number` | `500` | تعداد ورودی |
| `maxBytes` | `number` | — | بایت (با `sizeOf`) |
| `sizeOf` | `(v) => number` | — | |
| `policy` | `'lru' \| 'fifo'` | `'lru'` | |
| `clock` | `() => number` | `Date.now` | |
| `name` | `string` | — | برای `registerCache` |
| `onEvict` | `(key, v, reason: 'ttl'\|'size'\|'manual') => void` | — | |

**آمار (`stats()`):** `{ size, maxSize, hits, misses, staleHits, evictions, hitRatio }` (همان شکل `expressions.getCacheStats` تا سازگار بماند).
**attribute:** مشترک برای directiveها: `zen-<name>-cache="30s"` یا `"30s,swr=2m"`. مصرف: `zen-fetch-cache`, `zen-resource-cache`.
**SSR:** cache per-app (جلوگیری از نشت بین درخواست‌ها). دورهٔ پاک‌سازی با timer ندارد؛ انقضا lazy است.
**خطا:** `ZEN-1201` ttl نامعتبر؛ `ZEN-1202` loader شکست خورد (خطای اصلی `cause`).
**جایگزین می‌شود:** `http` (cache/tags)، `data` (`getCachedData/setCachedData/clearFetchCache`)، `resource` (`staleTime`)، `components` (`ComponentCacheConfig`)، `expressions` (`cache.ts`)، `router` (`clearRouteCache`).
**تست:** هم‌روندی `getOrLoad` (۱۰۰ فراخوانی هم‌زمان = ۱ loader)، LRU، TTL با `clock` جعلی، نشت حافظه.

---

### ۲.۵ `@zenith/storage` — L0 — **تازه**

**API**
| export | امضا |
|---|---|
| `createStorage` | `(opts?: StorageOptions) => Storage & Disposable` |
| `Storage` | `get<T>(key, def?)`, `set(key, v, o?: { ttl })`, `remove(key)`, `has(key)`, `keys()`, `clear()`, `subscribe(key, cb) → Cleanup`, `ready: Promise<void>` |
| `storage.signal` | `<T>(key, initial, o?) => Signal<T>` (از `@zenith/storage/signal`؛ همگام با ذخیره و تب‌های دیگر) |
| درایورها | `localDriver`, `sessionDriver`, `memoryDriver`, `indexedDBDriver({db, store})`, `cookieDriver(opts)` |
| `persistStore` | `(store, opts) => Cleanup` — برای `store` (`$subscribe`/persist) |
| `isStorageAvailable` | `(driver) => boolean` |

**گزینه‌ها (`StorageOptions`)**
| گزینه | نوع | پیش‌فرض | توضیح |
|---|---|---|---|
| `driver` | `'local'\|'session'\|'memory'\|'indexeddb'\|'cookie'\|Driver` | `'memory'` در سرور، `'local'` در مرورگر | |
| `namespace` | `string` | `'zen'` | پیشوند کلیدها |
| `version` | `number` | `1` | |
| `migrate` | `(old: unknown, fromVersion: number) => unknown` | — | |
| `serializer` | `{ parse; stringify }` | JSON | |
| `ttl` | `number` | `'never'` | ms |
| `sync` | `boolean` | `true` | همگام‌سازی بین تب‌ها (`storage` event / `BroadcastChannel`) |
| `sensitive` | `boolean` | `false` | `true` ⇒ `local/session/indexeddb` ممنوع (فقط `memory`/`cookie`) |
| `onQuotaExceeded` | `'throw'\|'evict-oldest'\|'ignore'` | `'evict-oldest'` | |
| `cookie` | `{ path; domain; sameSite; secure; maxAge }` | `sameSite:'Strict'`, `secure:true`, `path:'/'` | HttpOnly از سمت کلاینت ممکن نیست؛ در مستندات هشدار |

**attributeها** (برای المان‌های دارای `zen-model`):
| attribute | مقدار | پیش‌فرض |
|---|---|---|
| `zen-persist` | کلید ذخیره | — |
| `zen-persist-driver` | `local`/`session`/`indexeddb` | `local` |
| `zen-persist-ttl` | مدت | `never` |
| `zen-persist-version` | عدد | `1` |
| `zen-persist-debounce` | مدت | `300ms` |

**SSR:** `memory` driver؛ مقدار اولیه از cookie درخواست می‌تواند تزریق شود. هیچ دسترسی به `window` هنگام import.
**امنیت:** `sensitive: true` برای توکن؛ `Math.random` ممنوع؛ داده با `schema` اختیاری اعتبارسنجی می‌شود تا داده دست‌کاری‌شده پذیرفته نشود.
**خطا:** `ZEN-1101` ذخیره‌گاه در دسترس نیست (حالت private، fallback به memory با هشدار)؛ `ZEN-1102` quota؛ `ZEN-1103` migrate شکست خورد؛ `ZEN-1104` داده خراب.
**مهاجرت:** `auth` (`tokenStorage`) و `store` (persist) و سبد `ecommerce-demo` از آن استفاده می‌کنند.

---

### ۲.۶ `@zenith/jalali` — L0 — **استخراج** از `i18n`

**نقش:** تقویم جلالی خالص (بدون `Intl` ضروری).

**API:** `toJalaliParts(date)`, `fromJalaliParts(y, m, d)`, `formatJalali(date, fmt)`, `parseJalali(str, fmt)`, `addDays/addMonths/addYears`, `diffDays`, `isLeap(jy)`, `monthDays(jy, jm)`, `monthName(jm, {style})`, `weekdayName(i, {style})`, `compareJalali`, `jalaliNow()`, `isValidJalali(y,m,d)`، همراه با `toPersianDigits`, `toArabicDigits`, `toLatinDigits`.
**نشانه‌های قالب (`fmt`):** `YYYY YY MMMM MMM MM M DD D dddd ddd HH mm ss`.
**گزینه‌ها**
| گزینه | نوع | پیش‌فرض |
|---|---|---|
| `digits` | `'latin'\|'persian'\|'arabic'` | `'latin'` |
| `locale` | `'fa'\|'en'` | `'fa'` |
| `useIntl` | `boolean` | `true` اگر `Intl` با `u-ca-persian` در دسترس باشد |
| `range` | `{ min: number; max: number }` | `1000..3000` (سال جلالی) |

**رفتار مرز:** خارج از بازه `ZEN-1301` می‌اندازد (به‌جای هشدار و نتیجهٔ نادرست فعلی).
**attribute:** ندارد؛ مصرف در `ui` (`date-picker`) و `i18n`.
**SSR:** isomorphic، منطقهٔ زمانی صریح (`timeZone` گزینه) تا خروجی سرور و کلاینت یکی باشد.
**خطا:** `ZEN-1301` خارج از بازه؛ `ZEN-1302` قالب نامعتبر؛ `ZEN-1303` تاریخ نامعتبر.
**تست:** مرز سال کبیسه (۱۳۹۹، ۱۴۰۳)، همهٔ ماه‌ها، رفت‌وبرگشت `Date ↔ Jalali` برای ۱۰۰۰ تا ۳۰۰۰، مقایسه با `Intl` در محیط‌هایی که دارند.
**مهاجرت:** `@zenith/i18n` توابع قدیمی را از آن re-export می‌کند (alias + `deprecate`).

---

### ۲.۷ `@zenith/devtools-core` — L1 — **استخراج** از `state` (`registry.ts`) و `devtools` (`api.ts`, `graph.ts`)

**نقش:** یک رجیستری واحد برای signalها، timeline و گراف زمان اجرا؛ حذف تکرار `registerSignal`/`recordStateChange`.

**تغییر در `state`:** فقط یک نقطهٔ hook:
```ts
// @zenith/state
export interface SignalObserver {
  onCreate?(sig: Signal<any>, name?: string): void;
  onChange?(sig: Signal<any>, oldValue: unknown, newValue: unknown): void;
  onDispose?(sig: Signal<any>): void;
}
export function setSignalObserver(o: SignalObserver | null): Cleanup;   // در prod حذف‌شدنی (tree-shake)
```

**API `devtools-core`**
| export | امضا |
|---|---|
| `installDevtoolsCore` | `(opts?: DevtoolsCoreOptions) => Disposable` (به `setSignalObserver` وصل می‌شود) |
| `registerSignal` | `(sig, name?) => string` — **یک** شناسهٔ رشته‌ای |
| `nameSignal` | `(sig, name) => void` |
| `getAllSignals` / `getSignalInfo(id)` | |
| `getTimeline` | `(limit?) => StateChange[]` |
| `onStateChange` | `(cb) => Cleanup` |
| `snapshot` | `() => Snapshot` |
| `restore` | `(snap: Snapshot) => void` (time-travel) |
| `replay` | `(from: number, to: number, o?: { speed }) => Promise<void>` |
| `RuntimeGraph` | همان `DependencyGraph` فعلی با نام جدید (جلوگیری از اشتباه با `@zenith/dependency-graph`) |
| `registerCache` / `registerStore` / `registerApp` | منبع برای پنل |
| `hook` | `window.__ZENITH_DEVTOOLS_HOOK__` با `{ version, emit, on }` (نسخه‌دار) |

**گزینه‌ها (`DevtoolsCoreOptions`)**
| گزینه | نوع | پیش‌فرض |
|---|---|---|
| `enabled` | `boolean` | `__ZENITH_DEV__` |
| `maxTimelineEntries` | `number` | `1000` |
| `redact` | `string[]` | همان لیست logger |
| `sampleRate` | `number` (۰..۱) | `1` |
| `captureValues` | `boolean` | `true` (در `false` فقط نوع/اندازه) |

**attribute:** ندارد. `data-zen-id` روی المان‌ها در dev برای نگاشت پنل به DOM.
**SSR:** غیرفعال (no-op).
**خطا:** `ZEN-2401` نسخهٔ hook ناسازگار؛ `ZEN-2402` snapshot نامعتبر.
**مهاجرت:** `state` توابع `registerSignal`, `recordStateChange`, `getAllSignals`, `getStateTimeline`, `onStateChange`, `nameSignal`, `clearRegistry` را حذف و برای یک نسخه از `devtools-core` re-export می‌کند. `devtools` فقط پل افزونه می‌ماند.

---

### ۲.۸ `@zenith/runtime-core` — L3 — **استخراج** از `runtime`

**نقش:** هستهٔ کوچک DOM (walker، context، attributes، hydrate، directiveهای پایه) و API ثبت directive/افزونه. `runtime` فعلی به یک بستهٔ سازگار تبدیل می‌شود که `runtime-core` + ویژگی‌ها را نصب می‌کند.

**directiveهای داخل هسته:** `zen-text`, `zen-html`, `zen-bind`, `zen-model`, `zen-show`, `zen-if` / `zen-else-if` / `zen-else`, `zen-for` / `zen-key`, `zen-cloak`, `zen-ref`, `zen-memo`, `zen-action`.
**بیرون از هسته (افزونه):** `zen-html-trusted`, `zen-portal`, `zen-intersection`, `zen-island`, `zen-virtual`, `zen-optimistic`, `zen-track` (→ `analytics`)، `zen-date-picker` (→ `ui`)، `zen-button` (`stateful`)، `zen-router`/`zen-link` (`router`)، `zen-suspense`، `zen-error`، `zen-fetch`/`zen-resource`.

**API**
| export | امضا | توضیح |
|---|---|---|
| `createApp` | `(opts?: AppOptions) => App` | حذف singleton |
| `App` | `mount(root, state?) → Cleanup`, `unmount()`, `use(plugin, opts?) → App`, `directive(name, def) → Cleanup`, `provide(key, v)`, `inject(key, def?)`, `config`, `dispose()` | |
| `defineDirective` | `(def: DirectiveDefinition) => DirectiveDefinition` | |
| `definePlugin` | `(p: Plugin) => Plugin` | `{ name, version?, install(app, options) }` |
| `onMount` / `onUnmount` / `onUpdate` | `(fn) => void` | در محدودهٔ directive/کامپوننت؛ خارج از آن `ZEN-2301` |
| `provide` / `inject` | درختی (بر پایهٔ owner) | |
| `useApp` | `() => App` | |
| `hydrate` / `startFromSSR` | `(root, init?) => Promise<HydrationResult>` | فقط این دو عمومی؛ `hydrate*` داخلی می‌شود |

**`DirectiveDefinition`**
```ts
interface DirectiveDefinition {
  name: string;                       // 'zen-dialog'
  meta: DirectiveMeta;                // بند ۰.۳
  priority?: number;                  // پیش‌فرض 500
  structural?: boolean;               // مثل zen-for / zen-if
  bind(el: HTMLElement, ctx: BindContext): Cleanup | void;
  hydrate?(el: HTMLElement, ctx: BindContext): Cleanup | void;
  ssr?(el: Element, ctx: SsrContext): void;         // رندر سمت سرور
}
interface BindContext {
  expr: string; context: Record<string, any>; app: App;
  processChildren(node: HTMLElement, ctx?: Record<string, any>): void;
  disposes: Disposable;               // به‌جای آرایهٔ disposes فعلی
  state: Record<string, any>;
  option(attr: string): string | null;                  // خواندن zen-<name>-<option>
  config<T>(schema: Schema<T>): T;                      // zen-<name>-options
}
```

**ترتیب اجرا (`priority`، بالاتر زودتر):** `zen-for` ۱۰۰۰، `zen-if`/`else-if`/`else` ۹۰۰، `zen-memo` ۸۰۰، `zen-ref` ۷۰۰، سایر ۵۰۰، `zen-action` ۱۰۰. اگر دو directive ساختاری روی یک المان باشند `ZEN-2302` (conflict).

**گزینه‌ها (`AppOptions`)**
| گزینه | نوع | پیش‌فرض |
|---|---|---|
| `state` | `Record<string, any>` | `{}` |
| `plugins` | `Array<Plugin \| [Plugin, opts]>` | `[]` |
| `devtools` | `boolean` | `__ZENITH_DEV__` |
| `delegationRoot` | `Document \| ShadowRoot \| HTMLElement` | `document` |
| `strictParity` | `boolean` | `false` |
| `logger` | `Logger` | `logger` پیش‌فرض |
| `errorHandler` | `(err: ZenithError) => void` | گزارش به `error-boundary` |
| `warnHandler` | `(msg, ctx) => void` | |
| `idPrefix` | `string` | `'zen'` |
| `ssr` | `{ preloadState?: boolean; validateHydration?: boolean }` | `{ preloadState: true, validateHydration: false }` |

**attributeهای هسته:** `zen-text`, `zen-html`, `zen-bind` (`zen-bind:<attr>`), `zen-model` (+ `zen-model-lazy`, `zen-model-trim`, `zen-model-number`)، `zen-show`, `zen-if`/`zen-else-if`/`zen-else`, `zen-for` (+ `zen-key` الزامی؛ نبودنش `ZEN-2303`)، `zen-cloak`, `zen-ref`, `zen-memo`, `zen-action:<event>.<mod>`، `zen-static` (عدم بازبینی)، `zen-state`.
**SSR/Hydration:** نشانگرهای `data-zen-h` با شناسهٔ قطعی؛ عدم تطابق `ZEN-2310` (dev: هشدار با diff، prod: بازرندر موضعی).
**تست:** دو `createApp` هم‌زمان در یک صفحه؛ دو درخواست SSR هم‌زمان؛ `dispose()` ⇒ صفر listener/effect باقی؛ ترتیب `priority`؛ پلاگین دوباره‌نصب‌نشدنی.
**مهاجرت:** `Zen.start(root, state)` ≡ `defaultApp().mount(root, state)`. `Zen.use`, `registerCustomDirective` به `app.use`/`app.directive` نگاشت می‌شوند (alias + `deprecate`). شیء سراسری `Zen` در `@zenith/runtime` باقی می‌ماند.

---

### ۲.۹ `zenith` (umbrella) — L5 — **تازه**

**نقش:** یک نقطهٔ import با قاعدهٔ re-export یکسان، `presets` و باندل مرورگری.

**ساختار export**
| مسیر | محتوا |
|---|---|
| `zenith` | `createApp`, `defineDirective`, `definePlugin`, `signal`, `computed`, `effect`, `batch`, `watch` + namespaceها: `http`, `router`, `store`, `form`, `i18n`, … (`export * as x`) |
| `zenith/core` | `runtime-core` + `state` |
| `zenith/ssr` | `ssr` + adapterها (type-only) |
| `zenith/testing` | `testing` |
| `zenith/presets/minimal` | core + events + security |
| `zenith/presets/spa` | + router, http, resource, store, form, error-boundary, notifications, i18n |
| `zenith/presets/full` | + همهٔ ویژگی‌های L2 |
| `zenith/browser` | باندل IIFE `window.Zenith` (با SRI و sourcemap جدا) |

**API:** `createZenith(opts: { preset?, plugins?, ...AppOptions }) => App`، `assertCompatible(): void` (بررسی lockstep نسخهٔ همهٔ پکیج‌ها؛ `ZEN-2320`).
**گزینه‌ها:** همان `AppOptions` + `preset: 'minimal' | 'spa' | 'full'` (پیش‌فرض `'minimal'`).
**قاعدهٔ re-export:** هر پکیج L2/L3 دقیقاً یک بار، به‌صورت namespace؛ نام تکراری (`clearCache`, `alert`, …) در سطح بالا export نمی‌شود.
**تست:** `size-limit` برای هر preset؛ tree-shaking: import فقط `signal` ⇒ ≤ ۳ KB؛ تست باندل مرورگری با Playwright.

---

## ۳. P1 — قابلیت‌ها

### ۳.۱ `@zenith/i18n` (بازنویسی) — L2

**نقش:** چندزبانگی واقعی: پیام‌ها، plural، قالب عدد/تاریخ، locale واکنشی. ابزار جلالی فعلی به `@zenith/jalali` رفته است.

**API**
| export | امضا |
|---|---|
| `createI18n` | `(opts: I18nOptions) => I18n & Disposable` |
| `I18n.locale` | `Signal<string>` (خواندن/نوشتن) |
| `I18n.dir` | `ReadonlySignal<'rtl'\|'ltr'>` |
| `I18n.t` | `(key: string, params?: Params, o?: { locale?; default?; count? }) => string` |
| `I18n.te` / `I18n.tm` | وجود کلید / دریافت پیام خام |
| `I18n.n` | `(value: number, fmt?: string \| Intl.NumberFormatOptions) => string` |
| `I18n.d` | `(date: Date \| number, fmt?: string \| Intl.DateTimeFormatOptions) => string` |
| `I18n.rt` | `(value: number, unit: Intl.RelativeTimeFormatUnit) => string` |
| `I18n.list` | `(items: string[], o?) => string` |
| `I18n.setLocale` | `(l: string) => Promise<void>` (بارگذاری تنبل) |
| `I18n.addMessages` | `(locale, messages, o?: { merge }) => Cleanup` |
| `I18n.availableLocales` | `ReadonlySignal<string[]>` |
| `i18nPlugin` | `definePlugin` برای `app.use(i18nPlugin, opts)` |
| `useI18n` | `() => I18n` (از context برنامه) |
| `detectLocale` | `(opts, ctx?) => string` |

**قالب پیام (زیرمجموعهٔ ICU):**
```
سلام {name}
{count, plural, =0 {هیچ} one {# مورد} other {# مورد}}
{gender, select, male {او} female {او} other {آنها}}
{price, number, currency}   {when, date, short}
@:common.save               ← لینک به کلید دیگر
```

**گزینه‌ها (`I18nOptions`)**
| گزینه | نوع | پیش‌فرض | توضیح |
|---|---|---|---|
| `locale` | `string` | `'en'` | locale آغازین |
| `fallbackLocale` | `string \| string[]` | `'en'` | زنجیرهٔ fallback |
| `messages` | `Record<string, Messages>` | `{}` | |
| `loadMessages` | `(locale) => Promise<Messages>` | — | بارگذاری تنبل |
| `detect` | `Array<'query'\|'cookie'\|'storage'\|'navigator'\|'path'>` | `[]` | ترتیب تشخیص |
| `detectKey` | `string` | `'lang'` | نام query/cookie |
| `persist` | `string \| false` | `'zen.locale'` | کلید ذخیره (نیاز به `storage`) |
| `missing` | `'key'\|'empty'\|'throw'` | `'key'` | |
| `warnOnMissing` | `boolean` | dev: `true` | |
| `numberFormats` | `Record<string, Intl.NumberFormatOptions>` | `{}` | |
| `dateFormats` | `Record<string, Intl.DateTimeFormatOptions>` | `{}` | |
| `calendar` | `'gregory'\|'persian'` | بر اساس locale (`fa` ⇒ `'persian'`) | |
| `numberingSystem` | `'latn'\|'arab'\|'arabext'` | `'latn'` (`fa` ⇒ `'arabext'` اگر `digits:'locale'`) | |
| `timeZone` | `string` | `'UTC'` در SSR | هم‌خوانی سرور/کلاینت |
| `escapeParams` | `boolean` | `true` | escape HTML پارامترها |
| `syncDocument` | `boolean` | `true` | `lang` و `dir` روی `<html>` |
| `rtlLocales` | `string[]` | `['fa','ar','he','ur']` | |

**expressionها:** `$t(key, params)`, `$te(key)`, `$n(v, fmt)`, `$d(v, fmt)`, `$locale`, `$dir`.

**attributeها**
| attribute | مقدار | توضیح |
|---|---|---|
| `zen-t` | کلید پیام | جایگزین `textContent` |
| `zen-t-params` | expression شیء | `{ name: user.name }` |
| `zen-t-count` | expression عدد | برای plural |
| `zen-t-attr` | `attr:key; attr2:key2` | ترجمهٔ attribute (`title`, `placeholder`, `aria-label`) |
| `zen-t-html` | کلید | خروجی sanitize می‌شود |
| `zen-t-default` | رشته | متن جایگزین |
| `zen-locale` | locale | محدودهٔ زیردرخت (فقط این بخش) |
| `zen-dir` | `ltr`/`rtl`/`auto` | تعیین جهت زیردرخت |

**SSR:** locale از درخواست (`Accept-Language` / cookie / path) به `App` داده می‌شود؛ پیام‌های استفاده‌شده در `__ZENITH_I18N__` سریال می‌شوند تا hydration بدون fetch دوباره باشد. `timeZone` ثابت.
**خطا:** `ZEN-1301`…`1303` در `jalali`؛ در `i18n`: `ZEN-1311` کلید پیدا نشد (با `missing:'throw'`)، `ZEN-1312` قالب ICU نامعتبر، `ZEN-1313` locale پشتیبانی‌نشده، `ZEN-1314` بارگذاری پیام شکست خورد.
**a11y:** `lang`/`dir` همگام؛ `zen-locale` روی المان `lang` می‌گذارد.
**تست:** plural فارسی/انگلیسی/عربی، fallback زنجیره‌ای، hydration بدون mismatch، `zen-t-attr` با sanitize، تغییر locale واکنشی بدون rerender کامل.
**مهاجرت:** `toJalali`, `formatJalali`, … ← `@zenith/jalali` (alias با `deprecate`)؛ `toPersianNums` ← `jalali` یا `i18n.n` با `numberingSystem`.

---

### ۳.۲ `@zenith/a11y` — L2 — **تازه**

**API**
| export | امضا |
|---|---|
| `createFocusTrap` | `(el, opts?: FocusTrapOptions) => FocusTrap & Disposable` (`activate`, `deactivate`, `pause`, `unpause`) |
| `announce` | `(message: string, o?: { politeness?: 'polite'\|'assertive'; clearAfter?: number }) => void` |
| `createLiveRegion` | `(o?) => Disposable & { announce(msg) }` |
| `getFocusable` | `(root, o?: { includeHidden?: boolean }) => HTMLElement[]` |
| `focusFirst` / `focusLast` | `(root) => boolean` |
| `restoreFocus` | `() => Cleanup` (ذخیرهٔ المان فعال و بازگرداندن) |
| `createRovingTabindex` | `(container, o?: { orientation?; loop?; selector?; home?; end? }) => Disposable` |
| `inert` | `(el, on: boolean) => Cleanup` (با `inert` یا fallback) |
| `lockScroll` | `() => Cleanup` (شمارنده‌ای برای چند لایه) |
| `prefersReducedMotion` | `() => ReadonlySignal<boolean>` |
| `useId` | `(prefix?) => string` (قطعی در SSR) |
| `installRouteAnnouncer` | `(o?: RouteAnnouncerOptions) => Cleanup` |

**گزینه‌ها**
| `FocusTrapOptions` | نوع | پیش‌فرض |
|---|---|---|
| `initialFocus` | `string \| HTMLElement \| (() => HTMLElement)` | اولین المان focusable |
| `returnFocus` | `boolean` | `true` |
| `escapeDeactivates` | `boolean` | `true` |
| `clickOutsideDeactivates` | `boolean` | `false` |
| `allowOutsideClick` | `boolean \| ((e) => boolean)` | `false` |
| `fallbackFocus` | `string \| HTMLElement` | خود container با `tabindex=-1` |

| `RouteAnnouncerOptions` | نوع | پیش‌فرض |
|---|---|---|
| `mainSelector` | `string` | `'[data-zen-main], main'` |
| `title` | `(route) => string` | `document.title` |
| `message` | `(title) => string` | `` `رفتید به ${title}` `` |
| `focusMain` | `boolean` | `true` |
| `politeness` | `'polite'\|'assertive'` | `'polite'` |

**attributeها**
| attribute | مقدار | گزینه‌ها |
|---|---|---|
| `zen-focus-trap` | expression boolean (فعال/غیرفعال) | `zen-focus-trap-initial` (selector)، `zen-focus-trap-return` (boolean)، `zen-focus-trap-escape` (boolean) |
| `zen-announce` | expression رشته | `zen-announce-politeness` (`polite`/`assertive`)، `zen-announce-clear` (مدت، پیش‌فرض `5s`) |
| `zen-live` | `polite`/`assertive`/`off` | `role="status"`/`"alert"` و `aria-atomic` را می‌گذارد |
| `zen-roving` | `horizontal`/`vertical`/`both` | `zen-roving-loop` (پیش‌فرض `true`)، `zen-roving-selector` |
| `zen-autofocus` | expression boolean | |
| `zen-inert` | expression boolean | |
| `zen-scroll-lock` | expression boolean | |
| `zen-reduced-motion` | `skip`/`fade` | جایگزین انیمیشن‌های `transition` |

**SSR:** no-op؛ `useId` قطعی. directiveها `client-only`.
**خطا:** `ZEN-1401` المان focusable پیدا نشد (trap بدون fallback)؛ `ZEN-1402` trap تو در تو بدون ترتیب پشتیبانی نمی‌شود (پشتهٔ trap داخلی است، ولی هشدار)؛ `ZEN-1403` `aria-*` ناسازگار.
**تست:** با `axe-core` روی `ui` و `router`; تست کیبورد (Tab/Shift+Tab/Esc/Home/End)؛ `prefers-reduced-motion` شبیه‌سازی‌شده.
**مصرف:** `ui`, `router`, `notifications`, `data-table`, `crud`, `transition`.

---

### ۳.۳ `@zenith/head` — L2 — **تازه**

**API**
| export | امضا |
|---|---|
| `createHead` | `(opts?: HeadOptions) => Head & Disposable` |
| `useHead` | `(input: HeadInput \| (() => HeadInput)) => HeadEntry & Disposable` (`patch`, `dispose`) |
| `renderHead` | `(head) => { headTags: string; htmlAttrs: string; bodyAttrs: string }` |
| `headPlugin` | پلاگین `app.use(headPlugin, opts)` |
| `titleFromRoute` | `(route, template?) => string` |

**`HeadInput` (همهٔ فیلدها `MaybeSignal`):** `title`, `titleTemplate`, `meta: Array<{ name?; property?; content; key? }>`, `link: Array<{ rel; href; key? ... }>`, `script: Array<{ type?; children?; src?; key? }>`, `htmlAttrs: { lang?; dir?; class? }`, `bodyAttrs`, `base`.

**گزینه‌ها (`HeadOptions`)**
| گزینه | نوع | پیش‌فرض |
|---|---|---|
| `titleTemplate` | `string \| ((t) => string)` | `'%s'` |
| `dedupe` | `Array<'name'\|'property'\|'rel+href'\|'key'>` | همهٔ موارد |
| `nonce` | `string` | — |
| `maxTags` | `number` | `100` (هشدار dev) |
| `allowScript` | `Array<'application/ld+json'>` | `['application/ld+json']` |

**attributeها**
| attribute / المان | توضیح |
|---|---|
| `<zen-head>` | فرزندانش (`title`, `meta`, `link`) به `<head>` منتقل و مدیریت می‌شوند |
| `zen-head-title="expr"` | تعیین عنوان واکنشی روی هر المان |
| `zen-head-description="expr"` | `meta[name=description]` |
| `zen-head-canonical="expr"` | `link[rel=canonical]` |
| `zen-head-og-image="expr"` | `meta[property=og:image]` |
| `zen-head-key` | کلید dedupe |

**SSR:** هر درخواست یک `Head` جدا؛ `ssr.generateFullPage` از `renderHead` استفاده می‌کند (وابستگی `ssr → head` اختیاری و peer). تگ‌های مدیریت‌شده `data-zen-head` دارند تا کلاینت بازاستفاده کند.
**امنیت:** مقادیر escape؛ `script` فقط JSON-LD با `JSON.stringify` و جایگزینی `</script`؛ `nonce` به تگ‌ها اعمال می‌شود.
**خطا:** `ZEN-1501` تگ مجاز نیست؛ `ZEN-1502` JSON-LD نامعتبر؛ `ZEN-1503` تعداد تگ‌ها بیش از `maxTags`.
**تست:** SSR + hydration بدون تگ تکراری، اولویت entry آخر، پاک‌سازی هنگام `dispose`.

---

### ۳.۴ `@zenith/ui` — L2 — **تازه** (+ استخراج `zen-date-picker`, `zen-portal` از `runtime`)

**نقش:** primitiveهای headless (بدون استایل)، دسترس‌پذیر. هر کامپوننت هم API برنامه‌نویسی و هم directive دارد. هر کدام subpath جدا برای tree-shaking.

**ابزار مشترک (`@zenith/ui/position`):** `computePosition(reference, floating, { placement, offset, flip, shift, arrow }) → { x, y, placement }`, `autoUpdate(ref, floating, update) → Cleanup`.

**نشانه‌های مشترک:** `data-state="open|closed"`, `data-placement`, `data-disabled`, `data-orientation`. متغیرها: `--zen-ui-z-index` (پیش‌فرض `1000`), `--zen-ui-anchor-width`, `--zen-ui-available-height`. وابستگی `transition` برای ورود/خروج؛ با `prefers-reduced-motion` خاموش می‌شود.

#### Dialog (`@zenith/ui/dialog`)
API: `createDialog(opts) → { open: Signal<boolean>, show(), hide(), toggle(), ids: { title, description }, dispose }`.
| attribute | پیش‌فرض | توضیح |
|---|---|---|
| `zen-dialog="expr"` | — | signal/expression قابل‌نوشتن برای باز بودن |
| `zen-dialog-modal` | `true` | `aria-modal`, `inert` بقیه، focus trap |
| `zen-dialog-role` | `dialog` | یا `alertdialog` |
| `zen-dialog-close-on-esc` | `true` | |
| `zen-dialog-close-on-backdrop` | `true` | |
| `zen-dialog-initial-focus` | اولین focusable | selector |
| `zen-dialog-return-focus` | `true` | |
| `zen-dialog-scroll-lock` | `true` | |
| `zen-dialog-portal` | `body` | selector مقصد |
| پارت‌ها | | `zen-dialog-title`, `zen-dialog-description`, `zen-dialog-close`, `zen-dialog-backdrop` |
| رویدادها | | `zen-dialog-open`, `zen-dialog-close` (`detail: { reason: 'esc'\|'backdrop'\|'api' }`) |

#### Popover (`@zenith/ui/popover`) و Tooltip (`@zenith/ui/tooltip`)
| attribute | پیش‌فرض | توضیح |
|---|---|---|
| `zen-popover="expr"` | — | باز بودن |
| `zen-popover-trigger` | — | selector یا `#id` |
| `zen-popover-placement` | `bottom` | `top/bottom/left/right` + `-start/-end` |
| `zen-popover-offset` | `8` | px |
| `zen-popover-flip` / `zen-popover-shift` | `true` | |
| `zen-popover-arrow` | `false` | |
| `zen-popover-trigger-on` | `click` | `click`/`hover`/`focus`/`manual` |
| `zen-tooltip="text expr"` | — | `role="tooltip"` + `aria-describedby` خودکار |
| `zen-tooltip-placement` | `top` | |
| `zen-tooltip-delay` | `500ms` | تأخیر نمایش |
| `zen-tooltip-hide-delay` | `0` | |
| `zen-tooltip-disabled` | `false` | |

#### Menu (`@zenith/ui/menu`)
`zen-menu` (container، `role="menu"`)، `zen-menu-trigger`، `zen-menu-item` (`role="menuitem"`)، `zen-menu-item-disabled`، `zen-menu-checkbox`/`zen-menu-radio`؛ گزینه‌ها: `zen-menu-loop` (`true`), `zen-menu-typeahead` (`true`), `zen-menu-close-on-select` (`true`). کیبورد: Arrow/Home/End/Enter/Space/Esc/حرف. رویداد: `zen-menu-select` (`detail: { value }`).

#### Tabs (`@zenith/ui/tabs`)
`zen-tabs="activeExpr"`، `zen-tablist`، `zen-tab="id"`، `zen-tabpanel="id"`؛ گزینه‌ها: `zen-tabs-orientation` (`horizontal`), `zen-tabs-activation` (`auto`/`manual`، پیش‌فرض `auto`), `zen-tabs-lazy` (`false`). `aria-controls`/`aria-labelledby` خودکار. رویداد: `zen-tabs-change`.

#### Accordion (`@zenith/ui/accordion`)
`zen-accordion="valueExpr"`، `zen-accordion-item="id"`، `zen-accordion-trigger`، `zen-accordion-panel`؛ `zen-accordion-multiple` (`false`), `zen-accordion-collapsible` (`true`). رویداد: `zen-accordion-change`.

#### Combobox (`@zenith/ui/combobox`)
`zen-combobox="valueExpr"`، `zen-combobox-options="listExpr"`، `zen-combobox-option-label` / `zen-combobox-option-value` (مسیر فیلد)، `zen-combobox-filter` (`contains`/`startsWith`/`none`), `zen-combobox-allow-custom` (`false`), `zen-combobox-async` (نام تابع loader)، `zen-combobox-debounce` (`250ms`), `zen-combobox-min-chars` (`0`), `zen-combobox-multiple` (`false`). `role="combobox"` + `aria-expanded/controls/activedescendant`. رویدادها: `zen-combobox-change`, `zen-combobox-input`.

#### Date picker (`@zenith/ui/date-picker`) — از `runtime` منتقل می‌شود
المان `<zen-date-picker>` (سازگار با فعلی: `value`). attributeهای جدید:
| attribute | پیش‌فرض |
|---|---|
| `value` | — (ISO یا جلالی طبق `calendar`) |
| `calendar` | `jalali` (`gregorian`) |
| `locale` | locale برنامه |
| `min` / `max` | — |
| `first-day` | `6` (شنبه) برای `jalali`، `1` برای `gregorian` |
| `format` | `YYYY/MM/DD` |
| `disabled` / `readonly` / `required` | `false` |
| `name` | — (برای فرم) |
| `range` | `false` |
| رویداد | `zen-date-picker-change` |

**گزینه‌های برنامه‌نویسی:** هر `createX` همان attributeها را camelCase دریافت می‌کند (`closeOnEsc`, `initialFocus`, `placement`, …) و `MaybeSignal` می‌پذیرد.
**SSR:** `client-only` برای popover/tooltip/menu/combobox؛ `dialog`, `tabs`, `accordion` با وضعیت اولیه رندر می‌شوند.
**a11y:** الگوهای WAI-ARIA APG؛ همه با `@zenith/a11y`.
**خطا:** `ZEN-1601` المان trigger پیدا نشد؛ `ZEN-1602` `zen-tab` بدون `zen-tabpanel`؛ `ZEN-1603` مقدار `value` خارج از گزینه‌ها؛ `ZEN-1604` `portal` مقصد ندارد.
**تست:** axe برای هر کامپوننت؛ کیبورد کامل؛ RTL؛ stacking دو dialog؛ حذف از DOM در وسط انیمیشن.
**مهاجرت:** `zen-date-picker`, `zen-portal` از `runtime` ← `ui` (runtime برای یک نسخه re-export/نصب خودکار می‌کند).

---

### ۳.۵ `@zenith/realtime` — L2 — **تازه**

**API**
| export | امضا |
|---|---|
| `createRealtime` | `(opts: RealtimeOptions) => Realtime & Disposable` |
| `Realtime` | `status: ReadonlySignal<Status>`, `lastMessage`, `messages` (آخرین N)، `error`, `open()`, `close(code?, reason?)`, `send(data)`, `subscribe(topic, cb) → Cleanup`, `on(event, cb) → Cleanup` |
| `createWebSocket` / `createSSE` | میان‌بر برای `transport` |
| `realtimePlugin` | پلاگین |

`Status`: `'idle' | 'connecting' | 'open' | 'closing' | 'closed' | 'error'`.

**گزینه‌ها (`RealtimeOptions`)**
| گزینه | نوع | پیش‌فرض | واحد |
|---|---|---|---|
| `url` | `string \| (() => string)` | الزامی | |
| `transport` | `'ws' \| 'sse'` | `'ws'` | |
| `protocols` | `string[]` | `[]` | |
| `autoConnect` | `boolean` | `true` | |
| `reconnect` | `boolean \| { retries; delay; factor; jitter; maxDelay }` | `{ retries: Infinity, delay: 1000, factor: 2, jitter: 0.3, maxDelay: 30000 }` | ms |
| `heartbeat` | `false \| { interval; timeout; message }` | `false` | ms |
| `parse` | `'json' \| 'text' \| (raw) => T` | `'json'` | |
| `serialize` | `(data) => string \| ArrayBuffer` | `JSON.stringify` | |
| `auth` | `() => string \| Promise<string>` | — | توکن |
| `authMode` | `'subprotocol' \| 'first-message' \| 'query'` | `'first-message'` | |
| `queue` | `{ maxSize; whileDisconnected: 'buffer'\|'drop' }` | `{ maxSize: 100, whileDisconnected: 'buffer' }` | |
| `history` | `number` | `50` | تعداد پیام نگه‌داری‌شده |
| `signal` | `AbortSignal` | — | |
| `allowInsecure` | `boolean` | `false` | `ws://` غیر localhost مجاز؟ |

**attributeها**
| attribute | پیش‌فرض | توضیح |
|---|---|---|
| `zen-ws="url"` / `zen-sse="url"` | — | اتصال و صدور state |
| `zen-state` | `data` | نام state: `{ status, message, messages, error }` |
| `zen-realtime-topic` | — | فیلتر موضوع |
| `zen-realtime-reconnect` | `true` | boolean یا مدت اولین تأخیر |
| `zen-realtime-protocols` | — | با کاما |
| `zen-realtime-parse` | `json` | `json`/`text` |
| `zen-realtime-history` | `50` | |
| `zen-realtime-send` | — | expression ارسال هنگام تغییر |
| `zen-realtime-options` | — | JSON |
| رویدادها | | `zen-realtime-open`, `zen-realtime-message`, `zen-realtime-close`, `zen-realtime-error` |

**SSR:** در سرور وصل نمی‌شود؛ `status: 'idle'` و state اولیه. در hydration خودکار وصل می‌شود.
**امنیت:** توکن پیش‌فرض در پیام اول (نه URL)؛ `ws://` غیر localhost در production هشدار/خطا؛ اندازهٔ پیام و نرخ قابل محدودسازی (`maxMessageSize`).
**خطا:** `ZEN-1701` اتصال شکست خورد؛ `ZEN-1702` پیام نامعتبر (parse)؛ `ZEN-1703` پروتکل ناامن؛ `ZEN-1704` صف پر؛ `ZEN-1705` heartbeat timeout.
**تست:** سرور WS آزمایشی؛ reconnect با backoff و jitter؛ `dispose` وسط اتصال؛ نشت timer.

---

### ۳.۶ `@zenith/analytics` — L2 — **استخراج** از `runtime` (`zen-track`, `configureAnalytics`)

**API**
| export | امضا |
|---|---|
| `createAnalytics` | `(opts?: AnalyticsOptions) => Analytics & Disposable` |
| `Analytics` | `track(event, props?)`, `page(path?, props?)`, `identify(id, traits?)`, `setConsent(c)`, `flush()`, `use(provider) → Cleanup` |
| providerها | `gtagProvider({id})`, `plausibleProvider({domain})`, `consoleProvider()`, `beaconProvider({url})` |
| `analyticsPlugin` | پلاگین (دنبال‌کردن خودکار مسیر با `router`) |

**گزینه‌ها**
| گزینه | نوع | پیش‌فرض |
|---|---|---|
| `providers` | `Provider[]` | `[]` |
| `consent` | `{ required: boolean; default: boolean }` | `{ required: true, default: false }` |
| `respectDNT` | `boolean` | `true` |
| `autoPageViews` | `boolean` | `true` |
| `sampleRate` | `number` | `1` |
| `batch` | `{ size; interval }` | `{ size: 10, interval: 5000 }` |
| `redact` | `string[]` | لیست logger |
| `sessionTimeout` | `number` | `30m` |

**attributeها (سازگار با `zen-track` فعلی)**
| attribute | پیش‌فرض | توضیح |
|---|---|---|
| `zen-track="event"` | — | نام رویداد |
| `zen-track-on` | `click` | `click`/`submit`/`visible`/`change` |
| `zen-track-props` | — | expression شیء |
| `zen-track-label` | — | معادل `data-label` فعلی (که پشتیبانی می‌شود) |
| `zen-track-once` | `false` | |
| `zen-track-debounce` | `0` | |

**SSR:** no-op. **حریم خصوصی:** بدون رضایت هیچ رویدادی ارسال نمی‌شود؛ صف تا تأیید نگه‌داری نمی‌شود (حذف).
**خطا:** `ZEN-1901` ارائه‌دهنده شکست خورد (جدا از برنامه، خطا بلعیده نمی‌شود)؛ `ZEN-1902` رضایت لازم است.

---

### ۳.۷ `@zenith/adapter-node` — L4 — **تازه**

**API**
| export | امضا |
|---|---|
| `createNodeHandler` | `(opts: NodeAdapterOptions) => (req, res, next?) => void` (Node http / Express / Connect / Fastify middleware) |
| `createNodeServer` | `(opts) => { listen(port, host?) → Promise<void>; close() → Promise<void>; handler }` |
| `serveStatic` | `(dir, opts) => handler` |

**گزینه‌ها (`NodeAdapterOptions`)**
| گزینه | نوع | پیش‌فرض | توضیح |
|---|---|---|---|
| `template` | `string \| (() => Promise<string>)` | الزامی | HTML پایه |
| `app` | `() => App \| Promise<App>` | الزامی | یک `App` جدید برای هر درخواست |
| `routes` | `string[] \| (path) => boolean` | همه | |
| `stream` | `boolean` | `true` | `renderToStream` با backpressure |
| `timeout` | `number` | `10000` ms | سقف رندر؛ بعد از آن `503` |
| `staticDir` | `string` | — | |
| `cacheControl` | `(req, result) => string` | `no-store` برای HTML | |
| `etag` | `boolean` | `true` برای static | |
| `compression` | `boolean \| 'gzip' \| 'br'` | `true` | |
| `csp` | `{ nonce: boolean; policy?: CSPOptions }` | `{ nonce: true }` | تولید nonce و تزریق |
| `trustProxy` | `boolean` | `false` | |
| `health` | `string \| false` | `'/healthz'` | |
| `onError` | `(err, req, res) => void` | پاسخ `500` ساده | |
| `onAbort` | `(req) => void` | — | قطع اتصال کلاینت ⇒ `AbortSignal` لغو |
| `gracefulShutdownTimeout` | `number` | `10000` ms | |
| `logger` | `Logger` | پیش‌فرض | `requestId` در هر لاگ |

**رفتار:** ایزولاسیون هر درخواست با `AsyncLocalStorage`؛ لغو رندر هنگام قطع اتصال؛ بدون نشت state بین درخواست‌ها.
**خطا:** `ZEN-1801` رندر timeout؛ `ZEN-1802` template نامعتبر (بدون `<!--zen-outlet-->`)؛ `ZEN-1803` ALS در دسترس نیست.
**تست:** ۱۰۰ درخواست هم‌زمان با state متفاوت؛ client abort؛ استریم با کلاینت کند؛ CSP nonce.

### ۳.۸ `@zenith/adapter-edge` — L4 — **تازه**

**API:** `createFetchHandler(opts) => (request: Request, env?, ctx?) => Promise<Response>` (Cloudflare Workers، Deno، Bun، Vercel Edge)، `createCloudflareHandler`, `createDenoHandler`.
**گزینه‌ها:** همان `NodeAdapterOptions` به‌جز `staticDir`/`compression`/`trustProxy`؛ به‌علاوه `domImpl: 'linkedom' | 'happy-dom'` (peer؛ پیش‌فرض `linkedom`، چون `jsdom` در Edge ممکن نیست)، `waitUntil: boolean` (پیش‌فرض `true`)، `assets: (path) => Promise<Response \| undefined>`.
**نیازمندی:** `ssr` باید رندر بدون `jsdom` و بدون `AsyncLocalStorage` (با fallback به context صریح) را پشتیبانی کند — تغییر مورد نیاز در `ssr` (ثبت در بند ۵).
**خطا:** `ZEN-1811` runtime پشتیبانی نمی‌شود؛ `ZEN-1812` DOM implementation نصب نیست.
**تست:** اجرا روی Miniflare و Deno؛ حجم باندل ≤ ۱ MB.

---

### ۳.۹ `create-zenith` — tooling — **تازه** (استخراج قالب‌ها از `cli`)

**فراخوانی:** `npm create zenith@latest [name] -- [flags]`.
**flags**
| flag | نوع | پیش‌فرض |
|---|---|---|
| `--template` | `spa \| ssr \| pwa \| dashboard \| minimal` | تعاملی |
| `--typescript` / `--no-typescript` | boolean | `true` |
| `--pm` | `npm \| pnpm \| yarn \| bun` | تشخیص از `npm_config_user_agent` |
| `--install` / `--no-install` | boolean | `true` |
| `--git` / `--no-git` | boolean | `true` |
| `--force` | boolean | `false` |
| `--dry-run` | boolean | `false` |
| `--yes` | boolean | `false` (غیرتعاملی) |
| `--json` | boolean | `false` |

**قواعد:** نام پروژه فقط `[a-z0-9-_.]` و بدون `..`، مسیر مطلق یا جداکننده (`ZEN-2501`)؛ پوشهٔ غیرخالی بدون `--force` خطا؛ کد خروج: `0` موفق، `1` خطای کاربر، `2` خطای سیستم؛ بدون ارسال telemetry.
**ساختار قالب‌ها:** پکیج `@zenith/templates` (داده‌محور، بدون template literal تودرتو که منشأ باگ‌های `templates.ts` بود) + تست snapshot و بیلد هر قالب در CI.

### ۳.۱۰ `@zenith/eslint-plugin` — tooling — **تازه**

**configها:** `recommended`, `strict`, `library` (برای پکیج‌های Zenith)، `template` (برای `.html`).
**قوانین کد (`zenith/*`)**
| قانون | توضیح | پیش‌فرض |
|---|---|---|
| `no-console` | به‌جز sink | error |
| `no-plain-error` | `throw new Error` ⇒ `ZenithError` | error |
| `no-destroy-alias` | `destroy/cancel/stop` در API عمومی | error |
| `options-object` | `create*` آرگومان تنظیمات موقعیتی نگیرد | error |
| `dispose-required` | خروجی `create*` باید `dispose` داشته باشد | error |
| `no-module-state` | `let` سطح ماژول در پکیج‌ها (به‌جز allowlist) | warn |
| `no-math-random-security` | `Math.random` در مسیرهای امنیتی | error |
| `no-deprecated-api` | استفادهٔ aliasهای deprecated | warn |
| `no-global-name-collision` | نام export عمومی تکراری | error |
| `tsdoc-default` | هر گزینهٔ عمومی `@default` داشته باشد | warn |

**قوانین قالب (`zenith/template/*`، پردازندهٔ `.html` و template literal)**
`valid-directive` (نام و مقدار طبق `DirectiveMeta`)، `no-unknown-directive`، `no-unknown-option`، `require-key-in-for`، `no-structural-conflict`، `valid-expression` (parse + validator امن)، `no-forbidden-identifier`، `a11y/*` (`button-name`, `img-alt`, `form-label`, `no-positive-tabindex`, `dialog-label`).
**گزینه‌ها:** هر قانون `[severity, options]`؛ تنظیم مشترک `settings.zenith = { version, packages: [...] }` برای انتخاب متادیتا.
**وابستگی:** `@zenith/expressions` (parse)، `@zenith/schema` (متادیتا).

### ۳.۱۱ `@zenith/language-server` — tooling — **استخراج** از `vscode-extension`

**قابلیت‌ها (LSP 3.17):** diagnostics (کدهای `ZEN-xxx` + quick-fix)، completion (directive، گزینه‌ها با مقدار مجاز، متغیرهای state، `$t` کلیدها)، hover (مستندات TSDoc/`DirectiveMeta`)، go-to-definition (state، action، component)، find references، rename (state/action/کامپوننت)، formatting، semantic tokens (expressions)، code actions (جایگزینی API deprecated، با codemod)، folding، document links (`zen-link`).
**منبع داده:** `zenith.meta.json` تولیدشده توسط `@zenith/schema` از هر پکیج؛ `html.customData.json` برای ویرایشگرهای بدون LSP.
**گزینه‌ها (`zenith.config.json` یا تنظیمات ویرایشگر)**
| گزینه | نوع | پیش‌فرض |
|---|---|---|
| `zenith.validate.enable` | boolean | `true` |
| `zenith.validate.strict` | boolean | `false` |
| `zenith.completion.snippets` | boolean | `true` |
| `zenith.trace.server` | `off`/`messages`/`verbose` | `off` |
| `zenith.packages` | `string[]` | کشف خودکار از `package.json` |
| `zenith.maxFileSize` | عدد (KB) | `1024` |

**ساختار:** `vscode-extension` فقط کلاینت نازک (بسته‌بندی با `vsce`، تست با `@vscode/test-electron`)؛ فایل ۱۰۹۷ خطی به ماژول‌های server/client تقسیم می‌شود.
**خطا:** سرور هرگز کرش نمی‌کند؛ هر handler داخل try/catch با `logger`؛ `ZEN-2510` متادیتا بارگذاری نشد.

---

## ۴. P2 — اکوسیستم

### ۴.۱ `@zenith/theme` — L2

**API:** `createTheme(opts) → Theme & Disposable` با `mode: Signal<'light'|'dark'|'system'>`، `resolved: ReadonlySignal<'light'|'dark'>`، `dir: Signal<'ltr'|'rtl'>`، `setMode(m)`، `toggle()`، `tokens(name) → string`؛ `themeInitScript({ nonce?, storageKey, attribute }) → string` (اسکریپت inline بسیار کوچک برای جلوگیری از flash)؛ `themePlugin`.
**گزینه‌ها**
| گزینه | نوع | پیش‌فرض |
|---|---|---|
| `defaultMode` | `'light'\|'dark'\|'system'` | `'system'` |
| `storageKey` | `string \| false` | `'zen.theme'` |
| `attribute` | `'data-theme' \| 'class'` | `'data-theme'` |
| `modes` | `Record<string, Tokens>` | `{ light: {}, dark: {} }` |
| `tokenPrefix` | `string` | `'--zen'` |
| `dir` | `'ltr'\|'rtl'\|'auto'` | `'auto'` (از locale) |
| `transitionDisabledOnChange` | `boolean` | `true` (جلوگیری از چشمک) |
| `cookie` | `boolean` | `false` (برای SSR بدون flash) |

**attributeها:** `zen-theme="expr"` (اعمال حالت روی زیردرخت)، `zen-theme-toggle` (دکمه؛ `aria-pressed` خودکار)، `zen-theme-mode` (`light`/`dark`/`system`)، `zen-dir="rtl|ltr|auto"`.
**SSR:** حالت از cookie؛ `themeInitScript` در `<head>` (CSP nonce).
**خطا:** `ZEN-2001` token نامعتبر؛ `ZEN-2002` ذخیره‌گاه در دسترس نیست.

### ۴.۲ `@zenith/auth-oauth` — L2

**نقش:** OAuth2/OIDC با PKCE؛ به `auth` فعلی با یک adapter وصل می‌شود.
**API:** `createOAuthClient(opts) → OAuthClient & Disposable`؛ متدها: `login(opts?: { provider?; scopes?; prompt?; loginHint? })`، `handleCallback(url?) → Promise<AuthResult>`، `logout(opts?: { federated? })`، `refresh()`، `getAccessToken() → Promise<string>`، `user: ReadonlySignal<User \| null>`، `status: ReadonlySignal<...>`؛ `oauthAuthAdapter(client) → AuthAdapter` برای `auth`؛ `discover(issuer) → Promise<OidcConfig>`.
**گزینه‌ها**
| گزینه | نوع | پیش‌فرض |
|---|---|---|
| `issuer` | `string` | الزامی (یا `authorizationEndpoint`/`tokenEndpoint`) |
| `clientId` | `string` | الزامی |
| `redirectUri` | `string` | الزامی |
| `scopes` | `string[]` | `['openid','profile','email']` |
| `pkce` | `boolean` | `true` (غیرفعال‌شدنی نیست مگر `allowInsecure`) |
| `responseType` | `'code'` | `'code'` |
| `storage` | `'memory' \| 'session' \| Storage` | `'memory'` |
| `silentRenew` | `boolean \| { iframe; interval }` | `true` |
| `renewBefore` | `number` | `60s` |
| `stateTtl` | `number` | `10m` |
| `clockSkew` | `number` | `60s` |
| `extraParams` | `Record<string,string>` | `{}` |

**attributeها:** `zen-oauth-login="provider"` (دکمه)، `zen-oauth-scope`، `zen-oauth-prompt`، `zen-oauth-callback` (المان/مسیر callback)، `zen-oauth-logout`، `zen-oauth-state` (نام state، پیش‌فرض `auth`).
**امنیت:** `state` و `nonce` تصادفی با `crypto`؛ `code_verifier` S256؛ اعتبارسنجی `id_token` (امضا با JWKS، `iss`, `aud`, `exp`, `nonce`)؛ توکن در `memory` به‌صورت پیش‌فرض.
**خطا:** `ZEN-2101` state نامطابق؛ `ZEN-2102` `id_token` نامعتبر؛ `ZEN-2103` discovery شکست؛ `ZEN-2104` refresh منقضی؛ `ZEN-2105` callback بدون code.

### ۴.۳ `@zenith/ssg` — L4

**API:** `prerender(opts) → Promise<PrerenderReport>`؛ `defineStaticRoutes(...)`، CLI: `zenith ssg`.
**گزینه‌ها**
| گزینه | نوع | پیش‌فرض |
|---|---|---|
| `routes` | `string[] \| () => Promise<string[]>` | از جدول router |
| `crawl` | `boolean` | `false` |
| `template` | `string` | `index.html` |
| `outDir` | `string` | `dist` |
| `concurrency` | `number` | `4` |
| `trailingSlash` | `boolean` | `false` |
| `sitemap` | `false \| { hostname; changefreq }` | `false` |
| `robots` | `boolean \| string` | `false` |
| `failOnError` | `boolean` | `true` |
| `timeout` | `number` | `15000` ms |

متادیتای route: `{ prerender: true, getStaticPaths(): Promise<Record<string,string>[]> }`. attribute برای المان `<zen-route>`: `prerender`، `prerender-paths` (JSON/expression).
**خطا:** `ZEN-1821` مسیر رندر نشد؛ `ZEN-1822` داده در build در دسترس نیست.

### ۴.۴ `unplugin-zenith` — tooling

**نقش:** پشتیبانی Vite، Rollup، webpack، esbuild و Rspack از یک کد (`vite-plugin` فعلی یک wrapper نازک بالای آن می‌ماند).
**API:** `export default createUnplugin(opts)`؛ subpathها `unplugin-zenith/vite|rollup|webpack|esbuild|rspack`.
**گزینه‌ها (نام‌ها با `vite-plugin` یکی می‌شوند و یک `CompileOptions` وجود دارد):**
| گزینه | نوع | پیش‌فرض |
|---|---|---|
| `include` / `exclude` | `string[]` | `['**/*.html']` / `['node_modules/**']` |
| `compile` | `boolean \| { strict?: boolean }` | `true` |
| `devtools` | `boolean` | `true` در dev |
| `htmlHmr` | `boolean` | `true` |
| `watchPatterns` | `string[]` | `[]` |
| `meta` | `boolean` | `true` (تولید `zenith.meta.json` برای ابزار) |

**خطا:** `ZEN-2520` پلاگین روی bundler پشتیبانی‌نشده؛ `ZEN-2521` HMR ناسازگار.

### ۴.۵ `@zenith/mock` — tooling (dev/test)

**API:** `createMockServer(handlers, opts?) → MockServer & Disposable` (`listen()`, `close()`, `use(...handlers)`, `reset()`, `calls`)؛ `rest.get|post|put|patch|delete(url, resolver)`؛ `ws.link(url)`؛ `delay(ms)`، `passthrough()`، `respond({ status, headers, json, text })`؛ `installFetchMock()` (تست)، `setupWorker()` (مرورگر، بر پایهٔ Service Worker).
**گزینه‌ها:** `onUnhandledRequest: 'error'|'warn'|'bypass'` (پیش‌فرض `'error'`)، `baseURL`، `latency: number | [min,max]` (پیش‌فرض `0`)، `record: boolean` (پیش‌فرض `false`).
**ادغام:** `@zenith/testing` یک `mockHttp()` از آن می‌سازد؛ `http`/`resource` بدون تغییر کار می‌کنند.
**خطا:** `ZEN-2530` درخواست بدون handler؛ `ZEN-2531` handler دو بار پاسخ داد.

### ۴.۶ `@zenith/testing-e2e` — tooling

**API (Playwright fixtures):** `test` (extend شده)، `mountApp(page, { html, state, plugins })`، `waitForHydration(page)`، `getSignal(page, name)`، `setSignal(page, name, value)`، `expectNoA11yViolations(page, opts?)`، `expectNoConsoleErrors(page)`، `snapshotDevtools(page)`.
**گزینه‌ها:** `baseURL`، `a11y: { rules?; exclude?; impact: 'minor'|'moderate'|'serious'|'critical' }` (پیش‌فرض `'serious'`)، `failOnConsoleError` (`true`)، `hydrationTimeout` (`5s`).
**ادغام CI:** گزارش HTML و trace هنگام شکست.

### ۴.۷ `@zenith/codemod` — tooling

**CLI:** `zenith upgrade [--from 1.4] [--to 2.0] [--dry] [--glob "src/**/*.{ts,html}"] [--write] [--report json]`.
**تبدیل‌ها (هر کدام جدا اجرا می‌شود):**
| id | تبدیل |
|---|---|
| `destroy-to-dispose` | `x.destroy()` / `x.cancel()` ⇒ `x.dispose()` |
| `process-to-bind` | `processX(...)` ⇒ `bindX(...)` + امضای جدید |
| `clear-to-reset` | `clearX()` در تست ⇒ `resetForTesting()` |
| `form-unify` | `createReactiveForm/createAdvancedForm/createWizardForm` ⇒ `createForm({ mode })` |
| `error-class` | `throw new Error` ⇒ `ZenithError` با کد |
| `console-to-logger` | `console.*` ⇒ `logger.*` |
| `cache-unify` | cacheهای قدیمی ⇒ `createCache` |
| `i18n-jalali` | import توابع جلالی از `i18n` ⇒ `jalali` |
| `runtime-imports` | importهای `@zenith/runtime` ⇒ `zenith` یا `runtime-core` |

**خروجی گزارش:** فایل‌های تغییرکرده، موارد نیازمند بازبینی دستی (با شمارهٔ خط)، و `exit code ≠ 0` اگر `--check` و تغییری لازم باشد.

### ۴.۸ `@zenith/feature-flags` — L2

**API:** `createFlags(opts) → Flags & Disposable` (`flag(name, def?) → ReadonlySignal<boolean>`، `variant(name) → ReadonlySignal<string | null>`، `setContext(ctx)`، `override(name, value) → Cleanup`، `refresh()`)؛ `flagsPlugin`.
**گزینه‌ها**
| گزینه | نوع | پیش‌فرض |
|---|---|---|
| `source` | `Record<string, FlagDef> \| (() => Promise<...>)` | `{}` |
| `context` | `Record<string, unknown>` | `{}` |
| `rollout` | `'hash' \| 'random'` | `'hash'` (پایدار بر اساس `userId`) |
| `persist` | `string \| false` | `false` |
| `refreshInterval` | `number` | `0` (خاموش) |
| `bootstrap` | `Record<string, boolean>` | `{}` (برای SSR) |

**attributeها:** `zen-flag="name"` (نمایش اگر روشن)، `zen-flag-else`، `zen-flag-variant="exp:variantA"` (نمایش برای واریانت)، `zen-flag-default` (boolean).
**SSR:** `bootstrap` در HTML تزریق می‌شود تا flicker نداشته باشد.
**خطا:** `ZEN-2201` پرچم تعریف نشده (فقط dev)؛ `ZEN-2202` بارگذاری source شکست.

### ۴.۹ `@zenith/charts` — L2 (اختیاری)

**API:** `createChart(el, opts) → Chart & Disposable` (`update(data)`، `resize()`، `toImage()`)؛ رندر SVG؛ جدول متنی جایگزین برای screen reader.
**انواع:** `line`, `area`, `bar`, `pie`, `scatter`.
**گزینه‌ها**
| گزینه | نوع | پیش‌فرض |
|---|---|---|
| `type` | نوع نمودار | `'line'` |
| `data` | `MaybeSignal<Row[]>` | الزامی |
| `x` / `y` | مسیر فیلد (`y` می‌تواند آرایه) | الزامی |
| `series` | `Array<{ field; label; color? }>` | از `y` |
| `height` | `number` | `300` px |
| `legend` | `boolean \| 'top'\|'bottom'` | `true` |
| `tooltip` | `boolean` | `true` |
| `animate` | `boolean` | `true` (احترام به reduced-motion) |
| `locale` | `string` | locale برنامه (اعداد/تاریخ) |
| `a11yTable` | `boolean` | `true` |

**attributeها:** `zen-chart="dataExpr"`، `zen-chart-type`، `zen-chart-x`، `zen-chart-y`، `zen-chart-series`، `zen-chart-height`، `zen-chart-legend`، `zen-chart-aria-label`، `zen-chart-options` (JSON).
**SSR:** SVG ایستا رندر می‌شود.

### ۴.۱۰ `@zenith/icons` — L2 (اختیاری)

**API:** `registerIcons(set: Record<string, string>, o?: { prefix }) → Cleanup`، `getIcon(name)`، `defineIconSet(...)`؛ مجموعه‌های جدا subpath (tree-shakable).
**attributeها**
| attribute | پیش‌فرض | توضیح |
|---|---|---|
| `zen-icon="name"` | — | نام (یا expression) |
| `zen-icon-size` | `1em` | |
| `zen-icon-label` | — | اگر نباشد `aria-hidden="true"`؛ اگر باشد `role="img"` + `aria-label` |
| `zen-icon-set` | `default` | |
| `zen-icon-spin` | `false` | |

**امنیت:** SVG با sanitizer (`@zenith/security`) پاک می‌شود؛ `script`/`on*`/`foreignObject` حذف.

---

## ۵. تأثیر بر پکیج‌های موجود

| پکیج موجود | تغییر لازم |
|---|---|
| `state` | حذف رجیستری devtools و خطا؛ افزودن `setSignalObserver`، `watch`، `MaybeSignal`، `createAsync`؛ `onMount`/`onUnmount` در `runtime-core` |
| `errors` | افزودن بازه‌های `ZEN-1000..2599` (بند ۰.۴)؛ `ZEN-DEPR-xxx` |
| `runtime` | تبدیل به بستهٔ سازگار روی `runtime-core`؛ انتقال `date-picker`/`portal` به `ui`، `track` به `analytics`؛ شیء `Zen` facade |
| `ssr` | پشتیبانی رندر بدون `jsdom` و بدون ALS (برای `adapter-edge`)؛ ادغام `head` و `i18n`؛ پنهان کردن `domAls`, `installDOMGlobalGetters` |
| `http` / `data` / `resource` / `components` / `expressions` / `router` | استفاده از `cache`؛ `data` در `resource` ادغام؛ `clearCache` نام‌های یکتا |
| `auth` | استفاده از `storage`؛ یک API (حذف سبک دوم یا alias)؛ adapter برای `auth-oauth` |
| `store` | `persist` و `$subscribe` از `storage` |
| `form` | یک `createForm`؛ `fromZod`/`fromJsonSchema` از `schema` |
| `router` | `scrollBehavior`، `afterEach`، `installRouteAnnouncer` از `a11y`، `titleFromRoute` با `head` |
| `notifications` | نام‌های `showAlert`/`showConfirm`، `aria-live` از `a11y` |
| `transition` | یک API؛ احترام به `prefersReducedMotion` |
| `virtual-list` / `suspense` | حذف API قدیمی؛ `untracked` در effect کنترلر |
| `data-table` | virtualization با `virtual-list`؛ ARIA grid؛ export CSV |
| `devtools` | فقط پل افزونه؛ مصرف `devtools-core` |
| `testing` | `resetForTesting()`، fake timers، `mockHttp` (با `mock`)، `expectAccessible` |
| `compiler` | پوشش ۶ directive باقی‌مانده؛ مصرف `DirectiveMeta` |
| `vite-plugin` | wrapper نازک روی `unplugin-zenith`؛ یک `CompileOptions` |
| `cli` | بیرون کشیدن قالب‌ها (`@zenith/templates`)؛ `dev/build/test/upgrade/doctor`؛ نسخه از `package.json` |
| `vscode-extension` | کلاینت نازک روی `language-server`؛ بسته‌بندی و تست |
| `devtools-extension` | `manifest.json` استاندارد (بدون کامنت)؛ `host_permissions` محدود |
| همهٔ پکیج‌ها | `DEFAULTS` + schema، بدون `console.*`، `Disposable`، TSDoc `@default` |

---

## ۶. قالب package.json و معیار پذیرش

### ۶.۱ قالب (هر پکیج جدید)
```json
{
  "name": "@zenith/<name>",
  "version": "1.5.0",
  "description": "…",
  "license": "MIT",
  "type": "module",
  "sideEffects": false,
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "development": "./dist/index.dev.js",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist", "README.md", "LICENSE"],
  "engines": { "node": ">=18.19" },
  "peerDependencies": { "@zenith/state": "^1.5.0", "@zenith/scheduler": "^1.5.0" },
  "repository": { "type": "git", "url": "…", "directory": "packages/<name>" },
  "publishConfig": { "access": "public", "provenance": true }
}
```
`peerDependencies` فقط برای پکیج‌هایی که از signal/scheduler استفاده می‌کنند؛ `L0` بدون آن‌ها.

### ۶.۲ معیار پذیرش هر پکیج
- [ ] لایه و وابستگی‌ها مطابق بند ۱؛ `dependency-cruiser` سبز.
- [ ] `XOptions` با schema و `DEFAULTS`؛ تست «پیش‌فرض‌ها + مقدار نامعتبر».
- [ ] هر `createX` دارای `dispose()` و تست idempotency/نشت.
- [ ] هر directive دارای `DirectiveMeta` و ورودی در `zenith.meta.json`.
- [ ] کدهای خطای بازهٔ خودش در `@zenith/errors` ثبت شده و مستند است.
- [ ] SSR: تست رندر سرور، hydration بدون mismatch، یا `client-only` صریح.
- [ ] a11y: axe بدون نقض `serious`+؛ کیبورد کامل برای کامپوننت‌های تعاملی.
- [ ] بودجهٔ حجم (`size-limit`) و tree-shaking (import یک تابع ⇒ فقط همان).
- [ ] README (نصب، مثال، جدول گزینه‌ها و attributeها)، TypeDoc، `CHANGELOG`.
- [ ] `api-extractor` snapshot؛ هیچ export داخلی در `index.ts`.
- [ ] بدون `console.*`، `throw new Error` ساده، `any` در API عمومی، `Math.random` امنیتی.
- [ ] تست در Node 18.19/20/22 و مرورگرهای Chromium/Firefox/WebKit.

---

## ۷. ترتیب پیاده‌سازی

| مرحله | پکیج‌ها | پیش‌نیاز | خروجی |
|---|---|---|---|
| ۱ | `shared` → `logger` → `cache` → `jalali` → `schema` → `storage` | `errors` با بازه‌های جدید | قرارداد قابل اجبار؛ ESLint/API-extractor فعال |
| ۲ | `devtools-core` + تغییر `state` | مرحله ۱ | حذف تکرار رجیستری |
| ۳ | `runtime-core` + `zenith` + `createApp` | مرحله ۱–۲ | حذف singleton؛ `runtime` سازگار |
| ۴ | `i18n` جدید، `a11y`، `head` | مرحله ۳ | قابلیت‌های پایه؛ router/notifications به‌روز |
| ۵ | `ui`، `analytics`، `realtime` | مرحله ۴ | انتقال date-picker/portal/track |
| ۶ | `adapter-node`، `adapter-edge` (+ تغییر `ssr`)، `create-zenith`، `eslint-plugin` | مرحله ۳ | استقرار و DX |
| ۷ | `language-server`، `unplugin-zenith`، `codemod` | مرحله ۱–۶ | مهاجرت خودکار |
| ۸ | `theme`، `auth-oauth`، `ssg`، `feature-flags`، `mock`، `testing-e2e` | مرحله ۴–۶ | |
| ۹ | `charts`، `icons` | اختیاری | |

نسخه: همهٔ پکیج‌های جدید با `1.5.0` (lockstep با بقیه). حذف نام‌های قدیمی فقط در `2.0.0` و پس از یک نسخهٔ deprecation.

### ریسک‌ها و تصمیم‌های باز
(همه بسته شدند — #175، ADRها در `docs/decisions/`:)
1. **فضای کد خطا:** بازهٔ ۳رقمی پر است؛ بازهٔ ۴رقمی تغییر در قالب `ZEN-NNN` را لازم دارد (regex مصرف‌کننده‌ها). → **بسته: DEC-020** (بدون renumber؛ بازه‌های ۴رقمی برای پکیج‌های جدید؛ #171)
2. **`Readable<T>` ساختاری** در `shared` به معنی تایپ `MaybeSignal` در دو جا است؛ باید با تست نوع (tsd) ثابت شود. → **بسته: DEC-021** (brand DEC-009 + تست نوع `expectTypeOf`؛ #141)
3. **`adapter-edge`** به رندر بدون `jsdom` نیاز دارد؛ اگر `ssr` با `linkedom` سازگار نشود، پکیج به تعویق می‌افتد. → **بسته: DEC-022** (شرط فعال شد — به تعویق تا #92)
4. **`ui`** حجم کار زیاد دارد؛ پیشنهاد: ابتدا `dialog`, `popover`, `tooltip`, `tabs`، سپس بقیه. → **بسته: DEC-023** (تأیید ترتیب؛ مبنای APG)
5. **`charts` و `icons`** ممکن است بهتر باشد پکیج جامعه (community) باشند؛ تصمیم پس از بازخورد مصرف‌کنندگان. → **بسته: DEC-024** (community/اختیاری؛ درِ رسمی‌شدن باز)
6. **`runtime-core`** تقسیم‌شدنی با حفظ سازگاری رو به عقب است ولی بالاترین ریسک شکست را دارد؛ نیاز به تست parity (`compiler`/`runtime`) قبل از انتقال. → **بسته: DEC-025** (parity-first؛ #148)
7. **نسخه‌گذاری:** → **بسته: DEC-026** (lockstep `1.5.0`؛ حذف قدیمی‌ها فقط `2.0.0` پس از یک نسخهٔ deprecation — #58)
8. **حداقل Node و dual ESM/CJS:** → **بسته: DEC-027** (`>=18.19` تا ۲.۰ طبق #14/DEC-007؛ ESM-first، CJS فقط ابزارها — §۰.۶)
