// benchmarks/lib/measure.mjs
// #86 — the ONE timing helper of the benchmark suite.
//
// **Time-based batches, not a fixed iteration count.** A fixed 100k-iteration
// batch is 0.4ms for `signal.get()` (~200M ops/sec) but 250ms for Vue's computed
// diamond — the short batch is dominated by timer overhead and JIT tiering
// (measured: the same metric swung between 18M and 100M ops/sec), and the long
// one wastes half a minute. Each batch therefore runs CHUNKS of `chunk`
// iterations until `durationMs` elapsed (the chunk bounds how often we read the
// clock, so `performance.now()` never dominates the measurement).
//
// **Medians, not means.** A shared CI box (or a laptop) has spikes — GC,
// frequency scaling, other tenants. Every metric is the MEDIAN of `batches`
// independent measurements after a `warmupMs` warmup; min/max/spread are kept in
// the report so a noisy run is visible instead of silently averaged away.
//
// **The result is consumed.** `sink` keeps the last return value: without it V8
// is free to eliminate the whole call (dead-code elimination), which is exactly
// how a benchmark starts reporting fantasy numbers.
import { performance } from 'node:perf_hooks';

/** پیش‌فرض‌های اندازه‌گیری (آبجکت گزینه‌ها — DEC-036). */
export const MEASURE_DEFAULTS = Object.freeze({
  /** طول هر batch (میلی‌ثانیه). */
  durationMs: 20,
  /** تعداد batchها (میانه گرفته می‌شود). */
  batches: 5,
  /** گرم‌کردن پیش از اندازه‌گیری (میلی‌ثانیه). */
  warmupMs: 50,
  /** اندازهٔ chunk — فاصلهٔ خواندن ساعت در حلقه. */
  chunk: 4_096,
});

/** میانهٔ یک لیست عددی (کپی مرتب‌شده؛ ورودی دست‌نخورده می‌ماند). */
export function median(values) {
  if (!Array.isArray(values) || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** آماره‌های یک نمونه: میانه/کمینه/بیشینه/پراکندگی درصدی نسبت به میانه. */
export function stats(values) {
  const clean = values.filter((v) => Number.isFinite(v));
  const med = median(clean);
  const min = clean.length ? Math.min(...clean) : 0;
  const max = clean.length ? Math.max(...clean) : 0;
  return {
    median: Number(med.toFixed(4)),
    min: Number(min.toFixed(4)),
    max: Number(max.toFixed(4)),
    spreadPct: med > 0 ? Number((((max - min) / med) * 100).toFixed(2)) : 0,
    samples: clean.length,
  };
}

/**
 * نرخ عملیات بر ثانیه: هر batch تا `durationMs` اجرا می‌شود و میانهٔ batchها
 * برگردانده می‌شود.
 * @param {(i: number) => unknown} fn
 * @param {{durationMs?: number, batches?: number, warmupMs?: number, chunk?: number}} [options]
 */
export function measureOpsPerSec(fn, options = {}) {
  const opts = { ...MEASURE_DEFAULTS, ...options };
  const chunk = Math.max(1, opts.chunk);
  let sink = 0;
  let fired = 0;

  // زنجیرهٔ وابسته به تکرار (`sink = (sink + result) & mask`) عمدی است: اگر
  // نتیجه فقط در یک متغیر ریخته شود، V8 می‌تواند فراخوانی خالصِ ثابت را از حلقه
  // بیرون بکشد (hoisting) و نرخ تخیلی بدهد — اندازه‌گیری‌شده: همان متریک در دو
  // پاس پیاپی یک فرایند ۲۱۰M و ۹۹M ops/sec گزارش شد. این جمعِ loop-carried و
  // ماسک، هر دو تخریب (hoisting و DCE) را می‌بندد و برای همهٔ پیاده‌سازی‌ها
  // یکسان است (همین سرباری که سقف را پایین می‌آورد، مقایسه را منصفانه می‌کند).
  const step = (i) => {
    const result = fn(i);
    sink = (sink + (typeof result === 'number' ? result : 1)) & 0x3fffffff;
  };

  const warmStart = performance.now();
  while (performance.now() - warmStart < opts.warmupMs) {
    for (let k = 0; k < chunk; k++) step(fired++);
  }

  const samples = [];
  const counts = [];
  for (let b = 0; b < opts.batches; b++) {
    let count = 0;
    const start = performance.now();
    let elapsed = 0;
    do {
      for (let k = 0; k < chunk; k++) step(count++);
      elapsed = performance.now() - start;
    } while (elapsed < opts.durationMs);
    samples.push((count / Math.max(elapsed, 0.001)) * 1000);
    counts.push(count);
  }

  const s = stats(samples);
  return {
    iterations: Math.round(median(counts)),
    batches: opts.batches,
    durationMs: opts.durationMs,
    opsPerSec: Math.round(s.median),
    minOpsPerSec: Math.round(s.min),
    maxOpsPerSec: Math.round(s.max),
    spreadPct: s.spreadPct,
    /** جمعِ loop-carried روی خروجی‌ها — مانع DCE/hoisting توسط V8. */
    sinkConsumed: typeof sink === 'number' && Number.isFinite(sink),
  };
}

/** درصد اختلاف `current` نسبت به `baseline` (مثبت = بیشتر). */
export function relativeDeltaPct(current, baseline) {
  if (!Number.isFinite(current) || !Number.isFinite(baseline) || baseline === 0) return null;
  return Number((((current - baseline) / baseline) * 100).toFixed(2));
}
