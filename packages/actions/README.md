# @zenith/actions

> Phase 4 — Action Registry

پکیج `@zenith/actions` یک **Registry ساده و سبک** از نام‌های اکشن به توابع جاوااسکریپت
فراهم می‌کند. این پکیج لایه‌ی Bridge بین HTML Declarative و Business Logic است.

## ایده

به‌جای inline handlerها در HTML:

```html
<!-- ❌ Anti-pattern: کد JS داخل HTML -->
<button onclick="alert('saved')">ذخیره</button>
```

فقط یک **نام** می‌نویسیم:

```html
<!-- ✅ Declarative: فقط نام اکشن -->
<button zen-action="save">ذخیره</button>
```

و خود تابع در JS ثبت می‌شود:

```typescript
import { Zen } from '@zenith/runtime';

Zen.action('save', ({ state, element, event }) => {
  event.preventDefault();
  state.isSaving.set(true);
  // ...
});
```

## API

```typescript
import {
  registerAction,
  unregisterAction,
  getAction,
  hasAction,
  clearActions,
  action,
} from '@zenith/actions';
```

| تابع | کاربرد |
|------|--------|
| `registerAction(name, fn)` | ثبت یا بازنویسی یک اکشن |
| `unregisterAction(name)` | حذف یک اکشن (برمی‌گرداند `boolean`) |
| `getAction(name)` | دریافت تابع اکشن یا `undefined` |
| `hasAction(name)` | بررسی وجود اکشن |
| `clearActions()` | پاکسازی کل Registry (فقط تست/HMR) |
| `action.register` / `action.unregister` / … | همان توابع، در قالب یک شیء |

## ActionContext

هر Action هنگام اجرا یک Context دریافت می‌کند:

```typescript
interface ActionContext {
  event: Event;                  // رویداد اصلی مرورگر
  state: Record<string, any>;    // همان State که به Zen.start داده شد
  element: HTMLElement;           // عنصری که zen-action روی آن بود
}
```

## Design Notes

- **چرا Map به‌جای Plain Object؟**
  کلیدهای رشته‌ای مثل `"__proto__"` یا `"constructor"` در Plain Object مشکلات امنیتی
  و رفتارهای پیش‌فرض دارند. Map از این نظر کاملاً ایمن است.
- **چرا اعتبارسنجی در `registerAction`؟**
  برای کشف زودهنگام خطاهای توسعه‌دهنده (مثلاً پاس دادن `undefined` به‌عنوان تابع).
  این خطاها در Dev باید سریع و واضح باشند.
- **State خام یا Context؟**
  State خام (همان `signal(0)` و …) پاس داده می‌شود، نه Contextای که با `$` کار می‌کند.
  این انتخاب عمدی است چون Actionها معمولاً می‌خواهند Signalها را `set` کنند،
  نه فقط `get`.
