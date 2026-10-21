import { buildPackage } from './build-package.mjs';
import { getPackageOrder } from './package-order.mjs';

// #57 — published artifacts are production builds: dev-only warnings
// (`__ZENITH_DEV__`) are stripped unless the caller explicitly opts into a
// development build (NODE_ENV=development). No release/CI path sets this
// today, so the default lives here, at the artifact producer.
process.env.NODE_ENV ??= 'production';

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
