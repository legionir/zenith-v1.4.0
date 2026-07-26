import { buildPackage } from './build-package';

const packages = [
  'state',
  'runtime',
  'scheduler',
  'expressions',
  'compiler',
  'router',
  'form',
  'resource',
  'auth',
  'i18n',
  'ssr',
  'devtools'
];

console.log('🚀 Building all Zenith packages...\n');
for (const pkg of packages) {
  await buildPackage(pkg);
}
console.log('\n🎉 All packages built successfully!');
