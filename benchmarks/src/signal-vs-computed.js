// benchmarks/src/signal-vs-computed.js
//
// FEATURE (v0.4.0): Benchmark — Signal vs Computed micro-benchmarks
//
// معیارهای micro: signal.get() throughput, signal.set() throughput,
// computed re-evaluation, effect re-run cost.

import { signal, computed, effect } from '../../packages/state/dist/index.js';

/**
 * Benchmark: signal.get() throughput.
 */
export function benchSignalGet(iterations = 1000000) {
  const s = signal(42);
  let sum = 0;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    sum += s.get();
  }
  const time = performance.now() - start;
  return {
    benchmark: 'signal.get() throughput',
    size: iterations,
    totalMs: time.toFixed(2),
    opsPerSec: Math.round(iterations / (time / 1000)),
    notes: `sum=${sum} (prevents dead-code elimination)`,
  };
}

/**
 * Benchmark: signal.set() throughput (بدون effect).
 */
export function benchSignalSet(iterations = 1000000) {
  const s = signal(0);
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    s.set(i);
  }
  const time = performance.now() - start;
  return {
    benchmark: 'signal.set() throughput (no effect)',
    size: iterations,
    totalMs: time.toFixed(2),
    opsPerSec: Math.round(iterations / (time / 1000)),
    notes: `final value: ${s.get()}`,
  };
}

/**
 * Benchmark: computed re-evaluation cost.
 */
export function benchComputed(iterations = 100000) {
  const a = signal(1);
  const b = signal(2);
  const c = computed(() => a.get() + b.get());
  let last = 0;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    a.set(i);
    last = c.get();
  }
  const time = performance.now() - start;
  return {
    benchmark: 'computed re-evaluation',
    size: iterations,
    totalMs: time.toFixed(2),
    opsPerSec: Math.round(iterations / (time / 1000)),
    notes: `a+b computed, last=${last}`,
  };
}

/**
 * Benchmark: effect re-run cost.
 */
export function benchEffectRerun(iterations = 100000) {
  const s = signal(0);
  let runCount = 0;
  effect(() => { s.get(); runCount++; });
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    s.set(i);
  }
  const time = performance.now() - start;
  return {
    benchmark: 'effect re-run cost',
    size: iterations,
    totalMs: time.toFixed(2),
    opsPerSec: Math.round(iterations / (time / 1000)),
    notes: `effect ran ${runCount} times`,
  };
}

/**
 * اجرای کامل micro-benchmarks.
 */
export function runMicroBenchmarks() {
  return [
    benchSignalGet(1000000),
    benchSignalSet(1000000),
    benchComputed(100000),
    benchEffectRerun(100000),
  ];
}
