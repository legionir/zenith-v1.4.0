// #164 — سطح پنج آداپتر، برابری facade، گارد portable، رفتار هسته.
import { describe, it, expect } from 'vitest';
import { ZenithError } from '@zenith/errors';
import {
  zenithUnplugin,
  zenithVite,
  zenithRollup,
  zenithWebpack,
  zenithEsbuild,
  zenithRspack,
  PLUGIN_VERSION,
  assertPortableOptions,
  createCoreHooks,
  resolveUnpluginOptions,
  transformHtml,
  UNPLUGIN_OPTIONS_DEFAULTS,
} from '../src/index';
import * as vitePluginFacade from '@zenith/vite-plugin';

function catchError(fn: () => unknown): ZenithError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(ZenithError);
    return err as ZenithError;
  }
  throw new Error('Expected function to throw ZenithError');
}

describe('@zenith/unplugin-zenith adapters (#164)', () => {
  it('exposes one instance with all five bundler adapters', () => {
    for (const name of ['vite', 'rollup', 'webpack', 'esbuild', 'rspack'] as const) {
      expect(typeof (zenithUnplugin as any)[name]).toBe('function');
    }
    expect(zenithRollup).toBe(zenithUnplugin.rollup);
    expect(zenithWebpack).toBe(zenithUnplugin.webpack);
    expect(zenithEsbuild).toBe(zenithUnplugin.esbuild);
    expect(zenithRspack).toBe(zenithUnplugin.rspack);
    expect(zenithVite).toBeDefined();
    expect(typeof zenithVite).toBe('function');
  });

  it('keeps the @zenith/vite-plugin facade identical (no behavior change)', () => {
    expect(vitePluginFacade.zenithPlugin).toBe(zenithVite);
    expect(vitePluginFacade.default).toBe(zenithVite);
    expect(vitePluginFacade.PLUGIN_VERSION).toBe(PLUGIN_VERSION);
    expect(vitePluginFacade.zenithPluginOptions).toBeDefined();
    expect(vitePluginFacade.ZENITH_PLUGIN_OPTIONS_DEFAULTS).toBe(UNPLUGIN_OPTIONS_DEFAULTS);
    expect(vitePluginFacade.resolveZenithPluginOptions()).toEqual(resolveUnpluginOptions());
  });

  it('rejects explicit Vite-only options on other bundlers with catalogued codes', () => {
    // غایب/پیش‌فرض = portable (همان config همه‌جا build می‌شود).
    expect(() => assertPortableOptions(undefined, 'rollup')).not.toThrow();
    expect(() => assertPortableOptions({}, 'webpack')).not.toThrow();
    expect(() => assertPortableOptions({ enableHtmlHMR: false }, 'vite')).not.toThrow();
    expect(() =>
      assertPortableOptions({ watchPatterns: ['pages/**'] }, 'vite'),
    ).not.toThrow();

    const watchErr = catchError(() =>
      assertPortableOptions({ watchPatterns: ['pages/**'] }, 'rollup'),
    );
    expect(watchErr.code).toBe('ZEN-2520');

    const devtoolsErr = catchError(() =>
      assertPortableOptions({ autoInjectDevtools: true }, 'esbuild'),
    );
    expect(devtoolsErr.code).toBe('ZEN-2520');

    const hmrErr = catchError(() =>
      assertPortableOptions({ enableHtmlHMR: false }, 'rspack'),
    );
    expect(hmrErr.code).toBe('ZEN-2521');
  });
});

describe('@zenith/unplugin-zenith core hooks (#164)', () => {
  it('matches include/exclude and compiles directives with per-build metadata', async () => {
    const { hooks } = createCoreHooks();
    expect(hooks.transformInclude('src/pages/index.html')).toBe(true);
    expect(hooks.transformInclude('node_modules/foo/index.html')).toBe(false);

    const html = `<div><h1 zen-text="$title"></h1></div>`;
    const out = await hooks.transform(html, 'src/pages/index.html');
    expect(out).toBeDefined();
    expect(typeof out!.code).toBe('string');

    const meta = hooks.getMeta();
    expect(meta.length).toBe(1);
    expect(meta[0]!.file).toBe('src/pages/index.html');
    expect(typeof meta[0]!.moduleName).toBe('string');
    expect(meta[0]!.directiveCount).toBeGreaterThan(0);

    const plain = await hooks.transform('<div>hello</div>', 'src/pages/plain.html');
    expect(plain).toBeUndefined();
    expect(hooks.getMeta().length).toBe(1);
  });

  it('resets virtual modules and metadata on buildStart', async () => {
    const { hooks } = createCoreHooks();
    const html = `<div><h1 zen-text="$title"></h1></div>`;
    await hooks.transform(html, 'src/pages/a.html');
    expect(hooks.getMeta().length).toBe(1);
    hooks.buildStart();
    expect(hooks.getMeta().length).toBe(0);
    expect(hooks.resolveId('a.zenith.js')).toBeNull();
  });

  it('emits a line-preserving sourcemap for compiled HTML (#110)', async () => {
    const { hooks } = createCoreHooks();
    const html = `<html>\n<body>\n<h1 zen-text="$title">x</h1>\n<p>hi</p>\n</body>\n</html>`;
    const out = await hooks.transform(html, 'src/pages/index.html');
    expect(out).toBeDefined();
    const map = out!.map;
    expect(map).not.toBeNull();
    expect(map!.version).toBe(3);
    expect(map!.sources).toEqual(['src/pages/index.html']);
    expect(map!.sourcesContent).toEqual([html]);
    expect(map!.names).toEqual([]);
    // mappings decode: one entry per generated line; every line maps to the
    // same original line except the single injected script-tag line.
    const genLines = out!.code.split('\n');
    const mapLines = map!.mappings.split(';');
    expect(mapLines.length).toBe(genLines.length);
    const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const vlqDecode = (s: string): number[] => {
      const nums: number[] = [];
      let value = 0;
      let shift = 0;
      for (const ch of s) {
        const digit = B64.indexOf(ch);
        value |= (digit & 31) << shift;
        if (digit & 32) shift += 5;
        else {
          nums.push(value & 1 ? -(value >> 1) : value >> 1);
          value = 0;
          shift = 0;
        }
      }
      return nums;
    };
    let srcLine = 0;
    let unmapped = 0;
    mapLines.forEach((line, i) => {
      if (line === '') {
        unmapped += 1;
        expect(genLines[i]).toContain('<script');
        return;
      }
      const [genCol, src, lineDelta, srcCol] = vlqDecode(line);
      expect(genCol).toBe(0);
      expect(src).toBe(0);
      expect(srcCol).toBe(0);
      srcLine += lineDelta!;
      expect(srcLine).toBe(i - unmapped);
    });
    expect(unmapped).toBe(1);
  });

  it('forwards stateTypes to the compiler: strict breaks, lax warns (#111)', async () => {
    const html = `<div zen-text="$bogus"></div>`;
    // legacy: سکوت (بدون stateTypes هیچ ZEN-502 نیست).
    const legacy = await transformHtml(html, 'src/pages/a.html');
    expect(legacy.warnings.filter((w) => w.includes('ZEN-502'))).toEqual([]);
    expect(legacy.js).not.toBeNull();
    // strict + stateTypes: شکست build با ZEN-502.
    await expect(
      transformHtml(html, 'src/pages/b.html', { strict: true, stateTypes: { title: 'string' } }),
    ).rejects.toThrow(/ZEN-502/);
    // غیر strict + stateTypes: warning ولی build موفق.
    const lax = await transformHtml(html, 'src/pages/c.html', { stateTypes: { title: 'string' } });
    expect(lax.js).not.toBeNull();
    expect(lax.warnings.some((w) => w.includes('ZEN-502') && w.includes('$bogus'))).toBe(true);
    // schema تمیز: بدون یافته.
    const clean = await transformHtml('<div zen-text="$title"></div>', 'src/pages/d.html', {
      strict: true,
      stateTypes: { title: 'string' },
    });
    expect(clean.warnings.filter((w) => w.includes('ZEN-502'))).toEqual([]);
  });
});
