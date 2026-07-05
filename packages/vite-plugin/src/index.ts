// packages/vite-plugin/src/index.ts
//
// Vite Plugin برای Zenith — فاز ۱۰+.
//
// این پلاگین دو قابلیت اصلی فراهم می‌کند:
//   1) HMR (Hot Module Replacement) برای فایل‌های HTML:
//      وقتی یک فایل HTML تغییر می‌کند (مثلاً یک کامپوننت یا صفحه)،
//      به‌جای رفرش کامل صفحه، یک رویداد HMR به مرورگر ارسال می‌شود.
//      فریم‌ورک سپس DOM را به‌صورت انتخابی پاکسازی و reload می‌کند.
//
//   2) Auto-inject DevTools در Development:
//      در حالت Development، یک اسکریپت به HTML اضافه می‌کند که
//      DevTools Hook را به‌صورت خودکار نصب می‌کند.
//
// ── نکات طراحی ──
//
// 1) Non-Intrusive:
//    این پلاگین فقط در Development فعال است. در Production build،
//    هیچ کاری انجام نمی‌دهد (no-op).
//
// 2) Selective HMR:
//    فقط فایل‌های HTML که در مسیرهای مشخص‌شده هستند (مثل /pages/ یا
//    /components/) را رصد می‌کند. این از HMR های ناخواسته جلوگیری می‌کند.
//
// 3) Custom Event:
//    به‌جای استفاده از `full-reload`، یک custom event `zenith:html-update`
//    ارسال می‌کند. فریم‌ورک سپس تصمیم می‌گیرد چه چیزی reload شود.

import fs from 'node:fs';
import type { Plugin, ViteDevServer, ResolvedConfig } from 'vite';
import {
  transformHtml,
  hasZenithDirectives,
  type CompileOptions,
} from './compile';

/**
 * تبدیل یک glob pattern ساده به RegExp.
 * از `**` (recursive), `*` (single-segment), `?` (single char) پشتیبانی می‌کند.
 * برای watchPatterns استفاده می‌شود تا کاربر بتواند از glob pattern استفاده کند.
 */
function globToRegex(pattern: string): RegExp {
  let escaped = '';
  for (let i = 0; i < pattern.length; i++) {
    const ch = pattern.charAt(i);
    if (ch === '*' && pattern.charAt(i + 1) === '*') {
      // ** → مسیر بازگشتی
      escaped += '.*';
      i++; // کاراکتر دوم * را رد کن
      // اسلش بعدی اختیاری است
      if (pattern.charAt(i + 1) === '/' || pattern.charAt(i + 1) === '\\') i++;
    } else if (ch === '*') {
      // * → هر مقدار به جز جداکننده مسیر
      escaped += '[^/\\\\]*';
    } else if (ch === '?') {
      escaped += '[^/\\\\]';
    } else if (/[.+^${}()|[\]\\]/.test(ch)) {
      escaped += '\\' + ch;
    } else {
      escaped += ch;
    }
  }
  return new RegExp(escaped);
}

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
export function zenithPlugin(options: ZenithPluginOptions = {}): Plugin {
  const {
    autoInjectDevtools = true,
    enableHtmlHMR = true,
    watchPatterns,
    compile = {},
  } = options;

  // متغیرهای state که در hooks تنظیم می‌شوند
  let isBuild = false;
  let devtoolsModulePath: string | null = null;
  let compileCount = 0;

  // تبدیل watchPatterns از glob به regex
  // FIX (B-2): از globToRegex استفاده می‌کنیم تا کاربر بتواند از الگوهای glob
  // استاندارد مثل "pages/**/*.html" استفاده کند.
  // IMPROVEMENT (I-8): پیش‌فرض watchPatterns به pages/ و components/ محدود شده
  // تا HMR ناخواسته روی node_modules یا build output انجام نشود.
  const watchRegexes = watchPatterns && watchPatterns.length > 0
    ? watchPatterns.map(p => globToRegex(p))
    : [/\/pages\/.*\.html$/, /\/components\/.*\.html$/];

  return {
    name: 'zenith-plugin',
    enforce: 'pre',  // قبل از پلاگین‌های دیگر اجرا شود.

    // ── تنظیم build mode از config Vite ──
    // FIX (B-1): به‌جای ctx.hasOwnProperty('bundle') که ناپایدار است،
    // از config.isProduction استفاده می‌کنیم که Vite به‌صورت رسمی پشتیبانی می‌کند.
    configResolved(config: ResolvedConfig) {
      isBuild = config.isProduction || config.command === 'build';

      // ذخیره مسیر واقعی DevTools برای تزریق در Development
      // FIX (B-6): از Vite resolve API استفاده می‌کنیم.
      try {
        const resolved = require.resolve('@zenith/devtools/dist/index.js', {
          paths: [config.root, process.cwd()],
        });
        devtoolsModulePath = resolved;
      } catch {
        // fallback: از مسیر نسبی استفاده کن
        devtoolsModulePath = 'node_modules/@zenith/devtools/dist/index.js';
      }
    },

    // ── پاکسازی pendingModules در شروع هر build ──
    // FIX (B-3): buildStart hook اضافه شد تا pendingModules در build --watch
    // و build‌های مکرر پاک شود و از نشت حافظه جلوگیری کند.
    buildStart() {
      pendingModules.clear();
      compileCount = 0;
    },

    // ── پاکسازی و گزارش در پایان build ──
    // IMPROVEMENT (I-3): buildEnd hook برای cleanup و چاپ آمار compile-time.
    buildEnd(error?: Error) {
      if (error) {
        console.error(`[Zenith] Build failed: ${error.message}`);
      } else if (compileCount > 0) {
        console.log(`[Zenith] Compiled ${compileCount} file(s).`);
      }
      pendingModules.clear();
    },

    // ── تزریق اسکریپت HMR و DevTools در HTML ──
    async transformIndexHtml(html, ctx) {
      const compileEnabled = compile.enabled !== false;

      // FIX (B-1): از متغیر isBuild تنظیم‌شده در configResolved استفاده کن.
      if (isBuild && compileEnabled && hasZenithDirectives(html)) {
        try {
          const result = await transformHtml(html, 'index.html', {
            ...compile,
            enabled: true,
          });

          // چاپ warningها
          if (result.warnings.length > 0) {
            for (const w of result.warnings) {
              console.warn(`[Zenith Compile] ⚠️  ${w}`);
            }
          }

          // در Production، HTML transform شده را برمی‌گردانیم.
          // فایل JS به‌صورت virtual module در hook `load` پردازش می‌شود.
          if (result.js) {
            // ثبت JS برای پردازش بعدی در resolveId/load
            pendingModules.set(result.moduleName, result.js);
            compileCount++;
            return result.html;
          }
        } catch (e) {
          console.error(`[Zenith Compile] ❌ Failed to compile: ${(e as Error).message}`);
          if (compile.strict) {
            throw e;
          }
        }
      }

      // در Development: HMR و DevTools را تزریق کن.
      if (!ctx.server) return html;

      const tags: Array<{
        tag: string;
        attrs?: Record<string, string>;
        children?: string;
        injectTo?: 'head' | 'body' | 'head-prepend' | 'body-prepend';
      }> = [];

      // ── تزریق DevTools ──
      if (autoInjectDevtools && devtoolsModulePath) {
        // FIX (B-6): از مسیر واقعی DevTools (resolve شده) استفاده می‌کنیم
        // تا در pnpm و monorepoها هم کار کند.
        const importPath = `/@fs/${devtoolsModulePath.replace(/\\/g, '/')}`;
        tags.push({
          tag: 'script',
          attrs: { type: 'module' },
          children: `
            // Auto-injected by @zenith/vite-plugin
            import { initDevTools } from '${importPath}';
            initDevTools();
            console.log('[Zenith] DevTools auto-injected by Vite plugin.');
          `,
          injectTo: 'head',
        });
      }

      // ── تزریق HMR client ──
      if (enableHtmlHMR) {
        tags.push({
          tag: 'script',
          attrs: { type: 'module' },
          children: `
            // Auto-injected by @zenith/vite-plugin
            if (import.meta.hot) {
              import.meta.hot.on('zenith:html-update', (data) => {
                console.log('[Zenith HMR] HTML updated:', data.path);
                // فریم‌ورک را وادار به پیمایش مجدد DOM می‌کند.
                if (window.__ZENITH_RELOAD__) {
                  window.__ZENITH_RELOAD__(data.path);
                } else {
                  console.warn('[Zenith HMR] __ZENITH_RELOAD__ not found. Full reload.');
                  window.location.reload();
                }
              });
              console.log('[Zenith] HMR client installed.');
            }
          `,
          injectTo: 'head',
        });
      }

      return { html, tags };
    },

    // ── resolveId برای virtual modules ──
    // وقتی HTML به یک فایل .zenith.js reference می‌دهد، آن را به‌عنوان virtual
    // module شناسایی می‌کنیم تا در load آن را از pendingModules برگردانیم.
    resolveId(source) {
      if (source.endsWith('.zenith.js') && pendingModules.has(source.replace(/^\//, ''))) {
        return `\0${source}`;
      }
      return null;
    },

    // ── load برای virtual modules ──
    load(id) {
      if (id.startsWith('\0') && id.endsWith('.zenith.js')) {
        const moduleName = id.slice(1).replace(/^\//, '');
        const code = pendingModules.get(moduleName);
        if (code) {
          return code;
        }
      }
      return null;
    },

    // ── رصد تغییرات فایل‌های HTML برای HMR ──
    handleHotUpdate(ctx) {
      // FIX (B-7): اگر enableHtmlHMR=false، [] برگردان تا Vite
      // full reload انجام ندهد (= رفتار مورد انتظار کاربر).
      if (!enableHtmlHMR) return [];

      const { file, server } = ctx;

      // IMPROVEMENT (I-5): Companion file HMR.
      // وقتی یک فایل .ts/.js تغییر می‌کند، companion .html آن را پیدا کن
      // و یک رویداد HMR برای آن ارسال کن.
      if (file.endsWith('.ts') || file.endsWith('.js')) {
        const htmlMatch = file.replace(/\.(ts|js)$/, '.html');
        if (fs.existsSync(htmlMatch)) {
          server.ws.send({
            type: 'custom',
            event: 'zenith:html-update',
            data: {
              path: htmlMatch,
              timestamp: Date.now(),
            },
          });
        }
        return [];
      }

      // بررسی اینکه آیا فایل با یکی از watchPatterns منطبق است.
      const matches = watchRegexes.some(regex => regex.test(file));
      if (!matches) return [];

      // ارسال رویداد custom به مرورگر.
      server.ws.send({
        type: 'custom',
        event: 'zenith:html-update',
        data: {
          path: file,
          timestamp: Date.now(),
        },
      });

      // جلوگیری از رفرش کامل صفحه توسط Vite.
      // با برگرداندن []، Vite هیچ ماژولی را reload نمی‌کند.
      return [];
    },

    // ── در زمان شروع dev server، یک پیام چاپ کن ──
    configureServer(server: ViteDevServer) {
      server.ws.on('connection', () => {
        console.log('[Zenith] Dev server connected. HMR active.');
      });
    },
  };
}

/**
 * Map از ماژول‌های virtual که در transformIndexHtml تولید شده‌اند.
 * در load() از این Map خوانده می‌شود.
 *
 * کلید: نام ماژول (مثل "index.zenith.js")
 * مقدار: کد JavaScript تولیدشده.
 *
 * نکته: این Map در buildStart و buildEnd پاک می‌شود.
 */
const pendingModules: Map<string, string> = new Map();

/**
 * نسخه‌ی پلاگین.
 */
export const PLUGIN_VERSION = '1.3.0';

// ── default export ──
export default zenithPlugin;
