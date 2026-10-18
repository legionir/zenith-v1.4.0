import { build } from 'esbuild';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export async function bundleWorker() {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  return build({
    entryPoints: [resolve(root, 'packages/adapter-edge/test/fixtures/worker.ts')],
    bundle: true, write: false, format: 'esm', platform: 'browser', target: 'es2022', minify: true, metafile: true,
    define: { __ZENITH_DEV__: 'false', 'globalThis.__ZENITH_DEV__': 'false', 'process.env.NODE_ENV': '"production"', __ZENITH_PKG_VERSION__: '"1.5.0"' },
    plugins: [{ name: 'workspace-source', setup(builder) {
      builder.onResolve({ filter: /^@zenith\// }, args => {
        const [name, ...subpath] = args.path.slice('@zenith/'.length).split('/');
        return { path: resolve(root, 'packages', name, 'src', `${subpath.length ? subpath.join('/') : 'index'}.ts`) };
      });
    } }],
  });
}
