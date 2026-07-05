# @zenith/devtools

> Phase 10 — DevTools Hook

پکیج `@zenith/devtools` پل ارتباطی بین فریم‌ورک Zenith و افزونه مرورگر
(Chrome Extension) است. این پکیج یک شیء سراسری روی `window.__ZENITH__`
قرار می‌دهد تا افزونه بتواند State، کامپوننت‌ها، و Timeline تغییرات را
بازرسی کند.

## استفاده

```typescript
import { initDevTools } from '@zenith/devtools';

// در زمان شروع اپلیکیشن (فقط در Development)
initDevTools();
```

سپس در console مرورگر:

```javascript
// دسترسی به Hook
const hook = window.__ZENITH__;

// نسخه‌ی فریم‌ورک
console.log(hook.version);  // "1.0.0"

// لیست تمام Signal های فعال
hook.getSignals().forEach(s => {
  console.log(`Signal #${s.id}:`, s.value, `(${s.subscriberCount} subscribers)`);
});

// Timeline تغییرات State
hook.getTimeline(50).forEach(change => {
  console.log(`Signal #${change.signalId}: ${change.oldValue} → ${change.newValue}`);
});

// گوش دادن به تغییرات real-time
hook.onStateChange(change => {
  console.log('State changed:', change);
});
```

## غیرفعال کردن در Production

برای غیرفعال کردن DevTools (مثلاً در production):

```typescript
// قبل از import کردن فریم‌ورک
window.__ZENITH_DEVTOOLS__ = false;
```

یا در HTML:

```html
<script>window.__ZENITH_DEVTOOLS__ = false;</script>
```

## API

### `initDevTools()`

نصب Hook روی `window.__ZENITH__`. این تابع idempotent است.

### `ZenithDevtoolsHook`

شیءای که روی `window.__ZENITH__` قرار می‌گیرد:

| متد/فیلد | توضیح |
|----------|-------|
| `version` | نسخه‌ی فریم‌ورک |
| `getSignals()` | لیست تمام Signal های فعال |
| `getTimeline(limit?)` | Timeline تغییرات State |
| `onStateChange(cb)` | گوش دادن به تغییرات real-time (برمی‌گرداند unsubscribe) |
| `components` | Map از کامپوننت‌های ثبت‌شده |
| `installedAt` | زمان نصب Hook |

## Design Notes

### چرا Registry در State؟

در فاز ۱۰، یک State Registry به پکیج `@zenith/state` اضافه شد که تمام
Signal های ساخته‌شده را ردیابی می‌کند. این رجیستری:

- به‌صورت خودکار هر Signal را در constructor ثبت می‌کند.
- هر `set()` را در Timeline ثبت می‌کند.
- اگر DevTools غیرفعال باشد، no-op می‌شود (بدون overhead).

### چرا `__ZENITH_DEVTOOLS__` flag؟

به‌جای `import.meta.env?.DEV` (که فقط در Vite کار می‌کند)، از یک flag
سراسری استفاده می‌کنیم که در هر محیطی کار می‌کند. این به کاربر اجازه
می‌دهد DevTools را حتی در production فعال کند (برای دیباگ) یا در development
غیرفعال کند (برای تست performance).

### Idempotent

`initDevTools` می‌تواند چندبار فراخوانی شود بدون اینکه مشکلی ایجاد کند.
این مهم است چون در HMR، `Zen.start` ممکن است چندبار فراخوانی شود.
