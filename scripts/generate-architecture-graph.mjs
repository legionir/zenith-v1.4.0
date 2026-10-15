#!/usr/bin/env node
// scripts/generate-architecture-graph.mjs
//
// #108 — تولید `docs/ARCHITECTURE-GRAPH.md` از گراف واقعی importها
// (dependency-cruiser؛ همان `packageEdges()` که SVG در scripts/dependency-graph.mjs
// از آن ساخته می‌شود) + سند هستهٔ reactive. گیت تازگی در CI:
// `node scripts/generate-architecture-graph.mjs --check`.
//
// چرا Mermaid: دیف‌فرندلی و روی GitHub رندر می‌شود؛ SVG کامل (Graphviz) در هر
// اجرای CI به‌عنوان artifact منتشر می‌شود (`npm run deps:graph`).

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { packageEdges } from './dependency-graph.mjs';

const ROOT = process.cwd();
const OUT = join(ROOT, 'docs/ARCHITECTURE-GRAPH.md');
const ORDER = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'TOOLING'];
/** یال‌های رو به بالا که docs/ARCHITECTURE-LAYERS.md صریحاً مجاز می‌داند. */
const DOCUMENTED_UPWARD = new Set(['runtime>devtools']);

/** گام لایه برای مقایسه (TOOLING آخر). */
function rank(layer) {
  return layer === 'TOOLING' ? 99 : Number(layer.slice(1));
}

const REACTIVE_CORE = `## هستهٔ reactive (چطور یک تغییر به DOM می‌رسد)

مسیر یک به‌روزرسانی، از خواندن تا پچ گره — بدون Virtual DOM (ADR-0001, ADR-0002):

1. **خواندن (pull):** قالب/DOM با \`signal.get()\` یا از طریق دایرکتیو
   (\`zen-text\`, \`zen-bind\`, \`zen-if\`, \`zen-for\`) مقدار را می‌خواند. هر خواندن،
   effect مالک را به‌عنوان مشترک آن سیگنال ثبت می‌کند.
2. **نوشتن (push زمان‌بندی‌شده):** \`signal.set(v)\` مقدار را عوض می‌کند و
   effectهای وابسته را در صف \`@zenith/scheduler\` می‌گذارد؛ چند \`set\` در یک
   tick = یک رندر (batch داخلی، بدون \`batch()\` در API).
3. **کولسینگ/اولویت:** زمان‌بند در یک microtask/rAF صف را اجرا می‌کند؛
   \`flushSync()\` مرز قطعی تست/SSR است و \`nextTick()\` انتظار غیرمسدودکننده.
4. **پچ گره:** هر bind فقط همان گرهٔ DOM را به‌روزرسانی می‌کند
   (\`textContent\`, attribute, جای درج). هیچ diffی روی درخت اجرا نمی‌شود.
5. **عبارت‌ها:** رشتهٔ \`zen-*=...\` با \`@zenith/expressions\` به AST تبدیل و در
   sandbox تفسیر می‌شود (ADR-0004) — بدون \`eval\`/\`new Function\`.
6. **مالکیت/آزادسازی:** هر effect/دایرکتیو در درخت Owner ثبت می‌شود؛
   \`dispose()\` یا \`Cleanup\` برگشتی همان شاخه را می‌بندد (ADR-0007).
7. **SSR:** همان مسیر روی سرور اجرا می‌شود
   (\`renderToString\`/\`renderToReadableStream\`) و کلاینت فقط state سریالایزشده
   را hydrate می‌کند (ADR-0015).

وابستگی‌های این زنجیره به‌ترتیب لایه‌ها (و دلیل هر یال در جدول لایه‌ها):

- \`@zenith/state\` (L1) → \`@zenith/scheduler\` (L0) → \`@zenith/errors\`/\`@zenith/shared\` (L0)
- \`@zenith/runtime-core\` (L3) → \`state\`, \`expressions\`, \`compiler\`(tooling? نه: فقط رانتایم DOM): \`runtime-core\` روی L1/L2 بنا شده و مرز مشترک کلاینت/SSR است (DEC-025)
- \`@zenith/testing\` (L4) → همهٔ لایه‌های پایین‌تر برای harness ایزوله + \`resetForTesting()\` (ADR-0012)`;

const GRAMMAR_NOTE = `## چطور این فایل به‌روز می‌شود

\`\`\`bash
node scripts/generate-architecture-graph.mjs          # بازتولید
node scripts/generate-architecture-graph.mjs --check  # گیت تازگی (CI: job deps)
npm run deps:graph                                    # SVG کامل Graphviz → artifacts/
\`\`\`

یال‌ها از گراف واقعی importها (dependency-cruiser با resolve به \`src\`؛
DEC-049 در \`docs/decisions\`) استخراج می‌شوند، نه از \`package.json\`؛ بنابراین
import عمیق یا یال پنهان هم دیده می‌شود. SVG آن در هر اجرای CI artifact می‌شود.`;

/**
 * سند کامل را می‌سازد.
 * @param {{nodes: string[], edges: Array<[string, string]>}} graph
 * @param {Record<string, string[]>} layers
 */
export function renderArchitectureDoc(graph, layers) {
  const layerOf = new Map(ORDER.flatMap((l) => (layers[l] ?? []).map((p) => [p, l])));
  const edges = [...new Map(graph.edges.map((e) => [`${e[0]}>${e[1]}`, e])).values()].sort(
    (a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]),
  );
  // یال «رو به بالا» = از لایهٔ پایین‌تر به لایهٔ بالاتر (نقض قاعدهٔ لایه‌ای).
  const upward = edges.filter(([from, to]) => {
    const a = layerOf.get(from);
    const b = layerOf.get(to);
    if (!a || !b) return false; // پکیج بیرون نقشهٔ لایه‌ها (پیش از ثبت در JSON)
    return rank(b) > rank(a);
  });

  const lines = [];
  lines.push('# نمودار وابستگی و معماری اجرایی Zenith (`#108`)');
  lines.push('');
  lines.push('> این فایل **خودکار** از گراف واقعی importها تولید می‌شود (dependency-cruiser).');
  lines.push('> ویرایش دستی بی‌فایده است: گیت CI آن را کهنه تشخیص می‌دهد.');
  lines.push(
    `> مقیاس فعلی: **${graph.nodes.length} پکیج** و **${edges.length} یال** یکتا (fold‌شده در سطح پکیج).`,
  );
  lines.push('');
  lines.push('## نمودار (Mermaid)');
  lines.push('');
  lines.push('```mermaid');
  lines.push('graph LR');
  for (const layer of ORDER) {
    const pkgs = (layers[layer] ?? []).filter((p) => graph.nodes.includes(p)).sort();
    if (!pkgs.length) continue;
    lines.push(`  subgraph ${layer}["${layer}"]`);
    lines.push('    direction TB');
    for (const pkg of pkgs) lines.push(`    ${id(pkg)}["${pkg}"]`);
    lines.push('  end');
  }
  for (const [from, to] of edges) {
    lines.push(`  ${id(from)} --> ${id(to)}`);
  }
  lines.push('```');
  lines.push('');
  lines.push('## لایه‌ها');
  lines.push('');
  lines.push('| لایه | تعداد | پکیج‌ها |');
  lines.push('|---|---|---|');
  for (const layer of ORDER) {
    const pkgs = (layers[layer] ?? []).slice().sort();
    lines.push(
      `| **${layer}** | ${pkgs.length} | ${pkgs.map((p) => `\`${p}\``).join(', ') || '—'} |`,
    );
  }
  lines.push('');
  lines.push(
    '> نقشهٔ رسمی و قاعدهٔ مجاز بودن یال‌ها در ' +
      '[docs/ARCHITECTURE-LAYERS.md](./ARCHITECTURE-LAYERS.md) است؛ اجرای گیت با ' +
      '`npm run deps` انجام می‌شود و ADR آن [ADR-0005](./adr/0005-layered-monorepo.md) است.',
  );
  lines.push('');
  lines.push('## یال‌های رو به بالا (نقض لایه)');
  lines.push('');
  if (upward.length === 0) {
    lines.push('هیچ یال رو به بالایی وجود ندارد. ✅');
  } else {
    lines.push('| از | به | وضعیت |');
    lines.push('|---|---|---|');
    for (const [from, to] of upward) {
      const key = `${from}>${to}`;
      lines.push(
        `| \`${from}\` | \`${to}\` | ${
          DOCUMENTED_UPWARD.has(key) ? 'استثنای مستند (حذف در ۲.۰)' : '**نقض** — باید رفع شود'
        } |`,
      );
    }
  }
  lines.push('');
  lines.push(REACTIVE_CORE);
  lines.push('');
  lines.push(GRAMMAR_NOTE);
  lines.push('');
  return lines.join('\n');
}

function id(pkg) {
  return pkg.replace(/[^A-Za-z0-9_]/g, '_');
}

/** سند را از گراف فعلی می‌سازد. */
export function buildArchitectureDoc(root = ROOT) {
  const layers = JSON.parse(
    readFileSync(join(root, 'scripts/architecture-layers.json'), 'utf8'),
  ).layers;
  const graph = packageEdges(root);
  return renderArchitectureDoc(graph, layers);
}

const invokedDirectly =
  process.argv[1] && process.argv[1].endsWith('generate-architecture-graph.mjs');

if (invokedDirectly) {
  const content = buildArchitectureDoc(ROOT);
  if (process.argv.includes('--check')) {
    let current = '';
    try {
      current = readFileSync(OUT, 'utf8');
    } catch {
      current = '';
    }
    if (current !== content) {
      console.error(
        '❌ docs/ARCHITECTURE-GRAPH.md کهنه است — `node scripts/generate-architecture-graph.mjs` را اجرا کنید (#108).',
      );
      process.exit(1);
    }
    console.log('✅ docs/ARCHITECTURE-GRAPH.md تازه است.');
  } else {
    writeFileSync(OUT, content);
    console.log(`✅ docs/ARCHITECTURE-GRAPH.md نوشته شد (${content.split('\n').length} خط).`);
  }
}
