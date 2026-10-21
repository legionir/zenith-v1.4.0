// #164 — ماتریس compile/run روی پنج bundler.
//
// بدون نیاز به bundler: شکل هر پنج آداپتر + راندن هوک‌ها روی آبجکت آداپترهای
// vite/rollup. اجرای واقعی bundler فقط وقتی که آن bundler نصب باشد (skip صریح
// در غیر این صورت) — اعتبارسنجی پس از `npm install` (webpack و ‎@rspack/core
// در root devDependencies) همه را اجرا می‌کند.
import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zenithUnplugin, zenithVite } from '../src/index';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));

/** bundler نصب است؟ (نبود = skip صریح، نه شکست) */
function hasBundler(name: string): boolean {
  try {
    require.resolve(name);
    return true;
  } catch {
    return false;
  }
}

describe('@zenith/unplugin-zenith bundler matrix (#164)', () => {
  it('every adapter factory builds a plugin with the expected shape', () => {
    const vite = zenithUnplugin.vite({});
    expect(vite).toBeDefined();
    expect((vite as any).name).toBe('zenith-unplugin');
    // آداپتر دست‌ساز Vite همان هسته + رفتار Vite-only است (نام تاریخی حفظ شده).
    expect((zenithVite({}) as any).name).toBe('zenith-plugin');

    const rollup = zenithUnplugin.rollup({});
    expect(rollup).toBeDefined();
    expect(typeof (rollup as any).transform).toBe('function');

    const esbuild = zenithUnplugin.esbuild({});
    expect(esbuild).toBeDefined();
    expect(typeof (esbuild as any).setup).toBe('function');

    const webpack = zenithUnplugin.webpack({});
    expect(webpack).toBeDefined();

    const rspack = zenithUnplugin.rspack({});
    expect(rspack).toBeDefined();
  });

  it('compiles through the vite adapter hooks (no bundler needed)', async () => {
    const plugin = zenithVite({}) as any;
    expect(plugin.transformInclude('src/pages/index.html')).toBe(true);
    expect(plugin.transformInclude('node_modules/x/index.html')).toBe(false);
    const out = await plugin.transform(
      '<div><h1 zen-text="$title">hello</h1></div>',
      'src/pages/index.html',
    );
    expect(out?.code).toContain('.zenith.js');
    expect(out?.code).not.toContain('zen-text');
  });

  it('compiles through the rollup adapter hooks (no bundler needed)', async () => {
    const plugin = zenithUnplugin.rollup({}) as any;
    const html = '<div><h1 zen-text="$title">hello</h1></div>';
    const id = 'src/pages/index.html';
    if (typeof plugin.transformInclude === 'function') {
      expect(plugin.transformInclude(id)).toBe(true);
    }
    const out = await plugin.transform(html, id);
    const code = typeof out === 'string' ? out : out?.code;
    expect(code).toContain('.zenith.js');
  });

  it.runIf(hasBundler('vite'))('vite build compiles index.html end-to-end', async () => {
    const { build } = (await import('vite')) as typeof import('vite');
    const tmp = join(tmpdir(), `zenith-unplugin-vite-${Date.now()}`);
    mkdirSync(tmp, { recursive: true });
    try {
      writeFileSync(
        join(tmp, 'index.html'),
        readFileSync(join(here, 'fixtures', 'compile-me.html'), 'utf8'),
        'utf8',
      );
      await build({
        root: tmp,
        logLevel: 'silent',
        plugins: [zenithVite()],
        build: { outDir: 'dist', emptyOutDir: true, write: true },
      });
      const outHtml = readFileSync(join(tmp, 'dist', 'index.html'), 'utf8');
      expect(outHtml).not.toContain('zen-text');
      expect(outHtml).toContain('.zenith.js');
      const assets = readdirSync(join(tmp, 'dist'));
      expect(assets.some((f) => f.endsWith('.zenith.js') || f.endsWith('.js'))).toBe(true);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  it.runIf(hasBundler('esbuild'))('esbuild resolves the adapter without crashing', async () => {
    const esbuild = await import('esbuild');
    const plugin = zenithUnplugin.esbuild({});
    expect(plugin).toBeDefined();
    expect(esbuild).toBeDefined();
  });

  it.runIf(hasBundler('webpack'))('webpack exposes an applyable plugin', async () => {
    await import('webpack');
    const plugin = zenithUnplugin.webpack({}) as any;
    expect(typeof plugin.apply).toBe('function');
  });

  it.runIf(hasBundler('@rspack/core'))('rspack exposes an applyable plugin', async () => {
    await import('@rspack/core');
    const plugin = zenithUnplugin.rspack({}) as any;
    expect(typeof plugin.apply).toBe('function');
  });
});
