# Zenith Framework v1.0.0 — API Reference

> مرجع کامل API های v1.0.0 با signature، مثال، و caveats.
>
> **تاریخ**: ۲۰۲۶-۰۶-۲۲
> **نسخه**: v1.0.0

---

## فهرست

1. [compileExpression](#1-compileexpression)
2. [Resource.destroy()](#2-resourcedestroy)
3. [Zen.start options](#3-zenstart-options)
4. [SSR AsyncLocalStorage API](#4-ssr-asynclocalstorage-api)
5. [zen-static attribute](#5-zen-static-attribute)
6. [Property Diffing](#6-property-diffing)
7. [DocumentFragment Batching](#7-documentfragment-batching)
8. [ZenithAttributes TypeScript Types](#8-zenithattributes-typescript-types)
9. [Custom Directive Registry](#9-custom-directive-registry)
10. [Walk and Bind](#10-walk-and-bind)

---

## ۱. compileExpression

### امضا (Signature)

```typescript
import { compileExpression } from '@zenith/expressions';

function compileExpression(expr: string): (context: object) => any;
```

### توضیح

یک Expression را **یک‌بار** parse و validate می‌کند و یک **closure** آماده‌ی ارزیابی برمی‌گرداند. این تابع برای **Hot Path** ها طراحی شده — یعنی directive processor هایی که Expression را داخل effect فراخوانی می‌کنند و effect ممکن است هزاران بار re-run شود.

### تفاوت با `evaluateExpression`

| ویژگی | `evaluateExpression(expr, ctx)` | `compileExpression(expr)(ctx)` |
|-------|----------------------------------|--------------------------------|
| Parse | هر بار `compile(expr)` صدا زده می‌شود | فقط یک‌بار در closure captured |
| Cache overhead | `cache.has()` + `cache.get()` + `cache.delete()` + `cache.set()` (LRU touch) در هر فراخوانی | صفر — فقط `evaluate(ast, ctx)` |
| مناسب برای | استفاده‌ی یک‌بار یا نادر | Effectهای پرتکرار (directive processor) |

### مثال

```typescript
import { compileExpression } from '@zenith/expressions';

// یک‌بار compile — AST در closure ذخیره می‌شود.
const fn = compileExpression('$user.age > 18');

// چندین بار evaluate با context های مختلف.
fn({ $user: { age: 25 } }); // → true
fn({ $user: { age: 15 } }); // → false
fn({ $user: { age: 30 } }); // → true
```

### استفاده در Directive Processor

```typescript
import { compileExpression } from '@zenith/expressions';
import { effect } from '@zenith/state';

function processMyDirective(el, expr, context) {
  // compile-once — expr فقط یک‌بار parse می‌شود.
  const evalFn = compileExpression(expr);

  const dispose = effect(() => {
    // در هر re-run، فقط evaluate اجرا می‌شود — صفر Map operation.
    const value = evalFn(context);
    el.textContent = String(value);
  });

  return dispose;
}
```

### Caveats

- **امنیت**: validation در زمان `compile` انجام می‌شود. اگر Expression نامعتبر باشد، خطا پرتاب می‌کند و closure هرگز برنمی‌گردد.
- **Cache sharing**: closure با سایر closure های همان expression، AST یکسانی را به اشتراک می‌گذارند (cache hit). اما closure نمی‌تواند AST را mutate کند.
- **Context leak**: closure به context دسترسی ندارد — آن را در هر فراخوانی دریافت می‌کند.
- **LRU eviction**: اگر cache پر شود (MAX_CACHE_SIZE=500)، expression های قدیمی evict می‌شوند. اما closure های evicted شده هنوز کار می‌کنند (AST در closure captured شده).

### امنیتی

- Forbidden identifiers (`window`, `eval`, `Function`, `constructor`, `__proto__`, `prototype`) در compile time بلاک می‌شوند.
- Dynamic key access (`$obj[$key]` که `$key='constructor'`) در runtime توسط `FORBIDDEN_PROPERTIES_RT` بلاک می‌شود.
- closure هیچ دسترسی به cache Map یا AST object ندارد.

---

## ۲. Resource.destroy()

### امضا (Signature)

```typescript
import { Resource } from '@zenith/resource';

class Resource<T = any> {
  destroy(): void;
}
```

### توضیح

به‌طور کامل یک Resource را tear down می‌کند — مخصوصاً وقتی کامپوننتی که Resource را ساخته unmount می‌شود. برخلاف `reset()`، این متد Resource را از global registry حذف می‌کند و `_destroyed=true` می‌کند تا هیچ CRUD method جدیدی نتواند اجرا شود.

### عملیات (۷ مرحله)

1. `stopAutoRefresh()` — پاک کردن `_refreshTimer`
2. `_abortController.abort()` — لغو تمام درخواست‌های fetch در حال انجام
3. `_inflightRequests.clear()` — پاک کردن Map درخواست‌های در حال انجام
4. `_mutationQueue.length = 0` — پاک کردن صف mutation
5. `_destroyed = true` — جلوگیری از عملیات جدید
6. signal state به مقادیر اولیه برمی‌گردد (`data: null, loading: false, error: null`)
7. Resource از `resourceRegistry` حذف می‌شود

### مثال

```typescript
import { createResource } from '@zenith/resource';

const users = createResource('users', { url: '/api/users' });

// استفاده...
await users.list();
console.log(users.data); // [{ id: 1, name: 'Ali' }, ...]

// هنگام unmount کامپوننت:
users.destroy();

// بعد از destroy:
await users.list(); // → { success: false, error: 'Resource destroyed' }
console.log(users.data); // → null
console.log(getResource('users')); // → undefined
```

### رفتار بعد از destroy

| متد | رفتار |
|-----|--------|
| `list()` | `{ success: false, error: 'Resource destroyed' }` |
| `read(id)` | `{ success: false, error: 'Resource destroyed' }` |
| `create(body)` | `{ success: false, error: 'Resource destroyed' }` |
| `update(id, body)` | `{ success: false, error: 'Resource destroyed' }` |
| `delete(id)` | `{ success: false, error: 'Resource destroyed' }` |
| `createOptimistic(body)` | `{ success: false, error: 'Resource destroyed' }` |
| `updateOptimistic(id, body)` | `{ success: false, error: 'Resource destroyed' }` |
| `deleteOptimistic(id)` | `{ success: false, error: 'Resource destroyed' }` |
| `signal.get()` | state reset شده برمی‌گردد |
| `signal.set()` | همچنان کار می‌کند (design decision — Signal primitive) |
| `setData()` | همچنان کار می‌کند (design decision — برای cleanup) |
| `invalidate()` | همچنان کار می‌کند (ولی بی‌فایده چون data null است) |

### Revive با reset()

```typescript
users.destroy();
users.reset(); // Revive!
assertFalse(users._destroyed); // true
// حالا CRUD methods دوباره کار می‌کنند.
await users.list(); // → { success: true, data: [...] }
```

### Caveats

- **Double destroy**: idempotent است (safe to call multiple times).
- **Inflight fetch**: بلافاصله abort می‌شود.
- **AbortError retry**: AbortError در `_executeWithRetry` retry نمی‌شود (فقط یک fetch).
- **Data leak prevention**: data و error بعد از destroy پاک می‌شوند (حساس داده leak نمی‌کند).
- **signal.set()**: همچنان کار می‌کند چون Signal یک primitive است. اما `_destroyed` flag از network requests جلوگیری می‌کند.

---

## ۳. Zen.start options

### امضا (Signature)

```typescript
import { Zen } from '@zenith/runtime';

interface ZenStartOptions {
  devtools?: boolean; // @default true
}

Zen.start(root: HTMLElement, state: Record<string, any>, options?: ZenStartOptions): void;
```

### توضیح

پارامتر سوم `options` اضافه شد. در حال حاضر فقط `devtools` را پشتیبانی می‌کند.

### `devtools: boolean`

| مقدار | رفتار |
|-------|--------|
| `true` (پیش‌فرض) | `initDevTools()` صدا زده می‌شود. `window.__ZENITH__` نصب می‌شود. `__trackDirective` در گراف DevTools ثبت می‌کند. |
| `false` | `initDevTools()` صدا زده نمی‌شود. `window.__ZENITH__` تنظیم نمی‌شود. `__trackDirective` به no-op تبدیل می‌شود (صفر overhead). |

### مثال

```typescript
import { Zen } from '@zenith/runtime';

const root = document.getElementById('app');

// حالت معمولی (DevTools فعال — برای development):
Zen.start(root, state);

// benchmark/production (DevTools غیرفعال):
Zen.start(root, state, { devtools: false });

// explicit true (همان پیش‌فرض):
Zen.start(root, state, { devtools: true });
```

### چه زمانی `devtools: false` استفاده کنیم؟

- **Production**: در production build، DevTools مفیدی ندارد (افزونه Chrome نصب نیست).
- **Benchmark**: برای اندازه‌گیری REAL runtime performance.
- **High-performance apps**: اپ‌هایی با هزاران عنصر (مثل dashboards بزرگ).

### Caveats

- **Backwards compatible**: بدون `options` parameter، `devtools` پیش‌فرض `true` است (مانند v0.6.x).
- **Idempotent**: اگر چندین `Zen.start` با `devtools: true` صدا زده شود، `initDevTools` فقط یک‌بار نصب می‌شود.
- **Mixed**: اول `devtools: true`، سپس `devtools: false` — hook همچنان نصب می‌ماند (idempotent).

---

## ۴. SSR AsyncLocalStorage API

### امضا (Signature)

```typescript
import {
  domAls,
  getDOMGlobals,
  installDOMGlobalGetters,
  type DOMGlobals,
} from '@zenith/ssr';

interface DOMGlobals {
  window: any;
  document: any;
  Node: any;
  HTMLElement: any;
  Element: any;
  Event: any;
  history: any;
  location: any;
  DOMParser: any;
  MouseEvent: any;
  KeyboardEvent: any;
}

const domAls: AsyncLocalStorage<DOMGlobals>;

function getDOMGlobals(): DOMGlobals | undefined;
function installDOMGlobalGetters(): void;
```

### توضیح

v1.0.0 از `AsyncLocalStorage` برای isolation per-request در SSR استفاده می‌کند. این کار race condition در ۱۰۰+ concurrent requests را برطرف می‌کند.

### نحوه کار

1. `installDOMGlobalGetters()` getter هایی روی `globalThis` نصب می‌کند که به `AsyncLocalStorage` delegate می‌کنند.
2. هر درخواست SSR `domAls.run(globals, callback)` را صدا می‌زند.
3. داخل callback، `getDOMGlobals()` globals مربوط به همان درخواست را برمی‌گرداند.
4. `globalThis.document` (و سایر globals) به‌صورت خودکار به store فعلی delegate می‌کنند.

### مثال

```typescript
import { domAls, getDOMGlobals, type DOMGlobals } from '@zenith/ssr';

// شبیه‌سازی یک درخواست SSR.
async function handleSSRRequest(html: string, state: Record<string, any>) {
  const JSDOM = await import('jsdom');
  const dom = new JSDOM.JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`);

  // ساخت DOMGlobals از JSDOM.
  const globals: DOMGlobals = {
    window: dom.window,
    document: dom.window.document,
    Node: dom.window.Node,
    HTMLElement: dom.window.HTMLElement,
    Element: dom.window.Element,
    Event: dom.window.Event,
    history: dom.window.history,
    location: dom.window.location,
    DOMParser: dom.window.DOMParser,
    MouseEvent: dom.window.MouseEvent,
    KeyboardEvent: dom.window.KeyboardEvent,
  };

  // اجرای render داخل domAls.run — globals ایزوله است.
  const result = await domAls.run(globals, async () => {
    // داخل این callback:
    // - getDOMGlobals() همان globals را برمی‌گرداند.
    // - globalThis.document به globals.document delegate می‌کند.
    // - حتی در 100 concurrent requests، هر کدام globals مستقل دارند.
    return await renderToString(html, state);
  });

  dom.window.close();
  return result;
}
```

### ۱۰۰ Concurrent Requests (no race)

```typescript
// 100 درخواست concurrent — هر کدام DOM مستقل دارند.
const promises = [];
for (let i = 0; i < 100; i++) {
  const globals = makeGlobals(i); // هر درخواست globals مستقل.
  promises.push(domAls.run(globals, async () => {
    await new Promise(r => setTimeout(r, Math.random() * 50)); // delay
    // هر درخواست globals خود را می‌بیند.
    console.log(getDOMGlobals().document.requestId); // → i
  }));
}
await Promise.all(promises);
```

### Caveats

- **Browser-safe**: در مرورگر (که `document` از قبل تعریف شده)، `installDOMGlobalGetters` no-op است.
- **Idempotent**: `installDOMGlobalGetters` فقط یک‌بار نصب می‌شود (flag `_installed`).
- **Auto-install**: هنگام import ماژول در Node، getters به‌صورت خودکار نصب می‌شوند.
- **Configurable**: getter ها با `configurable: true` نصب می‌شوند — user code می‌تواند override کند (در production نباید).
- **Native values**: مقادیر native قبلی (مثلاً Node's `Event` در Node 18+) capture می‌شوند تا وقتی SSR فعال نیست، getter همان مقدار native را برگرداند.

---

## ۵. zen-static attribute

### امضا (Signature)

```html
<li zen-for="item in $items" zen-key="item.id" zen-static="">
  <span zen-text="item.name"></span>
</li>
```

### توضیح

`zen-static` یک attribute جدید برای `zen-for` است که **fast path** را فعال می‌کند. در این حالت:
- per-item `signal(item)` + `signal(i)` ساخته نمی‌شود (۲ signal کمتر per item).
- `createStaticLoopContext` (مقادیر مستقیم) به جای `createLoopContext` (getter + signalsMap).
- در تغییر لیست: **full re-render** (همه dispose + rebuild) به جای keyed diffing.

### مثال

```html
<!-- Standard zen-for (reactive, keyed diffing) -->
<li zen-for="item in $items" zen-key="item.id">
  <span zen-text="item.name"></span>
  <input zen-model="item.name"> <!-- کار می‌کند -->
</li>

<!-- zen-static (fast path, full re-render) -->
<li zen-for="item in $items" zen-key="item.id" zen-static="">
  <span zen-text="item.name"></span>
  <!-- <input zen-model="item.name"> کار نمی‌کند! -->
</li>
```

### چه زمانی zen-static استفاده کنیم؟

| سناریو | توصیه |
|---------|--------|
| لیست فقط‌خواندنی (منو، جدول read-only) | ✅ `zen-static` |
| لیست با zen-model (فرم‌ها) | ❌ standard |
| لیست با تغییرات مکرر (chat، live data) | ❌ standard |
| لیست ایستا با 1000+ آیتم | ✅ `zen-static` |
| لیست با animation (enter/leave) | ❌ standard |
| نتایج جستجوی static | ✅ `zen-static` |

### Benchmark

| Benchmark | Standard | zen-static | Speedup |
|-----------|----------|------------|---------|
| ۱k items init | ۱۹ms | ۱۰ms | **۱.۹x** |
| ۱۰k items init | ۱۶۶ms | ۱۲۵ms | **۱.۳x** |

### Caveats

- **zen-model پشتیبانی نمی‌شود**: `__zenith_signals__` در static context وجود ندارد. اگر به zen-model نیاز دارید، از standard zen-for استفاده کنید.
- **Full re-render**: در تغییر لیست، همه‌ی آیتم‌ها dispose + rebuild می‌شوند. برای لیست‌های با تغییرات مکرر، این کندتر از keyed diffing است.
- **Reactivity**: تغییرات in-place روی item fields (`items.get()[0].name = 'new'`) re-trigger نمی‌کنند. فقط list replacement (`items.set([...])`) re-render رخ می‌دهد.
- **DocumentFragment batching**: هم در standard و هم در static، initial mount از DocumentFragment batching استفاده می‌کند (۱ `insertBefore` به جای N).

---

## ۶. Property Diffing

### توضیح

در v1.0.0، directive processor های `zen-bind`, `zen-show`, `zen-html`, `zen-html-trusted`, `zen-model` از **property diffing** استفاده می‌کنند. اگر مقدار Expression با قبلی `===` برابر باشد، DOM mutation skip می‌شود.

### مثال

```typescript
// درون processBind:
let prevValue = undefined;
let isFirstRun = true;

const dispose = effect(() => {
  const value = evalFn(context);

  // Property Diffing — اگر مقدار با قبلی برابر است، skip کن.
  if (!isFirstRun && prevValue === value) {
    return; // DOM mutation skip می‌شود!
  }
  prevValue = value;
  isFirstRun = false;

  // ... setAttribute, removeAttribute, etc.
});
```

### رفتار

| نوع مقدار | Comparison | مثال |
|-----------|------------|------|
| `string` | `===` value | `'hello' === 'hello'` → skip |
| `number` | `===` value | `42 === 42` → skip |
| `boolean` | `===` value | `true === true` → skip |
| `null`/`undefined` | `===` | `null === null` → skip |
| `object` (class) | `===` reference | `{active: true} === {active: true}` → update (reference متفاوت) |
| `object` (same ref) | `===` reference | `obj === obj` → skip |

### Benchmark

| Benchmark | v0.6.3 | v1.0.0 | بهبود |
|-----------|--------|--------|-------|
| zen-bind ۱۰k update | ۶۶۲k ops/sec | ۱.۳۵M ops/sec | **۲x** |

### Caveats

- **اولین اجرا**: همیشه DOM mutation رخ می‌دهد (حتی اگر مقدار `undefined` باشد).
- **Object reference**: اگر کاربر در هر effect run یک object جدید بسازد، diffing کار نمی‌کند. برای reactive objects، از immutable pattern استفاده کنید (object جدید فقط وقتی واقعاً تغییر کرد).
- **Falsy values**: `false`, `null`, `undefined`, `0`, `""` همگی متفاوت در نظر گرفته می‌شوند.

---

## ۷. DocumentFragment Batching

### توضیح

در v1.0.0، `zen-for` در initial mount (هم standard و هم static) از DocumentFragment batching استفاده می‌کند. همه‌ی نودهای جدید در یک DocumentFragment جمع می‌شوند و یک‌بار `insertBefore` می‌شوند.

### مثال

```typescript
// قبل از v1.0.0:
for (let i = 0; i < 10000; i++) {
  parent.insertBefore(node[i], placeholder.nextSibling); // 10000 reflow!
}

// v1.0.0:
const frag = document.createDocumentFragment();
for (let i = 0; i < 10000; i++) {
  frag.appendChild(node[i]); // no reflow (fragment در DOM نیست)
}
parent.insertBefore(frag, placeholder.nextSibling); // 1 reflow!
```

### Caveats

- فقط در **initial mount** (`itemsByKey.size === 0` یا static mode). در updates، keyed diffing استفاده می‌شود.
- Transition support preserved: در batch mode، enter transitions بعد از batch insert اجرا می‌شوند.

---

## ۸. ZenithAttributes TypeScript Types

### امضا (Signature)

```typescript
import type {
  ZenithAttributes,
  ZenBindAttribute,
  AllZenithAttributes,
} from '@zenith/runtime';

interface ZenithAttributes {
  'zen-text'?: string;
  'zen-html'?: string;
  'zen-html-trusted'?: string;
  'zen-if'?: string;
  'zen-show'?: string;
  'zen-for'?: string;
  'zen-key'?: string;
  'zen-static'?: '' | 'true' | string;  // v1.0.0
  'zen-model'?: string;
  'zen-bind:class'?: string;
  // ... 40+ attribute ها
  config?: string;
  action?: string;
  'loading-text'?: string;
  // ...
}

type ZenBindAttribute = `zen-bind:${string}`;

type AllZenithAttributes = ZenithAttributes & {
  [key: ZenBindAttribute]: string | undefined;
};
```

### مثال

```typescript
import type { ZenithAttributes, AllZenithAttributes } from '@zenith/runtime';

// Type-safe attribute object
const attrs: ZenithAttributes = {
  'zen-text': '$user.name',
  'zen-if': '$show',
  'zen-for': 'item in $items',
  'zen-key': 'item.id',
  'zen-static': '',  // v1.0.0
  'zen-model': '$user.name',
  'zen-bind:class': '{ active: $isActive }',
  config: '$resource',
  action: 'save',
  'loading-text': 'Loading...',
};

// With generic bind
const allAttrs: AllZenithAttributes = {
  ...attrs,
  'zen-bind:custom-attr': '$value',
  'zen-bind:data-id': '$item.id',
};
```

### استفاده در React/JSX

```typescript
declare module 'react' {
  interface HTMLAttributes<T> extends ZenithAttributes {}
}

// حالا در JSX:
function MyComponent() {
  return <div zen-text="$user.name" zen-static="">Hello</div>;
}
```

---

## ۹. Custom Directive Registry

### امضا (Signature)

```typescript
import {
  registerCustomDirective,
  unregisterCustomDirective,
  clearCustomDirectives,
  getCustomDirective,
  type CustomDirectiveHandler,
} from '@zenith/runtime';

type CustomDirectiveHandler = (
  el: HTMLElement,
  configAttr: string | null,
  context: Record<string, any>,
  state: Record<string, any>,
) => () => void;

function registerCustomDirective(
  tagName: string,
  handler: CustomDirectiveHandler,
  attributeName?: string, // @default 'config'
): void;

function unregisterCustomDirective(tagName: string): boolean;
function clearCustomDirectives(): void;
function getCustomDirective(tagName: string): CustomDirectiveHandler | undefined;
```

### مثال

```typescript
import { registerCustomDirective, type CustomDirectiveHandler } from '@zenith/runtime';
import { effect } from '@zenith/state';
import { compileExpression } from '@zenith/expressions';

// تعریف یک custom directive.
const myDirective: CustomDirectiveHandler = (el, configAttr, context, state) => {
  if (!configAttr) return () => {};

  const evalFn = compileExpression(configAttr);
  const dispose = effect(() => {
    const value = evalFn(context);
    el.setAttribute('data-value', String(value));
  });

  return dispose;
};

// ثبت برای تگ <my-directive>
registerCustomDirective('my-directive', myDirective, 'config');

// حالا در HTML:
// <my-directive config="$user.name"></my-directive>
```

### Caveats

- **case-insensitive**: HTML tag names case-insensitive هستند. registry آن‌ها را lowercase ذخیره می‌کند.
- **attributeName**: اگر مشخص نشود، `'config'` پیش‌فرض است. برای `<zen-action-button action="save">`، `'action'` استفاده کنید.
- **Walker dispatch**: walker هنگام پیمایش، اگر به تگ ثبت‌شده‌ای برسد، handler آن را فراخوانی می‌کند و بقیه‌ی دایرکتیوهای معمول روی همان تگ و فرزندانش را پردازش نمی‌کند.
- **Dispose**: handler باید یک تابع dispose برگرداند که Effectها و listenerها را پاکسازی کند.

---

## ۱۰. Walk and Bind

### امضا (Signature)

```typescript
import { walkAndBind } from '@zenith/runtime';

function walkAndBind(root: HTMLElement, state: Record<string, any>): () => void;
```

### توضیح

`walkAndBind` یک نسخه‌ی سبک‌وزنِ `processDOM` است که برای per-clone binding در zen-for کامپایل‌شده استفاده می‌شود. برخلاف `Zen.start`:
- Event Delegation را re-init نمی‌کند.
- `resetResourceRegistry` صدا نمی‌زند.
- یک تابع teardown برمی‌گرداند که Effectهای ایجادشده را dispose می‌کند.

### مثال

```typescript
import { walkAndBind } from '@zenith/runtime';

const clone = template.cloneNode(true);
const localState = Object.create(parentState);
localState.item = signal(itemData);
localState.index = signal(0);

// Bind کردن clone با state محلی.
const teardown = walkAndBind(clone, localState);

// بعداً (هنگام removal):
teardown(); // Effectهای فرزندان dispose می‌شوند.
```

### Caveats

- **مورد استفاده‌ی اصلی**: vite-plugin `processChildren` برای zen-for کامپایل‌شده.
- **بهتر از Zen.start**: برای per-clone binding چون Event Delegation را re-init نمی‌کند.
- **Teardown**: همیشه teardown را صدا بزنید تا memory leak جلوگیری شود.

---

## جستجو در API ها

| API | پکیج | نسخه اضافه‌شده |
|-----|------|----------------|
| `compileExpression` | `@zenith/expressions` | v1.0.0 |
| `Resource.destroy()` | `@zenith/resource` | v1.0.0 |
| `Zen.start(options)` | `@zenith/runtime` | v1.0.0 |
| `ZenStartOptions` | `@zenith/runtime` | v1.0.0 |
| `domAls` | `@zenith/ssr` | v1.0.0 |
| `getDOMGlobals` | `@zenith/ssr` | v1.0.0 |
| `installDOMGlobalGetters` | `@zenith/ssr` | v1.0.0 |
| `DOMGlobals` (type) | `@zenith/ssr` | v1.0.0 |
| `zen-static` (attribute) | `@zenith/runtime` | v1.0.0 |
| Property Diffing | `@zenith/runtime` | v1.0.0 |
| DocumentFragment Batching | `@zenith/runtime` | v1.0.0 |
| `ZenithAttributes` (type) | `@zenith/runtime` | v1.0.0 |
| `AllZenithAttributes` (type) | `@zenith/runtime` | v1.0.0 |
| `ZenBindAttribute` (type) | `@zenith/runtime` | v1.0.0 |
| `registerCustomDirective` | `@zenith/runtime` | v0.6.0 |
| `walkAndBind` | `@zenith/runtime` | v0.4.0 |

---

##seealso

- [Migration Guide: 0.6.x → 1.0.0](./migration-guide.md)
- [Performance Tuning Guide](./performance-tuning.md)
- [Security Audit Report](../tests/v1.0/security-audit/README.md)
- [Benchmarks](../BENCHMARKS.md)
- [Changelog](../CHANGELOG.md)
