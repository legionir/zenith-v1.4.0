# `@zenith/virtual-list`

رندر مجازی برای لیست‌های بزرگ. فقط آیتم‌های داخل viewport به‌همراه `overscan` در DOM قرار می‌گیرند؛ spacer فضای اسکرول کل لیست را حفظ می‌کند.

## `createVirtualList`

```ts
import { createVirtualList } from '@zenith/virtual-list';
import { signal } from '@zenith/state';

const items = signal(
  Array.from({ length: 10_000 }, (_, id) => ({ id, label: `Item ${id}` })),
);

const list = createVirtualList({
  items,
  container: '#users',
  itemSize: 40,
  overscan: 8,
  getItemKey: (item) => item.id,
  renderItem: (item) => {
    const row = document.createElement('div');
    row.className = 'user-row';
    row.textContent = item.label;
    return row;
  },
  onVisibleRangeChange: (start, end) => {
    console.log(`Visible range: ${start}..${end}`);
  },
});
```

کانتینر باید ارتفاع یا عرض مشخص و قابل اسکرول داشته باشد:

```html
<div id="users" style="height: 500px; overflow-y: auto;"></div>
```

### گزینه‌ها

```ts
interface VirtualListOptions<T> {
  items: T[] | Signal<T[]>;
  itemSize: number | ((item: T, index: number) => number);
  container: HTMLElement | string;
  renderItem: (item: T, index: number) => HTMLElement;
  overscan?: number;
  direction?: 'vertical' | 'horizontal';
  getItemKey?: (item: T, index: number) => string | number;
  onScroll?: (info: ScrollInfo) => void;
  onVisibleRangeChange?: (start: number, end: number) => void;
}
```

| گزینه | توضیح |
|---|---|
| `items` | آرایه یا Signal آرایهٔ آیتم‌ها. تغییر Signal به‌صورت خودکار range را به‌روزرسانی می‌کند. |
| `itemSize` | اندازهٔ تخمینی هر آیتم. number برای همهٔ آیتم‌ها یا تابع برای estimate متغیر. اندازهٔ واقعی آیتم‌های mounted با `ResizeObserver` اصلاح می‌شود. |
| `container` | خود HTMLElement یا CSS selector کانتینر اسکرول. |
| `renderItem` | تابع ساخت DOM هر آیتم visible. |
| `overscan` | تعداد آیتم اضافی قبل و بعد viewport؛ پیش‌فرض `5`. |
| `direction` | `vertical` پیش‌فرض یا `horizontal`. |
| `getItemKey` | کلید پایدار برای جلوگیری از unmount/mount بی‌مورد در reorderها. پیش‌فرض index است. |

### API کنترلر

```ts
list.scrollToIndex(5000, 'center');
list.scrollToOffset(20_000);
list.refresh();
list.dispose();
```

| عضو | توضیح |
|---|---|
| `items` | Signal فقط‌خواندنی آرایهٔ کامل. |
| `visibleItems` | Signal فقط‌خواندنی از `{ item, index, offset }` برای آیتم‌های mounted. |
| `scrollToIndex(index, align?)` | اسکرول به آیتم با `start`، `center` یا `end`. |
| `scrollToOffset(offset)` | اسکرول به آفست پیکسلی. |
| `refresh()` | بازسازی اندازه‌ها، محاسبهٔ range و render مجدد. |
| `dispose()` | listenerها، observerها، effectها و DOM داخلی virtual list را پاکسازی می‌کند. |

## ارتفاع متغیر

```ts
const list = createVirtualList({
  items,
  container: '#users',
  itemSize: (item) => item.estimatedHeight,
  getItemKey: (item) => item.id,
  renderItem: renderUser,
});
```

تابع `itemSize` estimate اولیه است. اگر `ResizeObserver` در browser موجود باشد، ارتفاع/عرض واقعی آیتم‌های visible اندازه‌گیری و offsetهای بعدی اصلاح می‌شوند.

## directiveهای موجود

پروژه هنوز دو syntax legacy دارد:

```html
<div zen-virtual-list="$items" zen-item-height="40" zen-buffer="5">
  <template><div zen-text="$item.name"></div></template>
</div>
```

و runtime directive:

```html
<div zen-virtual="item in $items" data-item-height="40">
  <span zen-text="item.name"></span>
</div>
```

برای کد جدید، API عمومی `createVirtualList()` پیشنهاد می‌شود. migration کامل directiveها به یک engine مشترک در یک تغییر جداگانه انجام می‌شود تا رفتار template و table mode فعلی شکسته نشود.
