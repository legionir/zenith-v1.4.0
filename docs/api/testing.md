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

---

## `trackEffect()`

ردیابی تعداد دفعات اجرای یک افکت.

```typescript
import { trackEffect } from '@zenith/testing';

const tracked = trackEffect(() => count.get());
count.set(5);
test.flush();

expect(tracked.runCount).toBe(2);
tracked.dispose();
```

---

## `createMockResource()`

ایجاد منبع واکنش‌گرای mock برای تست‌های async.

```typescript
import { createMockResource } from '@zenith/testing';

const user = createMockResource<{ name: string }>();

expect(user.loading.get()).toBe(false);

user.resolve({ name: 'Ali' });

expect(user.data.get()?.name).toBe('Ali');
expect(user.requestCount).toBe(1);
```

---

## `zenithMatchers`

Matcherهای سفارشی برای تست‌های Zenith.

```typescript
import { expect } from 'bun:test';
import { zenithMatchers } from '@zenith/testing';

expect.extend(zenithMatchers);

// استفاده
expect(double).toHaveValue(10);
```

---

## `render()`

رندر قالب برای تست‌های کامپوننت.

```typescript
import { render } from '@zenith/testing';

const { container, dispose } = render(`
  <div zen-text="message"></div>
`, { message: signal('Hello') });

expect(container.textContent).toBe('Hello');
dispose();
```

---

## مثال کامل تست

```typescript
import { describe, it, expect } from 'bun:test';
import { createTestHarness, trackEffect, createMockResource, render, zenithMatchers } from '@zenith/testing';

expect.extend(zenithMatchers);

describe('Counter', () => {
  it('reacts to count changes', () => {
    using test = createTestHarness();
    const count = test.signal(0);
    const double = test.computed(() => count.get() * 2);

    const tracked = trackEffect(() => count.get());

    count.set(5);
    test.flush();

    expect(tracked.runCount).toBe(2);
    expect(double).toHaveValue(10);
    tracked.dispose();
  });

  it('loads user data', async () => {
    using test = createTestHarness();
    const user = createMockResource<{ name: string }>();

    expect(user.loading.get()).toBe(false);

    user.resolve({ name: 'Ali' });

    expect(user.data.get()?.name).toBe('Ali');
    expect(user.requestCount).toBe(1);
  });
});
```
