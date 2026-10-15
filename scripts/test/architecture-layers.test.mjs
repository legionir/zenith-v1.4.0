// scripts/test/architecture-layers.test.mjs
// #49 — enforced layering: the package→layer map is a single file that every package is in,
// ARCHITECTURE-LAYERS.md mirrors it, and dependency-cruiser breaks on upward imports, cycles
// and deep imports (proved on sample trees), while the real workspace stays clean.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { toDot, renderSvg, packageEdges } from '../dependency-graph.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const { layers } = JSON.parse(
  readFileSync(join(root, 'scripts', 'architecture-layers.json'), 'utf8'),
);
const mapped = Object.entries(layers).flatMap(([layer, pkgs]) => pkgs.map((p) => [p, layer]));
const depcruise = join(root, 'node_modules', '.bin', 'depcruise');

function cruise(files) {
  const dir = mkdtempSync(join(tmpdir(), 'layers-'));
  try {
    writeFileSync(
      join(dir, 'tsconfig.depcruise.json'),
      JSON.stringify({
        compilerOptions: {
          module: 'esnext',
          target: 'es2022',
          moduleResolution: 'bundler',
          baseUrl: '.',
          paths: { '@zenith/*': ['packages/*/src/index.ts'] },
        },
      }),
    );
    for (const [rel, body] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, rel)), { recursive: true });
      writeFileSync(join(dir, rel), body);
    }
    const r = spawnSync(
      depcruise,
      ['--config', join(root, '.dependency-cruiser.cjs'), '--output-type', 'json', 'packages'],
      { cwd: dir, encoding: 'utf8' },
    );
    const report = JSON.parse(r.stdout);
    return report.summary.violations.map((v) => v.rule.name);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('#49 layer map', () => {
  it('every package directory is mapped to exactly one layer', () => {
    const names = mapped.map(([p]) => p);
    expect(new Set(names).size, 'a package is listed in two layers').toBe(names.length);
    const onDisk = readdirSync(join(root, 'packages'), { withFileTypes: true })
      .filter((d) => d.isDirectory() && !d.name.startsWith('tmp-'))
      .map((d) => d.name);
    expect(
      onDisk.filter((d) => !names.includes(d)),
      'unmapped packages',
    ).toEqual([]);
  });

  it('docs/ARCHITECTURE-LAYERS.md §2 table lists exactly the same packages per layer', () => {
    const doc = readFileSync(join(root, 'docs', 'ARCHITECTURE-LAYERS.md'), 'utf8');
    const table = doc.slice(doc.indexOf('## ۲.'), doc.indexOf('## ۳.'));
    const rowFor = (label) => table.split('\n').find((l) => l.includes(`**${label}`)) ?? '';
    const labels = {
      L0: 'L0',
      L1: 'L1',
      L2: 'L2',
      L3: 'L3',
      L4: 'L4',
      L5: 'L5',
      TOOLING: 'Tooling',
    };
    for (const [layer, label] of Object.entries(labels)) {
      const cell = rowFor(label).split('|')[2] ?? '';
      const inDoc = [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]).sort();
      expect(inDoc, `${layer} row of the doc table`).toEqual([...layers[layer]].sort());
    }
  });
});

describe('#49 dependency-cruiser enforcement (sample trees)', () => {
  it('an upward import (L1 state → L2 router) fails', () => {
    const v = cruise({
      'packages/state/src/index.ts':
        "import { r } from '../../router/src/index';\nexport const s = r;\n",
      'packages/router/src/index.ts': 'export const r = 1;\n',
    });
    expect(v).toContain('layer-l1-no-upward');
  });

  it('an upward import written as a bare workspace specifier (@zenith/router) fails too', () => {
    const v = cruise({
      'packages/state/src/index.ts': "import { r } from '@zenith/router';\nexport const s = r;\n",
      'packages/router/src/index.ts': 'export const r = 1;\n',
    });
    expect(v).toContain('layer-l1-no-upward');
  });

  it('a static import cycle fails', () => {
    const v = cruise({
      'packages/router/src/index.ts': "import './a';\n",
      'packages/router/src/a.ts': "import './b';\nexport const a = 1;\n",
      'packages/router/src/b.ts': "import './a';\nexport const b = 1;\n",
    });
    expect(v).toContain('no-circular');
  });

  it('a deep import into another package internals fails; its public entry is fine', () => {
    const deep = cruise({
      'packages/router/src/index.ts':
        "import { x } from '../../state/src/internal';\nexport const r = x;\n",
      'packages/state/src/index.ts': 'export const s = 1;\n',
      'packages/state/src/internal.ts': 'export const x = 1;\n',
    });
    expect(deep).toContain('no-deep-import');
    const ok = cruise({
      'packages/router/src/index.ts':
        "import { s } from '../../state/src/index';\nexport const r = s;\n",
      'packages/state/src/index.ts': 'export const s = 1;\n',
    });
    expect(ok).toEqual([]);
  });

  it('the real workspace has zero violations', () => {
    const r = spawnSync(depcruise, ['--config', '.dependency-cruiser.cjs', 'packages'], {
      cwd: root,
      encoding: 'utf8',
    });
    expect(r.status, r.stdout + r.stderr).toBe(0);
  });
});

describe('#49 dependency graph artifact', () => {
  it('draws unexpected upward edges red and the documented exception dashed orange', () => {
    const dot = toDot({
      nodes: ['state', 'router', 'runtime', 'devtools'],
      edges: [
        ['state', 'router'],
        ['runtime', 'devtools'],
        ['router', 'state'],
      ],
    });
    expect(dot).toContain('"state" -> "router" [color="red"');
    expect(dot).toContain('"runtime" -> "devtools" [color="#ea580c"');
    expect(dot).toContain('"router" -> "state" [color="#6b7280"]');
  });

  it('renders a real SVG of the workspace (all packages, real edges, no red edge)', async () => {
    const graph = packageEdges(root);
    expect(graph.nodes.length).toBeGreaterThanOrEqual(34);
    expect(graph.edges.length).toBeGreaterThan(100);
    const svg = await renderSvg(toDot(graph));
    expect(svg.startsWith('<?xml')).toBe(true);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('stroke="red"');
  }, 60_000);
});
