// ecommerce-demo/src/main.js
// #145 + #9 — ماژول plain JS با importmap صفحه (بدون build pipeline؛ الگوی demos/*).
import { Zen } from '@zenith/runtime';
import { store } from './store.js';

Zen.action('addToCart', ({ element }) => {
  const id = parseInt(element.getAttribute('data-product-id') || '0', 10);
  const title = element.getAttribute('data-product-name') || '';
  const price = 50000; // قیمت نمونه
  store.addToCart(id, title, price);
});

Zen.action('removeFromCart', ({ element }) => {
  const id = parseInt(element.getAttribute('data-id') || '0', 10);
  store.removeFromCart(id);
});

Zen.action('checkout', () => {
  store.checkoutOrder();
});

const mainEl = typeof document !== 'undefined' ? document.querySelector('main') : null;
if (mainEl) {
  Zen.start(mainEl, { store });
}
