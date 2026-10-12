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

## Lifecycle (cleanup protocol — #116 / DEC-032)

`Resource` implements `Disposable` (`@zenith/shared`): `dispose()` stops the
auto-refresh interval, aborts in-flight requests and removes the instance from
the global registry; idempotent. `destroy()` is a deprecated alias (warns once
with **ZEN-DEPR-023**, removed in 2.0 per DEC-026). The `zen-resource` directive
(`processResource`) returns an idempotent `Cleanup` (`() => void`) and also
pushes it into the legacy `disposes[]` array for back-compat.
