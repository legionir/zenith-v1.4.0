// #86 — تست‌های سوئیت بنچمارک: اجرا، گیت بازتولیدپذیری، تولید سند و اتصال CI.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DOM_SUITE_OPERATIONS, runDomListSuite } from '../../benchmarks/dom-suite.js';
import {
  COMPETITOR_PACKAGES,
  competitorVersions,
  loadCompetitors,
} from '../../benchmarks/competitors.js';
import {
  collectEnvironment,
  environmentSignature,
  installedVersion,
  sameEnvironment,
} from '../../benchmarks/lib/env.mjs';
import {
  measureOpsPerSec,
  median,
  relativeDeltaPct,
  stats,
} from '../../benchmarks/lib/measure.mjs';
import { SUITE_GROUPS, runBenchmarkSuite } from '../../benchmarks/suite.mjs';
import {
  GATE_LIMIT_PCT,
  HIGHER_IS_BETTER,
  QUICK_OPTIONS,
  compareMetric,
  groupsForOnly,
  isGated,
  isHigherBetter,
  parseArgs,
  runPasses,
  toleranceFor,
} from '../bench.mjs';
import { generateBenchmarksDoc } from '../generate-benchmarks-doc.mjs';

const ROOT = process.cwd();
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');
const baseline = JSON.parse(read('benchmarks/results/baseline.json'));

describe('#86 — اندازه‌گیری و آمار', () => {
  it('computes medians and spreads without mutating the input', () => {
    const values = [5, 1, 3];
    expect(median(values)).toBe(3);
    expect(median([])).toBe(0);
    expect(values).toEqual([5, 1, 3]);
    const s = stats([10, 12, 20]);
    expect(s.median).toBe(12);
    expect(s.min).toBe(10);
    expect(s.max).toBe(20);
    expect(s.spreadPct).toBeCloseTo(((20 - 10) / 12) * 100, 1); // تا ۲ رقم اعشار گرد می‌شود
    expect(stats([]).median).toBe(0);
  });

  it('measures ops/sec as the median of independent time-based batches', () => {
    let calls = 0;
    const res = measureOpsPerSec(
      () => {
        calls += 1;
        return 1;
      },
      { durationMs: 5, batches: 3, warmupMs: 5, chunk: 64 },
    );
    // زمان‌محور است، نه تعداد‌محور: تعداد فراخوانی‌ها نتیجهٔ ساعت است.
    expect(calls).toBeGreaterThan(0);
    expect(res.iterations).toBeGreaterThan(0);
    expect(res.batches).toBe(3);
    expect(res.durationMs).toBe(5);
    expect(res.opsPerSec).toBeGreaterThan(0);
    expect(res.minOpsPerSec).toBeLessThanOrEqual(res.opsPerSec);
    expect(res.maxOpsPerSec).toBeGreaterThanOrEqual(res.opsPerSec);
    // نتیجه مصرف می‌شود، وگرنه V8 حلقه را حذف می‌کند (DCE).
    expect(res.sinkConsumed).toBe(true);
  });

  it('keeps the loop-carried sink so V8 cannot hoist a constant call out', () => {
    // همان تابعِ ثابت: اگر فراخوانی از حلقه بیرون کشیده شود، نرخ بی‌معنا می‌شود.
    const res = measureOpsPerSec((i) => i + 1, { durationMs: 5, batches: 2, warmupMs: 5 });
    expect(res.iterations).toBeGreaterThan(100);
    expect(res.opsPerSec).toBeLessThan(5_000_000_000);
  });

  it('computes signed relative deltas', () => {
    expect(relativeDeltaPct(110, 100)).toBe(10);
    expect(relativeDeltaPct(90, 100)).toBe(-10);
    expect(relativeDeltaPct(1, 0)).toBeNull();
    expect(relativeDeltaPct(Number.NaN, 10)).toBeNull();
  });
});

describe('#86 — محیط و مقایسه', () => {
  it('records hardware, runtime and the DOM engine', () => {
    const env = collectEnvironment();
    expect(env.node).toMatch(/^v\d+/);
    expect(env.cpuCores).toBeGreaterThanOrEqual(1);
    expect(env.totalMemGb).toBeGreaterThan(0);
    expect(env.domEngine).toMatch(/^jsdom@\d+/);
    expect(env.signature).toContain(env.domEngine);
    expect(sameEnvironment(env, { ...env })).toBe(true);
    expect(sameEnvironment(env, { ...env, domEngine: 'none' })).toBe(false);
    expect(sameEnvironment(env, { ...env, node: 'v0.0.0' })).toBe(false);
    expect(sameEnvironment(env, null)).toBe(false);
    // امضای بازمحاسبه‌شده با امضای ذخیره‌شده یکسان است.
    expect(environmentSignature(env)).toBe(env.signature);
  });

  it('resolves the real versions of the comparison libraries', () => {
    const versions = competitorVersions();
    for (const [key, pkg] of Object.entries(COMPETITOR_PACKAGES)) {
      expect(installedVersion(pkg), pkg).toBeTruthy();
      expect(versions[key]).toBe(installedVersion(pkg));
    }
    expect(versions.zenith).toBe(installedVersion('@zenith/state'));
  });

  it('loads working adapters from the real Solid/Vue/Preact packages', async () => {
    const { solid, vue, preact } = await loadCompetitors();
    for (const adapter of [solid, vue, preact]) {
      const read = adapter.createRead();
      expect(read()).toBe(42);
      const write = adapter.createWrite();
      write(7);
      const diamond = adapter.createDiamond();
      expect(diamond(3)).toBe(3 * 2 + (3 + 10));
      const counter = adapter.createEffectCounter();
      counter.set(1);
      counter.set(2);
      counter.flush();
      expect(counter.runs()).toBeGreaterThan(0);
    }
  });
});

describe('#86 — سوئیت reactive', () => {
  it('benchmarks Zenith and the real competitors in one run', async () => {
    const report = await runBenchmarkSuite({
      groups: ['reactive'],
      iterations: 5_000,
      batches: 2,
      warmup: 500,
    });
    const byId = new Map(report.metrics.map((m) => [m.id, m]));
    for (const impl of ['zenith', ...Object.keys(COMPETITOR_PACKAGES)]) {
      for (const kind of ['signal-read', 'signal-write', 'computed-diamond']) {
        const metric = byId.get(`reactive.${impl}.${kind}`);
        expect(metric, `${impl}.${kind}`).toBeTruthy();
        expect(metric.value).toBeGreaterThan(0);
        expect(metric.unit).toBe('ops/sec');
        expect(metric.script).toBe('benchmarks/suite.mjs');
      }
    }
    // batching: Zenith یک بار effect را اجرا می‌کند، رقبا هر نوشتن را.
    expect(byId.get('reactive.zenith.effect-runs-per-10k-writes').value).toBe(1);
    for (const impl of ['solid', 'vue', 'preact']) {
      expect(byId.get(`reactive.${impl}.effect-runs-per-10k-writes`).value, impl).toBeGreaterThan(
        1_000,
      );
    }
    expect(report.versions.solid).toBe(installedVersion('solid-js'));
  });
});

describe('#86 — عملیات لیست jsdom', () => {
  it('covers the js-framework-benchmark list and agrees with its own timing table', () => {
    const ids = DOM_SUITE_OPERATIONS.map((op) => op.id);
    expect(ids).toEqual([
      'create-1k',
      'replace-all-1k',
      'partial-update-1k',
      'select-1k',
      'swap-rows-1k',
      'remove-row-1k',
      'create-10k',
      'append-1k-to-10k',
      'clear-1k',
    ]);
    // جدول ماژول و جدول داخلی تابع (که به مرورگر سریال می‌شود) نباید واگرا شوند.
    const serialized = runDomListSuite.toString().replace(/(\d)_(\d)/g, '$1$2');
    for (const op of DOM_SUITE_OPERATIONS) {
      expect(serialized, op.id).toContain(`id: '${op.id}'`);
      expect(serialized, `${op.id} rows`).toContain(`rows: ${op.rows}`);
      expect(serialized, `${op.id} repeat`).toContain(`repeat: ${op.repeat}`);
    }
  });

  it('is serializable for the real-browser runner', () => {
    const source = runDomListSuite.toString();
    expect(source).not.toMatch(/\brequire\s*\(/);
    expect(source).not.toMatch(/^\s*import\s/m);
    // همان کاری که scripts/bench-browser.mjs با page.evaluate می‌کند:
    const rebuilt = Function(`return (${source})`)();
    expect(typeof rebuilt).toBe('function');
  });

  it('requires a document and a tbody, and only runs requested operations', async () => {
    expect(() => runDomListSuite(undefined)).toThrow(/Document/);
    const { JSDOM } = await import('jsdom');
    const empty = new JSDOM('<!doctype html><html><body></body></html>');
    expect(() => runDomListSuite(empty.window.document, { only: ['create-1k'] })).toThrow(/tbody/);
    empty.window.close();

    const dom = new JSDOM(
      '<!doctype html><html><body><table><tbody id="tbody"></tbody></table></body></html>',
    );
    const rows = runDomListSuite(dom.window.document, {
      only: ['create-1k'],
      runs: 1,
      warmupRuns: 0,
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('create-1k');
    expect(rows[0].ms).toBeGreaterThan(0);
    expect(rows[0].repeat).toBe(1);
    expect(dom.window.document.getElementById('tbody').children.length).toBe(1_000);
    dom.window.close();
  });
});

describe('#86 — گیت بازتولیدپذیری', () => {
  it('derives per-metric tolerances from the group floor and observed spread', () => {
    expect(toleranceFor({ group: 'reactive' }, 1)).toBe(5);
    expect(toleranceFor({ group: 'reactive' }, 12)).toBe(15); // ۱٫۵× پراکندگی، سقف‌دار
    expect(toleranceFor({ group: 'reactive' }, 3)).toBe(5); // کفِ گروه
    expect(toleranceFor({ group: 'dom' }, 3)).toBe(15); // کفِ گروه DOM
    expect(toleranceFor({ group: 'dom' }, 40)).toBe(45); // سقفِ ۳× کف
    expect(toleranceFor({ group: 'memory' }, NaN)).toBe(25);
    expect(toleranceFor({ group: 'unknown-group' }, 0)).toBe(5);
  });

  it('only gates metrics whose observed spread stayed inside the group limit', () => {
    expect(GATE_LIMIT_PCT.reactive).toBe(15);
    expect(GATE_LIMIT_PCT.dom).toBe(15);
    expect(GATE_LIMIT_PCT.memory).toBe(25);
    expect(isGated({ group: 'reactive' }, 4)).toBe(true);
    expect(isGated({ group: 'reactive' }, 15)).toBe(true);
    expect(isGated({ group: 'reactive' }, 15.1)).toBe(false);
    expect(isGated({ group: 'memory' }, 24)).toBe(true);
    expect(isGated({ group: 'unknown' }, 16)).toBe(false);
    expect(isGated({ group: 'unknown' }, NaN)).toBe(true);
  });

  it('is direction aware: ms/bytes lower is better, rates higher is better', () => {
    const ops = { id: 'x', unit: 'ops/sec' };
    expect(compareMetric({ ...ops, value: 96 }, 100, 5).status).toBe('ok');
    expect(compareMetric({ ...ops, value: 90 }, 100, 5).status).toBe('regression');
    expect(compareMetric({ ...ops, value: 120 }, 100, 5).status).toBe('improved');
    const ms = { id: 'y', unit: 'ms' };
    expect(compareMetric({ ...ms, value: 104 }, 100, 5).status).toBe('ok');
    expect(compareMetric({ ...ms, value: 130 }, 100, 5).status).toBe('regression');
    expect(compareMetric({ ...ms, value: 80 }, 100, 5).status).toBe('improved');
    expect(compareMetric({ ...ms, value: 10 }, 0, 5).status).toBe('n/a');
  });

  it('measures only the groups `--only` needs, so reproducing one number stays cheap', () => {
    expect(groupsForOnly(['reactive.zenith.signal-read'])).toEqual(['reactive']);
    expect(groupsForOnly(['dom.create-1k', 'dom.clear-1k'])).toEqual(['dom']);
    expect(groupsForOnly(['reactive.zenith.signal-read', 'ssr.pages-per-sec'])).toEqual([
      'reactive',
      'ssr',
    ]);
    expect(groupsForOnly(['whatever.id'])).toBeNull(); // ناشناخته ⇒ همهٔ گروه‌ها
    expect(groupsForOnly([])).toBeNull();
    expect(groupsForOnly(null)).toBeNull();
    expect(SUITE_GROUPS).toEqual(['reactive', 'dom', 'memory', 'ssr']);
  });

  it('cancels noise in the right direction: min for times, max for rates', () => {
    expect(HIGHER_IS_BETTER).toEqual(['ops/sec', 'pages/sec', 'runs']);
    expect(isHigherBetter('ops/sec')).toBe(true);
    expect(isHigherBetter('pages/sec')).toBe(true);
    expect(isHigherBetter('runs')).toBe(true);
    expect(isHigherBetter('ms')).toBe(false);
    expect(isHigherBetter('bytes')).toBe(false);
  });

  it('merges passes by minimum and records the observed reproducibility', async () => {
    const { metrics } = await runPasses({
      passes: 2,
      options: { ...QUICK_OPTIONS, groups: ['reactive'] },
      only: ['reactive.zenith.signal-read'],
    });
    expect(metrics).toHaveLength(1);
    const [metric] = metrics;
    expect(metric.id).toBe('reactive.zenith.signal-read');
    expect(metric.passes).toBe(2);
    expect(metric.value).toBeGreaterThan(0);
    expect(metric.reproPct).toBeGreaterThanOrEqual(0);
    expect(metric.reproPct).toBeLessThan(100);
  }, 30_000);
});

describe('#86 — baseline و سند تولیدشده', () => {
  it('records every metric with environment, commit, script and tolerance', () => {
    expect(baseline.commit).toMatch(/^[0-9a-f]{7,40}$/);
    expect(baseline.environment.signature).toContain('jsdom@');
    expect(Object.keys(baseline.metrics).length).toBeGreaterThanOrEqual(20);
    for (const [id, metric] of Object.entries(baseline.metrics)) {
      expect(metric.value, id).toBeGreaterThan(0);
      expect(metric.unit, id).toBeTruthy();
      expect(metric.script, id).toMatch(/^benchmarks\//);
      expect(metric.tolerancePct, id).toBeGreaterThanOrEqual(5);
      expect(metric.reproPct, id).toBeGreaterThanOrEqual(0);
    }
    expect(baseline.metrics['dom.create-10k'].value).toBeGreaterThan(0);
    expect(baseline.metrics['ssr.pages-per-sec'].value).toBeGreaterThan(0);
  });

  it('keeps docs/BENCHMARKS.md generated from the baseline — drift fails CI', () => {
    const { stale, doc } = generateBenchmarksDoc({ checkOnly: true });
    expect(stale).toBe(false);
    expect(doc).toContain('npm run bench');
    expect(doc).toContain(`\`${baseline.commit}\``);
    expect(doc).toContain('scripts/bench.mjs');
    expect(doc).toContain('generate-benchmarks-doc.mjs');
    for (const id of Object.keys(baseline.metrics)) {
      expect(doc, id).toContain(`\`${id}\``);
      expect(doc, `${id} repro command`).toContain(`npm run bench -- --only ${id}`);
    }
    // هر عدد به اسکریپت + کامیت لینک خورده است.
    expect(doc).toContain(
      `https://github.com/legionir/zenith-v1.4.0/blob/${baseline.commit}/benchmarks/suite.mjs`,
    );
    expect(doc).toContain('محدودیت‌ها');
  });

  it('marks spread-out metrics as informational and counts them honestly', () => {
    const { doc } = generateBenchmarksDoc({ checkOnly: true });
    const metrics = Object.values(baseline.metrics);
    const info = metrics.filter((m) => m.gate === false);
    const gated = metrics.filter((m) => m.gate !== false);
    expect(gated.length + info.length).toBe(metrics.length);
    expect(gated.length).toBeGreaterThan(0);
    expect(doc).toContain(`**${gated.length} متریک گیت‌شده**`);
    expect(doc).toContain(`**${info.length} متریک اطلاعاتی**`);
    const within5 = gated.filter((m) => m.reproPct <= 5).length;
    expect(doc).toContain(`**${within5} عدد با بازتولید ≤۵٪**`);
    // هر متریک اطلاعاتی در سند ⚠️ خورده و هر گیت‌شده ✅.
    for (const metric of [...info, ...gated]) {
      const row = doc.split('\n').find((line) => line.startsWith(`| \`${metric.id}\` |`));
      expect(row, metric.id).toBeTruthy();
      expect(row, metric.id).toContain(metric.gate === false ? '⚠️ اطلاعاتی' : '✅ گیت‌شده');
    }
  });

  it('prints every metric exactly once per table row and derives DOM repeats from the suite', () => {
    const { doc } = generateBenchmarksDoc({ checkOnly: true });
    for (const id of Object.keys(baseline.metrics)) {
      const rows = doc.split('\n').filter((line) => line.startsWith(`| \`${id}\` |`)).length;
      expect(rows, id).toBe(1); // ردیف تکراری (kinds) یا ردیف نبودن هر دو باگ است
    }
    // ستون «تکرار/نمونه» از جدول خودِ سوئیت می‌آید، نه از JSON.
    for (const op of DOM_SUITE_OPERATIONS) {
      const row = doc.split('\n').find((line) => line.startsWith(`| \`dom.${op.id}\` |`));
      expect(row, op.id).toContain(`| x${op.repeat} |`);
    }
  });

  it('keeps every generated table rectangular (header width == row width)', () => {
    const { doc } = generateBenchmarksDoc({ checkOnly: true });
    let width = null;
    const bad = [];
    for (const line of doc.split('\n')) {
      if (!line.startsWith('|')) {
        width = null; // خارج از جدول، انتظار ستون نداریم
        continue;
      }
      if (/^\|[-: |]+\|$/.test(line)) {
        width = line.split('|').length - 2; // ردیف جداکننده، عرض جدول را تعیین می‌کند
        continue;
      }
      const cells = line.split('|').length - 2;
      if (width !== null && cells !== width) bad.push(`${cells}≠${width}: ${line.slice(0, 60)}`);
    }
    expect(bad).toEqual([]);
  });

  it('documents the advisory default and the opt-in strict gate', () => {
    const { doc } = generateBenchmarksDoc({ checkOnly: true });
    expect(doc).toContain('--strict');
    expect(doc).toContain('حالت مشورتی');
    const source = read('scripts/bench.mjs');
    // انحراف در حالت پیش‌فرض کد خروج را تغییر نمی‌دهد؛ فقط `--strict` سخت است.
    expect(source).toMatch(/if \(flags\.strict\)/);
    expect(source).toContain('حالت مشورتی — کد خروج ۰');
  });

  it('documents the reproducibility contract honestly', () => {
    const doc = read('docs/BENCHMARKS.md');
    expect(doc).toContain('baseline.json');
    expect(doc).toContain('bench:record');
    expect(doc).toMatch(/jsdom/);
    expect(doc).toContain('bench:browser');
    expect(doc).toContain('۵٪');
  });
});

describe('#86 — اتصال اسکریپت‌ها و CI', () => {
  it('wires every benchmark command in package.json', () => {
    const pkg = JSON.parse(read('package.json'));
    expect(pkg.scripts.bench).toBe('node scripts/bench.mjs');
    expect(pkg.scripts['bench:record']).toBe('node scripts/bench.mjs --record --passes 3');
    expect(pkg.scripts['bench:doc']).toBe('node scripts/generate-benchmarks-doc.mjs');
    expect(pkg.scripts['check:bench-doc']).toBe('node scripts/generate-benchmarks-doc.mjs --check');
    expect(pkg.scripts['bench:browser']).toBe('node scripts/bench-browser.mjs');
    expect(pkg.scripts['bench:ci']).toBe('node scripts/benchmark-ci.mjs');
  });

  it('keeps the #84 CI budgets untouched', () => {
    const budgets = JSON.parse(read('benchmarks/budgets.json'));
    expect(budgets.signalsCreateSet).toBe(200_000);
    expect(budgets.ssrRender).toBe(2_000);
    const workflow = read('.github/workflows/main.yml');
    expect(workflow).toContain('npm run bench:ci');
    expect(workflow).toContain('npm run check:bench-doc');
  });

  it('parses the CLI contract the docs promise (bare --, --groups, unknown flag)', () => {
    // `npm run bench -- --json` و `node scripts/bench.mjs -- --json` هر دو کار می‌کنند.
    expect(parseArgs(['--', '--json']).json).toBe(true);
    expect(parseArgs(['--groups', 'reactive,dom']).groups).toEqual(['reactive', 'dom']);
    expect(parseArgs(['--only', 'dom.clear-1k']).only).toEqual(['dom.clear-1k']);
    expect(parseArgs(['--strict']).strict).toBe(true);
    expect(parseArgs([]).strict).toBe(false);
    expect(parseArgs(['--passes', '0']).passes).toBe(1); // حداقل یک پاس
    expect(parseArgs(['--passes', '3']).passes).toBe(3);
    expect(parseArgs([]).only).toBeNull();
    expect(parseArgs([]).groups).toBeNull();
    expect(() => parseArgs(['--bogus'])).toThrow(/پرچم ناشناخته/);
  });

  it('keeps exactly one runner: benchmarks/run-all.js only delegates', () => {
    const source = read('benchmarks/run-all.js');
    expect(source).toContain('spawnSync');
    expect(source).toContain("'scripts', 'bench.mjs'");
    expect(source).toContain('منسوخ');
    expect(source).not.toContain('╔'); // دیگر خودش گزارش چاپ‌دار قدیمی را اجرا نمی‌کند
    const pkg = JSON.parse(read('benchmarks/package.json'));
    expect(pkg.scripts.bench).toBe('node run-all.js');
    expect(pkg.private).toBe(true);
    // README یک دستور واحد را تبلیغ می‌کند و فایل‌های قدیمی را صادقانه علامت می‌زند.
    const readme = read('benchmarks/README.md');
    for (const command of ['npm run bench', 'bench:record', 'bench:browser', 'check:bench-doc']) {
      expect(readme, command).toContain(command);
    }
    expect(readme).toContain('docs/BENCHMARKS.md');
    expect(readme).toContain('تاریخی');
    expect(readme).toContain('baseline.json');
  });

  it('documented browser runner is optional and self-explaining when absent', () => {
    const source = read('scripts/bench-browser.mjs');
    expect(source).toContain('npx playwright install');
    expect(source).toContain('page.evaluate');
    expect(source).toContain('runDomListSuite.toString()');
    expect(source).toContain('benchmarks/results/browser.json');
  });
});
