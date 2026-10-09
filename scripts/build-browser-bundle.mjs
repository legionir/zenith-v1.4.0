import { build } from 'esbuild';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const outputDirectory = resolve('browser-bundles');

mkdirSync(outputDirectory, { recursive: true });

await build({
  entryPoints: ['packages/runtime/src/index.ts'],
  outfile: resolve(outputDirectory, 'zenith-runtime.js'),

  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  sourcemap: true,

  plugins: [
    {
      name: 'resolve-zenith-workspace-sources',

      setup(esbuild) {
        // Resolve @zenith/state -> packages/state/src/index.ts
        // instead of node_modules/@zenith/state/dist/index.js.
        esbuild.onResolve({ filter: /^@zenith\/[^/]+$/ }, (args) => {
          const packageDirectory = args.path.slice('@zenith/'.length);
          const sourceEntry = resolve(
            'packages',
            packageDirectory,
            'src',
            'index.ts',
          );

          if (!existsSync(sourceEntry)) {
            return {
              errors: [
                {
                  text: `Zenith workspace source was not found for ${args.path}`,
                },
              ],
            };
          }

          return { path: sourceEntry };
        });
      },
    },
  ],
});

console.log(
  'Browser bundle created: browser-bundles/zenith-runtime.js',
);
