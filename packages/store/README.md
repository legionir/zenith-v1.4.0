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

### Pending major contract migration (code-first candidate)

Getter properties are `Computed<T>` (`store.total.get()`); only
`this.getters.total` inside actions is unwrapped. Registry lookups without explicit
state/getter/action generics expose unknown state and no invented extension
members. Persistence migration receives unknown JSON and must narrow/validate it.

Default store plugins and non-browser fallback persistence belong to the captured
App registry. They do not cross SSR requests. Explicit browser/custom storage is
still shared by its key: give independent applications different keys where
appropriate. `dispose()` releases computed/state signals and every plugin even if
one cleanup throws. Reset-for-testing also clears fallback memory in that scope.
Native Date/Map/Set/class values remain opaque; replace them to notify subscribers.
These contracts and the new fixtures have not been validated in this candidate.
