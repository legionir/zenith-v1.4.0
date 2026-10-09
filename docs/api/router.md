# Router API

APIهای مسیریابی SPA با lazy loading و prefetch.

---

## `navigate()`

به یک مسیر جدید بدون رفرش صفحه ناوبری می‌کند.

### Type Signature
```typescript
function navigate(path: string, options?: NavigateOptions): void;
```

### مثال‌ها
```typescript
import { navigate, routeSignal } from '@zenith/router';

// ناوبری ساده
navigate('/about');

// خواندن مسیر فعلی
const current = routeSignal.get();
console.log(current.path); // "/about"
```

> مستندات کامل Router API به زودی تکمیل می‌شود.
