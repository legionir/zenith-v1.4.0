import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const packagesDir = './packages';
const ZENITH_PACKAGE_PREFIX = '@zenith/';

/**
 * Return workspace package directories in dependency order.
 *
 * Package entry points expose their declarations from `dist`, so a package
 * must emit its declarations before another workspace package can compile
 * against it. Directory order is neither stable nor dependency-aware.
 */
export function getPackageOrder() {
  const packages = new Map();

  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;

    const packageJsonPath = join(packagesDir, entry.name, 'package.json');
    if (!existsSync(packageJsonPath)) continue;

    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    packages.set(entry.name, packageJson);
  }

  const directoryForName = new Map(
    [...packages].map(([directory, packageJson]) => [packageJson.name, directory]),
  );
  const order = [];
  const visiting = new Set();
  const visited = new Set();

  function visit(directory, ancestry = []) {
    if (visited.has(directory)) return;
    if (visiting.has(directory)) {
      throw new Error(
        `Circular workspace dependency: ${[...ancestry, directory].join(' -> ')}`,
      );
    }

    visiting.add(directory);
    const packageJson = packages.get(directory);
    const dependencies = {
      ...packageJson.dependencies,
      ...packageJson.peerDependencies,
    };

    for (const dependencyName of Object.keys(dependencies).sort()) {
      if (!dependencyName.startsWith(ZENITH_PACKAGE_PREFIX)) continue;

      const dependencyDirectory = directoryForName.get(dependencyName);
      if (dependencyDirectory) {
        visit(dependencyDirectory, [...ancestry, directory]);
      }
    }

    visiting.delete(directory);
    visited.add(directory);
    order.push(directory);
  }

  for (const directory of [...packages.keys()].sort()) {
    visit(directory);
  }

  return order;
}
