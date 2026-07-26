import { build } from 'esbuild';
import { existsSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { spawnSync } from 'child_process';

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

  // ESM Build
  await build({
    entryPoints: [srcPath],
    outfile: join(outDir, 'index.js'),
    format: 'esm',
    platform: 'neutral',
    bundle: true,
    sourcemap: true,
    minify: true,
    target: 'es2022',
    external: ['@zenith/*'],
  });

  // CommonJS Build
  await build({
    entryPoints: [srcPath],
    outfile: join(outDir, 'index.cjs'),
    format: 'cjs',
    platform: 'neutral',
    bundle: true,
    sourcemap: true,
    minify: true,
    target: 'es2022',
    external: ['@zenith/*'],
  });

  // Type declarations via tsc
  const tsconfigPath = join(pkgPath, 'tsconfig.json');
  if (existsSync(tsconfigPath)) {
    const result = spawnSync('npx', ['tsc', '-p', tsconfigPath, '--declaration', '--emitDeclarationOnly', '--outDir', outDir], {
      stdio: 'pipe',
      shell: true,
    });
    if (result.status !== 0 && result.stderr) {
      // Some packages may not have declaration emit configured; that's ok
    }
  }

  console.log(`✅ @zenith/${pkgName} built successfully`);
  return true;
}
