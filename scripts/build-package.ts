import { build } from 'bun';
import { existsSync, rmSync } from 'fs';

export async function buildPackage(pkgName: string) {
  const pkgPath = `./packages/${pkgName}`;
  const outDir = `${pkgPath}/dist`;

  if (existsSync(outDir)) rmSync(outDir, { recursive: true });

  console.log(`🔨 Building @zenith/${pkgName}...`);

  // ESM Build
  await build({
    entrypoints: [`${pkgPath}/src/index.ts`],
    outdir: outDir,
    format: 'esm',
    target: 'browser',
    minify: true,
    sourcemap: 'external'
  });

  // CommonJS Build
  await build({
    entrypoints: [`${pkgPath}/src/index.ts`],
    outdir: outDir,
    format: 'cjs',
    target: 'node',
    minify: true,
    sourcemap: 'external'
  });

  // Type Definitions
  await build({
    entrypoints: [`${pkgPath}/src/index.ts`],
    outdir: outDir,
    format: 'esm',
    target: 'types'
  });

  console.log(`✅ @zenith/${pkgName} built successfully`);
}
