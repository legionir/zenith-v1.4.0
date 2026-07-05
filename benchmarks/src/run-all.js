// benchmarks/src/run-all.js
//
// FEATURE (v0.4.0): Benchmark Suite Runner
//
// اجرای تمام benchmarkها و چاپ گزارش فرمت‌شده.
// اجرا: node benchmarks/src/run-all.js

import { runListBenchmarks } from './list-rendering.js';
import { runUpdateBenchmarks } from './updates.js';
import { runNestedBenchmarks } from './nested-reactivity.js';
import { runMicroBenchmarks } from './signal-vs-computed.js';

function pad(str, len, alignRight = false) {
  str = String(str);
  if (str.length >= len) return str.substring(0, len);
  const spaces = ' '.repeat(len - str.length);
  return alignRight ? spaces + str : str + spaces;
}

function printTable(rows) {
  if (rows.length === 0) return;
  const keys = Object.keys(rows[0]);
  const widths = keys.map(k => Math.max(k.length, ...rows.map(r => String(r[k] ?? '').length)));
  // header
  console.log('| ' + keys.map((k, i) => pad(k, widths[i], true)).join(' | ') + ' |');
  console.log('|-' + widths.map(w => '-'.repeat(w)).join('-|-') + '-|');
  // rows
  for (const row of rows) {
    console.log('| ' + keys.map((k, i) => pad(row[k] ?? '', widths[i], typeof row[k] === 'number')).join(' | ') + ' |');
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Zenith Framework — Benchmark Suite (v0.4.0)');
  console.log('  Performance measurement suite for reactive primitives');
  console.log('═══════════════════════════════════════════════════════════\n');

  console.log('━━━ 1. List Rendering (zen-for vs manual DOM) ━━━');
  try {
    printTable(runListBenchmarks());
  } catch (e) {
    console.log(`(skipped: ${e.message})`);
  }
  console.log('');

  console.log('━━━ 2. Signal Updates (10k sequential + bulk) ━━━');
  try {
    printTable(runUpdateBenchmarks());
  } catch (e) {
    console.log(`(skipped: ${e.message})`);
  }
  console.log('');

  console.log('━━━ 3. Nested Reactivity (3-level zen-for) ━━━');
  try {
    printTable(runNestedBenchmarks());
  } catch (e) {
    console.log(`(skipped: ${e.message})`);
  }
  console.log('');

  console.log('━━━ 4. Signal vs Computed (micro-benchmarks) ━━━');
  try {
    printTable(runMicroBenchmarks());
  } catch (e) {
    console.log(`(skipped: ${e.message})`);
  }
  console.log('');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Benchmark Suite complete.');
  console.log('  نتایج بالا روی این محیط اجرا شده‌اند. برای مقایسه‌ی');
  console.log('  دقیق، در محیط target (مرورگر/Node) اجرا کنید.');
  console.log('═══════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error('Benchmark suite crashed:', err);
  process.exit(1);
});
