#!/usr/bin/env node
// scripts/benchmark-ci.mjs
//
// #84 (CI): بنچمارک خودکار برای کشف regression عملکرد. زیرمجموعه‌ای قطعی
// از benchmarkها را اجرا و با سقف‌های `benchmarks/budgets.json` مقایسه می‌کند؛
// اگر هر متریک بدتر از بودجه (× حدانه‌ای) باشد، exit 1.
//
// این اسکریپت سریع اجرا می‌شود (<30s) و در هر Push اجرا می‌گردد.
// بنچمارک کامل جریان-نرم با `node benchmarks/run-all.js` جداست.

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const budgetPath = join(root, 'benchmarks', 'budgets.json');

// بودجه‌ها: حداقل ops/sec (بزرگ‌تر بهتر) — با حاشیهٔ ۴۰٪ برای نویز CI.
const budgets = existsSync(budgetPath)
  ? JSON.parse(readFileSync(budgetPath, 'utf8'))
  : { signalsCreateSet: 200_000, ssrRender: 2_000 };
const SLACK = 0.6; // حدانه — بودجه × ۰٫۶ پایین‌تر آستانهٔ شکست

// dist استفاده می‌شود (نه src/.ts) — بنچمارک باید خروجی منتشرشونده را بسنجد.
const stateDist = join(root, 'packages/state/dist/index.js');
if (!existsSync(stateDist)) {
  console.error('❌ ابتدا build کنید: npm run build (سپس npm run bench:ci)');
  process.exit(1);
}
const { signal, computed } = await import(`file://${stateDist}`);

function measure(name, fn, iterations) {
  const t0 = performance.now();
  fn(iterations);
  const dt = performance.now() - t0;
  const ops = Math.round((iterations * 1000) / Math.max(dt, 0.001));
  return { name, opsPerSec: ops, ms: Number(dt.toFixed(2)) };
}

const results = [];

// ۱) هستهٔ reactive: ساخت N سیگنال + مجموعه‌ای آپدیت با computed وابسته
results.push(
  measure(
    'signalsCreateSet',
    (n) => {
      for (let i = 0; i < n / 10; i++) {
        const s = signal(i);
        const c = computed(() => s.get() * 2);
        for (let k = 0; k < 10; k++) {
          s.set(k);
          void c.get();
        }
        c.dispose?.();
      }
    },
    100_000,
  ),
);

console.log('\n📊 نتایج بنچمارک CI (#84):');
console.log('─'.repeat(64));
let failed = 0;
for (const r of results) {
  const budget = budgets[r.name];
  const floor = Math.round(budget * SLACK);
  const pass = budget === undefined ? null : r.opsPerSec >= floor;
  if (pass === false) failed++;
  const mark = pass === null ? 'ℹ️ ' : pass ? '✅' : '❌';
  console.log(
    `${mark} ${r.name}: ${r.opsPerSec.toLocaleString('fa')} ops/s (${r.ms}ms) — بودجه ≥ ${floor.toLocaleString('fa')}`,
  );
}
console.log('─'.repeat(64));

if (failed > 0) {
  console.error(`❌ ${failed} متریک از بودجهٔ عملکرد پایین‌تر است (regression احتمالی).`);
  process.exit(1);
}
console.log('✅ همهٔ متریک‌ها در بودجهٔ عملکرد هستند.');
