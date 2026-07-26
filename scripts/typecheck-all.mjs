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

  console.log(`🔍 Type-checking @zenith/${dir}...`);
  const result = spawnSync('npx', ['tsc', '--noEmit', '-p', tsconfigPath], {
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
