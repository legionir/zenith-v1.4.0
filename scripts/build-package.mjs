import { build } from 'esbuild';
import { existsSync, rmSync, mkdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

/**
 * Packages that run on a Node.js host rather than in the browser.
 *
 * These import Node builtins (`node:fs`, `node:async_hooks`, ...) either
 * directly or through a dependency, so they must be bundled with
 * `platform: 'node'`. With the default `platform: 'neutral'` esbuild does not
 * know about Node builtins and fails to resolve them.
 *
 * Browser/isomorphic packages intentionally stay on `neutral` so their output
 * remains portable across runtimes.
 */
const NODE_PLATFORM_PACKAGES = new Set([
  'cli',
  'ssr',
  'vite-plugin',
]);

/**
 * Build a single package with dual ESM + CJS output + TypeScript declarations.
 */
export async function buildPackage(pkgName) {
  const pkgPath = `./packages/${pkgName}`;
  const srcPath = join(pkgPath, 'src', 'index.ts');
  const outDir = join(pkgPath, 'dist');

  if (!existsSync(srcPath)) {
    console.log(`⏭️  @zenith/${pkgName}: no src/index.ts, skipping`);
    return false;
  }

  if (existsSync(outDir)) {
    rmSync(outDir, { recursive: true });
  }
  mkdirSync(outDir, { recursive: true });

  console.log(`🔨 Building @zenith/${pkgName}...`);

  const platform = NODE_PLATFORM_PACKAGES.has(pkgName) ? 'node' : 'neutral';

  // Peer dependencies are provided by the consumer and must never be bundled.
  // Without this, e.g. @zenith/ssr inlines the whole of jsdom (~3 MB) and
  // defeats its own "is jsdom installed?" runtime check.
  const pkgJsonPath = join(pkgPath, 'package.json');
  const peerDeps = existsSync(pkgJsonPath)
    ? Object.keys(JSON.parse(readFileSync(pkgJsonPath, 'utf8')).peerDependencies ?? {})
    : [];

  const sharedOptions = {
    entryPoints: [srcPath],
    platform,
    bundle: true,
    sourcemap: true,
    minify: true,
    target: 'es2022',
    external: ['@zenith/*', ...peerDeps],
  };

  // ESM Build
  //
  // Bundling CJS dependencies (e.g. commander) into ESM makes esbuild emit a
  // `require` shim that throws "Dynamic require of X is not supported" at
  // runtime. Recreating a real `require` via createRequire fixes those calls.
  await build({
    ...sharedOptions,
    outfile: join(outDir, 'index.js'),
    format: 'esm',
    ...(platform === 'node'
      ? {
          banner: {
            js: [
              "import { createRequire as __zenithCreateRequire } from 'node:module';",
              'const require = __zenithCreateRequire(import.meta.url);',
            ].join('\n'),
          },
        }
      : {}),
  });

  // CommonJS Build
  //
  // `import.meta` does not exist in CJS; esbuild would replace it with an
  // empty object and warn. Bundler-specific features guarded by
  // `import.meta.hot` (Vite HMR) are inherently ESM-only, so define it as
  // undefined here — the guards then fall through to their non-HMR paths.
  await build({
    ...sharedOptions,
    outfile: join(outDir, 'index.cjs'),
    format: 'cjs',
    define: { 'import.meta': 'undefined' },
  });

  // Type declarations via tsc
  const tsconfigPath = join(pkgPath, 'tsconfig.json');
  if (existsSync(tsconfigPath)) {
    const result = spawnSync('npx', ['tsc', '-p', tsconfigPath, '--declaration', '--emitDeclarationOnly', '--outDir', outDir], {
      stdio: 'pipe',
      shell: true,
    });
    if (result.status !== 0) {
      // Fail loudly. This used to be swallowed, which let type errors and
      // missing .d.ts files ship while the build still reported success.
      const details = [result.stdout?.toString(), result.stderr?.toString()]
        .filter(Boolean)
        .join('\n')
        .trim();
      throw new Error(
        `tsc failed to emit declarations for @zenith/${pkgName}` +
          (details ? `:\n${details}` : ''),
      );
    }
  }

  console.log(`✅ @zenith/${pkgName} built successfully`);
  return true;
}
