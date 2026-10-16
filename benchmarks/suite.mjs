// benchmarks/suite.mjs
// #86 — سوئیت واحد بنچمارک: «یک دستور، همهٔ اعداد».
//
// گروه‌ها:
//   1) reactive  — میکرو (signal read/write، effect گروهی، الماسِ computed) برای
//      Zenith و سه مرجع واقعی (Solid/Vue/Preact) در همان V8.
//   2) dom       — عملیات لیست js-framework-benchmark روی jsdom (benchmarks/dom-suite.js).
//   3) memory    — heap delta به‌ازای هر signal.
//   4) ssr       — نرخ رندر صفحهٔ ۵۰ آیتمی در Node.
//
// هر متریک یک رکورد یکنواخت است: { id, group, impl, label, unit, value,
// samples, script } — سند `docs/BENCHMARKS.md` از همین رکوردها ساخته می‌شود،
// پس هر عدد در سند به اسکریپت + کامیت گره خورده است.
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectEnvironment } from './lib/env.mjs';
import { measureOpsPerSec } from './lib/measure.mjs';
import {
  COMPETITOR_BUILDS,
  COMPETITOR_LABELS,
  competitorVersions,
  loadCompetitors,
} from './competitors.js';
import { DOM_SUITE_OPERATIONS, runDomListSuite } from './dom-suite.js';

export const SUITE_SCRIPT = 'benchmarks/suite.mjs';

/** گروه‌های سوئیت — ترتیب همین است که در خروجی و سند چاپ می‌شود. */
export const SUITE_GROUPS = Object.freeze(['reactive', 'dom', 'memory', 'ssr']);

/** پیش‌فرض‌های قابل‌تنظیم (آبجکت گزینه‌ها — DEC-036). */
export const SUITE_DEFAULTS = Object.freeze({
  /** مدت هر batch میکرو (ms) — اندازه‌گیری زمان‌محور، نه تعداد ثابت. */
  durationMs: 20,
  batches: 5,
  warmupMs: 400,
  /** 0 ⇒ سیاست نمونه‌گیری داخلی سوئیت DOM (۳ نمونه برای عملیات سنگین، ۷ برای بقیه). */
  domRuns: 0,
  domWarmupRuns: 2,
  ssrPages: 100,
  memorySignals: 100_000,
});

/** دسته‌های DOM جدا نگه داشته می‌شوند تا گزارش خوانا بماند. */

/** ماژول‌های Zenith از dist خوانده می‌شوند (خروجی منتشرشده)، با fallback به src. */
async function loadZenith() {
  try {
    const state = await import('../packages/state/dist/index.js');
    const scheduler = await import('../packages/scheduler/dist/index.js');
    return { state, scheduler };
  } catch {
    const state = await import('../packages/state/src/index.ts');
    const scheduler = await import('../packages/scheduler/src/index.ts');
    return { state, scheduler };
  }
}

function metric({ id, group, impl, label, unit, value, samples = null, note = null }) {
  return { id, group, impl, label, unit, value, samples, note, script: SUITE_SCRIPT };
}

/** ۱) میکرو reactive: Zenith و مراجع واقعی. */
export async function runReactiveSuite(options = {}) {
  const opts = { ...SUITE_DEFAULTS, ...options };
  const { state, scheduler } = await loadZenith();
  const { signal, computed, effect } = state;
  const { flushSync } = scheduler;
  const versions = competitorVersions();
  const competitors = await loadCompetitors();
  const ops = { durationMs: opts.durationMs, batches: opts.batches, warmupMs: opts.warmupMs };

  const rows = [];
  const add = (impl, kind, label, res, unit = 'ops/sec') =>
    rows.push(
      metric({
        id: `reactive.${impl}.${kind}`,
        group: 'reactive',
        impl,
        label,
        unit,
        value: unit === 'ops/sec' ? res.opsPerSec : res.ms,
        samples: { min: res.minOpsPerSec ?? res.minMs, max: res.maxOpsPerSec ?? res.maxMs, spreadPct: res.spreadPct },
      }),
    );

  // Zenith
  const sRead = signal(42);
  add('zenith', 'signal-read', 'signal.get()', measureOpsPerSec(() => sRead.get(), ops));
  const sWrite = signal(0);
  add('zenith', 'signal-write', 'signal.set() (بدون subscriber)', measureOpsPerSec((i) => sWrite.set(i), ops));

  const sEff = signal(0);
  const stopEff = effect(() => {
    sEff.get();
  });
  const batched = measureOpsPerSec((i) => {
    sEff.set(i);
    flushSync();
  }, ops);
  add('zenith', 'signal-write-batched-effect', 'signal.set() + یک effect (flushSync هر بار)', batched);
  stopEff();

  const sComp = signal(1);
  const cLeft = computed(() => sComp.get() * 2);
  const cRight = computed(() => sComp.get() + 10);
  const cSum = computed(() => cLeft.get() + cRight.get());
  add(
    'zenith',
    'computed-diamond',
    'الماسِ computed (set + read)',
    measureOpsPerSec((i) => {
      sComp.set(i);
      return cSum.get();
    }, ops),
  );
  cSum.dispose();
  cRight.dispose();
  cLeft.dispose();

  // اثرِ batching: چند بار effect با ۱۰٬۰۰۰ نوشتن اجرا می‌شود؟
  const writes = 10_000;
  const sBatch = signal(0);
  let batchRuns = 0;
  const stopBatch = effect(() => {
    sBatch.get();
    batchRuns += 1;
  });
  const before = batchRuns;
  for (let i = 0; i < writes; i++) sBatch.set(i);
  flushSync();
  stopBatch();
  rows.push(
    metric({
      id: 'reactive.zenith.effect-runs-per-10k-writes',
      group: 'reactive',
      impl: 'zenith',
      label: `اجرای effect برای ${writes.toLocaleString('en-US')} نوشتن متوالی`,
      unit: 'runs',
      value: batchRuns - before,
      note: 'batching خودکار: انتظار ۱',
    }),
  );

  // سقف اندازه‌گیری: همان حلقه/closure، ولی با یک عملیات بی‌هزینه. هر عددی که به
  // این سقف نزدیک باشد «کفِ واقعی» است، نه نرخ واقعی کتابخانه (در سند علامت ⛔).
  const ceiling = measureOpsPerSec(() => 1 + 1, ops);
  rows.push(
    metric({
      id: 'reactive.harness.ceiling',
      group: 'reactive',
      impl: 'harness',
      label: 'سقف اندازه‌گیری هارنس (1+1 در همان حلقه)',
      unit: 'ops/sec',
      value: ceiling.opsPerSec,
      samples: { min: ceiling.minOpsPerSec, max: ceiling.maxOpsPerSec, spreadPct: ceiling.spreadPct },
      note: 'هر متریک ≥۸۵٪ این سقف، تنها کفِ نرخ واقعی است',
    }),
  );

  // مراجع واقعی
  for (const [key, adapter] of Object.entries(competitors)) {
    add(key, 'signal-read', 'signal read', measureOpsPerSec(adapter.createRead(), ops));
    const write = adapter.createWrite();
    add(key, 'signal-write', 'signal write (بدون subscriber)', measureOpsPerSec((i) => write(i), ops));
    const diamond = adapter.createDiamond();
    add(
      key,
      'computed-diamond',
      'الماسِ computed (set + read)',
      measureOpsPerSec((i) => diamond(i), ops),
    );

    const counter = adapter.createEffectCounter();
    const startRuns = counter.runs();
    for (let i = 0; i < writes; i++) counter.set(i);
    await counter.flush();
    rows.push(
      metric({
        id: `reactive.${key}.effect-runs-per-10k-writes`,
        group: 'reactive',
        impl: key,
        label: `اجرای effect برای ${writes.toLocaleString('en-US')} نوشتن متوالی`,
        unit: 'runs',
        value: counter.runs() - startRuns,
        note: 'همگام (پس از flush): هر نوشتن یک اجرا',
      }),
    );
  }

  const versionsById = { zenith: versions.zenith };
  for (const key of Object.keys(competitors)) versionsById[key] = versions[key];
  return { rows, versions: versionsById, labels: COMPETITOR_LABELS, builds: COMPETITOR_BUILDS };
}

/** ۲) عملیات لیست js-framework-benchmark روی jsdom. */
export async function runDomBenchmarks(options = {}) {
  const opts = { ...SUITE_DEFAULTS, ...options };
  const { JSDOM } = await import('jsdom');
  // هر عملیات در یک سند تازه اندازه‌گیری می‌شود: jsdom لیست‌های live را در ریشهٔ
  // سند کش می‌کند و mutationهای عملیات قبلی هزینهٔ عملیات بعدی را مصنوعی بالا
  // می‌برند (اندازه‌گیری‌شده: پاک‌کردن ۱۰k ردیف از ۰٫۲s به ۶s می‌رسد).
  // پاس گرم‌کردن فرایند: هر عملیات یک بار در سندِ دورانداختنی اجرا می‌شود تا
  // JIT/تخصیص حافظه و اولین لمسِ page گرم شود؛ بدون این، اولین عملیات هر اجرا
  // ۵–۱۵٪ کندتر از اجرای بعدی همان فرایند است (اندازه‌گیری‌شده).
  for (const op of DOM_SUITE_OPERATIONS) {
    const dom = new JSDOM(
      '<!doctype html><html><body><table><tbody id="tbody"></tbody></table></body></html>',
    );
    runDomListSuite(dom.window.document, { only: [op.id], runs: 1, warmupRuns: 0 });
    dom.window.close();
  }

  const byId = new Map();
  for (const op of DOM_SUITE_OPERATIONS) {
    const dom = new JSDOM(
      '<!doctype html><html><body><table><tbody id="tbody"></tbody></table></body></html>',
    );
    const [row] = runDomListSuite(dom.window.document, {
      only: [op.id],
      runs: opts.domRuns || undefined,
      warmupRuns: opts.domWarmupRuns,
    });
    if (row) byId.set(row.id, row);
    dom.window.close();
  }
  const rows = DOM_SUITE_OPERATIONS.map((op) => {
    const res = byId.get(op.id);
    return metric({
      id: `dom.${op.id}`,
      group: 'dom',
      impl: 'zenith-dom',
      label: op.label,
      unit: 'ms',
      value: res?.ms ?? 0,
      samples: {
        runs: res?.runs ?? 0,
        rows: op.rows,
        repeat: res?.repeat ?? 1,
        spreadPct: res?.spreadPct ?? 0,
        medianMs: res?.medianMs ?? 0,
      },
      note: `js-framework-benchmark list: ${op.id}`,
    });
  });
  return { rows, operations: DOM_SUITE_OPERATIONS };
}

/**
 * ۳) حافظه: bytes/signal — در یک فرایند فرزند با `--expose-gc`
 * (`benchmarks/memory-probe.mjs`). اندازه‌گیری درون‌فرایندی می‌تواند به دلیل
 * GC خودکار V8 حتی منفی شود؛ اینجا gc() صریح و heap پایدار است (بازتولید
 * مشاهده‌شده: ۵۲۸/۵۲۹ بایت در سه اجرا).
 */
export async function runMemoryBenchmark(options = {}) {
  const opts = { ...SUITE_DEFAULTS, ...options };
  const probe = fileURLToPath(new URL('./memory-probe.mjs', import.meta.url));
  let result = null;
  try {
    const stdout = execFileSync(process.execPath, ['--expose-gc', probe, String(opts.memorySignals)], {
      encoding: 'utf8',
      timeout: 60_000,
    });
    result = JSON.parse(stdout.trim().split('\n').pop());
  } catch (err) {
    result = null;
    void err;
  }

  if (!result) {
    // fallback: اندازه‌گیری درون‌فرایندی (تقریبی — در گزارش مشخص می‌شود)
    const { state } = await loadZenith();
    const { signal } = state;
    const before = process.memoryUsage().heapUsed;
    const keep = new Array(opts.memorySignals);
    for (let i = 0; i < opts.memorySignals; i++) keep[i] = signal(i);
    const after = process.memoryUsage().heapUsed;
    if (keep.length !== opts.memorySignals) throw new Error('memory benchmark: signals collected');
    result = {
      signals: opts.memorySignals,
      bytesPerSignal: Math.round((after - before) / opts.memorySignals),
      gcExposed: false,
    };
  }

  return {
    rows: [
      metric({
        id: 'memory.bytes-per-signal',
        group: 'memory',
        impl: 'zenith',
        label: `${Number(result.signals).toLocaleString('en-US')} signal — بایت به‌ازای هر signal`,
        unit: 'bytes',
        value: result.bytesPerSignal,
        samples: { signals: result.signals, gcExposed: result.gcExposed === true },
        note: result.gcExposed
          ? 'فرایند فرزند با --expose-gc (heap پایدار)'
          : 'fallback درون‌فرایندی (بدون --expose-gc) — تقریبی',
      }),
    ],
  };
}

/** ۴) SSR: نرخ رندر صفحهٔ ۵۰ آیتمی (دسته‌ای، تا واحد اندازه‌گیری معنادار باشد). */
export async function runSsrBenchmark(options = {}) {
  const opts = { ...SUITE_DEFAULTS, ...options };
  let renderToString;
  try {
    ({ renderToString } = await import('../packages/ssr/dist/index.js'));
  } catch {
    ({ renderToString } = await import('../packages/ssr/src/index.ts'));
  }
  // توجه: `item.name` در سندباکس expression ممنوع است (ZEN-905، محافظ
  // prototype-pollution) — از `item.label` استفاده می‌کنیم.
  const template = `<div id="app"><h1 zen-text="$title"></h1><ul><li zen-for="item in $items" zen-key="item.id"><span zen-text="item.label"></span></li></ul></div>`;
  const state = {
    title: 'benchmark',
    items: Array.from({ length: 50 }, (_, i) => ({ id: i, label: `item ${i}` })),
  };
  // اولین رندر، استخر/کش قالب را گرم می‌کند؛ اندازه‌گیری بعد از آن انجام می‌شود.
  await renderToString(template, state);

  const perBatch = opts.ssrPages;
  const batches = opts.batches;
  // دو batch گرم‌کردن (دورانداختنی): JIT/template-cache در batchهای اول رشد
  // می‌کند و میانه را ۳۰–۵۰٪ جابه‌جا می‌کرد (اندازه‌گیری‌شده).
  for (let b = 0; b < 2; b++) {
    for (let i = 0; i < perBatch; i++) await renderToString(template, state);
  }
  const rates = [];
  let lastBatchMs = 0;
  for (let b = 0; b < batches; b++) {
    const start = performance.now();
    for (let i = 0; i < perBatch; i++) await renderToString(template, state);
    lastBatchMs = Math.max(0.001, performance.now() - start);
    rates.push((perBatch / lastBatchMs) * 1000);
  }
  const sorted = [...rates].sort((a, b) => a - b);
  // بهترین batch (هم‌سیاست با گروه DOM: نویز فقط زمان اضافه می‌کند).
  const pagesPerSec = Math.round(sorted[sorted.length - 1]);
  return {
    rows: [
      metric({
        id: 'ssr.pages-per-sec',
        group: 'ssr',
        impl: 'zenith-ssr',
        label: 'رندر صفحهٔ ۵۰ آیتمی (renderToString)',
        unit: 'pages/sec',
        value: pagesPerSec,
        samples: {
          batches,
          pagesPerBatch: perBatch,
          spreadPct: pagesPerSec > 0 ? Number((((sorted[sorted.length - 1] - sorted[0]) / pagesPerSec) * 100).toFixed(2)) : 0,
          lastBatchMs: Number(lastBatchMs.toFixed(3)),
        },
        note: `بهترین ${batches} دستهٔ ${perBatch} صفحه‌ای، پس از دو دستهٔ گرم‌کردن`,
      }),
    ],
  };
}

/**
 * کل سوئیت. `opts` روی همهٔ گروه‌ها اعمال می‌شود (بیش‌نویسی آبجکت گزینه‌ها).
 * @param {{iterations?: number, batches?: number, domRuns?: number, groups?: string[]}} [opts]
 */
export async function runBenchmarkSuite(opts = {}) {
  const environment = collectEnvironment();
  const groups = opts.groups ?? SUITE_GROUPS;
  const rows = [];
  const meta = {};

  if (groups.includes('reactive')) {
    const res = await runReactiveSuite(opts);
    rows.push(...res.rows);
    meta.versions = res.versions;
    meta.labels = res.labels;
    meta.builds = res.builds;
  }
  if (groups.includes('dom')) {
    const res = await runDomBenchmarks(opts);
    rows.push(...res.rows);
    meta.domOperations = res.operations;
  }
  if (groups.includes('memory')) rows.push(...(await runMemoryBenchmark(opts)).rows);
  if (groups.includes('ssr')) rows.push(...(await runSsrBenchmark(opts)).rows);

  return {
    suite: 'zenith-benchmarks',
    schema: 1,
    script: SUITE_SCRIPT,
    domSuiteScript: 'benchmarks/dom-suite.js',
    environment,
    versions: meta.versions ?? {},
    labels: meta.labels ?? {},
    builds: meta.builds ?? {},
    metrics: rows,
  };
}

/** مسیر پیش‌فرض نتایج (baseline ثبت‌شده و آخرین اجرا). */
export const RESULTS_DIR = join('benchmarks', 'results');
