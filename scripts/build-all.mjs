import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { buildPackage } from './build-package.mjs';

const packagesDir = './packages';
const pkgDirs = readdirSync(packagesDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)
  .filter(name => existsSync(join(packagesDir, name, 'package.json')));

let failed = 0;
let built = 0;

for (const dir of pkgDirs) {
  try {
    const ok = await buildPackage(dir);
    if (ok) built++;
  } catch (err) {
    console.error(`❌ @zenith/${dir} build failed:`, err.message);
    failed++;
  }
}

console.log(`\n📊 Results: ${built} built, ${failed} failed`);

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n🎉 All packages built successfully!');
}
