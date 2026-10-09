# @zenith/virtual-list

رندر فهرست‌های بزرگ (۱۰٬۰۰۰+ آیتم) با windowing — فقط آیتم‌های دیده‌شده در DOM می‌مانند؛ اندازهٔ آیتم ثابت یا پویا.

## نصب

```bash
npm install @zenith/virtual-list
```

## استفاده

```typescript
import { createVirtualList } from '@zenith/virtual-list';

const list = createVirtualList({
  container,
  items, // signal آیتم‌ها (از @zenith/state)
  itemSize: 40,
  overscan: 4,
});
```

```html
<div zen-virtual="$items" zen-virtual-item-size="40">
  <li zen-text="$item.title"></li>
</div>
```

مشخصات کامل: [docs/packages/virtual-list.md](../../docs/packages/virtual-list.md)

## مستندات مرتبط

- [ARCHITECTURE.md §۳](../../ARCHITECTURE.md)
- [README ریشه](../../README.md)

## مجوز

MIT
