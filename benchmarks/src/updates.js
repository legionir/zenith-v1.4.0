// benchmarks/src/updates.js
//
// FEATURE (v0.4.0): Benchmark — Signal Updates (10k sequential + bulk)
//
// سناریو: ۱۰k آپدیت متوالی به یک signal + آپدیت ۱k آیتم.
// معیارها: total time, per-update time, ops/sec.

import { signal, computed, effect } from '../../packages/state/dist/index.js';

/**
 * Benchmark: 10k آپدیت متوالی به یک signal.
 */
export function benchSequentialUpdates(count = 10000) {
  const s = signal(0);
  let last = 0;
  effect(() => { last = s.get(); });

  const start = performance.now();
  for (let i = 0; i < count; i++) {
    s.set(i);
  }
  const time = performance.now() - start;
  return {
    benchmark: 'Sequential Updates',
    size: count,
    totalMs: time.toFixed(2),
    perUpdateUs: ((time / count) * 1000).toFixed(2),
    opsPerSec: Math.round(count / (time / 1000)),
    notes: `last value: ${last}`,
  };
}

/**
 * Benchmark: آپدیت ۱k آیتم (هر آیتم ۱۰ بار).
 */
export function benchItemUpdates(items = 1000, updatesPerItem = 10) {
  const signals = Array.from({ length: items }, () => signal(0));
  let sum = 0;
  // یک effect که همه را می‌خواند
  effect(() => { sum = signals.reduce((a, s) => a + s.get(), 0); });

  const start = performance.now();
  for (let u = 0; u < updatesPerItem; u++) {
    for (let i = 0; i < items; i++) {
      signals[i].set(u + 1);
    }
  }
  const time = performance.now() - start;
  const totalUpdates = items * updatesPerItem;
  return {
    benchmark: 'Item Updates (1k×10)',
    size: totalUpdates,
    totalMs: time.toFixed(2),
    perUpdateUs: ((time / totalUpdates) * 1000).toFixed(2),
    opsPerSec: Math.round(totalUpdates / (time / 1000)),
    notes: `sum: ${sum}`,
  };
}

/**
 * اجرای کامل benchmark آپدیت‌ها.
 */
export function runUpdateBenchmarks() {
  return [
    benchSequentialUpdates(10000),
    benchItemUpdates(1000, 10),
  ];
}
