import type { Plugin } from 'vite';
import { type CompileOptions } from './compile';
/**
 * گزینه‌های پلاگین Zenith.
 */
export interface ZenithPluginOptions {
    /**
     * مسیرهای که باید برای HMR رصد شوند (به‌صورت glob یا regex).
     * پیش‌فرض: فایل‌های `.html` در همه‌ی مسیرها.
     */
    watchPatterns?: string[];
    /**
     * آیا DevTools به‌صورت خودکار در Development تزریق شود؟
     * پیش‌فرض: true.
     */
    autoInjectDevtools?: boolean;
    /**
     * آیا HMR برای HTML فعال باشد؟
     * پیش‌فرض: true.
     */
    enableHtmlHMR?: boolean;
    /**
     * گزینه‌های compile-time HTML transformation.
     * در production build فعال می‌شود تا directiveها به JS compile شوند.
     *
     * مثال:
     *   zenithPlugin({
     *     compile: { enabled: true, strict: true }
     *   })
     */
    compile?: CompileOptions;
}
/**
 * ساخت پلاگین Vite برای Zenith.
 *
 * استفاده:
 *   // vite.config.ts
 *   import { defineConfig } from 'vite';
 *   import { zenithPlugin } from '@zenith/vite-plugin';
 *
 *   export default defineConfig({
 *     plugins: [zenithPlugin()],
 *   });
 *
 * @param options گزینه‌های پلاگین.
 * @returns Plugin object برای Vite.
 */
export declare function zenithPlugin(options?: ZenithPluginOptions): Plugin;
/**
 * نسخه‌ی پلاگین.
 */
export declare const PLUGIN_VERSION = "0.1.0";
export default zenithPlugin;
//# sourceMappingURL=index.d.ts.map