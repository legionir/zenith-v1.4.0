// scripts/bench-reference.mjs
// #86 — the ≤5% reference runner: the procedure behind the reproducibility
// claim, as code. `npm run bench` is advisory by design (exit 0 on shared
// machines); THIS runner is the fail-closed gate for "every gated number
// reproduces within 5%":
//   - a PREDEFINED plan (default 5 independent runs, each in a fresh child
//     process — never "pick the best run after seeing the results"),
//   - a fail-closed environment check (no silent advisory downgrade: a
//     different machine exits 2 instead of pretending to compare),
//   - per-run absolute deviation vs baseline for EVERY gated metric
//     (informational metrics make no claim and are excluded from the verdict),
//   - raw per-run evidence JSON written to benchmarks/results/,
//   - a `--self-check` mode proving the gate trips on deliberate deviation
//     through the very same evaluation path (negative control).
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtempSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectEnvironment } from '../benchmarks/lib/env.mjs';
import { relativeDeltaPct } from '../benchmarks/lib/measure.mjs';

const ROOT = join(fileURLToPath(import.meta.url), '..', '..');
const BENCH_SCRIPT = join(ROOT, 'scripts', 'bench.mjs');
const BASELINE_PATH = join(ROOT, 'benchmarks', 'results', 'baseline.json');
const RESULTS_DIR = join(ROOT, 'benchmarks', 'results');

/** Minimum independent runs — the acceptance criterion fixes this floor. */
export const REFERENCE_RUNS = 5;
/** The ≤5% claim: absolute per-run deviation vs baseline, every gated metric. */
export const REFERENCE_TOLERANCE_PCT = 5;
/** Exit code reserved for "wrong machine — refuse to compare". */
export const ENVIRONMENT_MISMATCH_EXIT = 2;
/** Environment fields that must match the recorded baseline machine. */
export const REFERENCE_ENV_FIELDS = Object.freeze([
  'node',
  'v8',
  'platform',
  'cpuModel',
  'cpuCores',
  'domEngine',
]);

/**
 * CLI parsing — exported so the contract (incl. the ≥5 runs floor and unknown
 * flags) is cheaply testable. `--runs` below 5 is rejected: fewer runs cannot
 * support the "minimum 5 independent runs" evidence the criterion demands.
 */
export function parseReferenceArgs(argv) {
  const flags = { runs: REFERENCE_RUNS, only: null, outDir: null, selfCheck: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') continue;
    if (arg === '--self-check') flags.selfCheck = true;
    else if (arg === '--runs') {
      const n = Number(argv[++i]);
      if (!Number.isInteger(n) || n < REFERENCE_RUNS) {
        throw new Error(
          `bench-reference: --runs باید عدد صحیح ≥ ${REFERENCE_RUNS} باشد (شاهد حداقل ۵ اجرای مستقل)`,
        );
      }
      flags.runs = n;
    } else if (arg === '--only') flags.only = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (arg === '--out-dir') flags.outDir = argv[++i] ?? null;
    else if (arg === '--help' || arg === '-h') flags.help = true;
    else throw new Error(`bench-reference: پرچم ناشناخته «${arg}»`);
  }
  if (flags.only && flags.only.length === 0) flags.only = null;
  return flags;
}

/**
 * Fail-closed environment check: returns every differing field so the log
 * names the drift. A missing recorded environment is itself a mismatch —
 * comparing against "no machine" would be vacuous.
 */
export function checkReferenceEnvironment(live, recorded) {
  if (!recorded || typeof recorded !== 'object') {
    return { ok: false, mismatches: ['baseline بدون محیط ثبت‌شده است'] };
  }
  const mismatches = [];
  for (const field of REFERENCE_ENV_FIELDS) {
    if (live?.[field] !== recorded[field]) {
      mismatches.push(`${field}: «${live?.[field] ?? '—'}» در برابر «${recorded[field] ?? '—'}»`);
    }
  }
  return { ok: mismatches.length === 0, mismatches };
}

/**
 * The ≤5% verdict over predefined runs. `runs` is an array of per-run metric
 * arrays (`[{id, value, unit}]`); `baselineMetrics` is the baseline record
 * (`{id: {value, gate}}`). Absolute deviation (direction-free): a 6% speedup
 * is as much a non-reproduction as a 6% slowdown. Fail-closed: a gated metric
 * missing from ANY run fails the gate instead of being skipped.
 */
export function evaluateReferenceRuns(runs, baselineMetrics, tolerancePct = REFERENCE_TOLERANCE_PCT) {
  const gatedIds = Object.values(baselineMetrics ?? {})
    .filter((m) => m && m.gate !== false && typeof m.value === 'number')
    .map((m) => m.id);
  const informational = Object.values(baselineMetrics ?? {}).filter((m) => m && m.gate === false).length;
  const failures = [];
  runs.forEach((runMetrics, runIndex) => {
    const byId = new Map((runMetrics ?? []).map((m) => [m?.id, m]));
    for (const id of gatedIds) {
      const base = baselineMetrics[id];
      const observed = byId.get(id);
      if (!observed || typeof observed.value !== 'number' || !Number.isFinite(observed.value)) {
        failures.push({ id, runIndex, deltaPct: null, reason: 'missing-in-run' });
        continue;
      }
      const deltaPct = relativeDeltaPct(observed.value, base.value);
      if (deltaPct === null || Math.abs(deltaPct) > tolerancePct) {
        failures.push({ id, runIndex, deltaPct, reason: 'outside-tolerance' });
      }
    }
  });
  return {
    pass: failures.length === 0 && runs.length > 0,
    failures,
    checked: gatedIds.length,
    runs: runs.length,
    tolerancePct,
    informational,
  };
}

/**
 * Negative-control helper: returns a copy of one run with a single metric
 * scaled by `factor`, so `--self-check` can prove the gate trips through the
 * same evaluateReferenceRuns path the real runs take.
 */
export function injectDeviation(runMetrics, id, factor) {
  return (runMetrics ?? []).map((m) =>
    m?.id === id ? { ...m, value: m.value * factor } : m,
  );
}

/** One independent run in a FRESH child process (same isolation rationale as bench.mjs). */
function runReferencePass({ only = null } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'zenith-bench-ref-'));
  const out = join(dir, 'pass.json');
  const args = [BENCH_SCRIPT, '--out', out];
  if (only) args.push('--only', only.join(','));
  try {
    execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'ignore', timeout: 300_000 });
    const pass = JSON.parse(readFileSync(out, 'utf8'));
    return Array.isArray(pass.metrics) ? pass.metrics : [];
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** `--self-check`: no benches run; the gate must PASS clean runs and FAIL the tampered one. */
function selfCheck(baseline) {
  const ids = Object.values(baseline.metrics)
    .filter((m) => m.gate !== false)
    .map((m) => m.id);
  if (ids.length === 0) throw new Error('bench-reference --self-check: متریک گیت‌شده‌ای در baseline نیست');
  const cleanRun = ids.map((id) => ({ id, value: baseline.metrics[id].value, unit: 'x' }));
  const clean = evaluateReferenceRuns([cleanRun], baseline.metrics);
  if (!clean.pass) throw new Error('bench-reference --self-check: گیت روی اجراهای تمیز رد شد (باگ گیت)');
  const tampered = injectDeviation(cleanRun, ids[0], 1.5);
  const tripped = evaluateReferenceRuns([tampered], baseline.metrics);
  if (tripped.pass) throw new Error('bench-reference --self-check: انحراف عمدی ۵۰٪ گیت را قرمز نکرد (گیت توخالی است)');
  if (tripped.failures[0]?.id !== ids[0] || tripped.failures[0]?.runIndex !== 0) {
    throw new Error('bench-reference --self-check: گزارش انحراف، متریک/ران درست را نشان نداد');
  }
  console.log(
    `✅ bench-reference --self-check: گیت روی ${clean.checked} متریک گیت‌شده سالم است (تمیز=سبز، ‎+۵۰٪ عمدی=قرمز در ${ids[0]})`,
  );
  return 0;
}

async function main() {
  const flags = parseReferenceArgs(process.argv.slice(2));
  if (flags.help) {
    console.log(
      'usage: npm run bench:reference [-- --runs <n≥5>|--only <id,...>|--out-dir <dir>|--self-check]',
    );
    return 0;
  }
  if (!existsSync(BASELINE_PATH)) {
    throw new Error('bench-reference: benchmarks/results/baseline.json وجود ندارد (اول `npm run bench:record`)');
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  if (flags.selfCheck) return selfCheck(baseline);

  const liveEnv = collectEnvironment();
  const envCheck = checkReferenceEnvironment(liveEnv, baseline.environment);
  if (!envCheck.ok) {
    console.error('❌ bench-reference: محیط با ماشین ثبت baseline یکی نیست — مقایسه امتناع شد:');
    for (const m of envCheck.mismatches) console.error(`   - ${m}`);
    console.error('   ادعای «≤۵٪» فقط روی همان محیط معنا دارد؛ برای ثبت مجدد: npm run bench:record');
    return ENVIRONMENT_MISMATCH_EXIT;
  }

  const runs = [];
  for (let i = 0; i < flags.runs; i++) {
    console.log(`\n── پاس مرجع ${i + 1}/${flags.runs} (فرایند تازه) ──`);
    runs.push(runReferencePass({ only: flags.only }));
  }
  const verdict = evaluateReferenceRuns(runs, baseline.metrics ?? {});
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = flags.outDir ?? RESULTS_DIR;
  mkdirSync(outDir, { recursive: true });
  const evidencePath = join(outDir, `reference-${stamp}.json`);
  writeFileSync(
    evidencePath,
    `${JSON.stringify(
      {
        schema: 1,
        runner: 'bench-reference',
        generatedAt: new Date().toISOString(),
        runs: flags.runs,
        tolerancePct: verdict.tolerancePct,
        environment: liveEnv,
        baseline: { commit: baseline.commit, recordedAt: baseline.recordedAt },
        rawRuns: runs,
        verdict,
      },
      null,
      2,
    )}\n`,
  );

  console.log(`\n=== گیت مرجع ≤۵٪ (#86): ${verdict.checked} متریک گیت‌شده × ${verdict.runs} پاس ===`);
  if (verdict.pass) {
    console.log(
      `✅ هر ${verdict.checked} متریک گیت‌شده در هر ${verdict.runs} اجرای مستقل در ≤۵٪ baseline است — شاهد خام: ${evidencePath}`,
    );
    return 0;
  }
  console.error(`❌ ${verdict.failures.length} تخلف از ≤۵٪:`);
  for (const f of verdict.failures.slice(0, 20)) {
    console.error(
      `   - ${f.id} (پاس ${f.runIndex + 1}): ${f.reason === 'missing-in-run' ? 'در این پاس نیست' : `Δ ${f.deltaPct}%`}`,
    );
  }
  console.error(`   شاهد خام: ${evidencePath}`);
  return 1;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main()
    .then((code) => process.exit(code ?? 0))
    .catch((err) => {
      console.error(`❌ bench-reference: ${err?.message ?? err}`);
      process.exit(1);
    });
}
