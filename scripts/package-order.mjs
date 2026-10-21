import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ZENITH_PACKAGE_PREFIX = '@zenith/';

/**
 * Return workspace package directories in dependency order (#25).
 *
 * Package entry points expose their declarations from `dist`, so a package
 * must emit its declarations before another workspace package can compile
 * against it. That ordering edge exists for `dependencies`/`peerDependencies`
 * AND for workspace `devDependencies` — a package that only needs a sibling's
 * `.d.ts` at type-check time must still be ordered after it.
 *
 * Cycle policy:
 *  - A cycle made up entirely of *dev* edges is broken with a warning and the
 *    edge is skipped: dev edges only carry declaration-ordering hints, and a
 *    pure-dev cycle can't be satisfied in any order anyway.
 *  - A cycle containing at least one runtime/peer edge is a real hazard and
 *    throws, naming every package in the cycle.
 *
 * @param {{packagesDir?: string, logger?: {warn: (msg: string) => void}}} options
 */
export function getPackageOrder(options = {}) {
  const packagesDir = options.packagesDir ?? './packages';
  const logger = options.logger ?? console;

  /** @type {Map<string, any>} directory -> parsed package.json */
  const packages = new Map();

  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const packageJsonPath = join(packagesDir, entry.name, 'package.json');
    if (!existsSync(packageJsonPath)) continue;

    packages.set(entry.name, JSON.parse(readFileSync(packageJsonPath, 'utf8')));
  }

  const directoryForName = new Map(
    [...packages].map(([directory, packageJson]) => [packageJson.name, directory]),
  );

  /**
   * Workspace edges per package, tagged by the field they came from.
   * @type {Map<string, {to: string, kind: 'runtime' | 'dev'}[]>}
   */
  const edgesFor = new Map();
  for (const [directory, packageJson] of packages) {
    const edges = [];
    const runtime = { ...packageJson.dependencies, ...packageJson.peerDependencies };
    for (const name of Object.keys(runtime).sort()) {
      if (name.startsWith(ZENITH_PACKAGE_PREFIX) && directoryForName.has(name)) {
        edges.push({ to: directoryForName.get(name), kind: 'runtime' });
      }
    }
    for (const name of Object.keys(packageJson.devDependencies ?? {}).sort()) {
      if (name.startsWith(ZENITH_PACKAGE_PREFIX) && directoryForName.has(name)) {
        edges.push({ to: directoryForName.get(name), kind: 'dev' });
      }
    }
    edgesFor.set(directory, edges);
  }

  const order = [];
  const visited = new Set();
  const onPath = new Set();
  // Each stack frame records the kind of the edge that led INTO it, so a
  // detected cycle can tell whether every edge on it is dev-only.
  /** @type {{dir: string, inKind: 'runtime' | 'dev' | null}[]} */
  const stack = [];

  /** @param {{from: string, kind: 'runtime' | 'dev'}} edge */
  function visit(dir, edge) {
    if (visited.has(dir)) return;
    if (onPath.has(dir)) {
      const startIdx = stack.findIndex((f) => f.dir === dir);
      // Cycle = the frames from dir onward, plus the closing edge we followed.
      const cycleNames = stack
        .slice(startIdx)
        .map((f) => f.dir)
        .concat(dir);
      const cycleKinds = stack
        .slice(startIdx + 1)
        .map((f) => f.inKind)
        .concat(edge.kind);
      if (cycleKinds.every((kind) => kind === 'dev')) {
        logger.warn(
          `⚠️  Dev-only workspace dependency cycle skipped for ordering: ${cycleNames.join(' -> ')}`,
        );
        return; // drop this dev edge and keep cruising
      }
      throw new Error(`Circular workspace dependency: ${cycleNames.join(' -> ')}`);
    }

    onPath.add(dir);
    stack.push({ dir, inKind: edge ? edge.kind : null });
    for (const e of edgesFor.get(dir) ?? []) {
      visit(e.to, { from: dir, kind: e.kind });
    }
    stack.pop();
    onPath.delete(dir);
    visited.add(dir);
    order.push(dir);
  }

  for (const dir of [...packages.keys()].sort()) {
    visit(dir, null);
  }

  return order;
}
