# @zenith/runtime

موتور DOM Runtime فریم‌ورک Zenith — فاز ۳. این پکیج، فریم‌ورک را به DOM واقعی متصل می‌کند.

## دایرکتیوهای پشتیبانی‌شده

| دایرکتیو     | کاربرد                     | مثال                           |
| ------------ | -------------------------- | ------------------------------ |
| `zen-text`   | رندر متن                   | `<span zen-text="$user.name">` |
| `zen-if`     | نمایش شرطی (mount/unmount) | `<div zen-if="$isLoggedIn">`   |
| `zen-bind:*` | اتصال به Attribute         | `<a zen-bind:href="$url">`     |
| `zen-model`  | Two-way binding با Input   | `<input zen-model="$name">`    |

## نصب

```bash
npm install @zenith/runtime @zenith/state @zenith/expressions
```

## استفاده

```typescript
import { Zen, signal } from '@zenith/runtime';

// تعریف State
const state = {
  user: signal({ name: 'Ali' }),
  isProcessing: signal(false),
};

// شروع فریم‌ورک روی یک عنصر HTML
Zen.start(document.getElementById('app'), state);
```

```html
<div id="app">
  <h1>سلام <span zen-text="$user.name"></span>!</h1>
  <button zen-bind:disabled="$isProcessing">Save</button>
  <input zen-model="$user.name" />
</div>
```

## ویژگی‌ها

- ✅ **HTML-First**: بدون نوشتن کد JS برای DOM، رابط کاربری ساخته می‌شود
- ✅ **Fine-Grained Reactivity**: فقط عناصر وابسته آپدیت می‌شوند
- ✅ **Memory-Safe**: Effects در zen-if unmount می‌شوند (بدون Memory Leak)
- ✅ **No Build Step**: بدون نیاز به Compiler یا Bundler خاص

## تست

```bash
npm test    # ۶۹ تست با jsdom
```

## مجوز

MIT

## Analytics provider failures (#155 hotfix)

The current `createAnalytics` implementation is exported from `@zenith/runtime`;
a standalone `@zenith/analytics` package is not implemented yet. A synchronous
provider throw or rejected send promise is isolated: other providers still
receive the event, and `@zenith/logger` reports `ZEN-1901`. Event props, provider
names, identifiers and raw exception/cause are deliberately omitted from that
report. Even a late rejection after `dispose()` is handled; disposal cannot
cancel arbitrary work already started inside a third-party provider.

Consent/DNT behavior is unchanged. This hotfix is not completion of the
standalone analytics/privacy/provider specification tracked by #155.


## مالکیت Auth قدیمی — کاندیدای code-first، اعتبارسنجی‌نشده

APIهای Auth این بسته از facade تنبل `auth-api` عبور می‌کنند. اولین فراخوانی یا
خواندن state، پل مالکیت را نصب می‌کند؛ صرف import و مصرف `signal` نباید App یا
session بسازد. APIهای `@zenith/auth` سپس به `defaultApp().registries.auth` وصل‌اند؛
L2 هیچ وابستگی رو به بالا ندارد. ثبت‌های پیش از bootstrap با cleanup اصلی adopt
می‌شوند و مقدار صریح از قبل موجود App در تداخل نام اولویت دارد.

نمونهٔ default ساخته‌شده توسط factory با dispose/reset همان App آزاد می‌شود؛
reference دستی به معنای انتقال مالکیت destruction نیست. disposal بازگشتی به
App مرده برنمی‌گردد. `authPlugin/getAppAuth` برای App صریح و SSR مستقل‌اند.

فایل‌های قرارداد/گزینه‌های Auth جدا شده‌اند؛ hook reset بستهٔ Auth دیگر PURE
علامت نخورده و manifest آن side effect واقعی reset را اعلام می‌کند. خود runtime
bootstrap اجرایی در import ندارد. تست‌های unit و minified-consumer/tree-shaking
برای این مسیر نوشته شده‌اند، ولی طبق ترتیب کاربر **هنوز اجرا نشده‌اند**. بودجهٔ
۳KB مصرف signal تغییر نکرده و اندازهٔ جدید اندازه‌گیری نشده است.
