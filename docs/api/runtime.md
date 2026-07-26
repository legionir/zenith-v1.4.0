# Runtime API

ورودی اصلی برای راه‌اندازی و مدیریت چرخه حیات اپلیکیشن Zenith.

---

## `Zen.start()`

اپلیکیشن را راه‌اندازی می‌کند، DOM را پردازش کرده و واکنش‌گرایی را فعال می‌سازد.

### Type Signature
```typescript
function start(
  root: HTMLElement | string,
  initialState: Record<string, any> = {},
  options?: RuntimeOptions
): () => void;

interface RuntimeOptions {
  devtools?: boolean;
  strictParity?: boolean;
  ssr?: {
    preloadState?: boolean;
    validateHydration?: boolean;
  };
  onError?: ErrorHandler;
  effectDefaults?: EffectOptions;
}
```

### پارامترها
| نام | نوع | الزامی | پیش‌فرض | توضیح |
|---|---|---|---|---|
| `root` | `HTMLElement \| string` | ✅ | - | عنصر ریشه یا سلکتور آن |
| `initialState` | `Record<string, any>` | ❌ | `{}` | سیگنال‌ها و مقادیر اولیه اپلیکیشن |
| `options.devtools` | `boolean` | ❌ | `true` | فعال‌سازی DevTools API |
| `options.strictParity` | `boolean` | ❌ | `false` | بررسی تطابق رفتار رانتایم و کامپایل |
| `options.ssr.preloadState` | `boolean` | ❌ | `true` | بارگذاری خودکار state از سرور |
| `options.onError` | `ErrorHandler` | ❌ | - | Handler جهانی خطا |

### مثال‌ها
```typescript
import { signal } from '@zenith/state';
import { Zen } from '@zenith/runtime';

// تعریف state اولیه
const counter = signal(0);
const user = signal(null);

// راه‌اندازی اپلیکیشن
const dispose = Zen.start('#app', { counter, user }, {
  devtools: true,
  strictParity: true,
  onError: (err) => {
    console.error('Global error:', err);
  }
});

// توقف کامل و پاکسازی منابع
dispose();
```

---

## `Zen.stop()`

اپلیکیشن را متوقف کرده و تمام منابع را پاک می‌کند.

```typescript
Zen.stop(rootElement);
```

---

## `Zen.onError()`

ثبت handler جهانی خطا.

```typescript
Zen.onError(err => {
  console.error('خطا در اپلیکیشن:', err.message);
  if (err.hint) console.log('راهنمای رفع:', err.hint);
  Sentry.captureException(new Error(err.message));
});
```

---

## `Zen.reportError()`

ارسال خطای سفارشی از طریق سیستم مرکزی.

```typescript
Zen.reportError('Something went wrong', {
  category: 'runtime',
  severity: 'warning',
  recoverable: true
});
```

---

## `Zen.getErrors()`

دریافت تاریخچه خطاهای اخیر (تا ۵۰ مورد).

```typescript
const recentErrors = Zen.getErrors();
```

---

## `Zen.navigate()`

ناوبری SPA بدون رفرش صفحه.

```typescript
Zen.navigate('/dashboard');
Zen.navigate('/profile', { replace: true });
```

---

## `Zen.route`

Signal مسیر فعلی.

```typescript
const { path, params } = Zen.route.get();
```

---

## `Zen.flushSync()`

اجرای اجباری و synchronous صف افکت‌ها.

```typescript
count.set(5);
Zen.flushSync(); // افکت‌ها همین‌جا اجرا می‌شوند
```

---

## `Zen.use()`

نصب پلاگین.

```typescript
Zen.use(myPlugin, { option: 'value' });
```

---

## `Zen.action()`

ثبت اکشن.

```typescript
Zen.action('save', ({ state }) => {
  api.save(state.form.getValues());
});

// یا با متادیتا
Zen.action.register('delete', handler, { confirm: true });
```

---

## `Zen.auth`

دسترسی به API احراز هویت (v1.4.0).

```typescript
if (Zen.auth.isAuthenticated.get()) {
  console.log('Welcome', Zen.auth.user.get()?.name);
}

await Zen.auth.login({ email, password });
await Zen.auth.logout();
```

---

## `Zen.notify` / `Zen.toasts` / `Zen.alert` / `Zen.confirm`

سیستم اعلان‌ها (v1.4.0).

```typescript
Zen.toasts.success('عملیات با موفقیت انجام شد');
Zen.toasts.error('خطا در اتصال به سرور');

const confirmed = await Zen.confirm('آیا اطمینان دارید؟');
if (confirmed) { /* ... */ }
```

---

## `Zen.perf`

ابزار سبک‌وزن Performance Monitoring.

```typescript
Zen.perf.mark('render-start');
// ... عملیات ...
Zen.perf.measure('render');
console.log(Zen.perf.getReport());
```

---

## بررسی سختگیرانه برابری (Strict Parity)

برای اطمینان از تطابق رفتار runtime و کامپایلر در حالت توسعه:

```typescript
Zen.start('#app', state, {
  strictParity: true,
  devtools: true
});
```

### اجرای تست‌های برابری
```typescript
import { runAllParityTests, generateParityReport } from '@zenith/compiler';

const report = runAllParityTests(runtimeRunner, compilerRunner);
console.log(generateParityReport(report));

// خروجی نمونه:
// ════════════════════════════════════════════════════════════════
//   ZENITH RUNTIME ↔ COMPILER PARITY REPORT
// ════════════════════════════════════════════════════════════════
//   Total tests : 12
//   Passed      : 12
//   Failed      : 0
//   Status      : ✅ ALL PARITY CHECKS PASSED
// ───────────────────────────────────────────────────────────────
//   ✅ zen-text       MATCH
//   ✅ zen-bind       MATCH
//   ✅ zen-if         MATCH
//   ✅ zen-for        MATCH
//   ...
```

---

## Directives

### `zen-text`
محتوای متنی عنصر را به صورت امن تنظیم می‌کند.
```html
<h1 zen-text="pageTitle"></h1>
<p>سلام <span zen-text="userName"></span>!</p>
```

### `zen-html`
محتوای HTML عنصر را تنظیم می‌کند.
```html
<div zen-html="postContent"></div>
```

### `zen-if` / `zen-else-if` / `zen-else`
رندر شرطی.
```html
<div zen-if="isAdmin">پنل مدیریت</div>
<div zen-else-if="isLoggedIn">پروفایل کاربر</div>
<div zen-else>ورود به سایت</div>
```

### `zen-for`
تکرار عنصر.
```html
<ul>
  <li zen-for="item in items" zen-key="item.id" zen-text="item.name"></li>
</ul>
```

### `zen-show` / `zen-hide`
نمایش/پنهان کردن با CSS.
```html
<div zen-show="showModal">محتوای مودال</div>
<div zen-hide="isLoading">محتوای اصلی</div>
```

### `zen-class`
اضافه/حذف کلاس CSS به صورت شرطی.
```html
<button zen-class:active="isActive" zen-class:disabled="isLoading" class="btn">کلیک</button>
```

### `zen-style`
تنظیم استایل‌های CSS واکنش‌گرا.
```html
<div zen-style:color="textColor" zen-style:font-size="fontSize + 'px'">متن نمونه</div>
```

### `zen-on`
اتصال رویدادهای DOM.
```html
<button zen-on:click="handleClick">کلیک</button>
<button zen-on:click="deleteItem(item.id)">حذف</button>
```

### `zen-model`
اتصال دوطرفه.
```html
<input type="text" zen-model="username" />
<input type="checkbox" zen-model="acceptTerms" />
<select zen-model="selectedCity">...</select>
```

### `zen-bind`
اتصال ویژگی یا پراپرتی.
```html
<a zen-bind:href="linkUrl">لینک</a>
<button zen-bind:disabled="isLoading">ارسال</button>
<input zen-bind:value="username" />
```

### `zen-fetch` / `zen-resource`
بارگذاری خودکار داده.
```html
<div zen-fetch="/api/user" zen-resource="userData">
  <span zen-if="userData.loading">در حال بارگذاری...</span>
  <span zen-else-if="userData.error">خطا: {{ userData.error.message }}</span>
  <span zen-else>خوش آمدید {{ userData.data.name }}</span>
</div>
```

### `zen-component`
فراخوانی کامپوننت سفارشی.
```html
<zen-component name="UserCard" :user="currentUser" />
```
