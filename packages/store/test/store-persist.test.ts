// @vitest-environment jsdom
//
// #145 — store ↔ @zenith/storage (کار لازم: «مصرف در store»):
//   • Store.subscribe(cb) → Cleanup (حداقل PersistTarget؛ DEC-021 ساختاری).
//   • persistStore(store, {key, selector}) state را ذخیره و هنگام attach
//     hydrate می‌کند — بدون تغییر API موجودِ defineStore.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { defineStore, clearStores } from '../src/index';
import { createStorage } from '@zenith/storage';

beforeEach(() => {
  localStorage.clear();
  clearStores();
});
afterEach(() => {
  clearStores();
  localStorage.clear();
});

describe('Store.subscribe (#145)', () => {
  it('fires with state on proxy mutation and $patch; unsubscribe stops it', () => {
    const useCounter = defineStore('c', {
      state: () => ({ n: 0, nested: { deep: 1 } }),
      getters: {},
      actions: {},
    });
    const store = useCounter();
    const seen: number[] = [];
    const off = store.$subscribe((s) => seen.push(s.n));
    store.state.n = 1;
    store.$patch({ n: 2 });
    off();
    off(); // idempotent
    store.state.n = 3;
    expect(seen).toEqual([1, 2]);
  });

  it('subscribe cleanup does not break getters/actions', () => {
    const useCart = defineStore('cart2', {
      state: () => ({ items: [] as number[] }),
      getters: { count: (s) => s.items.length },
      actions: {
        add(x: number) {
          this.state.items = [...this.state.items, x];
        },
      },
    });
    const store = useCart();
    const off = store.$subscribe(() => {});
    store.add(5);
    off();
    store.add(6);
    expect(store.count.get()).toBe(2);
  });
});

describe('persistStore on a real defineStore (#145)', () => {
  it('writes cart to storage (debounce 0) and hydrates a fresh instance', async () => {
    const { persistStore } = await import('@zenith/storage');
    const definition = {
      state: () => ({ cart: [] as Array<{ id: number; price: number }>, secret: 'x' }),
      getters: {},
      actions: {
        add(id: number, price: number) {
          this.state.cart = [...this.state.cart, { id, price }];
        },
      },
    };
    const useShopA = defineStore('shopA', definition);
    const storage = createStorage({ driver: 'memory', namespace: 'demo' });
    const storeA = useShopA();
    const off = persistStore(storeA, {
      storage,
      key: 'shop',
      debounce: 0,
      selector: (s) => ({ cart: s.cart }),
    });
    storeA.add(1, 10);
    expect(storage.get<{ cart: unknown[] }>('shop')?.cart).toEqual([{ id: 1, price: 10 }]);
    off();

    // instance تازه از همان storage ⇒ hydrate
    clearStores();
    const useShopB = defineStore('shopB', definition);
    const storeB = useShopB();
    persistStore(storeB, {
      storage,
      key: 'shop',
      debounce: 0,
      selector: (s) => ({ cart: s.cart }),
    });
    expect(storeB.state.cart).toEqual([{ id: 1, price: 10 }]);
    expect(storeB.state.secret).toBe('x'); // hydrate فقط cart کرد (selector)
  });

  it('debounces writes (fake timers)', async () => {
    vi.useFakeTimers();
    try {
      const { persistStore } = await import('@zenith/storage');
      const useS = defineStore('deb', { state: () => ({ n: 0 }), getters: {}, actions: {} });
      const storage = createStorage({ driver: 'memory' });
      persistStore(useS(), { storage, key: 'k', debounce: 100 });
      const store = useS();
      store.state.n = 1;
      store.state.n = 2;
      expect(storage.get('k')).toBeUndefined();
      vi.advanceTimersByTime(120);
      expect(storage.get('k')).toEqual({ n: 2 }); // فقط یک نوشتن نهایی
    } finally {
      vi.useRealTimers();
    }
  });
});
