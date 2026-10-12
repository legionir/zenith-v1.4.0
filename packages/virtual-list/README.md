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
  items, // آرایه یا signal آیتم‌ها (از @zenith/state)
  itemSize: 40,
  overscan: 4,
  renderItem: (item, index) => {
    const el = document.createElement('div');
    el.textContent = String(item.title);
    return el;
  },
});

list.scrollToIndex(100);
list.dispose(); // پاک‌سازی listener/observer/نودها
```

```html
<div zen-virtual="$items" zen-virtual-item-size="40">
  <li zen-text="$item.title"></li>
</div>
```

> دایرکتیوی `zen-virtual-list` (توسط `processVirtualList` پردازش می‌شود) در این
> نسخه فقط wrapper روی `createVirtualList` است؛ استفاده مستقیم تابعی از آن در dev
> یک‌بار هشدار `ZEN-DEPR-001` می‌دهد و در major بعدی حذف می‌شود (#47، سیاست #58).
> برای کد دست‌کاری، API مبنا `createVirtualList` است.

مشخصات کامل: [docs/packages/virtual-list.md](../../docs/packages/virtual-list.md)

## مستندات مرتبط

- [ARCHITECTURE.md §۳](../../ARCHITECTURE.md)
- [README ریشه](../../README.md)

## مجوز

MIT
