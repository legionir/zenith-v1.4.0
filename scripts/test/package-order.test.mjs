// Tests for scripts/package-order.mjs (#25).
// Builds synthetic workspace fixtures in a temp dir and asserts:
//  1. no cycle → deterministic dependency order,
//  2. runtime cycle → throws with the cycle's package names,
//  3. devDependencies create ordering edges,
//  4. dev-only cycles warn (not throw) and still return a full order.
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getPackageOrder } from '../package-order.mjs';

/** @type {string} */
let root;

/** Write packages/<name>/package.json with the given dependency fields. */
function pkg(name, { dependencies = {}, peerDependencies = {}, devDependencies = {} } = {}) {
  const dir = join(root, 'packages', name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'package.json'),
    JSON.stringify({ name: `@zenith/${name}`, dependencies, peerDependencies, devDependencies }),
  );
}

/** Collect logger.warn calls during a getPackageOrder run. */
function runWithLogger() {
  /** @type {string[]} */
  const warnings = [];
  const order = getPackageOrder({
    packagesDir: join(root, 'packages'),
    logger: { warn: (msg) => warnings.push(msg) },
  });
  return { order, warnings };
}

describe('getPackageOrder (#25)', () => {
  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'zenith-order-'));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('orders dependencies before dependents with no cycle', () => {
    pkg('state', {});
    pkg('scheduler', {});
    pkg('expressions', { dependencies: { '@zenith/state': 'workspace:*' } });
    pkg('compiler', { peerDependencies: { '@zenith/expressions': '>=1' } });

    const { order, warnings } = runWithLogger();

    expect(order).toHaveLength(4);
    expect(order.indexOf('state')).toBeLessThan(order.indexOf('expressions'));
    expect(order.indexOf('expressions')).toBeLessThan(order.indexOf('compiler'));
    expect(warnings).toEqual([]);
  });

  it('throws a clear error naming every package in a real runtime cycle', () => {
    pkg('a', { dependencies: { '@zenith/b': 'workspace:*' } });
    pkg('b', { dependencies: { '@zenith/a': 'workspace:*' } });

    expect(() => runWithLogger()).toThrow(/Circular workspace dependency/);
    try {
      runWithLogger();
      expect.unreachable();
    } catch (err) {
      expect(err.message).toContain('a');
      expect(err.message).toContain('b');
    }
  });

  it('treats workspace devDependencies as ordering edges', () => {
    pkg('state', {});
    // runtime only needs state's .d.ts at type-check time (dev dep).
    pkg('runtime', { devDependencies: { '@zenith/state': 'workspace:*' } });

    const { order } = runWithLogger();
    expect(order.indexOf('state')).toBeLessThan(order.indexOf('runtime'));
  });

  it('warns and continues for a dev-only cycle', () => {
    pkg('x', { devDependencies: { '@zenith/y': 'workspace:*' } });
    pkg('y', { devDependencies: { '@zenith/x': 'workspace:*' } });

    const { order, warnings } = runWithLogger();

    expect(order).toHaveLength(2);
    expect(order).toContain('x');
    expect(order).toContain('y');
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('Dev-only');
    expect(warnings[0]).toContain('x');
    expect(warnings[0]).toContain('y');
  });

  it('still throws when a mixed dev+runtime cycle exists', () => {
    pkg('p', { dependencies: { '@zenith/q': 'workspace:*' } });
    pkg('q', { devDependencies: { '@zenith/p': 'workspace:*' } });

    expect(() => runWithLogger()).toThrow(/Circular workspace dependency/);
  });

  it('produces a valid order for the real workspace (no runtime cycle)', () => {
    // The actual monorepo must order every package exactly once and never
    // throw; workspace devDep edges (e.g. runtime → permission) are honoured.
    const order = getPackageOrder({ packagesDir: join(process.cwd(), 'packages') });
    // #142: @zenith/schema added (39 → 40).
    expect(order).toHaveLength(40);
    expect(new Set(order).size).toBe(40);
  });
});
