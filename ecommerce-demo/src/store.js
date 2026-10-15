// ecommerce-demo/src/store.js
//
// #145 + #9 — سبد دمو روی @zenith/storage + مدیریت موجودی کالا (inventory):
//   • namespace '' + کلید دقیق 'zenith_cart' ⇒ دادهٔ میراث (آرایۀ خام JSON
//     از نسخۀ قبل) به‌عنوان version 0 شناسایی و با migrate پذیرفته/backfill
//     می‌شود.
//   • selector فقط cart را ذخیره می‌کند (name/count/inventory دادهٔ محلی‌اند).
//   • #9: بررسی موجودی کالا (inventory) در addToCart و کسر موجودی در checkoutOrder.
import { defineStore } from '@zenith/store';
import { createStorage, persistStore } from '@zenith/storage';

const DEFAULT_STOCK = 10;

function readStock(state, productId) {
  const stock = state.inventory?.[productId];
  return typeof stock === 'number' ? stock : DEFAULT_STOCK;
}

// دادهٔ میراث = آرایۀ خام [items]؛ شکل جدید = { cart: [items] } برای $patch.
const cartStorage = createStorage({
  namespace: '',
  sync: true,
  migrate: (old) => (Array.isArray(old) ? { cart: old } : old),
  validate: (v) => {
    if (!Array.isArray(v.cart)) throw new Error('invalid persisted cart shape');
    return v;
  },
});

const useShop = defineStore('shop', {
  state: () => ({
    name: 'فروشگاه Zenith',
    cart: [],
    count: 0,
    inventory: {
      1: 5,
      2: 3,
      3: 0,
      7: 2,
    },
    lastOrderStatus: 'idle',
  }),
  getters: {
    cartCount: (state) => state.cart.length,
    totalPrice: (state) => state.cart.reduce((sum, item) => sum + item.price, 0),
  },
  actions: {
    getStock(productId) {
      return readStock(this.state, productId);
    },
    isInStock(productId) {
      return readStock(this.state, productId) > 0;
    },
    setStock(productId, stock) {
      this.state.inventory = {
        ...this.state.inventory,
        [productId]: Math.max(0, Number(stock) || 0),
      };
    },
    addToCart(productId, title, price) {
      if (readStock(this.state, productId) <= 0) {
        return false;
      }
      const exists = this.state.cart.some((item) => item.id === productId);
      if (!exists) {
        this.state.cart.push({ id: productId, title, price });
      }
      this.state.count = this.getters.cartCount;
      return true;
    },
    removeFromCart(id) {
      this.state.cart = this.state.cart.filter((item) => item.id !== id);
      this.state.count = this.getters.cartCount;
    },
    checkoutOrder() {
      if (this.state.cart.length === 0) {
        return false;
      }
      for (const item of this.state.cart) {
        if (readStock(this.state, item.id) <= 0) {
          this.state.lastOrderStatus = 'out_of_stock';
          return false;
        }
      }
      const nextInventory = { ...this.state.inventory };
      for (const item of this.state.cart) {
        const current = readStock(this.state, item.id);
        nextInventory[item.id] = Math.max(0, current - 1);
      }
      this.state.inventory = nextInventory;
      this.state.cart = [];
      this.state.count = 0;
      this.state.lastOrderStatus = 'success';
      return true;
    },
  },
});

export const store = useShop();

// اتصال persist — به‌جای persistCart/restoreCart دستی. debounce پیش‌فرض ۳۰۰ms
// نوشتن‌های پشت‌سرهم (کلیک‌های مکرر) را یکی می‌کند.
persistStore(store, {
  storage: cartStorage,
  key: 'zenith_cart',
  selector: (s) => ({ cart: s.cart }),
});
