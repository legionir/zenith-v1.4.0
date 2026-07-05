// packages/ssr/src/render.ts
//
// SSR (Server-Side Rendering) — Stabilized (Phase 6).
//
// FEATURE (v1.0.0): Thread Safety با AsyncLocalStorage.
// هر درخواست SSR DOM مستقل خود را دارد. globalThis دیگر mutate نمی‌شود —
// به‌جای آن، getters روی globalThis نصب شده‌اند که از AsyncLocalStorage
// (به‌ازای هر async context) می‌خوانند. این کار از race condition در SSR
// concurrent (مثلاً ۱۰۰ درخواست همزمان) جلوگیری می‌کند.
//
// Route Safety: از runWithRoute() استفاده می‌کند تا routeSignal در هر
// درخواست SSR ایزوله باشد. این از race condition بین درخواست‌های concurrent
// جلوگیری می‌کند (قبلاً route صفحه‌ی B می‌توانست روی صفحه‌ی A overwrite شود).
//
// Hydration: export `renderToStream` برای streaming + `hydrate` واقعی.
//
// محدودیت: zen-fetch در SSR پشتیبانی نمی‌شود — داده باید از قبل آماده باشد.
import { flushSync } from '@zenith/scheduler';
import { inlineServerComponents } from './server-component.js';
// FEATURE (v1.0.0): کتابخانه‌ی خطاها برای پیام‌های بهبودیافته.
import { ssrEnvironmentError } from '@zenith/errors';
// FEATURE (v1.0.0): AsyncLocalStorage برای isolation per-request.
// به‌جای patch کردن globalThis، globals در یک async-context store ذخیره
// می‌شوند و globalThis.document و سایر globals به‌عنوان getter تعریف
// می‌شوند که از store فعلی می‌خوانند. این کار از race condition در SSR
// concurrent جلوگیری می‌کند.
import { domAls } from './dom-context.js';
// SEC FIX (v1.2.6): SEC-A1 — safeScriptValue helper + isRouteSafe guard.
// Escapes characters that are dangerous when JSON is embedded in <script>:
//   `<` → `\u003c` (prevents `</script>` injection that closes the tag)
//   `>` → `\u003e` (defense-in-depth for `<!--`-style sequences)
//   U+2028 / U+2029 → line/paragraph separators (valid in JSON, fatal in JS string literals)
// Applied to BOTH state AND route before emitting them inside <script>...</script>.
export function safeScriptValue(jsonString) {
    return jsonString
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
}
// SEC FIX (v1.2.6): SEC-A1 — validate that a route string cannot break out of
// the surrounding <script> tag. We reject any route containing `</` (which is
// the only sequence that can terminate a script element from inside a JS string
// literal after JSON.stringify has done its job). Returning false here lets the
// caller drop the route entirely rather than emit an unsafe value.
export function isRouteSafe(route) {
    if (route == null)
        return true;
    return !route.includes('</');
}
// ── AsyncLocalStorage for thread-safe DOM isolation ──
/**
 * FEATURE (v1.0.0): Thread-safe render با AsyncLocalStorage.
 *
 * DOM globals در یک AsyncLocalStorage store به‌ازای هر درخواست ذخیره
 * می‌شوند (به‌جای mutate کردن globalThis). globalThis getters (که در
 * `dom-context.ts` نصب شده‌اند) از store فعلی می‌خوانند. این کار از
 * race condition در SSR concurrent (مثلاً ۱۰۰ درخواست همزمان) جلوگیری
 * می‌کند: globalThis دیگر بین درخواست‌ها share و overwrite نمی‌شود.
 *
 * Bug Fix: routeSignal نیز با runWithRoute() ایزوله می‌شود.
 * قبلاً routeSignal یک singleton ماژول-level بود و در SSR concurrent
 * باعث race condition می‌شد. حالا هر درخواست context مستقل خود را دارد.
 */
export async function renderToString(html, state, options = {}) {
    // FEATURE (v0.4.0): pre-pass برای inline کردن Server Components.
    // این کار قبل از JSDOM انجام می‌شود چون Server Components مستقل از
    // walker هستند و فقط HTML تولید می‌کنند. state برای resolve کردن
    // propهای $key.path پاس داده می‌شود.
    //
    // نکته: این pre-pass قبل از ساخت JSDOM و setup کردن AsyncLocalStorage
    // است تا در صورت خطا، DOM سرور آلوده نشود.
    html = await inlineServerComponents(html, state);
    let JSDOM;
    try {
        JSDOM = (await import('jsdom')).JSDOM;
    }
    catch {
        // FEATURE (v1.0.0): پیام خطای بهبودیافته با تشخیص محیط.
        throw ssrEnvironmentError('jsdom-missing');
    }
    // Pre-import all modules BEFORE entering synchronous section.
    // This eliminates await gaps inside the critical section.
    const { Zen } = await import('@zenith/runtime');
    let runWithRoute = null;
    if (options.route) {
        try {
            const routerMod = await import('@zenith/router');
            runWithRoute = routerMod.runWithRoute;
        }
        catch { }
    }
    const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
        pretendToBeVisual: true,
        url: options.route ? `http://localhost${options.route}` : 'http://localhost/',
    });
    // FEATURE (v1.0.0): ساخت DOM globals از JSDOM برای این درخواست.
    // این آبجکت در AsyncLocalStorage ذخیره می‌شود و globalThis getters
    // (که در dom-context.ts نصب شده‌اند) از آن می‌خوانند. هر درخواست
    // concurrent globals مستقل خود را دارد — globalThis دیگر mutate نمی‌شود.
    const domGlobals = {
        window: dom.window,
        document: dom.window.document,
        Node: dom.window.Node,
        HTMLElement: dom.window.HTMLElement,
        Element: dom.window.Element,
        Event: dom.window.Event,
        history: dom.window.history,
        location: dom.window.location,
        DOMParser: dom.window.DOMParser,
        MouseEvent: dom.window.MouseEvent,
        KeyboardEvent: dom.window.KeyboardEvent,
    };
    // ── Inner render function (synchronous) ──
    // این تابع داخل runWithRoute (اگر route مشخص شده) اجرا می‌شود.
    const doRender = () => {
        const root = dom.window.document.body.firstElementChild;
        if (!root)
            throw new Error('[Zenith SSR] No root element found.');
        Zen.start(root, state);
        flushSync(); // synchronous — no await gap
        const resultHtml = root.outerHTML;
        let stateJson = '';
        if (options.serializeState !== false) {
            const s = {};
            for (const k in state) {
                s[k] = state[k] && typeof state[k].get === 'function' ? state[k].get() : state[k];
            }
            // SEC FIX (v1.2.6): SEC-A1 — use safeScriptValue for BOTH state AND route.
            stateJson = safeScriptValue(JSON.stringify(s));
            // SEC FIX (v1.2.6): SEC-A1 — reject routes containing `</` at the source.
            if (!isRouteSafe(options.route)) {
                throw new Error('[Zenith SSR] Refusing to render: route contains `</` which could break out of the hydration script.');
            }
        }
        Zen.stop(root);
        return { html: resultHtml, state: stateJson, route: options.route };
    };
    // FEATURE (v1.0.0): اجرای doRender داخل AsyncLocalStorage.
    // این کار DOM globals را برای این درخواست ایزوله می‌کند. globalThis
    // دیگر mutate نمی‌شود — به‌جای آن، getters (که در dom-context نصب
    // شده‌اند) از store فعلی می‌خوانند. concurrent درخواست‌ها کاملاً ایزوله‌اند.
    try {
        // اگر route مشخص شده، داخل runWithRoute اجرا کن تا routeSignal ایزوله باشد.
        // در غیر این صورت، مستقیماً اجرا کن.
        if (runWithRoute && options.route) {
            // runWithRoute یک async function است، اما doRender sync است.
            // domAls.run داخل callback آن فراخوانی می‌شود تا store برای duration
            // doRender تنظیم شود. AsyncLocalStorage از طریق await های داخل
            // runWithRoute propagate می‌شود.
            return await runWithRoute(options.route, async () => {
                return domAls.run(domGlobals, () => doRender());
            });
        }
        return domAls.run(domGlobals, () => doRender());
    }
    finally {
        // FEATURE (v1.0.0): فقط JSDOM را ببند — globalThis را restore نکن.
        // چون globalThis دیگر mutate نشده، نیازی به restore نیست. هر درخواست
        // AsyncLocalStorage store مستقل خود را داشت که با خروج از domAls.run
        // به‌صورت خودکار پاک می‌شود.
        dom.window.close();
    }
}
export function generateHydrationScript(result, nonce) {
    const nonceAttr = nonce ? ` nonce="${nonce}"` : '';
    // SEC FIX (v1.2.6): SEC-A1 — apply safeScriptValue to BOTH state AND route,
    // and reject unsafe routes (containing `</`) before emitting them.
    const safeState = safeScriptValue(result.state || '');
    let routePart = '';
    if (result.route) {
        if (!isRouteSafe(result.route)) {
            console.error('[Zenith SSR] Refusing to embed unsafe route (contains `</`) in hydration script.');
        }
        else {
            routePart = `window.__ZENITH_ROUTE__=${safeScriptValue(JSON.stringify(result.route))};`;
        }
    }
    return `<script${nonceAttr}>window.__ZENITH_STATE__=${safeState};${routePart}</script>`;
}
export function generateFullPage(result, head = '', nonce) {
    return `<!DOCTYPE html><html><head><meta charset="UTF-8">${head}${generateHydrationScript(result, nonce)}</head><body>${result.html}</body></html>`;
}
/**
 * Stream SSR: HTML را به chunks تقسیم می‌کند.
 *
 * 1. Head + opening tags فوراً stream می‌شوند.
 * 2. State script در head قرار می‌گیرد.
 * 3. Body content بعد از render stream می‌شود.
 * 4. Closing tags آخرین chunk هستند.
 *
 * استفاده:
 *   const stream = renderToStream(html, state, { route: '/' });
 *   for await (const chunk of stream) {
 *     res.write(chunk.html);
 *   }
 *   res.end();
 */
export async function* renderToStream(html, state, options = {}) {
    const head = options.head || '';
    // BUG-8 FIX (v1.2.2): قبلاً placeholder در head chunk emit می‌شد و سپس
    // تلاش می‌شد در result.html (که فقط body است) replace شود. جایگزینی
    // هرگز اتفاق نمی‌افتاد. راه‌حل: state را قبل از yield محاسبه کن و مستقیماً
    // در head قرار بده.
    // SEC FIX (v1.2.6): SEC-A1 — use safeScriptValue (escapes <, >, U+2028, U+2029)
    // for state AND route; reject routes containing `</`.
    const stateJson = JSON.stringify(Object.fromEntries(Object.entries(state).map(([k, v]) => [k, v && typeof v.get === 'function' ? v.get() : v])));
    const safeStateJson = safeScriptValue(stateJson);
    let routeLiteral = 'null';
    if (options.route) {
        if (!isRouteSafe(options.route)) {
            console.error('[Zenith SSR] renderToStream: refusing to embed unsafe route (contains `</`).');
        }
        else {
            routeLiteral = safeScriptValue(JSON.stringify(options.route));
        }
    }
    // Phase 1: Head + opening — فوراً stream کن (با state واقعی، بدون placeholder).
    yield {
        html: `<!DOCTYPE html><html><head><meta charset="UTF-8">${head}<script>window.__ZENITH_STATE__=${safeStateJson};window.__ZENITH_ROUTE__=${routeLiteral};</script></head><body><div id="app">`,
        done: false,
    };
    // Phase 2: Render content.
    const result = await renderToString(html, state, { route: options.route, serializeState: false });
    // Stream body content (state already injected via head chunk).
    yield { html: result.html, done: false };
    // Phase 3: Closing tags.
    yield { html: '</div></body></html>', done: true };
}
//# sourceMappingURL=render.js.map