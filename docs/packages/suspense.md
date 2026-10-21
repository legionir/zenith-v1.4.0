# `@zenith/suspense`

مدیریت loading ناهمزمان در Zenith. این پکیج دو API مکمل دارد:

- `createSuspense()` برای ردیابی Promiseها در کد TypeScript.
- `<zen-suspense>` برای نمایش fallback، timeout و error در templateهای HTML.

## کنترلر برنامه‌نویسی‌شده

```ts
import { createSuspense } from '@zenith/suspense';

const dataSuspense = createSuspense({
  minDelay: 200,
  timeout: 10_000,
  onTimeout: () => console.warn('Loading took too long'),
});

dataSuspense.onReady(() => {
  console.log('All tracked requests are ready');
});

dataSuspense.onError((error) => {
  console.error(error.message);
});

dataSuspense.track(fetch('/api/users').then((response) => response.json()));
```

### `SuspenseOptions`

```ts
interface SuspenseOptions {
  timeout?: number;
  minDelay?: number;
  onTimeout?: () => void;
}
```

| گزینه | توضیح |
|---|---|
| `timeout` | حداکثر زمان انتظار بر حسب میلی‌ثانیه. `undefined` یا `0` یعنی بدون timeout. |
| `minDelay` | حداقل تأخیر پیش از `loading.get() === true` شدن؛ برای جلوگیری از flicker در درخواست‌های سریع. |
| `onTimeout` | در هر چرخهٔ loading که timeout رخ دهد، یک‌بار اجرا می‌شود. |

### `SuspenseController`

| عضو | توضیح |
|---|---|
| `track(promise)` | Promise را به loading boundary متصل می‌کند. چند Promise هم‌زمان پشتیبانی می‌شوند. |
| `signal` | `Signal<SuspenseState>` برای مشاهدهٔ state کامل. |
| `loading` | سیگنال فقط‌خواندنی `boolean` برای UI. `minDelay` روی این سیگنال اعمال می‌شود. |
| `error` | سیگنال فقط‌خواندنی `Error \| null`. |
| `onReady(callback)` | callback را پس از settled شدن همهٔ Promiseهای trackشده اجرا می‌کند. یک unsubscribe function برمی‌گرداند. |
| `onError(callback)` | callback خطا را ثبت می‌کند و unsubscribe function برمی‌گرداند. |
| `reset()` | error، timeout و وضعیت loading را برای retry پاک می‌کند. |
| `dispose()` | timerها و listenerهای کنترلر را پاکسازی می‌کند. |

```ts
const stopReadyListener = dataSuspense.onReady(() => {
  renderUsers();
});

// هنگام cleanup کامپوننت:
stopReadyListener();
dataSuspense.dispose();
```

در صورت reject شدن Promise، error در controller ثبت می‌شود و `onError` اجرا می‌شود. برای شروع یک تلاش جدید پس از خطا یا timeout از `reset()` استفاده کنید.

```ts
async function retry() {
  dataSuspense.reset();
  dataSuspense.track(loadUsers());
}
```

## استفاده در HTML

`<zen-suspense>` توسط runtime پردازش می‌شود. محتوای اصلی، fallback، timeout و error به شکل زیر تعریف می‌شوند:

```html
<zen-suspense timeout="10000">
  <div class="content">
    <h2>محتوای اصلی</h2>
  </div>

  <template zen-fallback>
    <div class="loading">در حال بارگذاری…</div>
  </template>

  <template zen-timeout>
    <div class="error">زمان بارگذاری تمام شد.</div>
  </template>

  <template zen-error>
    <div class="error">خطایی رخ داد.</div>
  </template>
</zen-suspense>
```

هنگام loading، محتوای اصلی پنهان و fallback نمایش داده می‌شود. در حالت timeout یا error، template متناظر نمایش داده می‌شود. suspenseهای تو‌در‌تو نیز به boundary والد گزارش می‌شوند تا والد زودتر از فرزند ready نشود.

> تگ‌های `<zen-suspense-fallback>` و `<zen-suspense-error>` جزو syntax فعلی نیستند؛ از `<template zen-fallback>` و `<template zen-error>` استفاده کنید.

## API پایهٔ context

`createSuspenseContext` API سطح پایین‌تری است که runtime directive از آن استفاده می‌کند:

```ts
import { createSuspenseContext } from '@zenith/suspense';

const context = createSuspenseContext(5_000);

context.startLoading('users');
context.stopLoading('users');
context.reportError('Unable to load users');
context.reset();
```

```ts
interface SuspenseState {
  loading: boolean;
  pendingCount: number;
  timedOut: boolean;
  error: string | null;
}
```

`createSuspense()` برای کد application که با Promise کار می‌کند انتخاب مناسب‌تری است؛ `createSuspenseContext()` برای integrationهای سطح پایین و directiveها نگه داشته شده است.

## محدودیت‌ها

- `track()` در حال حاضر Promise می‌پذیرد؛ integration مستقیم با یک type عمومی `Resource` هنوز بخشی از API نیست.
- fallback SSR و hydration خودکار توسط این package ارائه نمی‌شود.
