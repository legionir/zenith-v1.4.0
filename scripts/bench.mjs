#!/usr/bin/env node
/**
 * #86 — `npm run bench`: یک دستور، همهٔ اعداد، و یک گیتِ بازتولیدپذیری.
 *
 * چه می‌کند:
 *   ۱. سوئیت کامل را اجرا می‌کند (`benchmarks/suite.mjs`): میکرو reactive +
 *      مقایسه با Solid/Vue/Preact واقعی، عملیات لیست js-framework-benchmark روی
 *      jsdom، حافظه، و SSR.
 *   ۲. محیط (CPU/هسته/حافظه/OS/Node/jsdom)، نسخهٔ رقبا، و کامیت جاری را ثبت
 *      می‌کند.
 *   ۳. اگر `benchmarks/results/baseline.json` ثبت‌شده باشد و **همان محیط**
 *      باشد، هر متریک را با `tolerancePct` خودش مقایسه می‌کند و در صورت انحراف
 *      بیش از حد با exit 1 برمی‌گردد. روی محیط دیگری فقط هشدار می‌دهد (اعداد
 *      مطلق چاپ می‌شوند) چون مقایسه بی‌معناست.
 *
 * پرچم‌ها:
 *   --json          خروجی JSON کامل (ماشین‌خوان) روی stdout
 *   --record        ثبت baseline جدید در `benchmarks/results/baseline.json`
 *   --passes <n>    تعداد پاس‌های اندازه‌گیری برای ثبت (پیش‌فرض ۳؛ کمینه در هر متریک برنده است)
 *   --only <id>     فقط یک متریک (یا چند تا با کاما) — مسیرِ بازتولید یک عدد خاص
 *   --groups <list> فقط گروه‌های مشخص (reactive,dom,memory,ssr) — مثل --groups reactive
 *   --quick         اندازه‌گیری سریع برای تست‌ها (تکرار کم)
 *   --list          فهرست شناسهٔ متریک‌ها و خارج شدن
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUITE_GROUPS, runBenchmarkSuite } from '../benchmarks/suite.mjs';
import { sameEnvironment } from '../benchmarks/lib/env.mjs';
import { relativeDeltaPct } from '../benchmarks/lib/measure.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RESULTS_DIR = join(ROOT, 'benchmarks', 'results');
const BASELINE_PATH = join(RESULTS_DIR, 'baseline.json');
const LATEST_PATH = join(RESULTS_DIR, 'latest.json');

/** آستانهٔ پیش‌فرض گروه‌ها (درصد) — کفِ ۵٪ برای گروه‌های میکرو/SSR. */
export const GROUP_TOLERANCE_PCT = Object.freeze({
  reactive: 5,
  ssr: 5,
  dom: 15, // نویز ذاتی jsdom (سقف مجاز) — درصد واقعی هر متریک در baseline ثبت می‌شود
  memory: 25, // تخمین heap بدون --expose-gc
});

/**
 * سقفِ «متریک گیت‌شده»: متریکی که در زمان ثبت، درصد بازتولیدش از این عدد
 * بیشتر بوده **اطلاعاتی** علامت می‌خورد (⚠️) و در تصمیم pass/fail شمرده نمی‌شود.
 * علتِ واقعی: عملیات زیر ~۱۰ns (مثل `signal.get()`) در V8 بین batchها بین
 * ۵ns و ۱۵ns می‌لرزد (اندازه‌گیری‌شده: پراکندگی تا ۷۰٪ در یک اجرا). عدد ثبت‌شده
 * همچنان «بهترین مشاهده» است، ولی ادعای بازتولید برایش مطرح نمی‌شود.
 */
export const GATE_LIMIT_PCT = Object.freeze({
  reactive: 15,
  dom: 15,
  memory: 25,
  ssr: 15,
});

/**
 * گروه‌هایی که `--only` واقعاً لازم دارد — تا مسیر «بازتولید یک عدد» ارزان باشد.
 * اگر شناسه‌ای به گروه شناخته‌شده نگردد، `null` یعنی همهٔ گروه‌ها اجرا شوند.
 */
export function groupsForOnly(only) {
  const wanted = [...new Set((only ?? []).map((id) => id.split('.')[0]))];
  const known = wanted.length > 0 && wanted.every((group) => SUITE_GROUPS.includes(group));
  return known ? wanted : null;
}

/**
 * جهتِ «بهتر» برای هر واحد — نویز همیشه فقط زمان اضافه می‌کند (کندتر/سنگین‌تر)،
 * پس بهترین مشاهدهٔ چند پاس، پایدارترین برآورد است: برای زمان/حافظه کمینه و
 * برای نرخ‌ها بیشینه. (پیش‌تر برای همه کمینه گرفته می‌شد و یک پاسِ کند، عددِ
 * نرخ را تا نصف پایین می‌کشید — اندازه‌گیری‌شده: ceiling ۱۴۲M ⇒ ۷۸M.)
 */
export const HIGHER_IS_BETTER = Object.freeze(['ops/sec', 'pages/sec', 'runs']);

/** آیا مقدار بزرگ‌تر بهتر است؟ */
export function isHigherBetter(unit) {
  return HIGHER_IS_BETTER.includes(unit);
}

/** یک متریک در ثبت بعدی «گیت‌شده» است یا فقط اطلاعاتی؟ */
export function isGated(metric, reproPct) {
  const limit = GATE_LIMIT_PCT[metric.group] ?? 15;
  return !(Number.isFinite(reproPct) && reproPct > limit);
}

/** اندازه‌گیری‌های `--quick` (برای تست‌ها): همان مسیر، بسیار کوچک‌تر. */
export const QUICK_OPTIONS = Object.freeze({
  durationMs: 3,
  batches: 2,
  warmupMs: 10,
  domRuns: 1,
  domWarmupRuns: 0,
  ssrPages: 10,
  memorySignals: 5_000,
});

/** کامیت جاری — برای «هر عدد به یک کامیت گره خورده است». */
export function currentCommit() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    return process.env.GITHUB_SHA ?? 'unknown';
  }
}

/**
 * آستانهٔ هر متریک: کفِ گروه (۵٪ برای میکرو/SSR)، و اگر متریک در ثبت پراکندگی
 * بیشتری داشت، ۱٫۵ برابرِ همان پراکندگی — با سقفِ ۳× کف. حاشیهٔ ۱٫۵× عمدی است تا
 * یک متریک گیت‌شده با نوسان کوچک، بی‌دلیل قرمز نشود.
 */
export function toleranceFor(metric, reproPct) {
  const floor = GROUP_TOLERANCE_PCT[metric.group] ?? 5;
  const cap = floor * 3;
  const observed = Number.isFinite(reproPct) ? Math.ceil(reproPct * 1.5) : floor;
  return Math.min(cap, Math.max(floor, observed));
}

/** مقایسهٔ یک مقدار با baseline (جهت‌دار: برای ms/bytes کمتر بهتر است). */
export function compareMetric(metric, baselineValue, tolerancePct) {
  const lowerIsBetter = metric.unit === 'ms' || metric.unit === 'bytes';
  const deltaPct = relativeDeltaPct(metric.value, baselineValue);
  if (deltaPct === null) return { deltaPct: null, status: 'n/a' };
  const worse = lowerIsBetter ? deltaPct > 0 : deltaPct < 0;
  const status = Math.abs(deltaPct) <= tolerancePct ? 'ok' : worse ? 'regression' : 'improved';
  return { deltaPct, status };
}

/**
 * تجزیهٔ پرچم‌ها — صادرشده تا تست بتواند قرارداد CLI (از جمله `--` بی‌اثر و
 * پرچم ناشناخته) را ارزان بررسی کند.
 */
export function parseArgs(argv) {
  const flags = {
    json: false,
    record: false,
    quick: false,
    list: false,
    passes: 3,
    only: null,
    groups: null,
    out: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') continue; // جداکنندهٔ `npm run bench -- --flag` را نادیده بگیر
    if (arg === '--json') flags.json = true;
    else if (arg === '--record') flags.record = true;
    else if (arg === '--quick') flags.quick = true;
    else if (arg === '--list') flags.list = true;
    else if (arg === '--passes') flags.passes = Math.max(1, Number(argv[++i]) || 1);
    else if (arg === '--only') flags.only = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (arg === '--groups') flags.groups = (argv[++i] ?? '').split(',').filter(Boolean);
    else if (arg === '--out')
      flags.out = argv[++i] ?? null; // حالت فرزند: یک پاس، JSON در فایل
    else if (arg === '--help' || arg === '-h') flags.help = true;
    else throw new Error(`bench: پرچم ناشناخته «${arg}»`);
  }
  return flags;
}

/**
 * یک پاس اندازه‌گیری در **فرایند فرزند** (برای ثبت چند‌پاسی).
 * چرا؟ tier/JIT و فشار heap در یک فرایند با هر پاس تغییر می‌کند و نرخ عملیات
 * زیر ۱۰ns بین پاس‌ها تا ۲ برابر جابه‌جا می‌شد؛ اندازه‌گیری هر پاس در فرایند
 * تازه، هم با `npm run bench` (که یک پاس در فرایند تازه است) هم‌جنس می‌شود.
 */
function runIsolatedPass({ only = null, groups = null, quick = false } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'zenith-bench-'));
  const out = join(dir, 'pass.json');
  const args = [fileURLToPath(import.meta.url), '--out', out];
  if (quick) args.push('--quick');
  if (groups) args.push('--groups', groups.join(','));
  if (only) args.push('--only', only.join(','));
  try {
    execFileSync(process.execPath, args, { cwd: ROOT, stdio: 'ignore', timeout: 300_000 });
    return JSON.parse(readFileSync(out, 'utf8'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** اجرای یک یا چند پاس و ادغام نتایج (کمینهٔ هر متریک برنده است). */
export async function runPasses({ passes = 1, options = {}, only = null, quick = false } = {}) {
  const merged = new Map();
  let last = null;
  for (let pass = 0; pass < passes; pass++) {
    // چند‌پاسی ⇒ هر پاس در فرایند تازه (مقایسهٔ هم‌جنس با `npm run bench`).
    const report = passes > 1 ? runIsolatedPass({ only, quick }) : await runBenchmarkSuite(options);
    last = report;
    for (const metric of report.metrics) {
      if (only && !only.includes(metric.id)) continue;
      const prev = merged.get(metric.id);
      if (!prev) {
        merged.set(metric.id, { ...metric, values: [metric.value] });
        continue;
      }
      prev.values.push(metric.value);
      const better = isHigherBetter(metric.unit)
        ? metric.value > prev.value
        : metric.value < prev.value;
      if (better) merged.set(metric.id, { ...metric, values: prev.values });
    }
  }
  const metrics = [...merged.values()].map((metric) => {
    const values = metric.values;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const reproPct = min > 0 ? ((max - min) / min) * 100 : 0;
    const rest = { ...metric };
    delete rest.values;
    return { ...rest, reproPct: Number(reproPct.toFixed(2)), passes: values.length };
  });
  return { report: last, metrics };
}

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return null;
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function fmt(value) {
  if (value === null || value === undefined) return '—';
  if (Math.abs(value) >= 1000) return Math.round(value).toLocaleString('en-US');
  return String(value);
}

function printReport({ metrics, environment, versions, baseline, comparisons }) {
  console.log('\n=== Zenith Benchmark Suite (#86) ===');
  console.log(
    `محیط: Node ${environment.node} | ${environment.platform} | ${environment.cpuModel} (${environment.cpuCores} cores, ${environment.totalMemGb} GB)`,
  );
  console.log(`موتور DOM: ${environment.domEngine} | امضای محیط: ${environment.signature}`);
  console.log(
    `رقبا: ${Object.entries(versions)
      .map(([k, v]) => `${k}@${v ?? 'n/a'}`)
      .join(', ')}`,
  );
  if (baseline) {
    const comparable = sameEnvironment(environment, baseline.environment);
    console.log(
      `baseline: کامیت ${String(baseline.commit).slice(0, 8)} (${baseline.recordedAt}) — ${
        comparable ? 'همان محیط ✅' : 'محیط متفاوت ⚠️ (گیت بازتولیدپذیری غیرفعال)'
      }`,
    );
  } else {
    console.log('baseline: ثبت‌نشده — برای ساختش: npm run bench:record');
  }

  let group = null;
  for (const metric of metrics) {
    if (metric.group !== group) {
      group = metric.group;
      console.log(`\n── ${group} ──`);
    }
    const cmp = comparisons?.find((c) => c.id === metric.id);
    const delta =
      cmp && cmp.deltaPct !== null
        ? `Δ ${cmp.deltaPct > 0 ? '+' : ''}${cmp.deltaPct}% (آستانه ${cmp.tolerancePct}%) ${
            !cmp.gated
              ? '⚠️ اطلاعاتی'
              : cmp.status === 'ok'
                ? '✅'
                : cmp.status === 'regression'
                  ? '❌'
                  : '⭐'
          }`
        : 'Δ —';
    console.log(
      `  ${metric.id.padEnd(48)} ${fmt(metric.value).padStart(12)} ${metric.unit.padEnd(10)} ${delta}`,
    );
  }
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help) {
    console.log(
      'usage: npm run bench [-- --json|--record|--quick|--only <id>|--groups <list>|--passes <n>|--list]',
    );
    return 0;
  }
  if (flags.list) {
    // فهرست باید **کامل** باشد (شناسهٔ هر متریک، از هر گروه)؛ سریع‌ترین
    // پیکربندی‌ای که هنوز همهٔ گروه‌ها را می‌سازد.
    const { report } = await runPasses({
      passes: 1,
      options: {
        ...QUICK_OPTIONS,
        durationMs: 2,
        batches: 1,
        warmupMs: 2,
        domRuns: 1,
        domWarmupRuns: 0,
        ssrPages: 1,
        memorySignals: 1_000,
      },
    });
    for (const metric of report.metrics) console.log(metric.id);
    console.log(`# ${report.metrics.length} متریک — بازتولید یکی: npm run bench -- --only <id>`);
    return 0;
  }

  const options = { ...(flags.quick ? QUICK_OPTIONS : {}) };
  if (flags.groups) options.groups = flags.groups;
  // `--only` یعنی «فقط همین عدد»؛ پس گروه‌های دیگر اصلاً اندازه‌گیری نمی‌شوند
  // (پیش‌تر هم محاسبه می‌شدند و بعد فیلتر — برای مسیر بازتولید یک عدد گران بود).
  if (flags.only && !options.groups) {
    const groups = groupsForOnly(flags.only);
    if (groups) options.groups = groups;
  }
  const passes = flags.record ? flags.passes : 1;
  const { report, metrics } = await runPasses({
    passes,
    options,
    only: flags.only,
    quick: flags.quick,
  });
  if (metrics.length === 0)
    throw new Error('bench: هیچ متریکی انتخاب نشد (پرچم --only را بررسی کنید)');

  const commit = currentCommit();
  const baseline = readBaseline();

  const comparisons = [];
  if (baseline?.metrics) {
    const comparable = sameEnvironment(report.environment, baseline.environment);
    for (const metric of metrics) {
      const base = baseline.metrics[metric.id];
      const tolerancePct = base?.tolerancePct ?? toleranceFor(metric, metric.reproPct);
      const { deltaPct, status } = base
        ? compareMetric(metric, base.value, tolerancePct)
        : { deltaPct: null, status: 'n/a' };
      // متریک «اطلاعاتی» (بازتولید بالاتر از سقفِ گروه) در gate شمرده نمی‌شود.
      const gated = base ? base.gate !== false : true;
      comparisons.push({
        id: metric.id,
        value: metric.value,
        baselineValue: base?.value ?? null,
        deltaPct,
        tolerancePct,
        status: comparable ? status : 'n/a',
        gated,
      });
    }
  }

  const out = {
    schema: 1,
    generatedAt: new Date().toISOString(),
    commit,
    environment: report.environment,
    versions: report.versions,
    builds: report.builds,
    metrics,
    baseline: baseline
      ? {
          commit: baseline.commit,
          recordedAt: baseline.recordedAt,
          environment: baseline.environment,
        }
      : null,
    comparisons,
  };

  // حالت فرزند: فقط یک فایل JSON می‌نویسیم (خروجی console دست‌نخورده می‌ماند).
  if (flags.out) {
    writeFileSync(flags.out, `${JSON.stringify(out)}\n`);
    return 0;
  }

  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(LATEST_PATH, `${JSON.stringify(out, null, 2)}\n`);

  if (flags.record) {
    const recorded = {
      schema: 1,
      suite: 'zenith-benchmarks',
      commit,
      recordedAt: new Date().toISOString().slice(0, 10),
      passes,
      environment: report.environment,
      versions: report.versions,
      builds: report.builds,
      metrics: Object.fromEntries(
        metrics.map((metric) => [
          metric.id,
          {
            id: metric.id,
            value: metric.value,
            unit: metric.unit,
            group: metric.group,
            label: metric.label,
            script: metric.script,
            impl: metric.impl,
            reproPct: metric.reproPct,
            gate: isGated(metric, metric.reproPct),
            tolerancePct: toleranceFor(metric, metric.reproPct),
            runs: metric.samples?.runs ?? null,
            spreadPct: metric.samples?.spreadPct ?? null,
            note: metric.note ?? null,
          },
        ]),
      ),
    };
    writeFileSync(BASELINE_PATH, `${JSON.stringify(recorded, null, 2)}\n`);
    console.log(
      `✅ baseline ثبت شد: ${Object.keys(recorded.metrics).length} متریک در ${passes} پاس → benchmarks/results/baseline.json`,
    );
    printReport({
      metrics,
      environment: report.environment,
      versions: report.versions,
      baseline: null,
    });
    return 0;
  }

  if (flags.json) {
    console.log(JSON.stringify(out, null, 2));
    return 0;
  }

  printReport({
    metrics,
    environment: report.environment,
    versions: report.versions,
    baseline,
    comparisons,
  });

  const gated = comparisons.filter((c) => c.gated);
  const regressions = gated.filter((c) => c.status === 'regression');
  const informational = comparisons.filter((c) => !c.gated);
  const comparable = baseline ? sameEnvironment(report.environment, baseline.environment) : false;
  if (baseline && !comparable) {
    console.log(
      '\n⚠️ محیط با baseline یکی نیست — گیت بازتولیدپذیری اعمال نشد. برای ثبت مجدد: npm run bench:record',
    );
    return 0;
  }
  if (regressions.length > 0) {
    console.error(
      `\n❌ ${regressions.length} متریک از آستانهٔ بازتولیدپذیری خودش بدتر شد: ${regressions
        .map((r) => `${r.id} (${r.deltaPct}% > ${r.tolerancePct}%)`)
        .join(', ')}`,
    );
    return 1;
  }
  if (baseline) {
    const info = `${informational.length} متریک اطلاعاتی (پراکندگی بالاتر از سقف گروه) در گیت شمرده نشدند.`;
    console.log(
      gated.length === 0
        ? `\nℹ️ در این اجرا متریک گیت‌شده‌ای نبود — ${info}`
        : `\n✅ همهٔ ${gated.length} متریک گیت‌شده در آستانهٔ بازتولیدپذیری خودشان نسبت به baseline (${String(baseline.commit).slice(0, 8)}) هستند` +
            (informational.length > 0 ? ` — ${info}` : '.'),
    );
  }
  return 0;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  main()
    .then((code) => process.exit(code ?? 0))
    .catch((err) => {
      console.error(`❌ bench: ${err?.message ?? err}`);
      process.exit(1);
    });
}
