# @zenith/permission

مجوزدهی (فاز ۴) — RBAC + کنترل سطح‌دانه با directiveهای `zen-permission` و `zen-role`؛ گیت‌های روت با `@zenith/router` هماهنگ است.

## نصب

```bash
npm install @zenith/permission
```

## استفاده

```html
<button zen-permission="user.delete">حذف</button>
<div zen-role="admin">فقط ادمین</div>
```

```typescript
import { createPermissionManager } from '@zenith/permission';

const pm = createPermissionManager();
pm.setUserAccess(['editor'], ['post.publish']);
pm.checkPermission('post.publish'); // true
pm.checkPermission('user.delete'); // false
```

## مستندات مرتبط

- [ARCHITECTURE.md §۴](../../ARCHITECTURE.md)
- [README ریشه](../../README.md)

## مجوز

MIT
