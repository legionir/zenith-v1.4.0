# DevTools API

APIهای داخلی برای اتصال ابزارهای توسعه‌دهنده و بازرسی وضعیت اپلیکیشن.

---

## `Zen.getDevTools()`

دریافت نمونه فعال DevTools برای دسترسی به اطلاعات سیگنال‌ها و افکت‌ها.

### Type Signature
```typescript
function getDevTools(): DevToolsAPI | null;

interface DevToolsAPI {
  getSignals(): Array<{ id: string; value: any; subscribers: number }>;
  getEffects(): Array<{ id: string; active: boolean; runs: number }>;
  getState(): Record<string, any>;
  subscribe(callback: (update: DevToolsUpdate) => void): () => void;
}
```

### مثال‌ها
```typescript
import { Zen } from '@zenith/runtime';

const devtools = Zen.getDevTools();
if (devtools) {
  // گرفتن لیست تمام سیگنال‌ها
  const signals = devtools.getSignals();
  console.log('Active signals:', signals.length);

  // اشتراک در تغییرات
  devtools.subscribe((update) => {
    console.log('State changed:', update);
  });
}
```

---

## `window.__ZENITH__` API

وقتی DevTools فعال باشد، یک API سراسری روی `window.__ZENITH__` در دسترس است.

### فعال‌سازی
```typescript
// فعال کردن DevTools API
window.__ZENITH__.enable();
```

### مشاهده سیگنال‌ها
```typescript
// دیدن تمام سیگنال‌ها
console.table(window.__ZENITH__.getSignals());
```

### مشاهده افکت‌ها
```typescript
// دیدن تمام افکت‌ها
console.log('Effects:', window.__ZENITH__.getEffects());
```

### دنبال کردن تغییرات state
```typescript
// دنبال کردن تغییرات state به صورت زنده
window.__ZENITH__.subscribeToStateChanges(change => {
  console.log('State changed:', change.signalName, change.oldValue, '→', change.newValue);
});
```

### آمار کلی
```typescript
// دیدن آمار کلی
console.log('Stats:', window.__ZENITH__.getStats());
```

### خطاهای اخیر
```typescript
// دیدن خطاهای اخیر
console.log('Errors:', window.__ZENITH__.getErrors());
```

### غیرفعال کردن
```typescript
// غیرفعال کردن و پاک کردن همه چیز
window.__ZENITH__.disable();
```
