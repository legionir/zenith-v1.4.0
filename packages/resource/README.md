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

### Pending major contracts and ownership

The untyped response default is unknown. Use `Resource<T>`/`getResource<T>()` to
state the transport payload contract; all CRUD verbs still return `CrudResult<T>`
and this does not silently reinterpret list responses as `T[]`. `setData` returns
`T|null`, while optimistic patches accept records. Request bodies are serialized
once; invalid/cyclic JSON settles as a failure before transport.

`processResource(element, BindContext)` is the preferred directive API. Its
structural context works with Core without importing Core into this lower layer.
The old positional overload is deprecated. Partial child binds and delayed binds
are owned/cleaned. Registry unregister/reset releases Resource lifetimes; explicit
legacy `resource.reset()` can revive a disposed Resource with a fresh Signal.
Subscribers must subscribe to that new Signal after revival. Queue rollbacks from
a disposed/reset lifetime cannot alter a new one. Final tests have not run.

DOM cleanup registrations have independent release tokens, including repeated use
of the same callback. The callback still runs once on disposal; unregistering it
explicitly does not let an older token remove a fresh registration. Disposal runs
all release paths even when a DOM callback throws, then propagates the collected
cleanup failure(s). Child binding stops immediately if its owning scope closes
reentrantly; no later child or initial fetch starts. Regression fixtures are
written but not executed.
