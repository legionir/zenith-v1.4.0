// @vitest-environment node
//
// #108 — گیت ADR و نمودار معماری:
//   ۱) ≥۱۰ ADR با قالب MADR (وضعیت/زمینه/محرک‌ها/گزینه‌ها/تصمیم/پیامد) و
//      شماره‌گذاری ترتیبی یکتا.
//   ۲) هر ADR دست‌کم یک DEC موجود را لینک می‌دهد و همهٔ لینک‌های نسبی سالم‌اند.
//   ۳) فهرست docs/adr/README.md از خود فایل‌ها تولید و تازه است (پروب منفی:
//      افزودن ADR بدون اجرای --write ⇒ gate قرمز).
//   ۴) docs/ARCHITECTURE-GRAPH.md از گراف واقعی importها تولید و تازه است و
//      یال رو به بالا جز استثنای مستند ندارد.
import { describe, it, expect } from 'vitest';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnNode } from '../../scripts/lib/proc.mjs';
import { auditAdrs, listAdrs, renderIndex, MIN_ADRS } from '../../scripts/check-adr.mjs';
import { renderArchitectureDoc } from '../../scripts/generate-architecture-graph.mjs';
import { packageEdges } from '../../scripts/dependency-graph.mjs';

const ROOT = process.cwd();
const adrDir = join(ROOT, 'docs/adr');

describe('#108 ADRs (MADR)', () => {
  it('has at least 10 well-formed ADRs linked to DECs and a fresh index', () => {
    const { problems, adrs } = auditAdrs(ROOT);
    expect(problems, problems.join('\n')).toEqual([]);
    expect(adrs.length).toBeGreaterThanOrEqual(MIN_ADRS);
    const numbers = adrs.map((a) => a.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  });

  it('each ADR documents options, outcome and consequences (not a stub)', () => {
    for (const adr of listAdrs(ROOT)) {
      expect(adr.text, adr.name).toMatch(/\n1\. /); // گزینه‌های شماره‌دار
      const outcome = adr.text.split('## Decision Outcome')[1] ?? '';
      expect(outcome.length, `${adr.name}: empty Decision Outcome`).toBeGreaterThan(80);
      expect(adr.text.split('\n').length, adr.name).toBeGreaterThan(25);
    }
  });

  it('the gate fails when an ADR is added without refreshing the index', () => {
    const tmp = join(adrDir, '0099-probe.md');
    const original = readFileSync(join(adrDir, '0001-html-first-no-virtual-dom.md'), 'utf8');
    const bumped = original
      .replace('# ADR-0001:', '# ADR-0099:')
      .replace(/^## Decision Outcome/m, '## Decision Outcome');
    try {
      writeFileSync(tmp, bumped);
      const bad = spawnNode('scripts/check-adr.mjs', [], { cwd: ROOT, encoding: 'utf8' });
      expect(bad.status).toBe(1);
      expect(bad.stderr).toContain('0099-probe.md');
      const { problems } = auditAdrs(ROOT);
      expect(problems.join('\n')).toContain('README.md index is stale');
      expect(problems.join('\n')).toContain('expected number');
    } finally {
      rmSync(tmp, { force: true });
    }
  });

  it('the MADR template is documented and lists the required sections', () => {
    const readme = readFileSync(join(adrDir, 'README.md'), 'utf8');
    for (const section of [
      '## Context and Problem Statement',
      '## Decision Drivers',
      '## Considered Options',
      '## Decision Outcome',
      '### Consequences',
    ]) {
      expect(readme).toContain(section);
    }
    expect(readme).toContain('MADR');
  });

  it('index rows mirror the ADR files (single source of truth)', () => {
    const adrs = listAdrs(ROOT);
    const index = renderIndex(adrs);
    for (const adr of adrs) {
      expect(index).toContain(adr.name);
    }
    expect(index.match(/^\| \[ADR-/gm)?.length).toBe(adrs.length);
  });
});

describe('#108 dependency graph docs', () => {
  it('docs/ARCHITECTURE-GRAPH.md matches a fresh render of the real graph', () => {
    const layers = JSON.parse(
      readFileSync(join(ROOT, 'scripts/architecture-layers.json'), 'utf8'),
    ).layers;
    const generated = renderArchitectureDoc(packageEdges(ROOT), layers);
    const onDisk = readFileSync(join(ROOT, 'docs/ARCHITECTURE-GRAPH.md'), 'utf8');
    expect(onDisk).toBe(generated);
  });

  it('lists every layer and only documented upward edges', () => {
    const doc = readFileSync(join(ROOT, 'docs/ARCHITECTURE-GRAPH.md'), 'utf8');
    for (const layer of ['L0', 'L1', 'L2', 'L3', 'L4', 'L5', 'TOOLING']) {
      expect(doc).toContain(`**${layer}**`);
    }
    const upwardSection = doc.slice(doc.indexOf('## یال‌های رو به بالا'));
    const rows = upwardSection
      .split('\n')
      .filter((l) => l.startsWith('| `'))
      .map((l) => l.split('|')[1].trim());
    expect(rows.length).toBeLessThanOrEqual(1); // امروز فقط runtime → devtools
    expect(upwardSection).not.toContain('**نقض**');
  });

  it('the CI gate exists and the reactive core is explained', () => {
    const doc = readFileSync(join(ROOT, 'docs/ARCHITECTURE-GRAPH.md'), 'utf8');
    expect(doc).toContain('generate-architecture-graph.mjs');
    expect(doc).toContain('## هستهٔ reactive');
    expect(doc).toContain('flushSync');
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts['check:architecture-graph']).toContain('--check');
    expect(pkg.scripts['check:adr']).toBeTruthy();
  });

  it('the docs README links both new artifacts', () => {
    const readme = readFileSync(join(ROOT, 'docs/README.md'), 'utf8');
    expect(readme).toContain('./adr/README.md');
    expect(readme).toContain('./ARCHITECTURE-GRAPH.md');
  });
});
