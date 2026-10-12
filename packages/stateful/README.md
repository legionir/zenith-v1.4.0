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
// مسیر canonical (#117 — تک‌مسیر نصب):
import { Zen } from '@zenith/runtime';
import { ZenithStatefulPlugin } from '@zenith/stateful';

Zen.use(ZenithStatefulPlugin);
```

> `installStatefulComponents()` همچنان کار می‌کند اما alias منسوخ‌شونده است
> (**ZEN-DEPR-026** — هشدار یک‌بار در dev؛ حذف در ۲.۰ طبق DEC-026) و یک
> `Cleanup` idempotent برای unregister برمی‌گرداند.

## مستندات مرتبط

- [ARCHITECTURE.md §۲](../../ARCHITECTURE.md)
- [README ریشه](../../README.md)

## مجوز

MIT
