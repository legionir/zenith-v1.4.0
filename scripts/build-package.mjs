import { build } from 'esbuild';
import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';
import { existsSync, rmSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'fs';
import { createHash } from 'crypto';
import { join, resolve } from 'path';
import { spawnSync } from 'child_process';
import { conditionTarget, distName, isDualEntry } from './lib/exports-shape.mjs';
import { collectTypeOnlyReexports, restoreTypeOnlyReexports } from './lib/dts-bundle.mjs';

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
const NODE_PLATFORM_PACKAGES = new Set(['cli', 'ssr', 'vite-plugin']);

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
  const pkgJson = existsSync(pkgJsonPath) ? JSON.parse(readFileSync(pkgJsonPath, 'utf8')) : {};
  const peerDeps = Object.keys(pkgJson.peerDependencies ?? {});

  const sharedOptions = {
    entryPoints: [srcPath],
    platform,
    bundle: true,
    sourcemap: true,
    minify: true,
    target: 'es2022',
    external: ['@zenith/*', ...peerDeps],
    define: {
      __ZENITH_PKG_VERSION__: JSON.stringify(pkgJson.version ?? '1.4.0'),
      ...(process.env.NODE_ENV === 'production' ? { __ZENITH_DEV__: 'false' } : {}),
    },
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
  //
  // #141 / DEC-027: new wave-2 packages are born ESM-only (exports map has no
  // `require` condition and `main` is not a `.cjs`). Emitting an orphan
  // `index.cjs` into `dist` would contradict their exports map and ship dead
  // bytes. Skip the CJS build for such packages; existing dual packages keep
  // emitting `.cjs` unchanged.
  const rootExport = pkgJson?.exports?.['.'];
  const declaresCjs = isDualEntry(rootExport) || String(pkgJson?.main ?? '').endsWith('.cjs');
  if (declaresCjs) {
    await build({
      ...sharedOptions,
      outfile: join(outDir, 'index.cjs'),
      format: 'cjs',
      define: {
        ...sharedOptions.define,
        'import.meta': 'undefined',
      },
    });
  }

  // Subpath entry points (#142): packages whose exports map declares `./x`
  // entries pointing at `dist/x.js` get their own esbuild bundle from
  // `src/x.ts`. tsc below emits matching `dist/x.d.ts` (src tree compiles
  // every module). Packages without such subpaths are unaffected.
  const subpaths = Object.entries(pkgJson?.exports ?? {}).filter(
    ([key]) => key.startsWith('./') && key !== './package.json',
  );
  for (const [key, val] of subpaths) {
    const importTarget = conditionTarget(val, 'import');
    if (typeof importTarget !== 'string' || !importTarget.startsWith('./dist/')) continue;
    const name = key.slice(2); // './zod' → 'zod'
    const subEntry = join(pkgPath, 'src', `${name}.ts`);
    if (!existsSync(subEntry)) continue;
    await build({
      ...sharedOptions,
      entryPoints: [subEntry],
      outfile: join(outDir, `${name}.js`),
      format: 'esm',
    });

    // #149: Browser IIFE bundle (window.Zenith) + external sourcemap + SRI
    if (name === 'browser') {
      const iifeOut = join(outDir, 'browser.global.js');
      const workspaceSourcePlugin = {
        name: 'zenith-workspace-src',
        setup(b) {
          b.onResolve({ filter: /^@zenith\// }, (args) => {
            const sub = args.path.slice('@zenith/'.length);
            const parts = sub.split('/');
            const slug = parts[0];
            const rest = parts.slice(1).join('/') || 'index';
            const candidate = resolve('./packages', slug, 'src', `${rest}.ts`);
            if (existsSync(candidate)) {
              return { path: candidate };
            }
            return null;
          });
        },
      };
      await build({
        entryPoints: [subEntry],
        bundle: true,
        outfile: iifeOut,
        format: 'iife',
        globalName: 'Zenith',
        // the IIFE's namespace return would overwrite the global installed by browser.ts
        footer: { js: 'Zenith=Zenith.ZenithBrowser;' },
        platform: 'browser',
        target: 'es2022',
        minify: true,
        sourcemap: 'external',
        plugins: [workspaceSourcePlugin],
      });
      const bytes = readFileSync(iifeOut);
      const sri = 'sha384-' + createHash('sha384').update(bytes).digest('base64');
      writeFileSync(`${iifeOut}.sri`, `${sri}\n`, 'utf8');
    }
  }

  // Type declarations (#74): tsc emits per-module declarations into a scratch dir, then every
  // public entry is bundled into ONE self-contained file with rollup-plugin-dts. Per-module
  // `.d.ts` files import each other without extensions (`./async`), which Node16/NodeNext
  // consumers cannot resolve (arethetypeswrong "InternalResolutionError"). Dual packages also
  // get a byte-identical `.d.cts` so `require` consumers resolve CJS-flavoured types.
  const tsconfigPath = join(pkgPath, 'tsconfig.json');
  if (existsSync(tsconfigPath)) {
    const scratch = join(outDir, '.dts');
    const result = spawnSync(
      'npx',
      [
        'tsc',
        '-p',
        tsconfigPath,
        '--declaration',
        '--declarationMap',
        'false',
        '--emitDeclarationOnly',
        '--outDir',
        scratch,
      ],
      {
        stdio: 'pipe',
        shell: true,
      },
    );
    if (result.status !== 0) {
      // Fail loudly. This used to be swallowed, which let type errors and
      // missing .d.ts files ship while the build still reported success.
      const details = [result.stdout?.toString(), result.stderr?.toString()]
        .filter(Boolean)
        .join('\n')
        .trim();
      throw new Error(
        `tsc failed to emit declarations for @zenith/${pkgName}` + (details ? `:\n${details}` : ''),
      );
    }

    const entries = new Map(); // dist-relative name → needs .d.cts?
    for (const [key, val] of Object.entries(pkgJson?.exports ?? {})) {
      if (key === './package.json') continue;
      const name = distName(conditionTarget(val, 'types'));
      if (name) entries.set(name, isDualEntry(val));
    }
    if (!entries.has('index')) entries.set('index', declaresCjs);
    const typeOnly = collectTypeOnlyReexports(scratch);
    for (const [name, dual] of entries) {
      const input = join(scratch, `${name}.d.ts`);
      if (!existsSync(input)) {
        throw new Error(
          `@zenith/${pkgName}: tsc did not emit ${input} for exports entry "${name}"`,
        );
      }
      const bundle = await rollup({
        input,
        // workspace + third-party + node: imports stay imports; only the package's own files merge
        external: (id) => !id.startsWith('.') && !id.startsWith('/') && !/^[A-Za-z]:[\\/]/.test(id),
        plugins: [dts()],
        onwarn(warning, defaultHandler) {
          if (warning.code === 'UNRESOLVED_IMPORT') return;
          defaultHandler(warning);
        },
      });
      const target = join(outDir, `${name}.d.ts`);
      const { output } = await bundle.generate({ format: 'es' });
      await bundle.close();
      writeFileSync(target, restoreTypeOnlyReexports(output[0].code, typeOnly));
      if (dual) copyFileSync(target, join(outDir, `${name}.d.cts`));
    }
    rmSync(scratch, { recursive: true, force: true });
  }

  console.log(`✅ @zenith/${pkgName} built successfully`);
  return true;
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/'))) {
  const pkg = process.argv[2];
  if (pkg) {
    await buildPackage(pkg);
  }
}
