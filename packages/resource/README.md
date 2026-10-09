# @zenith/resource

دریافت دادهٔ declarative (فاز ۳) — شبیه TanStack Query ولی HTML-first: dedup درخواست‌های هم‌زمان، cache با عمر (stale time)، retry و به‌روزرسانی optimistic، متصل به signalهای `@zenith/state`.

## نصب

```bash
npm install @zenith/resource
```

## استفاده

```typescript
import { createResource } from '@zenith/resource';

const users = createResource('users', {
  url: '/api/users',
  staleTime: 30_000,
  retryCount: 2,
});

await users.list(); // شروع fetch اولیه (dedup می‌شود)
```

در قالب با directive `zen-resource` / `@zenith/data` (`zen-fetch`) و کامپوننت‌های `@zenith/stateful` (`zen-resource-view`) مصرف می‌شود.

## مستندات مرتبط

- [ARCHITECTURE.md §۴](../../ARCHITECTURE.md)
- [README ریشه](../../README.md)

## مجوز

MIT
