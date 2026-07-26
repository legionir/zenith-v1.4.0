import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const packagesDir = './packages';
const pkgDirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .filter(name => existsSync(join(packagesDir, name, 'package.json')));

let failed = 0;

for (const dir of pkgDirs) {
  const tsconfigPath = join(packagesDir, dir, 'tsconfig.json');
  if (!existsSync(tsconfigPath)) {
    continue;
  }

  console.log(`🔍 Building types for @zenith/${dir}...`);
  const result = spawnSync('npx', ['tsc', '-p', tsconfigPath, '--declaration', '--emitDeclarationOnly'], {
    stdio: 'inherit',
    shell: true,
  });

  if (result.status !== 0) {
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n⚠️  ${failed} package(s) failed to build types`);
  process.exit(1);
} else {
  console.log('\n🎉 All type declarations built successfully!');
}
