import { describe, expect, it } from 'vitest';
import { build, buildSync } from 'esbuild';
import { createHash } from 'node:crypto';
import { statSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { resolve } from 'node:path';
import vm from 'node:vm';

const zenithDir = resolve(__dirname, '..');
const entry = resolve(zenithDir, 'src/index.ts');
const coreEntry = resolve(zenithDir, 'src/core.ts');
const minimalEntry = resolve(zenithDir, 'src/presets/minimal.ts');
const spaEntry = resolve(zenithDir, 'src/presets/spa.ts');
const fullEntry = resolve(zenithDir, 'src/presets/full.ts');
const BUDGET_BYTES = 4 * 1024; // 4 KB gzipped (with @zenith/* external)

describe('zenith size budget & tree-shaking (#149)', () => {
  it('keeps main entry, core, and minimal/spa/full presets under 4 KB gzipped each', () => {
    for (const file of [entry, coreEntry, minimalEntry, spaEntry, fullEntry]) {
      const out = buildSync({
        entryPoints: [file],
        bundle: true,
        format: 'esm',
        target: 'es2022',
        minify: true,
        write: false,
        external: ['@zenith/*'],
      });
      const gz = gzipSync(out.outputFiles[0].contents);
      expect(gz.byteLength).toBeLessThanOrEqual(BUDGET_BYTES);
    }
  });

  it('tree-shakes `import { signal } from "zenith"` to <= 3 KB gzipped and drops unused namespaces', async () => {
    const workspacePlugin = {
      name: 'workspace-src',
      setup(b: any) {
        b.onResolve({ filter: /^zenith$/ }, () => ({
          path: resolve(zenithDir, 'src/index.ts'),
          sideEffects: false,
        }));
        b.onResolve({ filter: /^@zenith\/(errors|scheduler)$/ }, (args: { path: string }) => ({
          path: args.path,
          external: true,
          sideEffects: false,
        }));
        b.onResolve({ filter: /^@zenith\// }, (args: { path: string }) => {
          const rest = args.path.slice('@zenith/'.length);
          const parts = rest.split('/');
          const slug = parts[0];
          const sub = parts.slice(1).join('/') || 'index';
          return {
            path: resolve(zenithDir, '..', slug, 'src', `${sub}.ts`),
            sideEffects: false,
          };
        });
        b.onResolve({ filter: /^\./ }, (args: { path: string; resolveDir: string }) => {
          const base = resolve(args.resolveDir, args.path);
          for (const candidate of [base, `${base}.ts`, resolve(base, 'index.ts')]) {
            try {
              if (statSync(candidate).isFile()) {
                return { path: candidate, sideEffects: false };
              }
            } catch {
              // continue
            }
          }
          return null;
        });
      },
    };

    const res = await build({
      stdin: {
        contents: `import { signal } from 'zenith'; console.log(signal(1).get());`,
        resolveDir: zenithDir,
        loader: 'ts',
      },
      bundle: true,
      minify: true,
      format: 'esm',
      target: 'es2022',
      write: false,
      metafile: true,
      plugins: [workspacePlugin],
    });
    const outBytes = res.outputFiles[0].contents;
    const gzBytes = gzipSync(outBytes).byteLength;
    expect(gzBytes).toBeLessThanOrEqual(3 * 1024);

    // Ensure none of the L2/L3 feature packages were retained in the output
    const inputFiles = Object.keys(Object.values(res.metafile!.outputs)[0].inputs);
    expect(inputFiles.some((f) => f.includes('packages/router/'))).toBe(false);
    expect(inputFiles.some((f) => f.includes('packages/form/'))).toBe(false);
    expect(inputFiles.some((f) => f.includes('packages/runtime-core/'))).toBe(false);
  });

  it('produces a valid IIFE browser bundle (window.Zenith) with sourcemap and SHA-384 SRI', async () => {
    const browserEntry = resolve(zenithDir, 'src/browser.ts');
    const workspacePlugin = {
      name: 'workspace-src',
      setup(b: any) {
        b.onResolve({ filter: /^@zenith\// }, (args: { path: string }) => {
          const rest = args.path.slice('@zenith/'.length);
          const parts = rest.split('/');
          const slug = parts[0];
          const sub = parts.slice(1).join('/') || 'index';
          return {
            path: resolve(zenithDir, '..', slug, 'src', `${sub}.ts`),
          };
        });
      },
    };

    const res = await build({
      entryPoints: [browserEntry],
      bundle: true,
      outfile: resolve(zenithDir, 'dist/browser.global.js'),
      format: 'iife',
      globalName: 'Zenith',
      platform: 'browser',
      target: 'es2022',
      minify: true,
      sourcemap: 'external',
      write: false,
      plugins: [workspacePlugin],
    });

    const jsFile = res.outputFiles.find((f) => f.path.endsWith('browser.global.js'))!;
    const mapFile = res.outputFiles.find((f) => f.path.endsWith('browser.global.js.map'))!;
    expect(jsFile).toBeDefined();
    expect(mapFile).toBeDefined();

    const sri = 'sha384-' + createHash('sha384').update(jsFile.contents).digest('base64');
    expect(sri).toMatch(/^sha384-[A-Za-z0-9+/=]+$/);

    // Execute the IIFE in an isolated VM context and verify window.Zenith works
    const sandbox: Record<string, any> = {
      window: { location: { pathname: '/', search: '', hash: '' } },
      structuredClone,
    };
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(jsFile.text, sandbox);

    expect(typeof sandbox.Zenith.createApp).toBe('function');
    expect(typeof sandbox.Zenith.signal).toBe('function');
    const s = sandbox.Zenith.signal(42);
    expect(s.get()).toBe(42);
  });
});
