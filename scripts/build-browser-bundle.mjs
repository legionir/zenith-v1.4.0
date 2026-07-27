import { build } from 'esbuild';
import { mkdirSync } from 'node:fs';

mkdirSync('browser-bundles', { recursive: true });

await build({
  entryPoints: ['packages/runtime/src/index.ts'],
  outfile: 'browser-bundles/zenith-runtime.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  sourcemap: true,
});

console.log('Browser bundle created: browser-bundles/zenith-runtime.js');
