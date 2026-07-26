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
