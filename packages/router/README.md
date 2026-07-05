# @zenith/router

> Phase 8 — SPA Router with History API

پکیج `@zenith/router` سیستم مسیریابی تک‌صفحه‌ای (SPA) فریم‌ورک Zenith است.
با استفاده از History API مرورگر، مسیرها را تطبیق داده و فایل‌های HTML را
به‌صورت داینامیک و lazy لود می‌کند.

## تعریف مسیرها

در HTML، با `<zen-router>` و `<zen-route>` مسیرها را تعریف کنید:

```html
<zen-router>
  <zen-route path="/" src="/pages/home.html"></zen-route>
  <zen-route path="/products/:id" src="/pages/product.html"></zen-route>
  <zen-route path="**" src="/pages/404.html"></zen-route>
</zen-router>
```

- `path` الگوی مسیر (می‌تواند شامل `:param` باشد).
- `src` URL فایل HTML که باید fetch شود.
- `**` wildcard است و با هر مسیری تطبیق می‌خورد (برای 404).

## ناوبری

برای ناوبری بدون رفرش صفحه، از `zen-link` روی `<a>` استفاده کنید:

```html
<a zen-link="/">صفحه اصلی</a>
<a zen-link="/products/101">محصول ۱۰۱</a>
<a zen-link="/products/202" href="/products/202">محصول ۲۰۲</a>
```

اگر `zen-link` مقدار داشته باشد، از آن استفاده می‌شود. در غیر این صورت،
از `href` استفاده می‌شود.

## دسترسی به Route در Expressionها

مسیر فعلی در Context به‌صورت `$route` در دسترس است:

```html
<!-- پارامترهای URL -->
<span zen-text="$route.params.id"></span>

<!-- مسیر فعلی -->
<span zen-text="$route.path"></span>
```

## API

```typescript
import {
  routeSignal,
  navigate,
  matchRoute,
  findMatchingRoute,
  processRouter,
  type RouteState,
} from '@zenith/router';
```

### `routeSignal: Signal<RouteState>`

Signal سراسری مسیر فعلی. شامل `path` و `params`.

### `navigate(path: string)`

تغییر مسیر بدون رفرش صفحه. از `history.pushState` استفاده می‌کند.

```typescript
navigate('/products/101');
```

### `matchRoute(pattern, path)`

تطبیق یک الگو با یک مسیر. برمی‌گرداند `Record<string, string> | null`.

```typescript
matchRoute('/products/:id', '/products/101')  // → { id: '101' }
matchRoute('**', '/anything')                  // → {}
matchRoute('/', '/about')                      // → null
```

### `processRouter(el, processChildren, parentDisposes)`

پردازشگر `<zen-router>`. توسط walker فراخوانی می‌شود.

## Design Notes

### چرا Effect Sync و Fetch Async؟

`effect(async () => ...)` مشکل دارد چون `effect` انتظار یک تابع synchronous
دارد. اگر `routeSignal.set` در داخل async effect فراخوانی شود، می‌تواند
infinite loop ایجاد کند.

به‌جای آن، effect فقط `routeSignal` را watch می‌کند و fetch را به‌صورت side
effect جداگانه (با IIFE async) انجام می‌دهد.

### Race Condition Handling

اگر کاربر سریع روی دو لینک کلیک کند، دو fetch همزمان ممکن است رخ دهد.
ما با یک flag `currentLoadId` فقط نتیجه‌ی آخرین fetch را اعمال می‌کنیم.

### Memory Leak Prevention

وقتی مسیر تغییر می‌کند، effectهای داخل صفحه‌ی قبلی باید dispose شوند.
ما یک آرایه `currentDisposes` نگه می‌داریم که قبل از لود صفحه‌ی جدید،
تمام disposeهای آن را فراخوانی می‌کند.

### Lazy Loading

فایل‌های HTML فقط زمانی fetch می‌شوند که مسیر منطبق باشد. این یعنی
اپلیکیشن شما فوق‌العاده سبک لود می‌شود — فقط صفحه‌ی اولیه fetch می‌شود.

### Back/Forward Support

`popstate` event به‌طور خودکار در module load نصب می‌شود. وقتی کاربر دکمه‌ی
Back یا Forward را می‌زند، `routeSignal` آپدیت می‌شود و Router صفحه‌ی مناسب
را لود می‌کند.
