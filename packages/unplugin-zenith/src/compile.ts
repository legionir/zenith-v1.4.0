// packages/unplugin-zenith/src/compile.ts
//
// Compiler Integration برای Vite Plugin — Production Readiness #13
//
// این ماژول قابلیت compile-time HTML transformation را برای Vite فراهم می‌کند.
//
// ── هدف ──
//   در Build Time (نه Runtime)، فایل‌های HTML را parse می‌کند،
//   directiveهای Zenith را شناسایی می‌کند و آن‌ها را به:
//     1) Static HTML (بدون directiveها)
//     2) JavaScript module (با Effectهای آماده‌ی اجرا)
//   تبدیل می‌کند.
//
//   مزایا:
//     - حذف هزینه‌ی DOM Walking در Runtime (مخصوصاً در صفحات بزرگ)
//     - Tree-shaking بهتر (فقط directiveهای استفاده‌شده در bundle می‌آیند)
//     - Early error detection (خطاهای سینتکس در build گزارش می‌شوند)
//     - کوچک‌ترین bundle size برای production
//
// ── نحوه کار ──
//   ورودی: index.html با directiveهای zenith
//   خروجی: index.html (بدون directiveها) + index.zenith.js (با render function)
//
//   در HTML نهایی، یک script tag به فایل JS اضافه می‌شود که آن را
//   load کرده و render function را روی document body اجرا می‌کند.

export type {
  VitePluginCompileOptions,
  CompileOptions,
  TransformResult,
} from './compile-types';
export {
  compileOptions,
  COMPILE_OPTIONS_DEFAULTS,
  compileOptionsSchema,
  resolveCompileOptions,
} from './compile-types';
export {
  clearCompileCache,
  getCompileCacheStats,
  hasZenithDirectives,
  getModuleName,
} from './compile-scan';
export { transformHtml } from './compile-transform';
export { analyzeHtml } from './compile-analyze';
