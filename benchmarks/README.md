# Zenith Benchmark Suite (v0.4.0)

مجموعه‌ای از benchmarkهای عملکرد برای Zenith Framework.

## اجرا

```bash
node benchmarks/src/run-all.js
```

## benchmarkها

### ۱. List Rendering (zen-for vs manual DOM)
رندر لیستی از N آیتم (۱k, ۱۰k, ۱۰۰k) با zen-for و مقایسه با appendChild دستی.
معیار: initial render time, node count.

### ۲. Signal Updates
- ۱۰k آپدیت متوالی به یک signal (per-update time, ops/sec)
- ۱k آیتم × ۱۰ آپدیت (bulk updates)

### ۳. Nested Reactivity
۳ سطح nested zen-for (users → orders → items): ۱۰۰×۱۰×۱۰ = ۱۰k leaf nodes.
معیار: signals created, build time, deep update re-render time.
این benchmark "Nested Reactivity Explosion" را کمی می‌کند.

### ۴. Signal vs Computed (micro-benchmarks)
- `signal.get()` throughput (۱M iterations)
- `signal.set()` throughput (۱M iterations, no effect)
- `computed` re-evaluation (۱۰۰k iterations)
- `effect` re-run cost (۱۰۰k iterations)

## تفسیر نتایج

- نتایج به سخت‌افزار و محیط (Node version, browser) بستگی دارد.
- برای مقایسه‌ی دقیق، در محیط target اجرا کنید.
- benchmarkهای List Rendering ممکن است در محیط‌های بدون DOM کامل fallback کنند (با mini-dom stub).

## نسخه
v0.4.0 — اولین نسخه‌ی رسمی Benchmark Suite.
