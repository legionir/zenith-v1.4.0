# @zenith/runtime

موتور DOM Runtime فریم‌ورک Zenith — فاز ۳. این پکیج، فریم‌ورک را به DOM واقعی متصل می‌کند.

## دایرکتیوهای پشتیبانی‌شده

| دایرکتیو | کاربرد | مثال |
|---|---|---|
| `zen-text` | رندر متن | `<span zen-text="$user.name">` |
| `zen-if` | نمایش شرطی (mount/unmount) | `<div zen-if="$isLoggedIn">` |
| `zen-bind:*` | اتصال به Attribute | `<a zen-bind:href="$url">` |
| `zen-model` | Two-way binding با Input | `<input zen-model="$name">` |

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
  <input zen-model="$user.name">
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
