// packages/unplugin-zenith/src/vite.ts — آداپتر Vite زنیت (#164)
//
// هوک‌های portable (`transform`/`resolveId`/`load`/`buildStart`/`buildEnd`) از
// همان `createCoreHooks` در `./shared` می‌آیند و همان نمونه بین همهٔ هوک‌ها
// مشترک است؛ رفتار Vite-only این‌جاست و جای دیگری تکرار نمی‌شود:
//   1) compileٔ `index.html` در build از مسیر `transformIndexHtml` (Vite فایل
//      ورودی HTML را از هوک `transform` عبور نمی‌دهد، پس دوگانه-compile رخ
//      نمی‌دهد)؛ همان `hooks.transform` صدا زده می‌شود تا warning/meta/
//      virtual-module دقیقاً یکی بماند.
//   2) تزریق HMR client و DevTools در Development.
//   3) `handleHotUpdate` (شامل companion-file برای `.ts/.js`) و `configureServer`.
import fs from 'node:fs';
import { createRequire } from 'node:module';
import type { Plugin, ViteDevServer, ResolvedConfig } from 'vite';
import { logger } from '@zenith/logger';
import { createCoreHooks, type ZenithUnpluginOptions } from './shared';
import { globToRegex } from './plugin-glob';

/**
 * ساخت پلاگین Vite برای Zenith.
 *
 * استفاده:
 *   // vite.config.ts
 *   import { defineConfig } from 'vite';
 *   import { zenithVite } from '@zenith/unplugin-zenith/vite';
 *
 *   export default defineConfig({
 *     plugins: [zenithVite()],
 *   });
 *
 * سازگاری: `@zenith/vite-plugin` همین تابع را با نام `zenithPlugin` صادر
 * می‌کند (facade؛ بدون تغییر رفتار).
 *
 * @public
 * @param options گزینه‌های یکپارچهٔ پلاگین (کلیدهای Vite-only روی bundlerهای
 * دیگر با `ZEN-2520`/`ZEN-2521` رد می‌شوند).
 * @returns Plugin object برای Vite.
 */
export function zenithVite(options: ZenithUnpluginOptions = {}): Plugin {
  // اعتبارسنجی در مرز ورودی (#52)؛ پیش‌فرض‌های فریزشده اعمال می‌شود.
  const { options: resolved, hooks } = createCoreHooks(options);
  const { autoInjectDevtools, enableHtmlHMR, watchPatterns } = resolved;

  // متغیرهای state که در hooks تنظیم می‌شوند
  let isBuild = false;
  let devtoolsModulePath: string | null = null;

  // تبدیل watchPatterns از glob به regex؛ پیش‌فرض به pages/ و components/
  // محدود است تا HMR ناخواسته روی node_modules یا build output انجام نشود.
  const watchRegexes =
    watchPatterns.length > 0
      ? watchPatterns.map((p) => globToRegex(p))
      : [/\/pages\/.*\.html$/, /\/components\/.*\.html$/];

  return {
    name: 'zenith-plugin',
    enforce: 'pre', // قبل از پلاگین‌های دیگر اجرا شود.

    // ── هوک‌های portable روی همان نمونهٔ shared ──
    transformInclude(id) {
      return hooks.transformInclude(id);
    },
    async transform(code, id) {
      return hooks.transform(code, id);
    },
    resolveId(source) {
      return hooks.resolveId(source);
    },
    load(id) {
      return hooks.load(id);
    },

    // ── تنظیم build mode از config Vite ──
    // به‌جای `ctx.hasOwnProperty('bundle')` که ناپایدار است، از
    // `config.command` استفاده می‌کنیم؛ NODE_ENV=production نباید serve را
    // build کند.
    configResolved(config: ResolvedConfig) {
      isBuild = config.command === 'build';

      // ذخیره مسیر واقعی DevTools برای تزریق در Development؛ از require
      // واقعی (نه bare `require` که در ESM تعریف‌نشده است) استفاده می‌کنیم تا
      // در pnpm و monorepoها هم کار کند.
      try {
        const require = createRequire(import.meta.url);
        devtoolsModulePath = require.resolve('@zenith/devtools/dist/index.js', {
          paths: [config.root, process.cwd()],
        });
      } catch {
        // fallback: از مسیر نسبی استفاده کن
        devtoolsModulePath = 'node_modules/@zenith/devtools/dist/index.js';
      }
    },

    // ── پاکسازی در شروع هر build ──
    // در `build --watch` و build‌های مکرر از نشت حافظه جلوگیری می‌کند.
    buildStart() {
      hooks.buildStart();
    },

    // ── گزارش/متا در پایان build ──
    buildEnd(error?: Error) {
      if (error) {
        logger.error(`[Zenith] Build failed: ${error.message}`);
      }
      hooks.buildEnd();
    },

    // ── تزریق اسکریپت HMR و DevTools در HTML ──
    transformIndexHtml: {
      // The compiled <script type="module"> must enter Vite's HTML pipeline
      // before Vite resolves/bundles module scripts (default order is too late).
      order: 'pre',
      async handler(html, ctx) {
        // در build: compile از همان هستهٔ shared (warning/meta/virtual-module
        // یکی می‌ماند). `hooks.transform` خودش enabled/directive/strict را
        // اعمال می‌کند؛ `index.html` از هوک `transform` رد نمی‌شود پس تکراری نیست.
        if (isBuild) {
          const out = await hooks.transform(html, 'index.html');
          if (out) return out.code;
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
          const importPath = `/@fs/${devtoolsModulePath.replace(/\\/g, '/')}`;
          tags.push({
            tag: 'script',
            attrs: { type: 'module' },
            children: `
            // Auto-injected by @zenith/unplugin-zenith/vite
            import { initDevTools } from '${importPath}';
            initDevTools();
            logger.debug('[Zenith] DevTools auto-injected by Vite plugin.');
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
            // Auto-injected by @zenith/unplugin-zenith/vite
            import { logger } from '@zenith/logger';
            if (import.meta.hot) {
              import.meta.hot.on('zenith:html-update', (data) => {
                logger.debug('[Zenith HMR] HTML updated:', data.path);
                // فریم‌ورک را وادار به پیمایش مجدد DOM می‌کند.
                if (window.__ZENITH_RELOAD__) {
                  window.__ZENITH_RELOAD__(data.path);
                } else {
                  logger.warn('[Zenith HMR] __ZENITH_RELOAD__ not found. Full reload.');
                  window.location.reload();
                }
              });
              logger.debug('[Zenith] HMR client installed.');
            }
          `,
            injectTo: 'head',
          });
        }

        return { html, tags };
      },
    },

    // ── رصد تغییرات فایل‌های HTML برای HMR ──
    handleHotUpdate(ctx) {
      // اگر enableHtmlHMR=false، [] برگردان تا Vite full reload انجام ندهد
      // (= رفتار مورد انتظار کاربر).
      if (!enableHtmlHMR) return [];

      const { file, server } = ctx;

      // Companion file HMR: وقتی یک فایل .ts/.js تغییر می‌کند، companion
      // .html آن را پیدا کن و یک رویداد HMR برای آن ارسال کن.
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
      const matches = watchRegexes.some((regex) => regex.test(file));
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
        logger.debug('[Zenith] Dev server connected. HMR active.');
      });
    },
  };
}

/**
 * نسخه‌ی پلاگین (هم‌گام با نسخهٔ پکیج).
 * @public
 */
export const PLUGIN_VERSION = '1.5.0';

// ── default export ──
export default zenithVite;
