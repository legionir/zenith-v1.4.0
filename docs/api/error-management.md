# مدیریت خطای یکپارچه

سیستم مرکزی جمع‌آوری، مدیریت و گزارش‌دهی خطاها در تمام سطوح فریم‌ورک.

---

## `Zen.onError()`

یک handler جهانی برای دریافت تمام خطاهای Zenith ثبت می‌کند.

### Type Signature
```typescript
type ErrorHandler = (error: ZenithError) => void;

function onError(handler: ErrorHandler): () => void;

interface ZenithError {
  message: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverable: boolean;
  timestamp: number;
  stack?: string;
  context?: Record<string, any>;
  hint?: string;
}

type ErrorCategory =
  | 'reactivity'
  | 'expression'
  | 'directive'
  | 'runtime'
  | 'ssr'
  | 'security';

type ErrorSeverity = 'error' | 'warning' | 'info';
```

### پارامترها
| نام | نوع | الزامی | توضیح |
|---|---|---|---|
| `handler` | `ErrorHandler` | ✅ | تابعی که هر خطایی رخ داد فراخوانی می‌شود |

### مقدار بازگشتی
یک تابع برای حذف handler ثبت شده.

### مثال‌ها
```typescript
import { Zen } from '@zenith/runtime';

// ثبت handler جهانی
const unsubscribe = Zen.onError(err => {
  console.error(`[${err.category}] ${err.message}`);

  if (err.hint) {
    console.log('راهنما:', err.hint);
  }

  // ارسال به سرویس مانیتورینگ
  Sentry.captureException(new Error(err.message), {
    extra: {
      category: err.category,
      severity: err.severity,
      context: err.context
    }
  });
});

// حذف handler
unsubscribe();

// هنگام راه‌اندازی اپلیکیشن
Zen.start('#app', state, {
  onError: err => {
    analytics.trackError(err);
  }
});
```

---

## `emitError()`

یک خطا را از طریق سیستم مرکزی ارسال می‌کند.

### Type Signature
```typescript
function emitError(error: Omit<ZenithError, 'timestamp'>): ZenithError;
```

### مثال‌ها
```typescript
import { emitError } from '@zenith/state';

emitError({
  message: 'Failed to load user data',
  category: 'runtime',
  severity: 'error',
  recoverable: true,
  hint: 'Check network connection and try again',
  context: { userId: 123, endpoint: '/api/user' }
});
```

---

## `errorBoundary()`

یک تابع را با محافظ خطا می‌پیچاند؛ خطاهای داخلی را گرفته و از طریق سیستم مرکزی گزارش می‌دهد.

### Type Signature
```typescript
function errorBoundary<T extends (...args: any[]) => any>(
  fn: T,
  category: ErrorCategory,
  context?: Record<string, any>
): (...args: Parameters<T>) => ReturnType<T> | undefined;
```

### مثال‌ها
```typescript
import { errorBoundary } from '@zenith/state';

const safeRender = errorBoundary((component) => {
  return component.render();
}, 'runtime', { phase: 'render' });

// اگر render خطا بندازد، برنامه کرش نمی‌کند و خطا گزارش می‌شود
const output = safeRender(myComponent);
```

---

## `getErrorHistory()` / `clearErrorHistory()`

دریافت تاریخچه خطاهای اخیر یا پاک کردن آن.

### Type Signature
```typescript
function getErrorHistory(): ReadonlyArray<ZenithError>;
function clearErrorHistory(): void;
```

### مثال‌ها
```typescript
import { getErrorHistory, clearErrorHistory } from '@zenith/state';

// دریافت ۵۰ خطای اخیر
const errors = getErrorHistory();
console.log(`Total errors: ${errors.length}`);

// پاک کردن تاریخچه
clearErrorHistory();
```

---

## `setDevMode()` / `isDevMode()`

فعال یا غیرفعال کردن حالت توسعه برای پیام‌های غنی‌تر خطا.

### Type Signature
```typescript
function setDevMode(enabled: boolean): void;
function isDevMode(): boolean;
```

### مثال‌ها
```typescript
import { setDevMode, isDevMode } from '@zenith/state';

// فعال کردن حالت توسعه
setDevMode(true);

if (isDevMode()) {
  console.log('Running in development mode');
}
```

### موارد خاص
- در حالت توسعه، خطاها با جزئیات بیشتر در کنسول نمایش داده می‌شوند شامل `hint`، `context` و `stack`.
- در حالت تولید، فقط پیام اصلی لاگ می‌شود تا حجم لاگ‌ها کم باشد.
- به طور خودکار هنگام `Zen.start` با توجه به گزینه `devtools` تنظیم می‌شود.

---

## دسته‌بندی خطاها

| دسته | توضیح |
|---|---|
| `reactivity` | خطاهای مربوط به سیگنال، افکت و کامپوتد |
| `expression` | خطاهای کامپایل یا اجرای عبارت‌ها در تمپلیت |
| `directive` | خطاهای اجرای directiveها |
| `runtime` | خطاهای عمومی زمان اجرا |
| `ssr` | خطاهای رندر سرور و هیدریشن |
| `security` | خطاهای امنیتی مثل تلاش دسترسی به پراپرتی ممنوعه |

---

## رفتار در حالت توسعه

وقتی حالت توسعه فعال باشد، هر خطا در کنسول به صورت گروه‌بندی نمایش داده می‌شود:
```
▼ [Zenith ERROR] reactivity
    Message: Effect function threw an error
    Hint: Check that all signals used inside effect are properly defined
    Context: { effectOwnerId: "eff_123" }
    Stack: Error: ...
    Recoverable: true
```
