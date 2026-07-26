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
