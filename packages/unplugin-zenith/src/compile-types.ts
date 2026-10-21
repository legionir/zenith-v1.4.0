// packages/unplugin-zenith/src/compile-types.ts
import { s, defineOptions } from '@zenith/schema';

/**
 * گزینه‌های compile در پلاگین Vite (#50: نام یکتای `VitePluginCompileOptions`).
 */
export interface VitePluginCompileOptions {
  /**
   * آیا compile در build time فعال باشد؟
   * پیش‌فرض: true در build، false در dev (در dev از runtime walker استفاده می‌شود).
   */
  enabled?: boolean;

  /**
   * مسیرهای که باید compile شوند (به‌صورت glob).
   * پیش‌فرض: همه‌ی فایل‌های `.html` در root و pages/.
   */
  include?: string[];

  /**
   * مسیرهای که نباید compile شوند.
   */
  exclude?: string[];

  /**
   * آیا خطاهای warning در build به error تبدیل شوند؟
   */
  strict?: boolean;
}

/**
 * @deprecated از `VitePluginCompileOptions` استفاده کنید (#50: رفع ابهام با `CompilerOptions`).
 */
export type CompileOptions = VitePluginCompileOptions;

/**
 * #52 — Schema و پیش‌فرض‌های فریزشده برای `CompileOptions`.
 */
export const compileOptions = defineOptions<Required<CompileOptions>>(
  'CompileOptions',
  s.object({
    enabled: s.default(s.boolean(), true),
    include: s.default(s.array(s.string({ min: 1 })), ['**/*.html']),
    exclude: s.default(s.array(s.string({ min: 1 })), ['node_modules/**']),
    strict: s.default(s.boolean(), false),
  }),
);

export const COMPILE_OPTIONS_DEFAULTS = compileOptions.DEFAULTS;
export const compileOptionsSchema = compileOptions.schema;
export const resolveCompileOptions = (opts?: unknown): Required<CompileOptions> =>
  compileOptions.resolve(opts);

/**
 * نقشه‌ی خط‌به‌خط خروجی HTML به HTML ورودی (#110).
 *
 * transform فقط attributeها را در همان خط جایگزین می‌کند و یک خط `<script>`
 * تزریق می‌کند؛ پس نگاشت line-preserving کافی و صادقانه است (خط تزریقی
 * نگاشت ندارد). بدون وابستگی (VLQ دستی) تا L0/tooling سبک بماند.
 * @public
 */
export interface HtmlSourceMap {
  version: 3;
  sources: [string];
  sourcesContent: [string];
  names: [];
  mappings: string;
}

/**
 * نتیجه‌ی transform یک فایل HTML.
 */
export interface TransformResult {
  /** HTML تغییر یافته (بدون directiveها، با script tag اضافه‌شده). */
  html: string;
  /** نقشه‌ی خط‌به‌خط `html` به ورودی (#110؛ همیشه حاضر وقتی `html` برگردد). */
  map: HtmlSourceMap | null;
  /** کد JavaScript تولیدشده (یا null اگر فایل directive نداشت). */
  js: string | null;
  /** نام ماژول برای import. */
  moduleName: string;
  /** تعداد directiveهای compile‌شده. */
  directiveCount: number;
  /** گزارش‌های warning. */
  warnings: string[];
}
