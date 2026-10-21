// benchmarks/src/nested-reactivity.js
//
// FEATURE (v0.4.0): Benchmark — Nested Reactivity (3-level zen-for)
//
// سناریو: users → orders → items (۳ سطح nested).
// ۱۰۰ users × ۱۰ orders × ۱۰ items = ۱۰k leaf nodes.
// معیارها: total Signals/Effects, re-render time on deep change.

import { signal, computed, effect } from '../../packages/state/dist/index.js';

/**
 * ساخت داده‌ی nested.
 */
function buildNestedData(users = 100, orders = 10, items = 10) {
  return Array.from({ length: users }, (_, u) => ({
    id: u,
    name: `User ${u}`,
    orders: Array.from({ length: orders }, (_, o) => ({
      id: `${u}-${o}`,
      total: 0,
      items: Array.from({ length: items }, (_, it) => ({
        id: `${u}-${o}-${it}`,
        name: `Item ${u}.${o}.${it}`,
        price: it * 10,
      })),
    })),
  }));
}

/**
 * Benchmark: ساخت Signals برای nested data + شمارش.
 *
 * این benchmark تعداد Signals/Effects/Subscriptions ایجادشده را می‌شمارد
 * تا "Nested Reactivity Explosion" را کمی کند.
 */
export function benchNestedReactivity(users = 100, orders = 10, items = 10) {
  const data = buildNestedData(users, orders, items);
  const leafCount = users * orders * items;

  // ساخت signal برای هر leaf node (شبیه‌سازی آنچه zen-for می‌سازد)
  const signals = [];
  const start = performance.now();

  for (const user of data) {
    for (const order of user.orders) {
      for (const item of order.items) {
        signals.push(signal(item));
      }
    }
  }

  const buildTime = performance.now() - start;

  // یک effect که یک leaf را می‌خواند
  let readValue = null;
  effect(() => { readValue = signals[0].get(); });

  // آپدیت یک leaf عمیق و اندازه‌گیری re-render
  const updateStart = performance.now();
  signals[0].set({ ...signals[0].get(), price: 999 });
  const updateTime = performance.now() - updateStart;

  return {
    benchmark: 'Nested Reactivity (3-level)',
    size: `${users}×${orders}×${items}`,
    leafNodes: leafCount,
    signalsCreated: signals.length,
    buildMs: buildTime.toFixed(2),
    deepUpdateMs: updateTime.toFixed(2),
    notes: `3-level nesting (users→orders→items), ${leafCount} leaf signals`,
  };
}

/**
 * اجرای کامل benchmark nested.
 */
export function runNestedBenchmarks() {
  return [benchNestedReactivity(100, 10, 10)];
}
