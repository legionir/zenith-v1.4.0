import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (rel) => readFileSync(join(ROOT, rel), 'utf8');

describe('template/demo e2e scenario coverage (#33)', () => {
  it('maps every template kind and both designated demos to an executable spec', () => {
    const scenarios = read('e2e/SCENARIOS.md');
    for (const kind of ['spa', 'ssr', 'pwa', 'dashboard', 'minimal']) {
      expect(scenarios, kind).toMatch(new RegExp(`\\b${kind}\\b`));
    }
    expect(scenarios).toMatch(/e2e\/templates-matrix\.spec\.ts/);
    expect(scenarios).toMatch(/e2e\/ecommerce\.spec\.ts/);
    expect(scenarios).toMatch(/e2e\/dashboard-rbac\.spec\.ts/);
    for (const spec of [
      'e2e/templates-matrix.spec.ts',
      'e2e/ecommerce.spec.ts',
      'e2e/dashboard-rbac.spec.ts',
      'scripts/build-template-fixtures.mjs',
    ]) {
      expect(existsSync(join(ROOT, spec)), spec).toBe(true);
    }
  });

  it('uses real browsers, not jsdom: no jsdom pragma in the new specs', () => {
    for (const spec of ['e2e/templates-matrix.spec.ts', 'e2e/ecommerce.spec.ts']) {
      expect(read(spec)).not.toMatch(/vitest-environment jsdom/);
    }
  });

  it('fails the matrix closed without fixtures and gates console/page errors', () => {
    const matrix = read('e2e/templates-matrix.spec.ts');
    expect(matrix).toMatch(/ZENITH_TEMPLATE_APPS/);
    expect(matrix).toMatch(/build-template-fixtures/);
    expect(matrix).toMatch(/attachDiags/);
    expect(matrix).toMatch(/pageErrors.*toEqual\(\[\]\)/);
    const ecommerce = read('e2e/ecommerce.spec.ts');
    // Negative controls: out-of-stock refusal and empty-checkout idle.
    expect(ecommerce).toMatch(/stock 0/);
    expect(ecommerce).toMatch(/idle/);
    expect(ecommerce).toMatch(/success/);
  });

  it('serves a deterministic /api/products mock whose ids are real store stock keys', () => {
    const server = read('scripts/e2e-server.mjs');
    const seedMatch = server.match(/const ECOMMERCE_PRODUCTS = \[([\s\S]*?)\];/);
    expect(seedMatch, 'ECOMMERCE_PRODUCTS seed').not.toBeNull();
    const ids = [...seedMatch[1].matchAll(/id: (\d+)/g)].map((m) => Number(m[1]));
    expect(ids.length).toBeGreaterThanOrEqual(3);
    // Every mocked product id must exist in the demo store inventory so the
    // stock states exercised are real, not invented.
    const store = read('ecommerce-demo/src/store.js');
    const inventory = store.match(/inventory: \{([\s\S]*?)\}/);
    expect(inventory, 'store inventory').not.toBeNull();
    for (const id of ids) {
      expect(inventory[1], `product ${id}`).toMatch(new RegExp(`\\b${id}:`));
    }
    // id 3 (stock 0) is the out-of-stock negative control.
    expect(inventory[1]).toMatch(/\b3: 0\b/);
  });

  it('documents the deliberate non-coverage instead of claiming it', () => {
    const scenarios = read('e2e/SCENARIOS.md');
    expect(scenarios).toMatch(/Deliberate non-coverage/);
    expect(scenarios).toMatch(/#114/);
    expect(scenarios).toMatch(/#165\/#166/);
  });
});
