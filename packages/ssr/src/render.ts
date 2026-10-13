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
import { inlineServerComponents, type ServerComponent } from './server-component';
// FEATURE (v1.0.0): کتابخانه‌ی خطاها برای پیام‌های بهبودیافته.
import { ssrEnvironmentError, ZenithError, ErrorCode } from '@zenith/errors';
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
import {
  setComponentRegistryStore,
  setActionRegistryStore,
  ActionRegistry,
  type App,
} from '@zenith/runtime';

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

export interface SSRResult {
  html: string;
  state: string;
  route?: string;
}

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

/**
 * Calculate a simple checksum for hydration validation.
 * Used to verify server output matches client DOM before hydration.
 */
export function calculateChecksum(content: string): string {
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Validate hydration using checksum comparison.
 * More reliable than simple JSON comparison of state alone.
 */
export function validateHydrationChecksum(serverHtml: string, clientRoot: HTMLElement): boolean {
  const serverChecksum = calculateChecksum(serverHtml);
  const clientChecksum = calculateChecksum(clientRoot.innerHTML);
  return serverChecksum === clientChecksum;
}

// ── Isomorphic utilities — work identically on server and client ──

/**
 * Get current environment (server or client).
 */
export function getEnvironment(): 'server' | 'client' {
  return typeof window === 'undefined' ? 'server' : 'client';
}

/**
 * Check if running on server.
 */
export function isServer(): boolean {
  return getEnvironment() === 'server';
}

/**
 * Check if running on client/browser.
 */
export function isClient(): boolean {
  return getEnvironment() === 'client';
}

/**
 * Run code only on server.
 */
export function runOnServer<T>(fn: () => T): T | undefined {
  if (isServer()) return fn();
  return undefined;
}

/**
 * Run code only on client.
 */
export function runOnClient<T>(fn: () => T): T | undefined {
  if (isClient()) return fn();
  return undefined;
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
export interface RenderOptions {
  route?: string;
  serializeState?: boolean;
  /** #92 / #148: نمونهٔ مستقل App ساخته‌شده با createApp */
  app?: App;
  /** #92: کامپوننت‌های سرور اختصاصی این درخواست (بدون نشت به سایر درخواست‌ها) */
  serverComponents?: Record<string, ServerComponent | ServerComponent['render']>;
  /** #92: اکشن‌های اختصاصی این درخواست */
  actions?: Record<string, (ctx: any) => void | Promise<void>>;
  /** #92: زبان/locale اختصاصی این درخواست */
  locale?: string;
  /** #92: سازندهٔ DOM سفارشی برای محیط‌های Edge بدون jsdom */
  createDOM?: (html: string, url: string) => { window: any; close?: () => void };
}

let _effectContextStoreInstalled = false;
function setEffectContextStoreOnce(): void {
  if (_effectContextStoreInstalled) return;
  _effectContextStoreInstalled = true;
  setEffectContextStore((): EffectContext | null => {
    const store = domAls.getStore() as (DOMGlobals & { effectContext?: EffectContext }) | undefined;
    if (!store) return null;
    if (!store.effectContext) {
      store.effectContext = {
        owner: null,
        activeEffect: null,
        activeCleanupRegistration: null,
      };
    }
    return store.effectContext ?? null;
  });
  setComponentRegistryStore(() => {
    const store = domAls.getStore();
    if (!store) return null;
    if (!store.componentRegistry) {
      store.componentRegistry = new Map();
    }
    return store.componentRegistry;
  });
  setActionRegistryStore(() => {
    const store = domAls.getStore();
    if (!store) return null;
    if (!store.actionRegistry) {
      store.actionRegistry = new ActionRegistry();
    }
    return store.actionRegistry;
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
  options: RenderOptions = {},
): Promise<SSRResult> {
  setEffectContextStoreOnce();

  // #92: کپی سطحی state برای جلوگیری از نشت تغییرات به آبجکت ورودی مشترک
  const renderState: Record<string, any> = { ...state };
  if (options.locale !== undefined && !('locale' in renderState)) {
    renderState.locale = options.locale;
  }

  // ساخت نقشهٔ ServerComponentهای اختصاصی درخواست (#92)
  const scopedServerComponents = new Map<string, ServerComponent>();
  if (options.serverComponents) {
    for (const [name, compOrFn] of Object.entries(options.serverComponents)) {
      if (typeof compOrFn === 'function') {
        scopedServerComponents.set(name, { name, render: compOrFn });
      } else if (compOrFn && typeof compOrFn.render === 'function') {
        scopedServerComponents.set(name, compOrFn);
      }
    }
  }

  // ساخت رجیستری اکشن اختصاصی درخواست (#92)
  const scopedActionRegistry = new ActionRegistry();
  if (options.actions) {
    for (const [actName, actFn] of Object.entries(options.actions)) {
      scopedActionRegistry.register(actName, actFn);
    }
  }

  let JSDOM: any = null;
  if (!options.createDOM) {
    try {
      JSDOM = (await import('jsdom')).JSDOM;
    } catch {
      throw ssrEnvironmentError('jsdom-missing');
    }
  }

  // Pre-import all modules BEFORE entering synchronous section.
  const { Zen } = await import('@zenith/runtime');
  let runWithRoute: ((path: string, fn: () => Promise<any>) => Promise<any>) | null = null;
  if (options.route) {
    try {
      const routerMod = await import('@zenith/router');
      runWithRoute = routerMod.runWithRoute;
    } catch {}
  }

  const url = options.route ? `http://localhost${options.route}` : 'http://localhost/';
  let domInstance = null as { window: any; close?: () => void } | null;

  const executeIsolatedRender = async (): Promise<SSRResult> => {
    // اجرای pre-pass کامپوننت‌های سرور در بستر ایزولهٔ درخواست (#92)
    const processedHtml = await inlineServerComponents(html, renderState);

    domInstance = options.createDOM
      ? options.createDOM(`<!DOCTYPE html><html><body>${processedHtml}</body></html>`, url)
      : new JSDOM(`<!DOCTYPE html><html><body>${processedHtml}</body></html>`, {
          pretendToBeVisual: true,
          url,
        });

    const win = domInstance!.window;
    const activeStore = domAls.getStore();
    if (activeStore) {
      activeStore.window = win;
      activeStore.document = win.document;
      activeStore.Node = win.Node;
      activeStore.HTMLElement = win.HTMLElement;
      activeStore.Element = win.Element;
      activeStore.Event = win.Event;
      activeStore.history = win.history;
      activeStore.location = win.location;
      activeStore.DOMParser = win.DOMParser;
      activeStore.MouseEvent = win.MouseEvent;
      activeStore.KeyboardEvent = win.KeyboardEvent;
    }

    const root = win.document.body.firstElementChild as HTMLElement;
    if (!root)
      throw new ZenithError({
        code: ErrorCode.SSR_NO_ROOT_ELEMENT,
        category: 'SSR',
        message: 'No root element found.',
        suggestion: 'root باید به یک element معتبر (مثلاً document.getElementById) اشاره کند.',
      });

    if (options.app) {
      const unmount = options.app.mount(root, renderState);
      flushSync();
      const resultHtml = root.outerHTML;
      unmount();
      return finalizeResult(resultHtml);
    }

    Zen.start(root, renderState);
    flushSync(); // synchronous — no await gap

    const resultHtml = root.outerHTML;
    Zen.stop(root);
    return finalizeResult(resultHtml);
  };

  const finalizeResult = (resultHtml: string): SSRResult => {
    let stateJson = '';
    if (options.serializeState !== false) {
      const s: Record<string, any> = {};
      for (const k in renderState) {
        s[k] =
          renderState[k] && typeof renderState[k].get === 'function'
            ? renderState[k].get()
            : renderState[k];
      }
      stateJson = safeScriptValue(JSON.stringify(s));
      if (!isRouteSafe(options.route)) {
        throw new ZenithError({
          code: ErrorCode.SECURITY_XSS_BLOCKED,
          category: 'Security',
          message:
            'Refusing to render: route contains `</` which could break out of the hydration script.',
          suggestion: 'route باید از isRouteSafe عبور کند؛ کاراکترهای `</` را حذف/encode کنید.',
        });
      }
    }
    return { html: resultHtml, state: stateJson, route: options.route };
  };

  const initialGlobals: DOMGlobals = {
    window: undefined,
    document: undefined,
    Node: undefined,
    HTMLElement: undefined,
    Element: undefined,
    Event: undefined,
    history: undefined,
    location: undefined,
    DOMParser: undefined,
    MouseEvent: undefined,
    KeyboardEvent: undefined,
    componentRegistry: new Map(),
    actionRegistry: scopedActionRegistry,
    serverComponents: scopedServerComponents,
    locale: options.locale,
  };

  try {
    if (runWithRoute && options.route) {
      return await runWithRoute(options.route, async () => {
        return await domAls.run(initialGlobals, () => executeIsolatedRender());
      });
    }
    return await domAls.run(initialGlobals, () => executeIsolatedRender());
  } finally {
    if (domInstance) {
      if (typeof domInstance.close === 'function') {
        domInstance.close();
      } else if (typeof domInstance.window?.close === 'function') {
        domInstance.window.close();
      }
    }
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
      console.error(
        '[Zenith SSR] Refusing to embed unsafe route (contains `</`) in hydration script.',
      );
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
export interface StreamChunk {
  html: string;
  done: boolean;
}

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
  /** #15: کالبک اختیاری برای flush تدریجی هر قطعه بلافاصله پس از تولید. */
  onFlush?: (chunk: StreamChunk) => void | Promise<void>;
}

function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('SSR streaming aborted.', 'AbortError');
  }
  const err = new Error('SSR streaming aborted.');
  err.name = 'AbortError';
  return err;
}

async function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) throw createAbortError();
  let onAbort: (() => void) | undefined;
  const abortPromise = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(createAbortError());
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try {
    return await Promise.race([promise, abortPromise]);
  } finally {
    if (onAbort) signal.removeEventListener('abort', onAbort);
  }
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
  options: StreamOptions = {},
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
      Object.entries(state).map(([k, v]) => [k, v && typeof v.get === 'function' ? v.get() : v]),
    ),
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
  if (options.signal?.aborted) {
    throw createAbortError();
  }

  // Phase 1: Head + opening — فوراً stream کن (با state واقعی، بدون placeholder).
  const headChunk: StreamChunk = {
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8">${head}<script>window.__ZENITH_STATE__=${safeStateJson};window.__ZENITH_ROUTE__=${routeLiteral};</script></head><body><div id="app">`,
    done: false,
  };
  await options.onFlush?.(headChunk);
  yield headChunk;

  // BUG-SSR-06 FIX: بعد از yield اول
  if (options.signal?.aborted) {
    throw createAbortError();
  }

  // Phase 2: Render content (با توقف فوری در صورت abort حین رندر async).
  const result = await raceWithAbort(
    renderToString(html, state, { route: options.route, serializeState: false }),
    options.signal,
  );

  // BUG-SSR-06 FIX: بعد از await renderToString (که ممکن است طولانی باشد)
  if (options.signal?.aborted) {
    throw createAbortError();
  }

  // Stream body content (state already injected via head chunk).
  const bodyChunk: StreamChunk = { html: result.html, done: false };
  await options.onFlush?.(bodyChunk);
  yield bodyChunk;

  // BUG-SSR-06 FIX: قبل از yield آخر
  if (options.signal?.aborted) {
    throw createAbortError();
  }

  // Phase 3: Closing tags.
  const closeChunk: StreamChunk = { html: '</div></body></html>', done: true };
  await options.onFlush?.(closeChunk);
  yield closeChunk;
}
