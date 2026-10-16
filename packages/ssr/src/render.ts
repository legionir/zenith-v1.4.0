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

import { randomBytes } from 'node:crypto';
import { flushSync } from '@zenith/scheduler';
import { logger } from '@zenith/logger';
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

export interface SSRHeadInput {
  title?: string;
  meta?: Array<Record<string, string>>;
  link?: Array<Record<string, string>>;
  jsonLd?: Record<string, any> | Array<Record<string, any>>;
  htmlAttrs?: Record<string, string>;
  bodyAttrs?: Record<string, string>;
}

export interface SSRI18nInput {
  locale: string;
  dir?: 'rtl' | 'ltr';
  messages?: Record<string, any>;
}

export interface SSRResult {
  html: string;
  state: string;
  route?: string;
  /** #174: تگ‌های رندرشدهٔ `<head>` */
  headTags?: string;
  /** #174: صفت‌های تگ `<html>` (مانند `lang` و `dir`) */
  htmlAttrs?: string;
  /** #174: صفت‌های تگ `<body>` */
  bodyAttrs?: string;
  /** #174: دادهٔ سریال‌شدهٔ چندزبانگی برای `__ZENITH_I18N__` */
  i18n?: string;
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
  /** Cancel pending rendering; no DOM/App work starts after cancellation. */
  signal?: AbortSignal;
  route?: string;
  serializeState?: boolean;
  /** #92 / #148 / #174: نمونهٔ مستقل App یا کارخانهٔ per-request (`() => App`) */
  app?: App | (() => App);
  /** #92: کامپوننت‌های سرور اختصاصی این درخواست (بدون نشت به سایر درخواست‌ها) */
  serverComponents?: Record<string, ServerComponent | ServerComponent['render']>;
  /** #92: اکشن‌های اختصاصی این درخواست */
  actions?: Record<string, (ctx: any) => void | Promise<void>>;
  /** #92: زبان/locale اختصاصی این درخواست */
  locale?: string;
  /** #174: ورودی `<head>` اختصاصی این درخواست */
  head?: SSRHeadInput | string;
  /** #174: وضعیت چندزبانگی (`i18n`) اختصاصی این درخواست */
  i18n?: SSRI18nInput;
  /** #92: سازندهٔ DOM سفارشی برای محیط‌های Edge بدون jsdom */
  createDOM?: (html: string, url: string) => { window: any; close?: () => void };
  /** #91: مهلت زمانی رندر SSR به میلی‌ثانیه (در صورت عبور، خطای ZEN-1801 پرتاب می‌شود) */
  timeout?: number;
  /** #91: نام مستعار مهلت زمانی رندر SSR (میلی‌ثانیه) */
  renderTimeoutMs?: number;
  /** #91: فعال‌سازی کش قالب‌های parse‌شده و استخر JSDOM (پیش‌فرض: true) */
  cacheTemplates?: boolean;
}

function escapeHtmlAttr(val: string): string {
  return String(val)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function renderAttrsMap(attrs?: Record<string, string>): string {
  if (!attrs) return '';
  const parts: string[] = [];
  for (const [k, v] of Object.entries(attrs)) {
    if (!/^[a-zA-Z_:][a-zA-Z0-9_.:-]*$/.test(k)) continue;
    parts.push(`${k}="${escapeHtmlAttr(v)}"`);
  }
  return parts.length > 0 ? ' ' + parts.join(' ') : '';
}

/**
 * #152 / #174: تبدیل ساختار `SSRHeadInput` به تگ‌های امن `<head>` با پشتیبانی از JSON-LD.
 */
export function renderSSRHead(
  head?: SSRHeadInput | string,
  i18n?: SSRI18nInput,
  fallbackLocale?: string,
): { headTags: string; htmlAttrs: string; bodyAttrs: string } {
  const effectiveLocale = i18n?.locale ?? fallbackLocale;
  const effectiveDir =
    i18n?.dir ??
    (effectiveLocale && /^(fa|ar|he|ur|ps|ckb|sd|ug|yi)\b/i.test(effectiveLocale)
      ? 'rtl'
      : effectiveLocale
        ? 'ltr'
        : undefined);

  if (typeof head === 'string' || !head) {
    const htmlMap: Record<string, string> = {};
    if (effectiveLocale) htmlMap.lang = effectiveLocale;
    if (effectiveDir) htmlMap.dir = effectiveDir;
    return {
      headTags: typeof head === 'string' ? head : '',
      htmlAttrs: renderAttrsMap(htmlMap),
      bodyAttrs: '',
    };
  }

  const tags: string[] = [];
  if (head.title) {
    tags.push(`<title data-zen-head="title">${escapeHtmlAttr(head.title)}</title>`);
  }
  if (Array.isArray(head.meta)) {
    for (const m of head.meta) {
      tags.push(`<meta data-zen-head="meta"${renderAttrsMap(m)}>`);
    }
  }
  if (Array.isArray(head.link)) {
    for (const l of head.link) {
      tags.push(`<link data-zen-head="link"${renderAttrsMap(l)}>`);
    }
  }
  if (head.jsonLd) {
    const items = Array.isArray(head.jsonLd) ? head.jsonLd : [head.jsonLd];
    for (const item of items) {
      const safeJson = safeScriptValue(JSON.stringify(item));
      tags.push(`<script type="application/ld+json" data-zen-head="ld">${safeJson}</script>`);
    }
  }

  const htmlMap: Record<string, string> = { ...(head.htmlAttrs ?? {}) };
  if (effectiveLocale && !htmlMap.lang) htmlMap.lang = effectiveLocale;
  if (effectiveDir && !htmlMap.dir) htmlMap.dir = effectiveDir;

  return {
    headTags: tags.join(''),
    htmlAttrs: renderAttrsMap(htmlMap),
    bodyAttrs: renderAttrsMap(head.bodyAttrs),
  };
}

interface PooledDOMEntry {
  window: any;
  templates: Map<string, any>;
}

const MAX_DOM_POOL_SIZE = 8;
const MAX_TEMPLATE_CACHE_ENTRIES = 128;
const _jsdomPool: PooledDOMEntry[] = [];
const _templateParseCounts = new Map<string, number>();

/**
 * #91: پاک‌سازی کش قالب‌های SSR و استخر JSDOM.
 */
export function clearSSRTemplateCache(): void {
  _templateParseCounts.clear();
  while (_jsdomPool.length > 0) {
    const entry = _jsdomPool.pop();
    try {
      entry?.window?.close?.();
    } catch {
      /* ignore close errors */
    }
  }
}

/**
 * #91: آمار کش قالب‌های SSR برای تست و مانیتورینگ عملکرد.
 */
export function getSSRTemplateCacheStats(): {
  cachedTemplates: number;
  pooledDOMInstances: number;
  parseCountFor: (html: string) => number;
} {
  return {
    cachedTemplates: _templateParseCounts.size,
    pooledDOMInstances: _jsdomPool.length,
    parseCountFor: (html: string) => _templateParseCounts.get(html) ?? 0,
  };
}

function createSSRTimeoutError(timeoutMs: number): ZenithError {
  return new ZenithError({
    code: 'ZEN-1801',
    category: 'SSR',
    message: `SSR render timed out after ${timeoutMs}ms.`,
    suggestion:
      'renderTimeoutMs / timeout را افزایش دهید یا داده‌های کندِ مسیر را به بافر/کش منتقل کنید.',
    context: { timeoutMs },
  });
}

async function raceWithTimeout<T>(promise: Promise<T>, timeoutMs?: number): Promise<T> {
  if (timeoutMs === undefined || !Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(createSSRTimeoutError(timeoutMs)), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
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
  if (options.signal?.aborted) throw createAbortError();
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
  const useTemplateCache = options.cacheTemplates !== false && !options.createDOM;
  const effectiveTimeout = options.timeout ?? options.renderTimeoutMs;
  let domInstance = null as { window: any; close?: () => void } | null;
  let pooledEntry: PooledDOMEntry | null = null;

  const executeIsolatedRender = async (): Promise<SSRResult> => {
    if (options.signal?.aborted) throw createAbortError();
    // اجرای pre-pass کامپوننت‌های سرور در بستر ایزولهٔ درخواست (#92)
    const processedHtml = await raceWithAbort(
      inlineServerComponents(html, renderState),
      options.signal,
    );
    // A completed prepass may race with abort in the same microtask turn.
    if (options.signal?.aborted) throw createAbortError();

    if (options.createDOM) {
      domInstance = options.createDOM(
        `<!DOCTYPE html><html><body>${processedHtml}</body></html>`,
        url,
      );
    } else if (useTemplateCache) {
      pooledEntry = _jsdomPool.pop() ?? null;
      if (!pooledEntry) {
        const freshDom = new JSDOM('<!DOCTYPE html><html><body></body></html>', {
          pretendToBeVisual: true,
          url,
        });
        pooledEntry = {
          window: freshDom.window,
          templates: new Map(),
        };
      } else {
        try {
          pooledEntry.window.history.replaceState(null, '', options.route || '/');
        } catch {
          /* ignore history errors on custom schemes */
        }
      }
      const win = pooledEntry.window;
      let tpl = pooledEntry.templates.get(processedHtml);
      if (!tpl) {
        tpl = win.document.createElement('template');
        tpl.innerHTML = processedHtml;
        if (pooledEntry.templates.size >= MAX_TEMPLATE_CACHE_ENTRIES) {
          const oldestKey = pooledEntry.templates.keys().next().value;
          if (oldestKey !== undefined) pooledEntry.templates.delete(oldestKey);
        }
        pooledEntry.templates.set(processedHtml, tpl);
        _templateParseCounts.set(processedHtml, (_templateParseCounts.get(processedHtml) ?? 0) + 1);
      }
      win.document.body.innerHTML = '';
      win.document.body.appendChild(tpl.content.cloneNode(true));
      domInstance = { window: win };
    } else {
      _templateParseCounts.set(processedHtml, (_templateParseCounts.get(processedHtml) ?? 0) + 1);
      domInstance = new JSDOM(`<!DOCTYPE html><html><body>${processedHtml}</body></html>`, {
        pretendToBeVisual: true,
        url,
      });
    }

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
      const appInstance = typeof options.app === 'function' ? options.app() : options.app;
      const unmount = appInstance.mount(root, renderState);
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
    const renderedHead = renderSSRHead(options.head, options.i18n, options.locale);
    const i18nJson = options.i18n
      ? safeScriptValue(
          JSON.stringify({
            locale: options.i18n.locale,
            dir:
              options.i18n.dir ??
              (/^(fa|ar|he|ur|ps|ckb|sd|ug|yi)\b/i.test(options.i18n.locale) ? 'rtl' : 'ltr'),
            messages: options.i18n.messages ?? {},
          }),
        )
      : undefined;

    return {
      html: resultHtml,
      state: stateJson,
      route: options.route,
      headTags: renderedHead.headTags,
      htmlAttrs: renderedHead.htmlAttrs,
      bodyAttrs: renderedHead.bodyAttrs,
      i18n: i18nJson,
    };
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
    const runTask = async () => {
      if (runWithRoute && options.route) {
        return await runWithRoute(options.route, async () => {
          return await domAls.run(initialGlobals, () => executeIsolatedRender());
        });
      }
      return await domAls.run(initialGlobals, () => executeIsolatedRender());
    };
    return await raceWithTimeout(runTask(), effectiveTimeout);
  } finally {
    const activePool = pooledEntry as PooledDOMEntry | null;
    if (activePool) {
      try {
        activePool.window.document.body.innerHTML = '';
        if (_jsdomPool.length < MAX_DOM_POOL_SIZE) {
          _jsdomPool.push(activePool);
        } else {
          activePool.window.close?.();
        }
      } catch {
        activePool.window.close?.();
      }
    } else if (domInstance) {
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
      logger.error(
        '[Zenith SSR] Refusing to embed unsafe route (contains `</`) in hydration script.',
      );
    } else {
      routePart = `window.__ZENITH_ROUTE__=${safeScriptValue(JSON.stringify(result.route))};`;
    }
  }
  const i18nPart = result.i18n ? `window.__ZENITH_I18N__=${result.i18n};` : '';
  return `<script${nonceAttr}>window.__ZENITH_STATE__=${safeState};${routePart}${i18nPart}</script>`;
}

export function generateFullPage(result: SSRResult, head = '', nonce?: string): string {
  const htmlAttrs = result.htmlAttrs ?? '';
  const bodyAttrs = result.bodyAttrs ?? '';
  const combinedHead = `${result.headTags ?? ''}${head}`;
  return `<!DOCTYPE html><html${htmlAttrs}><head><meta charset="UTF-8">${combinedHead}${generateHydrationScript(result, nonce)}</head><body${bodyAttrs}>${result.html}</body></html>`;
}

// ── Streaming SSR ──
export interface StreamChunk {
  html: string;
  done: boolean;
}

/**
 * BUG-SSR-06 FIX (v1.3.0): گزینه‌های streaming SSR با پشتیبانی AbortSignal.
 */
export interface StreamOptions extends RenderOptions {
  /** محتوای head (meta, title, styles). */
  head?: string;
  /** AbortSignal برای لغو streaming در صورت نیاز. */
  signal?: AbortSignal;
  /** #15: کالبک اختیاری برای flush تدریجی هر قطعه بلافاصله پس از تولید. */
  onFlush?: (chunk: StreamChunk) => void | Promise<void>;
  /** #91: اندازهٔ قطعه (کاراکتر) برای ارسال تدریجی بدنه با رعایت backpressure */
  chunkSize?: number;
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
      logger.error('[Zenith SSR] renderToStream: refusing to embed unsafe route (contains `</`).');
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

  // Phase 2: Render content (با توقف فوری در صورت abort یا timeout حین رندر async).
  const result = await raceWithAbort(
    renderToString(html, state, {
      ...options,
      serializeState: false,
    }),
    options.signal,
  );

  // BUG-SSR-06 FIX: بعد از await renderToString (که ممکن است طولانی باشد)
  if (options.signal?.aborted) {
    throw createAbortError();
  }

  // Stream body content (state already injected via head chunk).
  const chunkSize = options.chunkSize && options.chunkSize > 0 ? Math.floor(options.chunkSize) : 0;
  if (chunkSize > 0 && result.html.length > chunkSize) {
    for (let offset = 0; offset < result.html.length; offset += chunkSize) {
      if (options.signal?.aborted) {
        throw createAbortError();
      }
      const sliceChunk: StreamChunk = {
        html: result.html.slice(offset, offset + chunkSize),
        done: false,
      };
      await options.onFlush?.(sliceChunk);
      yield sliceChunk;
    }
  } else {
    const bodyChunk: StreamChunk = { html: result.html, done: false };
    await options.onFlush?.(bodyChunk);
    yield bodyChunk;
  }

  // BUG-SSR-06 FIX: قبل از yield آخر
  if (options.signal?.aborted) {
    throw createAbortError();
  }

  // Phase 3: Closing tags.
  const closeChunk: StreamChunk = { html: '</div></body></html>', done: true };
  await options.onFlush?.(closeChunk);
  yield closeChunk;
}

/**
 * #91: تبدیل جریان SSR به Web `ReadableStream<Uint8Array>` واقعی با پشتیبانی
 * کامل از backpressure (`pull`) و لغو خودکار رندر در `cancel()`.
 */
export function renderToReadableStream(
  html: string,
  state: Record<string, any>,
  options: StreamOptions = {},
): ReadableStream<Uint8Array> {
  const internalAbort = new AbortController();
  const externalSignal = options.signal;
  if (externalSignal) {
    if (externalSignal.aborted) {
      internalAbort.abort();
    } else {
      externalSignal.addEventListener('abort', () => internalAbort.abort(), { once: true });
    }
  }
  const encoder = new TextEncoder();
  const iterator = renderToStream(html, state, {
    ...options,
    signal: internalAbort.signal,
  });

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done || !value) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(value.html));
        if (value.done) {
          controller.close();
        }
      } catch (err) {
        controller.error(err);
      }
    },
    async cancel() {
      internalAbort.abort();
      try {
        await iterator.return?.(undefined as any);
      } catch {
        /* ignore generator return error on cancel */
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// #152 — Head Management (createHead, useHead, renderHead, titleFromRoute)
// ═══════════════════════════════════════════════════════════════════════════

export interface HeadManager {
  push(input: SSRHeadInput): { patch(next: SSRHeadInput): void; dispose(): void };
  resolve(): SSRHeadInput;
  dispose(): void;
}

let _activeHead: HeadManager | null = null;

/**
 * #152: ساخت مدیر واکنشی `<head>` با حذف تگ‌های تکراری (dedupe) و اولویت آخرین ورودی.
 */
export function createHead(
  options: { titleTemplate?: string; maxTags?: number } = {},
): HeadManager {
  const entries = new Set<{ current: SSRHeadInput }>();
  const maxTags = options.maxTags ?? 100;

  const manager: HeadManager = {
    push(input: SSRHeadInput) {
      const box = { current: { ...input } };
      entries.add(box);
      let disposed = false;
      return {
        patch(next: SSRHeadInput) {
          if (disposed) return;
          box.current = { ...box.current, ...next };
        },
        dispose() {
          if (disposed) return;
          disposed = true;
          entries.delete(box);
        },
      };
    },
    resolve(): SSRHeadInput {
      let title: string | undefined;
      const metaMap = new Map<string, Record<string, string>>();
      const linkMap = new Map<string, Record<string, string>>();
      const jsonLdList: Array<Record<string, any>> = [];
      const htmlAttrs: Record<string, string> = {};
      const bodyAttrs: Record<string, string> = {};

      for (const { current } of entries) {
        if (current.title !== undefined) title = current.title;
        if (current.meta) {
          for (const m of current.meta) {
            const key = m.key || m.name || m.property || JSON.stringify(m);
            metaMap.set(key, m);
          }
        }
        if (current.link) {
          for (const l of current.link) {
            const key = l.key || `${l.rel ?? ''}:${l.href ?? ''}`;
            linkMap.set(key, l);
          }
        }
        if (current.jsonLd) {
          if (Array.isArray(current.jsonLd)) jsonLdList.push(...current.jsonLd);
          else jsonLdList.push(current.jsonLd);
        }
        if (current.htmlAttrs) Object.assign(htmlAttrs, current.htmlAttrs);
        if (current.bodyAttrs) Object.assign(bodyAttrs, current.bodyAttrs);
      }

      if (title && options.titleTemplate && options.titleTemplate.includes('%s')) {
        title = options.titleTemplate.replace('%s', title);
      }

      const totalCount = metaMap.size + linkMap.size + jsonLdList.length;
      if (totalCount > maxTags) {
        throw new ZenithError({
          code: 'ZEN-1503',
          category: 'SSR',
          message: `Head tag count (${totalCount}) exceeded maxTags (${maxTags}).`,
          suggestion: 'تعداد تگ‌های meta/link را کاهش دهید یا گزینهٔ maxTags را افزایش دهید.',
        });
      }

      return {
        title,
        meta: Array.from(metaMap.values()),
        link: Array.from(linkMap.values()),
        jsonLd: jsonLdList.length > 0 ? jsonLdList : undefined,
        htmlAttrs,
        bodyAttrs,
      };
    },
    dispose() {
      entries.clear();
      if (_activeHead === manager) _activeHead = null;
    },
  };

  _activeHead = manager;
  return manager;
}

/**
 * #152: ثبت ورودی `<head>` در مدیر فعال.
 */
export function useHead(input: SSRHeadInput): { patch(next: SSRHeadInput): void; dispose(): void } {
  if (!_activeHead) {
    _activeHead = createHead();
  }
  return _activeHead.push(input);
}

/**
 * #152: رندر خروجی `HeadManager` یا `SSRHeadInput` به رشتهٔ HTML امن.
 */
export function renderHead(head: HeadManager | SSRHeadInput): {
  headTags: string;
  htmlAttrs: string;
  bodyAttrs: string;
} {
  const resolved = 'resolve' in head && typeof head.resolve === 'function' ? head.resolve() : head;
  return renderSSRHead(resolved as SSRHeadInput);
}

/**
 * #152: استخراج عنوان صفحه از متادیتای مسیر.
 */
export function titleFromRoute(
  route: { path: string; meta?: Record<string, any> },
  template = '%s',
): string {
  const raw =
    typeof route.meta?.title === 'string' && route.meta.title.length > 0
      ? route.meta.title
      : route.path === '/'
        ? 'Home'
        : route.path.replace(/^\//, '');
  return template.includes('%s') ? template.replace('%s', raw) : raw;
}

// ═══════════════════════════════════════════════════════════════════════════
// #156 & #157 — Node & Edge SSR Adapters (createNodeHandler, createFetchHandler)
// ═══════════════════════════════════════════════════════════════════════════

export interface SSRAdapterOptions {
  template: string;
  app?: () => App;
  state?:
    Record<string, any> | ((url: string) => Record<string, any> | Promise<Record<string, any>>);
  timeout?: number;
  health?: string | false;
  cacheControl?: string;
  /** Use {{nonce}} in a custom policy to reference the per-response nonce. */
  csp?: { nonce?: boolean; policy?: string };
  head?: SSRHeadInput | ((url: string) => SSRHeadInput);
  i18n?: SSRI18nInput | ((url: string) => SSRI18nInput);
}

/**
 * #156: ساخت handler سازگار با Node `http` / Express / Connect / Fastify.
 */
export function createNodeHandler(options: SSRAdapterOptions) {
  const healthPath = options.health === undefined ? '/healthz' : options.health;
  const cacheControl = options.cacheControl ?? 'no-store';

  return async (
    req: {
      url?: string;
      method?: string;
      aborted?: boolean;
      on?: (ev: string, fn: () => void) => void;
      off?: (ev: string, fn: () => void) => void;
    },
    res: {
      statusCode?: number;
      setHeader?: (name: string, value: string) => void;
      end?: (body?: string) => void;
      writableEnded?: boolean;
      on?: (ev: string, fn: () => void) => void;
      off?: (ev: string, fn: () => void) => void;
    },
  ): Promise<void> => {
    const rawUrl = req.url || '/';
    const cleanPath = rawUrl.split('?')[0] || '/';

    if (healthPath && cleanPath === healthPath) {
      res.statusCode = 200;
      res.setHeader?.('Content-Type', 'application/json; charset=utf-8');
      res.end?.(JSON.stringify({ status: 'ok' }));
      return;
    }

    const abortController = new AbortController();
    const abort = () => abortController.abort();
    // IncomingMessage 'close' also fires on normal request completion. Only an
    // aborted request or an unfinished response closing signals a disconnect.
    const onClose = () => {
      if (!res.writableEnded) abort();
    };
    req.on?.('aborted', abort);
    res.on?.('close', onClose);
    if (req.aborted) abort();

    try {
      if (abortController.signal.aborted) return;
      const reqState = await raceWithAbort(
        Promise.resolve(
          typeof options.state === 'function' ? options.state(rawUrl) : (options.state ?? {}),
        ),
        abortController.signal,
      );
      const headInput = typeof options.head === 'function' ? options.head(rawUrl) : options.head;
      const i18nInput = typeof options.i18n === 'function' ? options.i18n(rawUrl) : options.i18n;

      const ssrRes = await renderToString(options.template, reqState, {
        route: cleanPath,
        app: options.app,
        timeout: options.timeout ?? 10_000,
        head: headInput,
        i18n: i18nInput,
        signal: abortController.signal,
      });
      if (abortController.signal.aborted) return;

      const nonce = options.csp?.nonce ? randomBytes(16).toString('base64') : undefined;
      const fullHtml = generateFullPage(ssrRes, '', nonce);
      res.statusCode = 200;
      res.setHeader?.('Content-Type', 'text/html; charset=utf-8');
      res.setHeader?.('Cache-Control', cacheControl);
      if (nonce) {
        res.setHeader?.(
          'Content-Security-Policy',
          options.csp?.policy?.replaceAll('{{nonce}}', nonce) ??
            `default-src 'self'; script-src 'self' 'nonce-${nonce}'`,
        );
      }
      res.end?.(fullHtml);
    } catch (err: any) {
      if (abortController.signal.aborted) return;
      res.statusCode = err?.code === 'ZEN-1801' ? 503 : 500;
      res.setHeader?.('Content-Type', 'text/plain; charset=utf-8');
      res.end?.(err?.message || 'Internal Server Error');
    } finally {
      req.off?.('aborted', abort);
      res.off?.('close', onClose);
    }
  };
}

/**
 * #157: ساخت handler استاندارد WinterCG / Edge (`Request => Promise<Response>`) برای Cloudflare/Deno/Bun/Vercel Edge.
 */
export function createFetchHandler(options: SSRAdapterOptions) {
  const healthPath = options.health === undefined ? '/healthz' : options.health;
  const cacheControl = options.cacheControl ?? 'no-store';

  return async (request: Request): Promise<Response> => {
    const parsedUrl = new URL(request.url, 'http://localhost');
    const cleanPath = parsedUrl.pathname || '/';

    if (healthPath && cleanPath === healthPath) {
      return new Response(JSON.stringify({ status: 'ok' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
      });
    }

    try {
      if (request.signal.aborted) throw createAbortError();
      const reqState = await raceWithAbort(
        Promise.resolve(
          typeof options.state === 'function'
            ? options.state(parsedUrl.pathname + parsedUrl.search)
            : (options.state ?? {}),
        ),
        request.signal,
      );
      const headInput = typeof options.head === 'function' ? options.head(cleanPath) : options.head;
      const i18nInput = typeof options.i18n === 'function' ? options.i18n(cleanPath) : options.i18n;

      const ssrRes = await renderToString(options.template, reqState, {
        route: cleanPath,
        app: options.app,
        timeout: options.timeout ?? 10_000,
        head: headInput,
        i18n: i18nInput,
        signal: request.signal,
      });
      if (request.signal.aborted) throw createAbortError();

      const nonce = options.csp?.nonce ? randomBytes(16).toString('base64') : undefined;
      const fullHtml = generateFullPage(ssrRes, '', nonce);
      const headers: Record<string, string> = {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': cacheControl,
      };
      if (nonce) {
        headers['Content-Security-Policy'] =
          options.csp?.policy?.replaceAll('{{nonce}}', nonce) ??
          `default-src 'self'; script-src 'self' 'nonce-${nonce}'`;
      }
      return new Response(fullHtml, { status: 200, headers });
    } catch (err: any) {
      if (request.signal.aborted) throw createAbortError();
      const status = err?.code === 'ZEN-1801' ? 503 : 500;
      return new Response(err?.message || 'Internal Server Error', {
        status,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  };
}

export const createCloudflareHandler = createFetchHandler;
export const createDenoHandler = createFetchHandler;
