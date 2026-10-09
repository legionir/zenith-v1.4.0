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
