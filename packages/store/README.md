# @zenith/store

State سراسری شبیه Pinia (فاز ۳) — storeهای تعریف‌شده با state واکنش‌گرا، getter و action؛ ساخته‌شده روی signalهای `@zenith/state`.

## نصب

```bash
npm install @zenith/store
```

## استفاده

```typescript
import { defineStore } from '@zenith/store';

const useCart = defineStore('cart', {
  state: () => ({ items: [] as string[] }),
  getters: { count: (s) => s.items.length },
  actions: {
    add(item: string) {
      this.items.push(item);
    },
  },
});

const cart = useCart(); // singleton: همان نمونهٔ ثبت‌شده
cart.add('book');
```

## مستندات مرتبط

- [ARCHITECTURE.md §۴](../../ARCHITECTURE.md)
- [README ریشه](../../README.md)

## مجوز

MIT
