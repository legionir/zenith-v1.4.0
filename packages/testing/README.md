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
import {
  createTestHarness,
  trackEffect,
  createMockResource,
  render,
  zenithMatchers,
} from '@zenith/testing';

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
- `render({ template, state, attachToBody })` — Render template for testing
- `zenithMatchers` — Custom Jest/Bun matchers

## Canonical configuration (migration candidate, unvalidated)

```ts
const view = render({ template: '<p>hello</p>', state, attachToBody: true });
const bound = testDirective(directive, { html: '<div zen-example></div>', state });
```

Canonical bags use shared schemas. State validation checks record capability,
not application payload fields; caller-owned signals and state objects retain
identity. The old `render(template, state?, options?)` and
`testDirective(directive, html, state?)` forms remain deprecated bridges with
once-only `ZEN-DEPR-093/094` warnings (proposed removal in 2.0).

`useFakeTimers()` replaces global timeout functions and returns **numeric runtime
handles**, even where the ambient Node declaration ordinarily describes a Timeout
object. This helper does not provide `ref`, `unref`, `refresh` or
`timers/promises` support. Use a full test-runner clock for those capabilities.
Dispose/restore the controller after use; failed installation of clearTimeout
rolls back the setTimeout patch. This lifecycle repair is separate from the
implementation-module moves. No gate or compatibility result is claimed here.
