// packages/vite-plugin/src/index.ts
//
// Vite Plugin برای Zenith — فاز ۱۰.
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
import { transformHtml, hasZenithDirectives, } from './compile.js';
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
export function zenithPlugin(options = {}) {
    const { autoInjectDevtools = true, enableHtmlHMR = true, watchPatterns, compile = {}, } = options;
    // اگر watchPatterns تعریف شده، آن‌ها را به regex تبدیل می‌کنیم.
    // پیش‌فرض: همه‌ی فایل‌های `.html`.
    const watchRegexes = watchPatterns && watchPatterns.length > 0
        ? watchPatterns.map(p => new RegExp(p))
        : [/\.html$/];
    return {
        name: 'zenith-plugin',
        enforce: 'pre', // قبل از پلاگین‌های دیگر اجرا شود.
        // ── تزریق اسکریپت HMR و DevTools در HTML ──
        async transformIndexHtml(html, ctx) {
            // در Production Build: اگر compile فعال است، HTML را compile کن.
            const isBuild = ctx.hasOwnProperty('bundle') || !ctx.server;
            const compileEnabled = compile.enabled !== false;
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
                        return result.html;
                    }
                }
                catch (e) {
                    console.error(`[Zenith Compile] ❌ Failed to compile: ${e.message}`);
                    if (compile.strict) {
                        throw e;
                    }
                }
            }
            // در Development: HMR و DevTools را تزریق کن.
            if (!ctx.server)
                return html;
            const tags = [];
            // ── تزریق DevTools ──
            if (autoInjectDevtools) {
                tags.push({
                    tag: 'script',
                    attrs: { type: 'module' },
                    children: `
            // Auto-injected by @zenith/vite-plugin
            import { initDevTools } from '/@fs/${getDevtoolsPath()}';
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
            if (!enableHtmlHMR)
                return;
            const { file, server } = ctx;
            // بررسی اینکه آیا فایل با یکی از watchPatterns منطبق است.
            const matches = watchRegexes.some(regex => regex.test(file));
            if (!matches)
                return;
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
        configureServer(server) {
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
 * نکته: این Map در هر build پاک می‌شود (buildStart).
 */
const pendingModules = new Map();
/**
 * مسیر فایل DevTools برای import در browser.
 *
 * نکته: در Vite، می‌توان از `/@fs/` برای import فایل‌های خارج از root
 * استفاده کرد. اما برای سادگی، ما یک path نسبی به پکیج devtools برمی‌گردانیم.
 *
 * در عمل، کاربر باید `@zenith/devtools` را در پروژه خود نصب داشته باشد.
 */
function getDevtoolsPath() {
    // در عمل، این مسیر باید به build واقعی پکیج devtools اشاره کند.
    // برای سادگی، یک placeholder برمی‌گردانیم.
    // در پروژه‌ی کاربر، این به node_modules/@zenith/devtools/dist/index.js اشاره می‌کند.
    return 'node_modules/@zenith/devtools/dist/index.js';
}
/**
 * نسخه‌ی پلاگین.
 */
export const PLUGIN_VERSION = '0.1.0';
// ── default export ──
export default zenithPlugin;
//# sourceMappingURL=index.js.map