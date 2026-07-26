# SSR و Hydration API

APIهای رندر سمت سرور، هیدریشن کلاینت و انتقال state بین سرور و کلاینت.

---

## `renderToString()`

اپلیکیشن را به صورت رشته HTML رندر می‌کند.

### Type Signature
```typescript
function renderToString(renderFn: () => string): string;
```

### پارامترها
| نام | نوع | الزامی | توضیح |
|---|---|---|---|
| `renderFn` | `() => string` | ✅ | تابعی که اپلیکیشن را رندر می‌کند و HTML برمی‌گرداند |

### مثال‌ها
```typescript
// در سرور (Node.js)
import { renderToString, serializeState, injectState } from '@zenith/ssr';

function renderApp() {
  return `
    <!DOCTYPE html>
    <html>
      <head><title>My App</title></head>
      <body>
        <div id="app">
          <h1>Hello Zenith</h1>
        </div>
      </body>
    </html>
  `;
}

const appState = { user: { name: 'Ali' }, theme: 'dark' };

let html = renderToString(renderApp);
html = injectState(html, serializeState(appState));

// ارسال به کلاینت
response.send(html);
```

---

## `renderToStream()`

اپلیکیشن را به صورت استریم رندر می‌کند و بخش‌بخش ارسال می‌نماید (کاهش TTFB).

### Type Signature
```typescript
function renderToStream(
  renderFn: () => string,
  options?: {
    state?: Record<string, any>;
    chunkSize?: number;
    onChunk?: (chunk: string) => void;
  }
): ReadableStream<string>;
```

### پارامترها
| نام | نوع | الزامی | پیش‌فرض | توضیح |
|---|---|---|---|---|
| `renderFn` | `() => string` | ✅ | - | تابع رندر |
| `options.state` | `Record<string, any>` | ❌ | - | state برای تزریق خودکار |
| `options.chunkSize` | `number` | ❌ | `1024` | اندازه هر تکه خروجی به بایت |
| `options.onChunk` | `(chunk: string) => void` | ❌ | - | callback برای هر تکه ارسالی |

### مثال‌ها
```typescript
// در سرور Express
import { renderToStream } from '@zenith/ssr';

app.get('/', (req, res) => {
  res.type('html');

  const stream = renderToStream(() => renderApp(req), {
    state: getAppState(req),
    chunkSize: 2048
  });

  stream.pipe(res);
});
```

### مزیت Streaming
- **TTFB سریع‌تر**: اولین بایت HTML فوراً ارسال می‌شود (بخش `<head>`).
- **تجربه کاربری بهتر**: کاربر شروع به دیدن محتوا می‌کند حتی قبل از تکمیل رندر کامل.
- **استفاده بهینه از حافظه**: برای صفحات بسیار بزرگ مناسب است.

---

## `serializeState()` / `deserializeState()`

سریالایز و دسریالایز state برای انتقال بین سرور و کلاینت.

### Type Signature
```typescript
function serializeState(state: Record<string, any>): string;
function deserializeState(serialized: string): Record<string, any>;
```

### مثال‌ها
```typescript
// سرور
const state = { count: 5, items: [1, 2, 3] };
const serialized = serializeState(state);
// توابع به طور خودکار حذف می‌شوند

// کلاینت
const restored = deserializeState(serialized);
console.log(restored.count); // 5
```

### موارد خاص
- توابع در هنگام سریالایز حذف می‌شوند (قابل انتقال نیستند).
- اگر دسریالایز خطا بندازد، آبجکت خالی `{}` برمی‌گرداند.

---

## `injectState()`

state سریالایز شده را به صورت اسکریپت JSON در HTML تزریق می‌کند.

### Type Signature
```typescript
function injectState(html: string, state: string): string;
```

### مثال‌ها
```typescript
const html = '<html><head></head><body>...</body></html>';
const state = serializeState(appState);

const finalHtml = injectState(html, state);
// خروجی شامل:
// <script id="zenith-state" type="application/json">...</script>
// که قبل از </head> قرار می‌گیرد
```

---

## `loadPreloadedState()`

در کلاینت، state تزریق‌شده توسط سرور را بارگذاری می‌کند.

### Type Signature
```typescript
function loadPreloadedState(): Record<string, any> | null;
```

### مثال‌ها
```typescript
// در کلاینت
import { loadPreloadedState } from '@zenith/ssr';
import { Zen } from '@zenith/runtime';

const serverState = loadPreloadedState();
const initialState = { ...defaultState, ...(serverState || {}) };

Zen.start('#app', initialState);
```

### موارد خاص
- اگر اسکریپت state در صفحه وجود نداشته باشد، `null` برمی‌گرداند.
- به طور خودکار توسط `Zen.start` فراخوانی می‌شود اگر گزینه `ssr.preloadState` فعال باشد.

---

## `hydrate()`

اپلیکیشن را روی HTML موجود سرور هیدرات می‌کند (بدون رندر مجدد).

### Type Signature
```typescript
function hydrate(
  root: HTMLElement | string,
  initialState: Record<string, any> = {},
  options?: {
    validateChecksum?: boolean;
    serverHtml?: string;
  }
): () => void;
```

### پارامترها
| نام | نوع | الزامی | توضیح |
|---|---|---|---|
| `root` | `HTMLElement \| string` | ✅ | عنصر ریشه یا سلکتور آن |
| `initialState` | `Record<string, any>` | ❌ | state اولیه اپلیکیشن |
| `options.validateChecksum` | `boolean` | ❌ | بررسی تطابق checksum سرور و کلاینت |
| `options.serverHtml` | `string` | ❌ | HTML سرور برای محاسبه checksum |

### مقدار بازگشتی
تابع `dispose` برای پاکسازی اپلیکیشن.

### مثال‌ها
```typescript
// هیدریشن ساده پس از SSR
import { hydrate } from '@zenith/ssr';

// بارگذاری خودکار state ارسال‌شده از سرور
const dispose = hydrate('#app', {}, {
  validateChecksum: true
});

// در صورت نیاز به توقف کامل اپلیکیشن
dispose();
```

### موارد خاص
- اگر `validateChecksum` فعال باشد و خروجی سرور با ساختار DOM کلاینت تطابق نداشته باشد، هشدار می‌دهد و به طور خودکار به رندر کامل سقوط می‌کند تا از خرابی UI جلوگیری شود.
- به طور خودکار `loadPreloadedState()` را فراخوانی می‌کند و state ارسال‌شده توسط سرور را با state اولیه شما ادغام می‌کند.
- تفاوت اصلی با `Zen.start` این است که `hydrate` به جای ساخت مجدد کل DOM، به ساختار موجود واکنش‌گرایی و مدیریت رویدادها را متصل می‌کند.

---

## `registerServerComponent()` / `renderServerComponent()`

ثبت و رندر کامپوننت‌های فقط سرور که هیچ کد جاوااسکریپتی به باندل کلاینت اضافه نمی‌کنند.

### Type Signature
```typescript
function registerServerComponent(def: ServerComponentDefinition): void;
function renderServerComponent(id: string, props?: Record<string, any>): string;

interface ServerComponentDefinition {
  id: string;
  render: (props: Record<string, any>) => string;
  streamable?: boolean;
}
```

### پارامترها
| نام | نوع | الزامی | پیش‌فرض | توضیح |
|---|---|---|---|---|
| `id` | `string` | ✅ | - | شناسه یکتای کامپوننت |
| `render` | `(props) => string` | ✅ | - | تابع رندر که فقط روی سرور اجرا می‌شود |
| `streamable` | `boolean` | ❌ | `false` | امکان ارسال استریم خروجی این کامپوننت |

### مثال‌ها
```typescript
// فقط در کد سرور تعریف می‌شود
import { registerServerComponent, renderServerComponent } from '@zenith/ssr';

registerServerComponent({
  id: 'UserProfile',
  streamable: true,
  render: ({ userId }) => {
    // دسترسی مستقیم به دیتابیس یا منابع سرور
    const user = await db.users.findById(userId);
    return `<div class="profile-card">`
      `<h3>${user.name}</h3>`
      `<p>${user.bio}</p>`
    `</div>`;
  }
});

// در رندر اصلی صفحه
const pageHtml = `
  <body>
    <main>
      ${renderServerComponent('UserProfile', { userId: '123' })}
    </main>
  </body>
`;
```

---

## APIهای ایزومورفیک

توابعی که هم در سرور هم در کلاینت یکسان کار می‌کنند و نیاز به بررسی دستی محیط را از بین می‌برند.

### Type Signature
```typescript
function getEnvironment(): 'server' | 'client';
function isServer(): boolean;
function isClient(): boolean;
function runOnServer<T>(fn: () => T): T | undefined;
function runOnClient<T>(fn: () => T): T | undefined;
```

### مثال‌ها
```typescript
import { isServer, isClient, runOnServer, runOnClient } from '@zenith/ssr';

if (isServer()) {
  // فقط در سرور: اتصال به دیتابیس، خواندن فایل، توکن‌های امنیتی
}

if (isClient()) {
  // فقط در کلاینت: دسترسی به DOM، localStorage، رویدادهای کاربر
}

// اجرای شرطی بدون if دستی
runOnServer(() => {
  console.log('Running on server');
});

runOnClient(() => {
  console.log('Running in browser');
});
```
