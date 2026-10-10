// ecommerce-demo/src/main.js
// #145 — ماژول plain JS با importmap صفحه (بدون build pipeline؛ الگوی demos/*).
// اکشن‌ها روی خودِ instance نشسته‌اند (defineStore: `{ [K in keyof A]: A[K] }`)؛
// `store.actions.*` در نسخۀ قبلی undefined بود (باگ fixture) — اینجا مستقیم.
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

// همان الگوی demos/store/index.html: خودِ store instance در state می‌آید تا
// $store در template زنده باشد (getterها Computed‌اند و context آن‌ها را
// unwrap می‌کند)؛ نسخهٔ قبلی `store.state` (اسنپ‌شات سادهٔ object) می‌داد.
Zen.start(document.querySelector('main'), { store });
