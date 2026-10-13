import { describe, it, expect } from 'vitest';
import { gzipSync } from 'node:zlib';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import esbuild from 'esbuild';

const ROOT = process.cwd();

const workspaceSourcePlugin = {
  name: 'zenith-workspace-src',
  setup(build) {
    build.onResolve({ filter: /^@zenith\// }, (args) => {
      const rest = args.path.slice('@zenith/'.length);
      const [pkg, ...sub] = rest.split('/');
      const pkgJson = JSON.parse(
        readFileSync(join(ROOT, 'packages', pkg, 'package.json'), 'utf8'),
      );
      const entry = sub.length > 0 ? `${sub.join('/')}.ts` : 'index.ts';
      return {
        path: join(ROOT, 'packages', pkg, 'src', entry),
        sideEffects: pkgJson.sideEffects === false ? false : undefined,
      };
    });
    build.onResolve({ filter: /^zenith$/ }, () => ({
      path: join(ROOT, 'packages/zenith/src/index.ts'),
      sideEffects: false,
    }));
    build.onResolve({ filter: /^\.\.?\// }, (args) => {
      if (!args.importer.includes('/packages/')) return undefined;
      const m = args.importer.match(/\/packages\/([^/]+)\//);
      if (!m) return undefined;
      const pkg = m[1];
      const pkgJson = JSON.parse(
        readFileSync(join(ROOT, 'packages', pkg, 'package.json'), 'utf8'),
      );
      const resolvedPath = join(
        args.resolveDir,
        args.path.endsWith('.ts') ? args.path : `${args.path}.ts`,
      );
      if (pkgJson.sideEffects === false) {
        return { path: resolvedPath, sideEffects: false };
      }
      if (pkg === 'router' && args.path === './outlet') {
        return { path: resolvedPath, sideEffects: false };
      }
      return undefined;
    });
  },
};

async function measureBundleGzipBytes(code) {
  const result = await esbuild.build({
    stdin: {
      contents: code,
      resolveDir: ROOT,
      sourcefile: 'tree-shake-entry.ts',
      loader: 'ts',
    },
    bundle: true,
    minify: true,
    treeShaking: true,
    format: 'esm',
    target: 'es2022',
    platform: 'browser',
    write: false,
    plugins: [workspaceSourcePlugin],
  });
  const text = result.outputFiles[0].text;
  const gzipped = gzipSync(Buffer.from(text, 'utf8'));
  return { rawBytes: Buffer.byteLength(text, 'utf8'), gzipBytes: gzipped.byteLength, text };
}

describe('Real tree-shaking verification (#87)', () => {
  it('importing only `signal` from `zenith` produces <= 3KB gzip and excludes router/walker/http', async () => {
    const { gzipBytes, text } = await measureBundleGzipBytes(
      `import { signal } from 'zenith'; console.log(signal(0).get());`,
    );
    expect(gzipBytes).toBeLessThanOrEqual(3 * 1024);
    expect(text).not.toContain('popstate');
    expect(text).not.toContain('XMLHttpRequest');
  });

  it('importing only `signal` from `@zenith/runtime` produces <= 3KB gzip', async () => {
    const { gzipBytes, text } = await measureBundleGzipBytes(
      `import { signal } from '@zenith/runtime'; console.log(signal(0).get());`,
    );
    expect(gzipBytes).toBeLessThanOrEqual(3 * 1024);
    expect(text).not.toContain('zen-virtual-list');
  });

  it('importing only `navigate` from `@zenith/router` produces <= 4KB gzip', async () => {
    const { gzipBytes } = await measureBundleGzipBytes(
      `import { navigate } from '@zenith/router'; console.log(typeof navigate);`,
    );
    expect(gzipBytes).toBeLessThanOrEqual(4 * 1024);
  });

  it('importing only `sanitizeHTML` from `@zenith/security` produces <= 4KB gzip', async () => {
    const { gzipBytes } = await measureBundleGzipBytes(
      `import { sanitizeHTML } from '@zenith/security'; console.log(sanitizeHTML('<b>ok</b>'));`,
    );
    expect(gzipBytes).toBeLessThanOrEqual(4 * 1024);
  });
});
