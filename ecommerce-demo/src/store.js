// ecommerce-demo/src/store.js
//
// #145 — سبد دمو حالا از @zenith/storage استفاده می‌کند (SPEC §۲.۵ «مهاجرت»:
// «سبد ecommerce-demo از آن استفاده می‌کند»). persistCart/restoreCart دستیِ
// قدیم (localStorage.setItem('zenith_cart', JSON.stringify(...))) حذف شده؛
// جای آن persistStore با:
//   • namespace '' + کلید دقیق 'zenith_cart' ⇒ دادهٔ میراث (آرایۀ خام JSON
//     از نسخۀ قبل) به‌عنوان version 0 شناسایی و با migrate پذیرفته/backfill
//     می‌شود (بدون ازدواج کلید جدید، بدون از دست رفتن سبد کاربرهای قدیمی).
//   • selector فقط cart را ذخیره می‌کند (name/count دادهٔ مشتق/محلی‌اند).
//   • hydrate خودکار: persistStore هنگام اتصال، مقدار ذخیره‌شده را $patch
//     می‌کند — رفتار restoreCart که در دمو هرگز صدا زده نمی‌شد هم اصلاح شد.
//
// فایل .js است (نه .ts): مرورگر مستقیماً ES module اجرا می‌کند و این دمو
// build pipeline ندارد — همان الگوی demos/* با importmap به packages/*/dist.
import { defineStore } from '@zenith/store';
import { createStorage, persistStore } from '@zenith/storage';

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

// defineStore یک factory برمی‌گرداند؛ instance را export می‌کنیم
// (نسخۀ قبلی factory را «store» نامیده بود — store.state روی آن undefined
// بود و persistStore به $subscribe نمی‌رسید؛ باگ fixture که اینجا رفع شد).
const useShop = defineStore('shop', {
  state: () => ({
    name: 'فروشگاه Zenith',
    cart: [],
    count: 0,
  }),
  getters: {
    cartCount: (state) => state.cart.length,
    totalPrice: (state) => state.cart.reduce((sum, item) => sum + item.price, 0),
  },
  actions: {
    addToCart(productId, title, price) {
      const exists = this.state.cart.some((item) => item.id === productId);
      if (!exists) {
        this.state.cart.push({ id: productId, title, price });
      }
      // context اکشن‌ها: this.getters مقادیر unwrap‌شده می‌دهد (نسخۀ قبلی
      // this.cartCount بود که undefined است — باگ fixture که اینجا رفع شد).
      this.state.count = this.getters.cartCount;
    },
    removeFromCart(id) {
      this.state.cart = this.state.cart.filter((item) => item.id !== id);
      this.state.count = this.getters.cartCount;
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
