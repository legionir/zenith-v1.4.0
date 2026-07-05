# @zenith/data

> Phase 8 — Declarative Data Fetching

پکیج `@zenith/data` دایرکتیو `zen-fetch` را فراهم می‌کند که به‌صورت
Declarative درخواست API می‌دهد و وضعیت‌های `loading`, `error`, `success`
را در یک Signal محلی مدیریت می‌کند.

## استفاده

```html
<div zen-fetch="`/api/products/${$route.params.id}`" zen-state="product">
  <!-- loading state -->
  <div zen-if="$product.loading">
    <p>در حال بارگذاری...</p>
  </div>

  <!-- error state -->
  <div zen-if="$product.error">
    <p style="color: red;">خطا: <span zen-text="$product.error"></span></p>
  </div>

  <!-- success state -->
  <div zen-if="!$product.loading && !$product.error">
    <h2 zen-text="$product.data.name"></h2>
    <p>قیمت: <span zen-text="$product.data.price"></span></p>
  </div>
</div>
```

## نحوه کار

1. **`zen-fetch="<expr>"`** — Expression URL. در parentContext ارزیابی می‌شود.
2. **`zen-state="<name>"`** — نام متغیر در Context محلی (پیش‌فرض: `"data"`).
3. وقتی عنصر mount می‌شود، یک Signal محلی با شکل
   `{ loading: true, error: null, data: null }` ساخته می‌شود.
4. URL ارزیابی شده و fetch شروع می‌شود.
5. وقتی fetch کامل شد، Signal آپدیت می‌شود:
   - موفقیت: `{ loading: false, error: null, data: <result> }`
   - شکست: `{ loading: false, error: <message>, data: null }`
6. فرزندان می‌توانند با `$<name>.loading`, `$<name>.error`, `$<name>.data`
   به وضعیت دسترسی داشته باشند.

## Reactive URL

اگر URL به یک Signal وابسته باشد (مثلاً `$route.params.id`)، وقتی آن Signal
تغییر کند، fetch به‌طور خودکار دوباره انجام می‌شود:

```html
<!-- وقتی روی لینک‌های مختلف کلیک می‌کنید، $route.params.id تغییر می‌کند -->
<!-- و zen-fetch به‌طور خودکار دوباره fetch می‌کند -->
<div zen-fetch="`/api/products/${$route.params.id}`" zen-state="product">
  ...
</div>
```

## Race Condition Handling

اگر URL سریع تغییر کند (مثلاً کاربر سریع روی لینک‌های مختلف کلیک کند)،
چند fetch همزمان ممکن است رخ دهد. ما با یک flag `currentFetchId` فقط
نتیجه‌ی آخرین fetch را اعمال می‌کنیم.

## Content-Type Handling

- اگر `Content-Type: application/json` باشد، پاسخ به‌صورت JSON parse می‌شود.
- در غیر این صورت، پاسخ به‌صورت text برگردانده می‌شود.

## API

```typescript
import { processFetch, type FetchState } from '@zenith/data';
```

### `processFetch(el, expr, context, processChildren, disposes)`

پردازشگر `zen-fetch`. توسط walker فراخوانی می‌شود.

### `FetchState<T>`

```typescript
interface FetchState<T = any> {
  loading: boolean;
  error: string | null;
  data: T | null;
}
```

## Design Notes

### چرا Signal محلی؟

به‌جای استفاده از یک Signal سراسری، برای هر `zen-fetch` یک Signal محلی
می‌سازیم. این یعنی:

- چندین `zen-fetch` روی یک صفحه می‌توانند بدون تداخل کار کنند.
- وقتی عنصر unmount می‌شود، Signal هم dispose می‌شود (Memory Leak Prevention).
- Signal در Context محلی (`$<name>`) در دسترس است، نه در Context سراسری.

### چرا parentContext برای ارزیابی URL؟

URL در `parentContext` ارزیابی می‌شود (نه `localContext`) چون:

- URL ممکن است به `$route` وابسته باشد که در parentContext موجود است.
- اگر در localContext ارزیابی کنیم، ممکن است به `$product` (که خودمان
  ساختیم) دسترسی پیدا کند که منطقی نیست (circular dependency).

### Memory Leak Prevention

- Effect که URL را watch می‌کند در dispose کامپوننت/والد dispose می‌شود.
- تمام effectهای فرزندان (مثل zen-if که به `$product.loading` وابسته است)
  هم dispose می‌شوند.
- `currentFetchId` در dispose افزایش می‌یابد تا نتیجه‌ی fetch در حال انجام
  اعمال نشود.
