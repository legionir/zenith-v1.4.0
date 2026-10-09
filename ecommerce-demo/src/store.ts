import { defineStore } from '@zenith/store';

export const store = defineStore('shop', {
  state: () => ({
    name: 'فروشگاه Zenith',
    cart: [] as Array<{ id: number; title: string; price: number }>,
    count: 0,
  }),
  getters: {
    cartCount: (state) => state.cart.length,
    totalPrice: (state) => state.cart.reduce((sum, item) => sum + item.price, 0),
  },
  actions: {
    addToCart(productId: number, title: string, price: number) {
      const exists = this.state.cart.some((item) => item.id === productId);
      if (!exists) {
        this.state.cart.push({ id: productId, title, price });
      }
      this.state.count = this.cartCount.get();
      this.persistCart();
    },
    removeFromCart(id: number) {
      this.state.cart = this.state.cart.filter((item) => item.id !== id);
      this.state.count = this.cartCount.get();
      this.persistCart();
    },
    persistCart(): void {
      try {
        const cartStr = JSON.stringify(this.state.cart);
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('zenith_cart', cartStr);
        }
      } catch { /* ignore */ }
    },
    restoreCart(): void {
      try {
        if (typeof localStorage !== 'undefined') {
          const saved = localStorage.getItem('zenith_cart');
          if (saved) {
            this.state.cart = JSON.parse(saved);
            this.state.count = this.cartCount.get();
          }
        }
      } catch { /* ignore */ }
    },
  },
});
