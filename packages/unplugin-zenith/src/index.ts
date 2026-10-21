// packages/unplugin-zenith/src/index.ts — ورودی اصلی (`@zenith/unplugin-zenith`)
//
// هستهٔ portable، نمونهٔ یکتا و هر پنج آداپتر از همین‌جا هم قابل importاند؛
// زیرمسیرهای `@zenith/unplugin-zenith/<vite|rollup|webpack|esbuild|rspack>`
// برای ایزولاسیون اندازه/وابستگیِ هر bundler باقی می‌مانند.
/** @public */
export {
  type ZenithUnpluginOptions,
  unpluginOptions,
  DEFAULTS as UNPLUGIN_OPTIONS_DEFAULTS,
  unpluginOptionsSchema,
  resolveUnpluginOptions,
  assertPortableOptions,
  type ZenithMetaRecord,
  type CoreHooks,
  createCoreHooks,
} from './shared';
/** @public */
export {
  type VitePluginCompileOptions,
  type CompileOptions,
  type HtmlSourceMap,
  type TransformResult,
  compileOptions,
  COMPILE_OPTIONS_DEFAULTS,
  compileOptionsSchema,
  resolveCompileOptions,
} from './compile-types';
/** @public */
export { clearCompileCache, getCompileCacheStats, hasZenithDirectives, getModuleName } from './compile-scan';
/** @public */
export { transformHtml } from './compile-transform';
/** @public */
export { analyzeHtml } from './compile-analyze';
/** @public */
export { globToRegex } from './plugin-glob';
/** @public */
export { zenithUnplugin, default as unplugin } from './unplugin';
/** @public */
export { zenithVite, PLUGIN_VERSION, default as zenithViteDefault } from './vite';
/** @public */
export { zenithRollup, default as zenithRollupDefault } from './rollup';
/** @public */
export { zenithWebpack, default as zenithWebpackDefault } from './webpack';
/** @public */
export { zenithEsbuild, default as zenithEsbuildDefault } from './esbuild';
/** @public */
export { zenithRspack, default as zenithRspackDefault } from './rspack';
