# @zenith/stateful

کامپوننت‌های خودمدیر (v0.6.0) — حالت‌های loading/error/empty/success/offline/retry را خودکار مدیریت می‌کنند: `zen-resource-view`، `zen-action-button`، `zen-auth-view`.

## نصب

```bash
npm install @zenith/stateful
```

## استفاده

```html
<zen-resource-view config="$usersResource">
  <template>
    <div zen-text="$item.name"></div>
  </template>
</zen-resource-view>
```

حالت‌های loading/error/empty به‌صورت خودکار بین slotهای داخلی سوییچ می‌شوند؛ در success تمپلیت کاربر روی هر آیتم clone می‌شود.

```typescript
import { installStatefulComponents } from '@zenith/stateful';

const dispose = installStatefulComponents();
```

## مستندات مرتبط

- [ARCHITECTURE.md §۲](../../ARCHITECTURE.md)
- [README ریشه](../../README.md)

## مجوز

MIT
