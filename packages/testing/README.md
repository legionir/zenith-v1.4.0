# @zenith/testing

Testing utilities for Zenith signals, effects, and components.

## Installation

```bash
npm install @zenith/testing
```

## Usage

### Test Harness

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

## API Reference

- `createTestHarness()` — Create isolated test environment
- `trackEffect(fn)` — Track effect execution count
- `createMockResource<T>()` — Create mock reactive resource
- `render(template, state)` — Render template for testing
- `zenithMatchers` — Custom Jest/Bun matchers
