// packages/vite-plugin/src/index.ts — facade روی @zenith/unplugin-zenith (#164)
//
// کل پیاده‌سازی (هستهٔ compile + آداپتر Vite با HMR/DevTools) به
// `@zenith/unplugin-zenith` منتقل شد؛ این ورودی فقط نام‌های قدیمی را با همان
// رفتار صادر می‌کند. بدون warning جعلی deprecation (تصمیم در changeset #164).
//
// تفاوت‌های آگاهانه نسبت به 1.4.0 (ثبت‌شده در changeset):
//   - DEFAULTS/resolve حالا superset یکپارچه‌اند (کلیدهای include/exclude/
//     strict/meta اضافه شده؛ هر config قدیمی بدون تغییر معتبر است).
//   - PLUGIN_VERSION هم‌گام با @zenith/unplugin-zenith است (1.5.0).
/** @public */
export {
  transformHtml,
  hasZenithDirectives,
  clearCompileCache,
  getCompileCacheStats,
  compileOptions,
  COMPILE_OPTIONS_DEFAULTS,
  compileOptionsSchema,
  resolveCompileOptions,
  type VitePluginCompileOptions,
  type CompileOptions,
} from '@zenith/unplugin-zenith';
/** @public */
export type { ZenithUnpluginOptions as ZenithPluginOptions } from '@zenith/unplugin-zenith';
/** @public */
export {
  unpluginOptions as zenithPluginOptions,
  UNPLUGIN_OPTIONS_DEFAULTS as ZENITH_PLUGIN_OPTIONS_DEFAULTS,
  unpluginOptionsSchema as zenithPluginOptionsSchema,
  resolveUnpluginOptions as resolveZenithPluginOptions,
} from '@zenith/unplugin-zenith';
/** @public */
export { zenithVite as zenithPlugin, PLUGIN_VERSION, default } from '@zenith/unplugin-zenith/vite';
