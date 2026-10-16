#!/usr/bin/env node
/**
 * #86 — تولید `docs/BENCHMARKS.md` از `benchmarks/results/baseline.json`.
 *
 * چرا تولیدشده؟ چون شرطِ پذیرش #86 این است که «هر عدد به یک اسکریپت و یک
 * کامیت مشخص گره خورده باشد». سند دست‌نویس دقیقاً همان‌جایی است که اعداد از
 * واقعیت جدا می‌شوند؛ اینجا هر ردیف از سنجش واقعی ساخته می‌شود و به
 * `blob/<sha>/benchmarks/suite.mjs` + دستور `npm run bench -- --only <id>`
 * لینک می‌خورد. `npm run check:bench-doc` (در CI) هر drift را قرمز می‌کند.
 *
 * سیاست بازتولیدپذیری: در زمان ثبت، برای هر متریک «درصد بازتولید مشاهده‌شده»
 * روی چند پاس اندازه‌گیری می‌شود؛ متریکی که از سقفِ گروه (`GATE_LIMIT_PCT`)
 * بیرون بزند «اطلاعاتی» علامت می‌خورد و در gate شمرده نمی‌شود (نه پنهان
 * می‌شود، نه ادعای بی‌پایه می‌گیرد).
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOM_SUITE_OPERATIONS } from '../benchmarks/dom-suite.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE_PATH = join(ROOT, 'benchmarks', 'results', 'baseline.json');
const DOC_PATH = join(ROOT, 'docs', 'BENCHMARKS.md');
const REPO_URL = 'https://github.com/legionir/zenith-v1.4.0';

/** گروه‌ها به ترتیب نمایش، با عنوان و توضیح. */
const GROUPS = [
  {
    id: 'reactive',
    title: '۱. میکرو reactive — Zenith در برابر Solid/Vue/Preact (کتابخانه‌های واقعی)',
    intro:
      'همه در یک V8 واحد و با همان حلقهٔ اندازه‌گیری (`benchmarks/suite.mjs#runReactiveSuite`): ' +
      'هر batch تا ۲۰ms اجرا می‌شود (اندازه‌گیری **زمان‌محور**، نه تعداد ثابت — یک batch ثابتِ ۱۰۰k برای عملیات ۲۰۰M ops/sec فقط ۰٫۴ms است و ساعت/JIT نتیجه را تا ۵ برابر جابه‌جا می‌کند). ' +
      'عدد هر ردیف **میانهٔ ۵ batch** است و نتیجهٔ هر فراخوانی مصرف می‌شود تا V8 حلقه را حذف نکند (DCE).',
  },
  {
    id: 'dom',
    title: '۲. عملیات لیست js-framework-benchmark (jsdom)',
    intro:
      'همان ۹ عملیات استاندارد روی `<table><tbody>` واقعی، ولی موتور DOM این محیط **jsdom** است ' +
      '(مرورگر واقعی → `npm run bench:browser`). عملیات سبک K بار تکرار می‌شوند و عدد گزارش‌شده ' +
      '**زمان هر یک بار** است؛ عدد هر ردیف **کمینهٔ نمونه‌ها** است (نویز فقط زمان اضافه می‌کند).',
  },
  {
    id: 'memory',
    title: '۳. حافظه',
    intro: 'delta هیپ جاوااسکریپت به‌ازای هر signal — تقریبی (بدون `--expose-gc`).',
  },
  {
    id: 'ssr',
    title: '۴. SSR (Node)',
    intro: 'رندر یک صفحهٔ ۵۰ آیتمی با `renderToString` — میانهٔ ۳ اجرا پس از گرم‌کردن.',
  },
];

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

function fmtValue(value, unit) {
  if (!Number.isFinite(value)) return '—';
  if (unit === 'ms') return value >= 1000 ? `${(value / 1000).toFixed(2)}s` : `${value} ms`;
  if (unit === 'bytes') return `${Math.round(value)} B`;
  if (unit === 'runs' || unit === 'pages/sec') return Math.round(value).toLocaleString('en-US');
  return Math.round(value).toLocaleString('en-US');
}

/** لینک «اسکریپت + کامیت» برای هر متریک. */
function sourceLink(metric, commit) {
  const script = metric.script ?? 'benchmarks/suite.mjs';
  const sha = commit === 'unknown' ? 'main' : commit;
  return `[${script}@${sha.slice(0, 8)}](${REPO_URL}/blob/${sha}/${script})`;
}

function metricRow(metric, commit) {
  const repro = metric.reproPct === null ? '—' : `${metric.reproPct}%`;
  const stance = metric.gate === false ? '⚠️ اطلاعاتی' : '✅ گیت‌شده';
  return `| \`${metric.id}\` | ${fmtValue(metric.value, metric.unit)} | ${metric.runs ?? '—'} | ${repro} | ${metric.tolerancePct}% | ${stance} | ${sourceLink(metric, commit)} | \`npm run bench -- --only ${metric.id}\` |`;
}

export function buildBenchmarksDoc(baseline) {
  const { commit, recordedAt, environment, versions, metrics } = baseline;
  const builds = baseline.builds ?? {};
  // کلیدِ رکورد همان id است؛ id را هم تزریق می‌کنیم تا رکورد دست‌ساز هم کار کند.
  const byId = new Map(Object.entries(metrics).map(([id, metric]) => [id, { id, ...metric }]));
  const allMetrics = [...byId.values()];
  const KNOWN_KINDS = [
    'signal-read',
    'signal-write',
    'computed-diamond',
    'effect-runs-per-10k-writes',
  ];
  const kinds = KNOWN_KINDS.filter((kind) => allMetrics.some((m) => m.id.split('.')[2] === kind));
  const ceiling = metrics['reactive.harness.ceiling']?.value ?? null;
  const ceilingBound = (value) => ceiling !== null && value >= ceiling * 0.85;
  const impls = ['zenith', 'solid', 'vue', 'preact'];
  const labelOf = (kind) => byId.get(`reactive.zenith.${kind}`)?.label ?? kind;

  const lines = [];
  lines.push('# Zenith Framework — بنچمارک‌ها (#86)');
  lines.push('');
  lines.push(
    '> **یک دستور، همهٔ اعداد:** `npm run bench` — سوئیت را اجرا می‌کند، هر متریک را با همین سند',
    '> مقایسه می‌کند و اگر متریکی از آستانهٔ بازتولیدپذیری خودش بیرون بزند با کد خطای ۱ برمی‌گردد.',
    '>',
    '> - خودِ گیت: `scripts/bench.mjs` — اجرا، مقایسه با baseline، و `exit 1` در صورت انحراف',
    '> - ثبت مجدد baseline: `npm run bench:record` (هر پاس در فرایند جدا؛ کمینه برنده است)',
    '> - گیت drift سند در CI: `npm run check:bench-doc`',
    '> - اعداد DOM در مرورگر واقعی: `npm run bench:browser` (نیازمند `npx playwright install chromium`)',
  );
  lines.push('');
  lines.push(
    `> ⚠️ **این سند تولیدشده است** — ` +
      `[\`scripts/generate-benchmarks-doc.mjs\`](${REPO_URL}/blob/${commit}/scripts/generate-benchmarks-doc.mjs) ` +
      `از \`benchmarks/results/baseline.json\` (کامیت \`${commit.slice(0, 8)}\`، تاریخ ${recordedAt}).`,
  );
  lines.push('');
  lines.push('## محیط ثبت‌شده');
  lines.push('');
  lines.push('| مورد | مقدار |');
  lines.push('|---|---|');
  lines.push(`| کامیت | \`${commit}\` |`);
  lines.push(`| CPU | ${environment.cpuModel} (${environment.cpuCores} هسته) |`);
  lines.push(`| حافظه | ${environment.totalMemGb} GB |`);
  lines.push(`| سیستم | ${environment.osRelease} / ${environment.platform} |`);
  lines.push(`| Node | ${environment.node} (V8 ${environment.v8}) |`);
  lines.push(
    `| موتور DOM (گروه DOM/SSR) | ${environment.domEngine} — **مرورگر واقعی نیست**؛ ببینید «محدودیت‌ها» |`,
  );
  lines.push(
    `| کتابخانه‌های مقایسه | ${Object.entries(versions)
      .map(([key, version]) => `${key}@${version ?? 'n/a'}`)
      .join(' · ')} |`,
  );
  for (const [key, build] of Object.entries(builds)) {
    lines.push(`| بیلد ${key} | \`${build}\` |`);
  }
  lines.push('');
  lines.push(`**امضای محیط (مبنای مقایسهٔ baseline):** \`${environment.signature}\``);
  lines.push(
    'اگر سخت‌افزار/نسخهٔ Node/jsdom تغییر کند، `npm run bench` فقط هشدار می‌دهد و گیت را غیرفعال می‌کند (اعداد مطلق چاپ می‌شوند).',
  );
  lines.push('');

  // ۱) reactive — جدول مقایسهٔ impl × kind
  lines.push('## ' + GROUPS[0].title);
  lines.push('');
  lines.push(GROUPS[0].intro);
  lines.push('');
  lines.push(
    `| سنجه | ${impls.map((i) => byId.get(`reactive.${i}.signal-read`)?.impl ?? i).join(' | ')} | واحد |`,
  );
  lines.push(`|---|${impls.map(() => '---').join('|')}|---|`);
  for (const kind of kinds) {
    const cells = [];
    for (const impl of impls) {
      const metric = byId.get(`reactive.${impl}.${kind}`);
      if (!metric) cells.push('—');
      else if (ceilingBound(metric.value)) cells.push(`${fmtValue(metric.value, metric.unit)} ⛔`);
      else cells.push(fmtValue(metric.value, metric.unit));
    }
    const unit = byId.get(`reactive.zenith.${kind}`)?.unit ?? '';
    lines.push(`| ${labelOf(kind)} | ${cells.join(' | ')} | ${unit} |`);
  }
  if (ceiling !== null) {
    lines.push(
      `سقف اندازه‌گیری این محیط (یک عملیات بی‌هزینه در همان حلقه/closure): **${fmtValue(ceiling, 'ops/sec')} ops/sec** — ` +
        'هر عددی که به آن نزدیک باشد (≥۸۵٪، علامت ⛔) **کفِ واقعی** است، نه نرخ واقعی کتابخانه؛ در آن ناحیه هارنس گلوگاه است نه کتابخانه.',
    );
  }
  lines.push('');
  lines.push('جزئیات و لینک هر عدد:');
  lines.push('');
  // هدر هر جدول دقیقاً به تعداد ستون‌های metricRow — جدول واگرا، سندِ خراب است.
  lines.push(
    '| متریک | مقدار | نمونه | بازتولید مشاهده‌شده | آستانه | وضعیت | منبع (اسکریپت + کامیت) | بازتولید یک عدد |',
  );
  lines.push('|---|---|---|---|---|---|---|---|');
  for (const metric of reactiveMetrics(metrics)) lines.push(metricRow(metric, commit));
  lines.push('');

  // ۲) dom
  lines.push('## ' + GROUPS[1].title);
  lines.push('');
  lines.push(GROUPS[1].intro);
  lines.push('');
  lines.push(
    '| متریک | زمان هر بار | نمونه | تکرار/نمونه | بازتولید مشاهده‌شده | آستانه | وضعیت | منبع (اسکریپت + کامیت) | بازتولید یک عدد |',
  );
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const metric of groupMetrics(metrics, 'dom')) {
    const cells = metricRow(metric, commit).split('|');
    // درج ستون تکرار در جای مناسب
    // تکرار هر عملیات از جدول خودِ سوئیت می‌آید (نه JSON) — یک منبع حقیقت.
    const opId = metric.id.replace(/^dom\./, '');
    const repeat = DOM_SUITE_OPERATIONS.find((op) => op.id === opId)?.repeat ?? 1;
    const stance = metric.gate === false ? '⚠️ اطلاعاتی' : '✅ گیت‌شده';
    lines.push(
      `| \`${metric.id}\` | ${fmtValue(metric.value, metric.unit)} | ${metric.runs} | x${repeat} | ${metric.reproPct}% | ${metric.tolerancePct}% | ${stance} | ${sourceLink(metric, commit)} | \`npm run bench -- --only ${metric.id}\` |`,
    );
    void cells;
  }
  lines.push('');

  // ۳) memory و ۴) ssr
  for (const group of GROUPS.slice(2)) {
    lines.push('## ' + group.title);
    lines.push('');
    lines.push(group.intro);
    lines.push('');
    lines.push(
      '| متریک | مقدار | توضیح | بازتولید مشاهده‌شده | آستانه | وضعیت | منبع (اسکریپت + کامیت) | بازتولید یک عدد |',
    );
    lines.push('|---|---|---|---|---|---|---|---|');
    for (const metric of groupMetrics(metrics, group.id)) lines.push(metricRow(metric, commit));
    lines.push('');
  }

  // ۵) بازتولیدپذیری
  lines.push('## بازتولیدپذیری — چه چیزی تضمین می‌شود؟');
  lines.push('');
  lines.push(
    '- هر متریک با **کمینهٔ چند نمونه** (نه میانگین) گزارش می‌شود؛ نویز GC/زمان‌بندی فقط زمان اضافه می‌کند، پس کمترین زمان پایدارترین برآورد است.',
  );
  lines.push(
    '- `baseline.json` با `npm run bench:record -- --passes 3` ساخته شده و برای هر متریک **درصد بازتولید مشاهده‌شده** ثبت شده است.',
  );
  const gatedList = allMetrics.filter((m) => m.gate !== false);
  const infoList = allMetrics.filter((m) => m.gate === false);
  const within = (limit) => gatedList.filter((m) => m.reproPct <= limit).length;
  lines.push(
    `- **${gatedList.length} متریک گیت‌شده** و **${infoList.length} متریک اطلاعاتی** در این baseline ثبت شده است. از متریک‌های گیت‌شده، **${within(5)} عدد با بازتولید ≤۵٪** و بقیه با آستانهٔ خودشان (کفِ گروه: ۵٪ برای \`reactive\`/\`ssr\`، ۱۵٪ برای \`dom\`، ۲۵٪ برای \`memory\`) بررسی می‌شوند.`,
  );
  lines.push(
    '- `npm run bench` روی **همان محیط** هر متریک گیت‌شده را با آستانهٔ ثبت‌شده‌اش مقایسه می‌کند و در صورت عبور، exit 1 می‌دهد. متریک‌های اطلاعاتی (⚠️) فقط گزارش می‌شوند — عددشان «بهترین مشاهده» است و ادعای بازتولید برایشان مطرح نیست.',
  );
  if (infoList.length > 0) {
    lines.push(
      `- متریک‌های اطلاعاتی عمدتاً عملیات زیر ~۱۰ns هستند (مثل \`signal.get()\`): V8 در همین یک اجرا بین ۵ns و ۱۵ns می‌لرزد (پراکندگی ثبت‌شده تا ${Math.max(...infoList.map((m) => m.reproPct))}٪). این عدد در سند می‌ماند چون «کفِ» عملکرد مفید است، ولی برای تصمیم‌گیری به آستانه گره نمی‌خورد.`,
    );
  }
  lines.push(
    '- روی محیط دیگر، مقایسه غیرفعال می‌شود و فقط اعداد مطلق چاپ می‌شوند — «۵٪» یک ادعای محیط‌وابسته است، نه یک تضمین جهانی.',
  );
  lines.push('');

  // ۶) محدودیت‌ها
  lines.push('## محدودیت‌ها (صادقانه)');
  lines.push('');
  lines.push(
    `1. **مرورگر واقعی ثبت نشده است.** گروه DOM روی \`${environment.domEngine}\` اجرا شده، چون محیط ثبت (\`${environment.osRelease}\`) مرورگر نصب ندارد. برای اعداد مرورگری: \`npx playwright install chromium && npm run bench:browser\` (نسخهٔ مرورگر در \`benchmarks/results/browser.json\` ثبت می‌شود).`,
  );
  lines.push(
    '2. **بدون layout/paint.** هزینهٔ style/layout/composite مرورگر در این اعداد نیست؛ فقط هزینهٔ ساخت و جهش DOM.',
  );
  lines.push(
    '3. **حافظه از یک پروب فرزند می‌آید** (`node --expose-gc` + دو `gc()` صریح + ۱۰۰k سیگنال تا `benchmarks/memory-probe.mjs`) و چون تخمین هیپ است، آستانهٔ گروه ۲۵٪ است.',
  );
  lines.push('4. **تک‌رشته‌ای.** هیچ عددی هم‌زمانی/چند‌هسته‌ای را نمی‌سنجد.');
  lines.push(
    `5. اعداد v1.0.0 قبلی (Node 24 + Chrome Headless) بازتولیدپذیر نبودند و حذف شدند؛ در تاریخ گیت (\`git log -- docs/BENCHMARKS.md\`) باقی‌اند.`,
  );
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(
    `بازتولید کامل: \`npm run bench\` · گیت بودجهٔ عملکرد CI: \`npm run bench:ci\` (\`benchmarks/budgets.json\`) · سند: \`${relative(ROOT, DOC_PATH)}\``,
  );
  lines.push('');
  return `${lines.join('\n')}`;
}

function groupMetrics(metrics, group) {
  return Object.entries(metrics)
    .map(([id, metric]) => ({ id, ...metric }))
    .filter((metric) => metric.group === group)
    .sort((a, b) => cmp(a.id.split('.').slice(1).join('.'), b.id.split('.').slice(1).join('.')));
}

function reactiveMetrics(metrics) {
  const all = groupMetrics(metrics, 'reactive');
  const order = ['signal-read', 'signal-write', 'computed-diamond', 'effect-runs-per-10k-writes'];
  const implOrder = ['zenith', 'solid', 'vue', 'preact'];
  return all.sort((a, b) => {
    const [, implA, kindA] = a.id.split('.');
    const [, implB, kindB] = b.id.split('.');
    const kindDiff = order.indexOf(kindA) - order.indexOf(kindB);
    if (kindDiff !== 0) return kindDiff;
    return implOrder.indexOf(implA) - implOrder.indexOf(implB);
  });
}

export function generateBenchmarksDoc({ checkOnly = false } = {}) {
  if (!existsSync(BASELINE_PATH)) {
    throw new Error(
      'bench:doc — benchmarks/results/baseline.json وجود ندارد. اول `npm run bench:record` را اجرا کنید.',
    );
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  const doc = buildBenchmarksDoc(baseline);
  const current = existsSync(DOC_PATH) ? readFileSync(DOC_PATH, 'utf8') : null;
  const stale = current !== doc;
  if (checkOnly) return { stale, doc, current };
  writeFileSync(DOC_PATH, doc);
  return { stale, doc, current };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const checkOnly = process.argv.includes('--check');
  try {
    const { stale } = generateBenchmarksDoc({ checkOnly });
    if (checkOnly) {
      if (stale) {
        console.error(
          '❌ docs/BENCHMARKS.md با benchmarks/results/baseline.json هم‌خوان نیست — `npm run bench:doc` را اجرا کنید.',
        );
        process.exit(1);
      }
      console.log('✅ docs/BENCHMARKS.md با baseline هم‌خوان است.');
    } else {
      console.log(`✅ docs/BENCHMARKS.md بازتولید شد${stale ? '' : ' (بدون تغییر)'}.`);
    }
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }
}
