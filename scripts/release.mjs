import { readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

const packagesDir = './packages';
const pkgDirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .filter(name => existsSync(join(packagesDir, name, 'package.json')));

console.log('📦 Publishing packages to npm...\n');

let failed = 0;

for (const dir of pkgDirs) {
  const pkgPath = join(packagesDir, dir, 'package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

  // Skip private or non-publishable packages
  if (pkg.private) {
    console.log(`⏭️  ${pkg.name}: private package, skipping`);
    continue;
  }

  const distPath = join(packagesDir, dir, 'dist');
  if (!existsSync(distPath)) {
    console.warn(`⚠️  ${pkg.name}: no dist folder, skipping (run build first)`);
    continue;
  }

  console.log(`🚀 Publishing ${pkg.name}...`);
  const result = spawnSync('npm', ['publish', '--access', 'public'], {
    stdio: 'inherit',
    shell: true,
    cwd: join(packagesDir, dir),
  });

  if (result.status !== 0) {
    console.error(`❌ ${pkg.name} publish failed`);
    failed++;
  } else {
    console.log(`✅ ${pkg.name} published`);
  }
}

if (failed > 0) {
  console.error(`\n⚠️  ${failed} package(s) failed to publish`);
  process.exit(1);
} else {
  console.log('\n🎉 All packages published successfully!');
}
