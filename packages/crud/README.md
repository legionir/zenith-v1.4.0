# @zenith/crud

اکشن‌های آمادهٔ CRUD (فاز ۳) — create/read/update/delete روی `@zenith/resource` با رجیستری در `@zenith/actions`.

## نصب

```bash
npm install @zenith/crud
```

## استفاده

```typescript
import { registerCrudActions, getResource } from '@zenith/crud';

registerCrudActions(); // اکشن‌ها را با نام‌های crud-* ثبت می‌کند
const users = getResource('users');
```

در قالب، دکمه‌ها با `zen-action="crud-create"` و جدول با `@zenith/data-table` ترکیب می‌شود. برای دید کلیدواژه‌های سطح‌بالاتر `@zenith/stateful` را ببینید.

## مستندات مرتبط

- [ARCHITECTURE.md §۴](../../ARCHITECTURE.md)
- [README ریشه](../../README.md)

## مجوز

MIT

## Lifecycle (cleanup protocol — #116 / DEC-032)

`CrudEngine` implements `Disposable` (`@zenith/shared`): `dispose()` tears down
its resource effects and dynamic actions; idempotent. `destroy()` is a
deprecated alias (warns once with **ZEN-DEPR-021**, removed in 2.0 per DEC-026).
