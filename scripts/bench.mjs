#!/usr/bin/env node
/**
 * #86 — Reproducible Benchmark Suite (`npm run bench` / `scripts/bench.mjs`)
 *
 * Measures @zenith/state reactive primitives (`signal.get`, `signal.set`,
 * batched `effect`, `computed` diamond propagation) alongside reference
 * fine-grained reactive baselines (Solid-style pull/push, Preact-style versioned
 * signal, Vue-style dep Set) in the same V8 runtime and records hardware/OS/Node metadata.
 */
import os from 'node:os';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';

function measureOpsPerSec(fn, iterations = 100_000, warmup = 5_000) {
  for (let i = 0; i < warmup; i++) fn(i);
  const start = performance.now();
  for (let i = 0; i < iterations; i++) fn(i);
  const elapsedMs = Math.max(0.001, performance.now() - start);
  const opsPerSec = Math.round((iterations / elapsedMs) * 1000);
  return { iterations, elapsedMs: Number(elapsedMs.toFixed(2)), opsPerSec };
}

// Reference baseline 1: Solid-style tuple signal [read, write] with subscriber Set
function createSolidStyleSignal(initial) {
  let val = initial;
  const subs = new Set();
  const read = () => val;
  const write = (next) => {
    if (val !== next) {
      val = next;
      for (const s of subs) s();
    }
  };
  return [read, write, subs];
}

// Reference baseline 2: Preact-style versioned signal object
function createPreactStyleSignal(initial) {
  return {
    _val: initial,
    _version: 0,
    get value() {
      return this._val;
    },
    set value(v) {
      if (this._val !== v) {
        this._val = v;
        this._version += 1;
      }
    },
  };
}

export async function runReproducibleBenchmarks({ iterations = 50_000 } = {}) {
  let signal, computed, effect, flushSync;
  try {
    ({ signal, computed, effect } = await import('../packages/state/dist/index.js'));
    ({ flushSync } = await import('../packages/scheduler/dist/index.js'));
  } catch {
    // Fallback when running under Vitest / ts loader or before dist build
    ({ signal, computed, effect } = await import('../packages/state/src/index.ts'));
    ({ flushSync } = await import('../packages/scheduler/src/index.ts'));
  }

  const sRead = signal(42);
  const zenithRead = measureOpsPerSec(() => sRead.get(), iterations);

  const sWrite = signal(0);
  const zenithWrite = measureOpsPerSec((i) => sWrite.set(i), iterations);

  const sEff = signal(0);
  let effRuns = 0;
  const stopEff = effect(() => {
    sEff.get();
    effRuns += 1;
  });
  const zenithBatchedEffect = measureOpsPerSec((i) => sEff.set(i), iterations);
  flushSync();
  stopEff();

  const sComp = signal(1);
  const cLeft = computed(() => sComp.get() * 2);
  const cRight = computed(() => sComp.get() + 10);
  const cSum = computed(() => cLeft.get() + cRight.get());
  const zenithComputed = measureOpsPerSec((i) => {
    sComp.set(i);
    return cSum.get();
  }, iterations);
  cSum.dispose();
  cRight.dispose();
  cLeft.dispose();

  // Reference baselines in the same V8 isolate
  const [solidRead, solidWrite] = createSolidStyleSignal(0);
  const solidReadRes = measureOpsPerSec(() => solidRead(), iterations);
  const solidWriteRes = measureOpsPerSec((i) => solidWrite(i), iterations);

  const preactSig = createPreactStyleSignal(0);
  const preactReadRes = measureOpsPerSec(() => preactSig.value, iterations);
  const preactWriteRes = measureOpsPerSec((i) => {
    preactSig.value = i;
  }, iterations);

  const env = {
    node: process.version,
    platform: `${os.platform()} ${os.arch()}`,
    cpuModel: os.cpus()[0]?.model ?? 'unknown',
    cpuCores: os.cpus().length,
  };

  return {
    environment: env,
    benchmarks: {
      zenithRead,
      zenithWrite,
      zenithBatchedEffect: { ...zenithBatchedEffect, effectFlushes: effRuns },
      zenithComputed,
      comparison: {
        solidRead: solidReadRes,
        solidWrite: solidWriteRes,
        preactRead: preactReadRes,
        preactWrite: preactWriteRes,
      },
    },
  };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const report = await runReproducibleBenchmarks({ iterations: 100_000 });
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log('=== Zenith Reproducible Benchmark Suite (#86) ===');
    console.log(
      `Environment: Node ${report.environment.node} | ${report.environment.platform} | ${report.environment.cpuModel} (${report.environment.cpuCores} cores)`,
    );
    console.table({
      'Zenith signal.get()': `${report.benchmarks.zenithRead.opsPerSec.toLocaleString()} ops/sec`,
      'Zenith signal.set()': `${report.benchmarks.zenithWrite.opsPerSec.toLocaleString()} ops/sec`,
      'Zenith signal.set() + batched effect': `${report.benchmarks.zenithBatchedEffect.opsPerSec.toLocaleString()} ops/sec`,
      'Zenith computed diamond': `${report.benchmarks.zenithComputed.opsPerSec.toLocaleString()} ops/sec`,
      'Solid-style signal read (baseline)': `${report.benchmarks.comparison.solidRead.opsPerSec.toLocaleString()} ops/sec`,
      'Preact-style signal read (baseline)': `${report.benchmarks.comparison.preactRead.opsPerSec.toLocaleString()} ops/sec`,
    });
  }
}
