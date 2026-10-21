# @zenith/suspense

ردگیری Promise و حالت loading (فاز موازی L2) — `<zen-suspense>` تا حل‌شدن promiseهای زیردرخت، fallback نشان می‌دهد؛ با `@zenith/error-boundary` و signalها هماهنگ است.

## نصب

```bash
npm install @zenith/suspense
```

## استفاده

```typescript
import { createSuspense, createSuspenseContext } from '@zenith/suspense';

const ctx = createSuspenseContext();
const ctrl = createSuspense({ fallback: '#loading', context: ctx });
```

```html
<zen-suspense fallback="#spinner">
  <!-- محتوای وابسته به دادهٔ در حال بارگذاری -->
</zen-suspense>
```

مشخصات کامل: [docs/packages/suspense.md](../../docs/packages/suspense.md)

## مستندات مرتبط

- [ARCHITECTURE.md §۳](../../ARCHITECTURE.md)
- [README ریشه](../../README.md)

## مجوز

MIT

### Candidate configuration migration (unvalidated)

```ts
const context = createSuspenseContext({ timeoutMs: 1000, onSettle: settled => {} });
const tracked = trackPromise(request, { suspense: context, key: 'request' });
const timed = withTimeout(tracked, { ms: 2000, message: 'Request timed out' });
```

Canonical options use the shared schemas. Zero-argument context creation uses
canonical defaults without a positional warning. Existing positional overloads
remain deprecated; explicit `createSuspenseContext(undefined, callback)` retains
its legacy callback route. Canonical durations must be nonnegative. Legacy
negative-duration timeout no-ops are retained on the legacy route only. This is
candidate migration documentation; the current changes have not been executed
or approved for release.
