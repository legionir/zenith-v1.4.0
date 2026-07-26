# Testing API

ابزارهای استاندارد برای تست سیگنال‌ها، افکت‌ها و کامپوننت‌ها.

---

## `createTestHarness()`

ایجاد یک محیط تست ایزوله با پاکسازی خودکار.

### Type Signature
```typescript
function createTestHarness(): TestHarness & Disposable;

interface TestHarness {
  dispose: () => void;
  flush: () => void;
  tick: () => Promise<void>;
  signal: typeof signal;
  effect: typeof effect;
  computed: typeof computed;
}
```

### مثال‌ها
```typescript
import { describe, it, expect } from 'bun:test';
import { createTestHarness } from '@zenith/testing';

describe('Counter logic', () => {
  it('increases value correctly', () => {
    using test = createTestHarness();
    const count = test.signal(0);

    count.set(5);
    test.flush();

    expect(count.get()).toBe(5);
  });
});
```
