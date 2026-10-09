import { buildPackage } from './build-package.mjs';
import { getPackageOrder } from './package-order.mjs';

const pkgDirs = getPackageOrder();

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
