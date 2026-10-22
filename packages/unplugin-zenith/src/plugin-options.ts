// packages/unplugin-zenith/src/plugin-options.ts
import { s, defineOptions } from '@zenith/schema';
import { compileOptions, type CompileOptions } from './compile-types';

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
 * #52 — Schema و پیش‌فرض‌های فریزشده برای `ZenithPluginOptions`.
 */
export const zenithPluginOptions = defineOptions<ZenithPluginOptions>(
  'ZenithPluginOptions',
  s.object({
    watchPatterns: s.default(s.array(s.string({ min: 1 })), []),
    autoInjectDevtools: s.default(s.boolean(), true),
    enableHtmlHMR: s.default(s.boolean(), true),
    compile: s.default(compileOptions.schema, {
      enabled: true,
      include: ['**/*.html'],
      exclude: ['node_modules/**'],
      strict: false,
    }),
  }),
);

export const ZENITH_PLUGIN_OPTIONS_DEFAULTS = zenithPluginOptions.DEFAULTS;
export const zenithPluginOptionsSchema = zenithPluginOptions.schema;
export const resolveZenithPluginOptions = (opts?: unknown): ZenithPluginOptions =>
  zenithPluginOptions.resolve(opts);
