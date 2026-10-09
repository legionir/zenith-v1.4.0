import { existsSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';
import { getPackageOrder } from './package-order.mjs';

const packagesDir = './packages';
const pkgDirs = getPackageOrder();

let failed = 0;

for (const dir of pkgDirs) {
  const tsconfigPath = join(packagesDir, dir, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) {
    continue;
  }

  console.log(`🔍 Type-checking @zenith/${dir}...`);
  // Declarations are needed by downstream workspace packages because their
  // package `types` entries point at dist/. This is intentionally not
  // --noEmit: CI type-checks before the bundling step on a clean checkout.
  const result = spawnSync('npx', ['tsc', '-p', tsconfigPath, '--declaration', '--emitDeclarationOnly'], {
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n⚠️  ${failed} package(s) have type errors`);
  process.exit(1);
} else {
  console.log('\n🎉 All packages type-checked successfully!');
}
