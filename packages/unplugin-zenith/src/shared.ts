/**
 * Shared unplugin core (#164): one options object, one hook implementation,
 * one per-build metadata collector for all five bundlers.
 *
 * Vite-only development behavior (HMR tags, DevTools injection,
 * `handleHotUpdate`) stays in `./vite.ts`; everything here is portable.
 *
 * @packageDocumentation
 */
import { writeFileSync } from 'node:fs';
import { createReservedError } from '@zenith/errors';
import { logger } from '@zenith/logger';
import { defineOptions, s } from '@zenith/schema';
import { compileOptions, type CompileOptions, type HtmlSourceMap } from './compile-types';
import type { TemplateStateTypes } from '@zenith/compiler';
import { hasZenithDirectives, transformHtml } from './compile';
import { globToRegex } from './plugin-glob';

/** @public Unified plugin options for every bundler adapter. */
export interface ZenithUnpluginOptions {
  /**
   * Globs compiled by the shared transform.
   * @default every `.html` file (`**` + `/*.html`)
   */
  readonly include?: readonly string[];
  /**
   * Globs never compiled.
   * @default ['node_modules/**']
   */
  readonly exclude?: readonly string[];
  /**
   * Turn compile warnings into errors.
   * @default false
   */
  readonly strict?: boolean;
  /**
   * Nested compile options (kept for `@zenith/vite-plugin` parity).
   */
  readonly compile?: CompileOptions;
  /**
   * Emit a per-build JSON manifest of compiled modules (`meta: true` writes
   * `./zenith-meta.json`; `{ file }` overrides the path). Disabled by default.
   * @default false
   */
  readonly meta?: boolean | { readonly file?: string };
  /**
   * Vite dev HMR watch globs. Vite-only (see `assertPortableOptions`).
   * @default []
   */
  readonly watchPatterns?: readonly string[];
  /**
   * Vite dev DevTools injection. Vite-only.
   * @default true
   */
  readonly autoInjectDevtools?: boolean;
  /**
   * Vite dev HTML HMR. Vite-only.
   * @default true
   */
  readonly enableHtmlHMR?: boolean;
}

/**
 * #52-style schema and frozen defaults for `ZenithUnpluginOptions`.
 *
 * @public
 */
export const unpluginOptions = defineOptions<Required<ZenithUnpluginOptions>>(
  'ZenithUnpluginOptions',
  s.object({
    include: s.default(s.array(s.string({ min: 1 })), ['**/*.html']),
    exclude: s.default(s.array(s.string({ min: 1 })), ['node_modules/**']),
    strict: s.default(s.boolean(), false),
    compile: s.default(compileOptions.schema, {
      enabled: true,
      include: ['**/*.html'],
      exclude: ['node_modules/**'],
      strict: false,
    }),
    meta: s.default(s.union([s.boolean(), s.object({ file: s.optional(s.string({ min: 1 })) })]), false),
    watchPatterns: s.default(s.array(s.string({ min: 1 })), []),
    autoInjectDevtools: s.default(s.boolean(), true),
    enableHtmlHMR: s.default(s.boolean(), true),
  }),
);

/** @public */
export const DEFAULTS = unpluginOptions.DEFAULTS;

/** @public */
export const unpluginOptionsSchema = unpluginOptions.schema;

/** @public */
export function resolveUnpluginOptions(opts?: unknown): Required<ZenithUnpluginOptions> {
  return unpluginOptions.resolve(opts);
}

/**
 * Reject explicitly-requested Vite-only development behavior on other
 * bundlers with the catalogued codes (`ZEN-2520` unsupported bundler,
 * `ZEN-2521` incompatible HMR). Absent keys (defaults) stay portable so the
 * same config builds everywhere.
 *
 * @public
 */
export function assertPortableOptions(
  raw: ZenithUnpluginOptions | undefined,
  bundler: string,
): void {
  if (bundler === 'vite' || raw === undefined) return;
  if (raw.watchPatterns !== undefined && raw.watchPatterns.length > 0) {
    throw createReservedError('ZEN-2520', { details: { bundler, option: 'watchPatterns' } });
  }
  if (raw.autoInjectDevtools !== undefined) {
    throw createReservedError('ZEN-2520', { details: { bundler, option: 'autoInjectDevtools' } });
  }
  if (raw.enableHtmlHMR !== undefined) {
    throw createReservedError('ZEN-2521', { details: { bundler, option: 'enableHtmlHMR' } });
  }
}

/** @public One compiled module in the per-build manifest. */
export interface ZenithMetaRecord {
  /** Source file as seen by the bundler. */
  readonly file: string;
  /** Virtual module name served for the compiled JS. */
  readonly moduleName: string;
  /** Number of compiled directives. */
  readonly directiveCount: number;
  /** Compile warnings (empty unless `strict` turned them fatal elsewhere). */
  readonly warnings: readonly string[];
}

/** @public Portable hook implementation plus metadata access. */
export interface CoreHooks {
  transformInclude(id: string): boolean;
  transform(code: string, id: string): Promise<{ code: string; map: HtmlSourceMap | null } | undefined>;
  resolveId(source: string): string | null;
  load(id: string): string | null;
  buildStart(): void;
  buildEnd(): void;
  getMeta(): readonly ZenithMetaRecord[];
}

/**
 * Build the portable hook implementation over the shared compile core.
 * State (virtual modules, metadata) is per-instance and reset on `buildStart`.
 *
 * @public
 */
export function createCoreHooks(raw?: unknown): {
  options: Required<ZenithUnpluginOptions>;
  hooks: CoreHooks;
} {
  const options = resolveUnpluginOptions(raw);
  const include = options.include.map((pattern) => globToRegex(pattern));
  const exclude = options.exclude.map((pattern) => globToRegex(pattern));
  const pendingModules = new Map<string, string>();
  const meta: ZenithMetaRecord[] = [];
  let compileCount = 0;

  const matches = (id: string): boolean =>
    include.some((regex) => regex.test(id)) && !exclude.some((regex) => regex.test(id));

  const hooks: CoreHooks = {
    transformInclude(id: string): boolean {
      return matches(id);
    },
    async transform(code: string, id: string): Promise<{ code: string; map: HtmlSourceMap | null } | undefined> {
      // #111 — `stateTypes` (بیرون از schema منجمد) در runtime با spread می‌آید؛
      // تایپ‌اش را اینجا می‌بینیم تا به transformHtml برسد (تایپ سطح پلاگین در فاز validation).
      const compile = options.compile as
        | { enabled?: boolean; strict?: boolean; stateTypes?: TemplateStateTypes }
        | undefined;
      const enabled = compile?.enabled !== false;
      if (!enabled || !hasZenithDirectives(code)) return undefined;
      let result;
      try {
        result = await transformHtml(code, id, {
          ...(compile ?? {}),
          enabled: true,
          strict: options.strict || (compile?.strict ?? false),
        });
      } catch (error) {
        logger.error(`[Zenith Compile] Failed to compile: ${(error as Error).message}`);
        if (options.strict || compile?.strict) throw error;
        return undefined;
      }
      for (const warning of result.warnings) {
        logger.warn(`[Zenith Compile] ${warning}`);
      }
      meta.push({
        file: id,
        moduleName: result.moduleName,
        directiveCount: result.directiveCount,
        warnings: result.warnings,
      });
      if (result.js) {
        pendingModules.set(result.moduleName, result.js);
        compileCount++;
        return { code: result.html, map: result.map };
      }
      return undefined;
    },
    resolveId(source: string): string | null {
      if (source.endsWith('.zenith.js') && pendingModules.has(source.replace(/^\//, ''))) {
        return `\0${source}`;
      }
      return null;
    },
    load(id: string): string | null {
      if (id.startsWith('\0') && id.endsWith('.zenith.js')) {
        const moduleName = id.slice(1).replace(/^\//, '');
        // #110: virtual JS modules are served map-less for now — their
        // line mappings must come from the compiler (`compiled.code`), not
        // the plugin. The HTML transform above always carries a map.
        return pendingModules.get(moduleName) ?? null;
      }
      return null;
    },
    buildStart(): void {
      pendingModules.clear();
      meta.length = 0;
      compileCount = 0;
    },
    buildEnd(): void {
      if (compileCount > 0) {
        logger.debug(`[Zenith] Compiled ${compileCount} file(s).`);
      }
      const metaOption = options.meta as boolean | { file?: string } | undefined;
      if (metaOption === undefined || metaOption === false) return;
      const file =
        typeof metaOption === 'object' && metaOption.file ? metaOption.file : './zenith-meta.json';
      try {
        writeFileSync(file, JSON.stringify({ version: 1, modules: meta }, null, 2) + '\n', 'utf8');
      } catch (error) {
        logger.error(`[Zenith] Failed to write build metadata: ${(error as Error).message}`);
      }
    },
    getMeta(): readonly ZenithMetaRecord[] {
      return meta;
    },
  };
  return { options, hooks };
}
