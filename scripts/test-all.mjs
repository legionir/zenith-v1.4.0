import { readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const packagesDir = './packages';
const pkgDirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .filter(name => existsSync(join(packagesDir, name, 'package.json')));

let failed = 0;
let passed = 0;
let skipped = 0;

for (const dir of pkgDirs) {
  const pkgPath = join(packagesDir, dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

  if (!pkg.scripts || !pkg.scripts.test) {
    skipped++;
    continue;
  }

  console.log(`🧪 Testing @zenith/${dir}...`);
  const result = spawnSync('npm', ['run', 'test', '--workspace=@zenith/' + dir], {
    stdio: 'inherit',
    shell: true,
    cwd: process.cwd(),
  });

  if (result.status !== 0) {
    console.error(`❌ @zenith/${dir} tests failed`);
    failed++;
  } else {
    console.log(`✅ @zenith/${dir} tests passed`);
    passed++;
  }
}

console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${skipped} skipped`);

if (failed > 0) {
  process.exit(1);
}
