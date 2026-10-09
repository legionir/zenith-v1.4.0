import { Zen } from '@zenith/runtime';
import { store } from './store';

Zen.action('addToCart', ({ element }) => {
  const id = parseInt(element.getAttribute('data-product-id') || '0', 10);
  const title = element.getAttribute('data-product-name') || '';
  const price = 50000; // قیمت نمونه
  store.actions.addToCart(id, title, price);
});

Zen.action('removeFromCart', ({ element }) => {
  const id = parseInt(element.getAttribute('data-id') || '0', 10);
  store.actions.removeFromCart(id);
});

Zen.start(document.querySelector('main')!, { store: store.state });
