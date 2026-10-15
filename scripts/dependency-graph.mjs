#!/usr/bin/env node
/**
 * #49 — package-level dependency graph as SVG (CI artifact).
 *
 *   node scripts/dependency-graph.mjs [outFile=artifacts/dependency-graph.svg]
 *
 * Edges come from dependency-cruiser's module graph folded to one node per package (so they
 * are the REAL import edges, not package.json claims); nodes are grouped and coloured by the layer
 * in scripts/architecture-layers.json. An edge that points to a higher layer is drawn red;
 * the only documented exception (legacy runtime → devtools re-export, removed in v2.0) is
 * orange/dashed. `npm run deps` fails on any other upward edge. Pure JS (WASM Graphviz): no system `dot`.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { layers } = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'scripts', 'architecture-layers.json'), 'utf8'),
);
const ORDER = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'TOOLING'];
const COLORS = {
  L0: '#dbeafe',
  L1: '#dcfce7',
  L2: '#fef9c3',
  L3: '#fde68a',
  L4: '#fed7aa',
  L5: '#fecaca',
  TOOLING: '#e5e7eb',
};
/** Upward edges that docs/ARCHITECTURE-LAYERS.md §2 explicitly allows (see layer-l3 rule). */
const DOCUMENTED_EXCEPTIONS = new Set(['runtime>devtools']);
const layerOf = new Map(ORDER.flatMap((l) => layers[l].map((p) => [p, l])));
const rank = (pkg) => {
  const l = layerOf.get(pkg);
  return l === 'TOOLING' ? 99 : l ? Number(l.slice(1)) : -1;
};

/** Package-level edges derived from dependency-cruiser's module graph (real import edges). */
export function packageEdges(root = ROOT) {
  const bin = path.join(root, 'node_modules', '.bin', 'depcruise');
  const r = spawnSync(
    bin,
    ['--config', '.dependency-cruiser.cjs', '--output-type', 'json', 'packages'],
    { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const report = JSON.parse(r.stdout);
  const nodes = new Set();
  const edges = [];
  for (const mod of report.modules) {
    const from = mod.source.match(/^packages\/([^/]+)/)?.[1];
    if (!from) continue;
    nodes.add(from);
    for (const dep of mod.dependencies) {
      const to = dep.resolved.match(/^packages\/([^/]+)/)?.[1];
      if (to && to !== from) {
        nodes.add(to);
        edges.push([from, to]);
      }
    }
  }
  return {
    nodes: [...nodes].sort(),
    edges: edges.filter(([a, b], i, arr) => arr.findIndex(([x, y]) => x === a && y === b) === i),
  };
}

export function toDot({ nodes, edges }) {
  const out = ['digraph zenith {', '  rankdir=BT; compound=true; fontname="Helvetica";'];
  out.push('  node [shape=box, style="rounded,filled", fontname="Helvetica", fontsize=10];');
  for (const layer of ORDER) {
    const members = nodes.filter((n) => layerOf.get(n) === layer);
    if (!members.length) continue;
    out.push(
      `  subgraph cluster_${layer} {`,
      `    label="${layer}"; style=dashed; color="#9ca3af";`,
    );
    for (const m of members) out.push(`    "${m}" [fillcolor="${COLORS[layer]}"];`);
    out.push('  }');
  }
  for (const n of nodes.filter((x) => !layerOf.has(x))) {
    out.push(`  "${n}" [fillcolor="#ffffff", color="red", label="${n}\\n(unmapped!)"];`);
  }
  for (const [a, b] of edges) {
    const upward = rank(a) < rank(b) && rank(a) !== 99;
    const style = !upward
      ? '[color="#6b7280"]'
      : DOCUMENTED_EXCEPTIONS.has(`${a}>${b}`)
        ? '[color="#ea580c", style=dashed, penwidth=2]'
        : '[color="red", penwidth=2]';
    out.push(`  "${a}" -> "${b}" ${style};`);
  }
  out.push('}');
  return out.join('\n');
}

export async function renderSvg(dot) {
  const { Graphviz } = await import('@hpcc-js/wasm-graphviz');
  return (await Graphviz.load()).dot(dot, 'svg');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const outFile = path.resolve(ROOT, process.argv[2] ?? 'artifacts/dependency-graph.svg');
  const graph = packageEdges();
  const svg = await renderSvg(toDot(graph));
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, svg);
  console.log(
    `✅ dependency graph: ${graph.nodes.length} packages, ${graph.edges.length} edges → ${path.relative(ROOT, outFile)} (#49)`,
  );
}
