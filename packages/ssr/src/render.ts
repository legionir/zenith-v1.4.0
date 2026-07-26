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
import { inlineServerComponents } from './server-component';
// FEATURE (v1.0.0): کتابخانه‌ی خطاها برای پیام‌های بهبودیافته.
import { ssrEnvironmentError } from '@zenith/errors';
// FEATURE (v1.0.0): AsyncLocalStorage برای isolation per-request.
// به‌جای patch کردن globalThis، globals در یک async-context store ذخیره
// می‌شوند و globalThis.document و سایر globals به‌عنوان getter تعریف
// می‌شوند که از store فعلی می‌خوانند. این کار از race condition در SSR
// concurrent جلوگیری می‌کند.
import { domAls, type DOMGlobals } from './dom-context';
// BUG-22 FIX (v1.2.2): setEffectContextStore برای per-request isolation
// از activeEffect/activeCleanupRegistration. قبلاً این متغیرها به‌صورت
// module-level در signal.ts ذخیره می‌شدند و بین درخواست‌های concurrent
// share می‌شدند — race condition. حالا SSR یک provider تنظیم می‌کند که
// در هر call، EffectContext مخصوص همان async context را برمی‌گرداند.
import { setEffectContextStore, type EffectContext } from '@zenith/state';

/**
 * Serialize state for server-to-client transfer.
 * Strips functions and other non-serializable values.
 */
export function serializeState(state: Record<string, any>): string {
  return JSON.stringify(state, (_, value) => {
    if (typeof value === 'function') return undefined;
    return value;
  });
}

/**
 * Inject serialized state into HTML output.
 */
export function injectState(html: string, state: string): string {
  const script = `<script id="zenith-state" type="application/json">${state}</script>`;
  return html.replace('</head>', `${script}</head>`);
}

/**
 * Validate hydration consistency between client and server state.
 */
export function validateHydration(clientState: any, serverState: any): boolean {
  return JSON.stringify(clientState) === JSON.stringify(serverState);
}

export interface SSRResult { html: string; state: string; route?: string; }

// SEC FIX (v1.2.6): SEC-A1 — safeScriptValue helper.
// Escapes characters that are dangerous when JSON is embedded in <script>:
//   `<` → `\u003c` (prevents `</script>` injection that closes the tag)
//   `>` → `\u003e` (defense-in-depth for `<!--`-style sequences)
//   U+2028 / U+2029 → line/paragraph separators (valid in JSON, fatal in JS string literals)
// Applied to BOTH state AND route before emitting them inside <script>...</script>.
export function safeScriptValue(jsonString: string): string {
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
export function isRouteSafe(route: string | undefined | null): boolean {
  if (route == null) return true;
  return !route.includes('</');
}

// ── AsyncLocalStorage for thread-safe DOM isolation ──

/**
 * BUG-22 FIX (v1.2.2): provider function برای EffectContext. در هر call،
 * EffectContext مخصوص async context فعلی (via domAls) را برمی‌گرداند.
 * اگر خارج از domAls.run() فراخوانی شود (مثلاً در client-side)، null
 * برمی‌گرداند و signal.ts به fallback ماژول-level برمی‌گردد.
 *
 * effectContext روی domGlobals به‌صورت lazy ذخیره می‌شود (اولین call آن
 * را می‌سازد، callهای بعدی همان را برمی‌گرداند) تا بین effectهای یک درخواست
 * state به اشتراک گذاشته شود اما بین درخواست‌ها ایزوله بماند.
 */
let _effectContextStoreInstalled = false;
function setEffectContextStoreOnce(): void {
  if (_effectContextStoreInstalled) return;
  _effectContextStoreInstalled = true;
  setEffectContextStore((): EffectContext | null => {
    const store = domAls.getStore() as (DOMGlobals & { effectContext?: EffectContext }) | undefined;
    if (!store) return null;
    if (!store.effectContext) {
      store.effectContext = {
        activeEffect: null,
        activeCleanupRegistration: null,
      };
    }
    return store.effectContext;
  });
}

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
export async function renderToString(
  html: string,
  state: Record<string, any>,
  options: { route?: string; serializeState?: boolean } = {},
): Promise<SSRResult> {
  // BUG-22 FIX (v1.2.2): setEffectContextStore را با یک provider تنظیم کن که
  // در هر call، EffectContext مخصوص async context فعلی (via domAls) را
  // برمی‌گرداند. این کار از race condition در SSR concurrent جلوگیری می‌کند.
  // Provider یک‌بار به‌صورت سراسری تنظیم می‌شود (بدون وابستگی به request خاص)
  // اما چون domAls.getStore() در هر call بر اساس async context فعلی عمل می‌کند،
  // هر درخواست EffectContext مستقل خود را دریافت می‌کند.
  // نکته: این setEffectContextStore فقط یک‌بار global تنظیم می‌شود. برای
  // جلوگیری از re-install در هر فراخوانی renderToString، فقط در اولین call
  // (یا وقتی provider null است) آن را set می‌کنیم.
  setEffectContextStoreOnce();

  // FEATURE (v0.4.0): pre-pass برای inline کردن Server Components.
  // این کار قبل از JSDOM انجام می‌شود چون Server Components مستقل از
  // walker هستند و فقط HTML تولید می‌کنند. state برای resolve کردن
  // propهای $key.path پاس داده می‌شود.
  //
  // نکته: این pre-pass قبل از ساخت JSDOM و setup کردن AsyncLocalStorage
  // است تا در صورت خطا، DOM سرور آلوده نشود.
  html = await inlineServerComponents(html, state);

  let JSDOM: any;
  try { JSDOM = (await import('jsdom')).JSDOM; } catch {
    // FEATURE (v1.0.0): پیام خطای بهبودیافته با تشخیص محیط.
    throw ssrEnvironmentError('jsdom-missing');
  }

  // Pre-import all modules BEFORE entering synchronous section.
  // This eliminates await gaps inside the critical section.
  const { Zen } = await import('@zenith/runtime');
  let runWithRoute: ((path: string, fn: () => Promise<any>) => Promise<any>) | null = null;
  if (options.route) {
    try {
      const routerMod = await import('@zenith/router');
      runWithRoute = routerMod.runWithRoute;
    } catch {}
  }

  const dom = new JSDOM(`<!DOCTYPE html><html><body>${html}</body></html>`, {
    pretendToBeVisual: true,
    url: options.route ? `http://localhost${options.route}` : 'http://localhost/',
  });

  // FEATURE (v1.0.0): ساخت DOM globals از JSDOM برای این درخواست.
  // این آبجکت در AsyncLocalStorage ذخیره می‌شود و globalThis getters
  // (که در dom-context.ts نصب شده‌اند) از آن می‌خوانند. هر درخواست
  // concurrent globals مستقل خود را دارد — globalThis دیگر mutate نمی‌شود.
  const domGlobals: DOMGlobals = {
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
  const doRender = (): SSRResult => {
    const root = dom.window.document.body.firstElementChild as HTMLElement;
    if (!root) throw new Error('[Zenith SSR] No root element found.');

    Zen.start(root, state);
    flushSync(); // synchronous — no await gap

    const resultHtml = root.outerHTML;

    let stateJson = '';
    if (options.serializeState !== false) {
      const s: Record<string, any> = {};
      for (const k in state) {
        s[k] = state[k] && typeof state[k].get === 'function' ? state[k].get() : state[k];
      }
      // SEC FIX (v1.2.6): SEC-A1 — use safeScriptValue for BOTH state AND route
      // (previously only `<` was escaped on state; route was passed raw via
      // JSON.stringify which left `</script>`-style breaks possible).
      stateJson = safeScriptValue(JSON.stringify(s));
      // SEC FIX (v1.2.6): SEC-A1 — also reject unsafe routes at the source.
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
  } finally {
    // FEATURE (v1.0.0): فقط JSDOM را ببند — globalThis را restore نکن.
    // چون globalThis دیگر mutate نشده، نیازی به restore نیست. هر درخواست
    // AsyncLocalStorage store مستقل خود را داشت که با خروج از domAls.run
    // به‌صورت خودکار پاک می‌شود.
    dom.window.close();
  }
}

export function generateHydrationScript(result: SSRResult, nonce?: string): string {
  const nonceAttr = nonce ? ` nonce="${nonce}"` : '';
  // SEC FIX (v1.2.6): SEC-A1 — apply safeScriptValue to BOTH state AND route,
  // and reject unsafe routes (containing `</`) before emitting them.
  const safeState = safeScriptValue(result.state || '');
  let routePart = '';
  if (result.route) {
    if (!isRouteSafe(result.route)) {
      // Drop the route entirely instead of emitting something that could break out.
      console.error('[Zenith SSR] Refusing to embed unsafe route (contains `</`) in hydration script.');
    } else {
      routePart = `window.__ZENITH_ROUTE__=${safeScriptValue(JSON.stringify(result.route))};`;
    }
  }
  return `<script${nonceAttr}>window.__ZENITH_STATE__=${safeState};${routePart}</script>`;
}

export function generateFullPage(result: SSRResult, head = '', nonce?: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8">${head}${generateHydrationScript(result, nonce)}</head><body>${result.html}</body></html>`;
}

// ── Streaming SSR ──
export interface StreamChunk { html: string; done: boolean; }

/**
 * BUG-SSR-06 FIX (v1.3.0): گزینه‌های streaming SSR با پشتیبانی AbortSignal.
 */
export interface StreamOptions {
  /** Route برای hydration. */
  route?: string;
  /** محتوای head (meta, title, styles). */
  head?: string;
  /** AbortSignal برای لغو streaming در صورت نیاز. */
  signal?: AbortSignal;
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
export async function* renderToStream(
  html: string,
  state: Record<string, any>,
  options: { route?: string; head?: string; signal?: AbortSignal } = {},
): AsyncGenerator<StreamChunk> {
  const head = options.head || '';

  // BUG-8 FIX (v1.2.2): قبلاً state با placeholder در head chunk emit می‌شد
  // و سپس تلاش می‌شد placeholder در `result.html` (که فقط body است) replace
  // شود. چون result.html شامل placeholder نبود، جایگزینی هرگز اتفاق نمی‌افتاد
  // و خروجی نهایی شامل رشته‌ی معیوب `window.__ZENITH_STATE__=__ZENITH_STATE_PLACEHOLDER__;`
  // می‌شد که یک ReferenceError در hydration ایجاد می‌کرد.
  //
  // راه‌حل: state را قبل از yield کردن head محاسبه می‌کنیم و مقدار واقعی را
  // مستقیماً در head chunk قرار می‌دهیم. body همچنان به‌صورت streaming پس از
  // render تولید می‌شود (render گران است، اما serialize کردن state ارزان است).
  const stateJson = JSON.stringify(
    Object.fromEntries(
      Object.entries(state).map(([k, v]) => [k, v && typeof v.get === 'function' ? v.get() : v])
    )
  // SEC FIX (v1.2.6): SEC-A1 — use safeScriptValue (escapes <, >, U+2028, U+2029)
  // instead of only replacing `<`. Applied to state AND route below.
  );
  const safeStateJson = safeScriptValue(stateJson);
  // SEC FIX (v1.2.6): SEC-A1 — reject routes containing `</` before streaming.
  let routeLiteral = 'null';
  if (options.route) {
    if (!isRouteSafe(options.route)) {
      console.error('[Zenith SSR] renderToStream: refusing to embed unsafe route (contains `</`).');
    } else {
      routeLiteral = safeScriptValue(JSON.stringify(options.route));
    }
  }

  // BUG-SSR-06 FIX (v1.3.0): بررسی AbortSignal بین هر chunk.
  // اگر caller سیگنال abort داده باشد، generator را متوقف کن.
  if (options.signal?.aborted) {
    throw new DOMException('SSR streaming aborted.', 'AbortError');
  }

  // Phase 1: Head + opening — فوراً stream کن (با state واقعی، بدون placeholder).
  yield {
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8">${head}<script>window.__ZENITH_STATE__=${safeStateJson};window.__ZENITH_ROUTE__=${routeLiteral};</script></head><body><div id="app">`,
    done: false,
  };

  // BUG-SSR-06 FIX: بعد از yield اول
  if (options.signal?.aborted) {
    throw new DOMException('SSR streaming aborted.', 'AbortError');
  }

  // Phase 2: Render content.
  const result = await renderToString(html, state, { route: options.route, serializeState: false });

  // BUG-SSR-06 FIX: بعد از await renderToString (که ممکن است طولانی باشد)
  if (options.signal?.aborted) {
    throw new DOMException('SSR streaming aborted.', 'AbortError');
  }

  // Stream body content (state already injected via head chunk).
  yield { html: result.html, done: false };

  // BUG-SSR-06 FIX: قبل از yield آخر
  if (options.signal?.aborted) {
    throw new DOMException('SSR streaming aborted.', 'AbortError');
  }

  // Phase 3: Closing tags.
  yield { html: '</div></body></html>', done: true };
}
