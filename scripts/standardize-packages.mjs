import { readdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const packagesDir = './packages';
const pkgDirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name);

const zenithPackages = new Set(pkgDirs.map(d => `@zenith/${d}`));
zenithPackages.add('zenith-vscode');

for (const dir of pkgDirs) {
  const pkgPath = join(packagesDir, dir, 'package.json');
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  } catch {
    console.log(`Skipping ${dir} (no package.json)`);
    continue;
  }

  // Standardize fields
  pkg.version = '1.4.0';
  pkg.type = 'module';
  pkg.license = pkg.license || 'MIT';
  pkg.engines = pkg.engines || { node: '>=18' };

  // Standardize exports for all except vscode extension
  if (pkg.name !== 'zenith-vscode') {
    pkg.main = './dist/index.cjs';
    pkg.module = './dist/index.js';
    pkg.types = './dist/index.d.ts';
    pkg.exports = {
      '.': {
        types: './dist/index.d.ts',
        import: './dist/index.js',
        require: './dist/index.cjs'
      }
    };
    pkg.files = ['dist', 'README.md'];
    pkg.scripts = {
      ...pkg.scripts,
      build: 'tsc -p tsconfig.json',
      typecheck: 'tsc --noEmit'
    };
  }

  // Fix internal dependency versions to 1.4.0
  const fixDeps = (deps) => {
    if (!deps) return;
    for (const key of Object.keys(deps)) {
      if (zenithPackages.has(key)) {
        deps[key] = '1.4.0';
      }
    }
  };

  fixDeps(pkg.dependencies);
  fixDeps(pkg.devDependencies);
  fixDeps(pkg.peerDependencies);

  writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`Standardized ${pkg.name}`);
}

console.log('\nDone standardizing all packages.');
