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
