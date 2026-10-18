import type { SSRDOMWindow, SSRDOMInstance } from './dom-types';
import type { ActionFn } from '@zenith/runtime';
import { cloneRequestState } from './request-state';
import { serializeDOMChunks } from './dom-stream';
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
import { createHead as createRequestHead, renderHead as renderManagedHead, type HeadManager } from '@zenith/head';
import { isReadable, createDisposer, createReferenceRegistry, registerRegistryOwnerProvider, type RegistryOwner } from '@zenith/shared';
import { flushSync } from '@zenith/scheduler';
import { createOwner, disposeOwner, setOwner, type Owner } from '@zenith/state';
import { logger } from '@zenith/logger';
import { inlineServerComponents, type ServerComponent } from './server-component';
// FEATURE (v1.0.0): کتابخانه‌ی خطاها برای پیام‌های بهبودیافته.
import { ssrEnvironmentError, ZenithError, ErrorCode, createReservedError } from '@zenith/errors';
// FEATURE (v1.0.0): AsyncLocalStorage برای isolation per-request.
// به‌جای patch کردن globalThis، globals در یک async-context store ذخیره
// می‌شوند و globalThis.document و سایر globals به‌عنوان getter تعریف
// می‌شوند که از store فعلی می‌خوانند. این کار از race condition در SSR
// concurrent جلوگیری می‌کند.
import { domAls, bindSSRCallback, getSSRAppOwnership, type DOMGlobals } from './dom-context';
// BUG-22 FIX (v1.2.2): setEffectContextStore برای per-request isolation
// از activeEffect/activeCleanupRegistration. قبلاً این متغیرها به‌صورت
// module-level در signal.ts ذخیره می‌شدند و بین درخواست‌های concurrent
// share می‌شدند — race condition. حالا SSR یک provider تنظیم می‌کند که
// در هر call، EffectContext مخصوص همان async context را برمی‌گرداند.
import { setEffectContextStore, type EffectContext } from '@zenith/state/internal';
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
export function serializeState(state: Record<string, unknown>): string {
  return JSON.stringify(state, (_key: string, value: unknown) => {
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
export function validateHydration(clientState: unknown, serverState: unknown): boolean {
  return JSON.stringify(clientState) === JSON.stringify(serverState);
}

export interface SSRHeadInput {
  title?: string;
  meta?: Array<Record<string, string>>;
  link?: Array<Record<string, string>>;
  jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>;
  htmlAttrs?: Record<string, string>;
  bodyAttrs?: Record<string, string>;
}

export interface SSRI18nInput {
  locale: string;
  dir?: 'rtl' | 'ltr';
  messages?: Record<string, unknown>;
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
/** Request-owned factory inputs. The signal also closes when rendering finishes. @public */
export interface SSRAppContext {
  document: Document;
  state: Record<string, unknown>;
  head: HeadManager;
  route?: string;
  signal: AbortSignal;
}

// A factory must never hand a disposed or concurrently mounted App to another
// render. Weak membership does not retain completed Apps.
const { factoryApps, activeApps } = getSSRAppOwnership();

export interface RenderOptions {
  /** Cancel pending rendering; no DOM/App work starts after cancellation. */
  signal?: AbortSignal;
  route?: string;
  serializeState?: boolean;
  /** Response-owned CSP nonce for JSON-LD and hydration output. */
  nonce?: string;
  /** #92 / #148 / #174: نمونهٔ مستقل App یا کارخانهٔ per-request (`() => App`) */
  app?: App | ((context: SSRAppContext) => App | Promise<App>);
  /** #92: کامپوننت‌های سرور اختصاصی این درخواست (بدون نشت به سایر درخواست‌ها) */
  serverComponents?: Record<string, ServerComponent | ServerComponent['render']>;
  /** #92: اکشن‌های اختصاصی این درخواست */
  actions?: Record<string, ActionFn>;
  /** #92: زبان/locale اختصاصی این درخواست */
  locale?: string;
  /** #174: ورودی `<head>` اختصاصی این درخواست */
  head?: SSRHeadInput | string | HeadManager;
  /** #174: وضعیت چندزبانگی (`i18n`) اختصاصی این درخواست */
  i18n?: SSRI18nInput;
  /** #92: سازندهٔ DOM سفارشی برای محیط‌های Edge بدون jsdom */
  createDOM?: (html: string, url: string) => SSRDOMInstance;
  /** #91: مهلت زمانی رندر SSR به میلی‌ثانیه (در صورت عبور، خطای ZEN-1801 پرتاب می‌شود) */
  timeout?: number;
  /** #91: نام مستعار مهلت زمانی رندر SSR (میلی‌ثانیه) */
  renderTimeoutMs?: number;
  /** #91: فعال‌سازی کش قالب‌های parse‌شده و استخر JSDOM (پیش‌فرض: true) */
  cacheTemplates?: boolean;
}




/**
 * #152 / #174: تبدیل ساختار `SSRHeadInput` به تگ‌های امن `<head>` با پشتیبانی از JSON-LD.
 */
export function renderSSRHead(
  head?: SSRHeadInput | string | HeadManager,
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
      htmlAttrs: renderManagedHead({ htmlAttrs: htmlMap }).htmlAttrs,
      bodyAttrs: '',
    };
  }

  const manager = 'resolve' in head ? head as HeadManager : undefined;
  const value = manager ? manager.resolve() : head as SSRHeadInput;
  const result = renderManagedHead(manager ?? value);
  result.htmlAttrs = renderManagedHead({ htmlAttrs: {
    ...(effectiveLocale ? { lang: effectiveLocale } : {}), ...(effectiveDir ? { dir: effectiveDir } : {}), ...(value.htmlAttrs ?? {}),
  } }).htmlAttrs;
  return result;
}

interface PooledDOMEntry {
  window: SSRDOMWindow;
  templates: Map<string, HTMLTemplateElement>;
}

const MAX_DOM_POOL_SIZE = 8;
const MAX_TEMPLATE_CACHE_ENTRIES = 128;
const _jsdomPool: PooledDOMEntry[] = [];
const _templateParseCounts = new Map<string, number>();
let templateCacheEpoch = 0;
function recordTemplateParse(html: string): void {
  const count = _templateParseCounts.get(html) ?? 0; _templateParseCounts.delete(html);
  if (_templateParseCounts.size >= MAX_TEMPLATE_CACHE_ENTRIES) { const oldest = _templateParseCounts.keys().next().value; if (oldest !== undefined) _templateParseCounts.delete(oldest); }
  _templateParseCounts.set(html, count + 1);
}

/**
 * #91: پاک‌سازی کش قالب‌های SSR و استخر JSDOM.
 */
export function clearSSRTemplateCache(): void {
  templateCacheEpoch++; _templateParseCounts.clear();
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
  registerRegistryOwnerProvider(() => domAls.getStore()?.registryOwner ?? null);
  setEffectContextStore((): EffectContext | null => {
    const store = domAls.getStore();
    if (!store) return null;
    if (!store.effectContext) {
      store.effectContext = {
        owner: null,
        activeEffect: null,
        activeCleanupRegistration: null,
        bind: bindSSRCallback, globalObservation: false,
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
export function renderToString(
  html: string,
  state: Record<string, unknown>,
  options: RenderOptions = {},
): Promise<SSRResult> {
  return renderWithRoot(html, state, options, (root, finalize) => finalize(root.outerHTML));
}

/** One owned render lifetime shared by string output and demand-driven streams. */
async function renderWithRoot<T>(
  html: string,
  state: Record<string, unknown>,
  options: RenderOptions,
  consume: (root: HTMLElement, finalize: (html: string) => SSRResult) => T | Promise<T>,
): Promise<T> {
  if (options.signal?.aborted) throw createAbortError();
  setEffectContextStoreOnce();

  // Snapshot inside the request context; source signals never transfer ownership.
  let renderState: Record<string, unknown> = Object.create(null);
  const stateCleanup = createDisposer();

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

  const url = options.route ? `http://localhost${options.route}` : 'http://localhost/';
  const useTemplateCache = options.cacheTemplates !== false && !options.createDOM, cacheEpoch = templateCacheEpoch;
  const effectiveTimeout = options.timeout ?? options.renderTimeoutMs;
  let domInstance = null as SSRDOMInstance | null;
  let pooledEntry: PooledDOMEntry | null = null;
  const requestHead = createRequestHead({ nonce: options.nonce });
  const requestRegistryCleanup = createDisposer();
  const requestStateRegistryCleanup = createDisposer();
  const componentMap = new Map<string, HTMLTemplateElement>();
  const requestRegistries: RegistryOwner['registries'] = {
    actions: createReferenceRegistry(), components: createReferenceRegistry<HTMLTemplateElement>({ legacyMap: componentMap }) as unknown as ReturnType<typeof createReferenceRegistry<unknown>>,
    auth: createReferenceRegistry(), permissions: createReferenceRegistry(), resources: createReferenceRegistry(), stores: createReferenceRegistry(),
    serverComponents: createReferenceRegistry<ServerComponent>({ legacyMap: scopedServerComponents }) as unknown as ReturnType<typeof createReferenceRegistry<unknown>>,
    directives: createReferenceRegistry(), plugins: createReferenceRegistry(), devtools: createReferenceRegistry(),
  };
  const appCleanup = createDisposer();
  const externalSignal = options.signal;
  const renderAbort = new AbortController();
  options = { ...options, signal: renderAbort.signal };
  let abortInContext = () => domAls.run(initialGlobals, () => renderAbort.abort());
  const abort = () => abortInContext();
  let requestOwner: Owner | undefined;
  let pendingFactories = 0;
  let renderClosed = false;
  let restoreSSRDocumentFlag: (() => void) | undefined;

  const executeIsolatedRender = async (): Promise<T> => {
    if (renderClosed || options.signal?.aborted) throw createAbortError();
    renderState = cloneRequestState(state, { cleanup: stateCleanup });
    if (options.locale !== undefined && !('locale' in renderState)) renderState.locale = options.locale;
    const providedHead = options.head;
    if (providedHead && typeof providedHead !== 'string') {
      if ('resolve' in providedHead) requestHead.push(() => providedHead.resolve()); else requestHead.push(providedHead);
    }
    // اجرای pre-pass کامپوننت‌های سرور در بستر ایزولهٔ درخواست (#92)
    const processedHtml = await raceWithAbort(
      inlineServerComponents(html, renderState),
      options.signal,
    );
    // A completed prepass may race with abort in the same microtask turn.
    if (renderClosed || options.signal?.aborted) throw createAbortError();

    const { Zen } = await import('@zenith/runtime');
    const JSDOM = options.createDOM ? undefined : await import('jsdom').then(module => module.JSDOM).catch(() => { throw ssrEnvironmentError('jsdom-missing'); });
    if (renderClosed || options.signal?.aborted) throw createAbortError();
    if (options.createDOM) {
      domInstance = options.createDOM(
        `<!DOCTYPE html><html><body>${processedHtml}</body></html>`,
        url,
      );
    } else if (useTemplateCache) {
      pooledEntry = _jsdomPool.pop() ?? null;
      if (!pooledEntry) {
        const freshDom = new JSDOM!('<!DOCTYPE html><html><body></body></html>', {
          pretendToBeVisual: true,
          url,
        });
        pooledEntry = {
          window: freshDom.window,
          templates: new Map(),
        };
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
        if (cacheEpoch === templateCacheEpoch) recordTemplateParse(processedHtml);
      }
      // Cache only inert parser templates, never a user-visible request Window.
      // Clearing body alone cannot isolate custom globals, head, storage or events.
      const requestDOM = new JSDOM!('<!DOCTYPE html><html><body></body></html>', { pretendToBeVisual: true, url });
      requestDOM.window.document.body.appendChild(requestDOM.window.document.importNode(tpl.content, true));
      domInstance = requestDOM;
    } else {
      domInstance = new JSDOM!(`<!DOCTYPE html><html><body>${processedHtml}</body></html>`, {
        pretendToBeVisual: true,
        url,
      });
    }

    const win = domInstance!.window;
    const hadSSRFlag = Object.prototype.hasOwnProperty.call(win.document, '__zenithSSR__');
    const oldSSRFlag = win.document.__zenithSSR__;
    const hadRequestToken = Object.prototype.hasOwnProperty.call(win.document, '__zenithSSRRequest__');
    const oldRequestToken = win.document.__zenithSSRRequest__;
    win.document.__zenithSSRRequest__ = {};
    win.document.__zenithSSR__ = true;
    restoreSSRDocumentFlag = () => {
      if (hadSSRFlag) win.document.__zenithSSR__ = oldSSRFlag; else delete win.document.__zenithSSR__;
      if (hadRequestToken) win.document.__zenithSSRRequest__ = oldRequestToken; else delete win.document.__zenithSSRRequest__;
    };
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
      const source = options.app;
      const claim = (instance: App, owned: boolean): App => {
        if (!instance || typeof instance.mount !== 'function' || typeof instance.dispose !== 'function') {
          throw createReservedError('ZEN-1001', { details: { expected: 'App from SSR factory' } });
        }
        if (activeApps.has(instance) || factoryApps.has(instance)) {
          throw createReservedError('ZEN-1001', { details: { expected: 'a fresh, exclusively owned App' } });
        }
        if (owned) factoryApps.add(instance);
        if (renderClosed || options.signal?.aborted) {
          // The request may already have released its DOM. Never mount a late
          // App, and never dispose an App claimed by a different request.
          if (owned) instance.dispose();
          throw createAbortError();
        }
        activeApps.add(instance);
        appCleanup.add(() => { activeApps.delete(instance); });
        if (owned) appCleanup.add(instance);
        return instance;
      };
      let appInstance: App;
      if (typeof source === 'function') {
        pendingFactories++;
        const pending = Promise.resolve().then(() => {
          if (renderClosed || options.signal?.aborted) throw createAbortError();
          return source({ document: win.document, state: renderState, head: requestHead, route: options.route, signal: renderAbort.signal });
        }).then(instance => { pendingFactories--; return claim(instance, true); }, error => { pendingFactories--; throw error; });
        appInstance = await raceWithAbort(pending, options.signal);
      } else appInstance = claim(source, false);
      if (renderClosed || options.signal?.aborted) throw createAbortError();
      appCleanup.add(appInstance.mount(root, renderState));
      flushSync();
      const appHead = appInstance.inject<HeadManager>('zenith:head');
      if (appHead) requestHead.push(() => appHead.resolve());
      return await consume(root, finalizeResult);
    }
    // Legacy runtime roots are also stopped when binding or serialization throws.
    try { Zen.start(root, renderState); flushSync(); return await consume(root, finalizeResult); }
    finally { Zen.stop(root); }

  };

  const finalizeResult = (resultHtml: string): SSRResult => {
    let stateJson = '';
    if (options.serializeState !== false) {
      const s: Record<string, unknown> = {};
      for (const k in renderState) {
        s[k] =
          isReadable(renderState[k])
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
    const renderedHead = renderSSRHead(typeof options.head === 'string' ? options.head : requestHead, options.i18n, options.locale);
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
    // Install lifetime registration before Router creates its request Signal.
    effectContext: {
      owner: null, activeEffect: null, activeCleanupRegistration: null, bind: bindSSRCallback, globalObservation: false,
      registerDisposal: cleanup => {
        if (renderClosed) cleanup(); else requestStateRegistryCleanup.add(cleanup);
      },
    },
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
    componentRegistry: componentMap,
    registryOwner: { registries: requestRegistries, addCleanup: cleanup => { if (renderClosed) cleanup(); else requestRegistryCleanup.add(cleanup); } },
    actionRegistry: scopedActionRegistry,
    serverComponents: scopedServerComponents,
    locale: options.locale,
    head: requestHead,
  };

  let primaryFailure = false;
  externalSignal?.addEventListener('abort', abort, { once: true });
  if (externalSignal?.aborted) abort();
  try {
    const runTask = async () => {
      // Router is a declared dependency. Never silently fall back to shared
      // browser state, including when no explicit route was supplied.
      const { runWithRoute } = await import('@zenith/router');
      if (renderClosed || options.signal?.aborted) throw createAbortError();
      return await domAls.run(initialGlobals, () => runWithRoute(options.route ?? '/', async () => {
        if (renderClosed || options.signal?.aborted) throw createAbortError();
        requestOwner = createOwner(null);
        // This owner belongs to this native request context across awaits. It
        // is not a process-global createRoot scope held across a Promise.
        setOwner(requestOwner);
        abortInContext = bindSSRCallback(() => renderAbort.abort());
        return executeIsolatedRender();
      }));
    };
    return await raceWithTimeout(raceWithAbort(runTask(), options.signal), effectiveTimeout);
  } catch (error) {
    primaryFailure = true; throw error;
  } finally {
    renderClosed = true;
    abort();
    externalSignal?.removeEventListener('abort', abort);
    const cleanup = createDisposer();
    cleanup.add(() => {
      try { restoreSSRDocumentFlag?.(); } finally {
        const activePool = pooledEntry as PooledDOMEntry | null;
        if (activePool) {
          try {
            domInstance?.window?.close?.();
            activePool.window.document.body.innerHTML = '';
            // Only inert template owners enter this cache. Conservatively discard
            // the parser owner too if a user factory is still pending on abort.
            if (cacheEpoch === templateCacheEpoch && pendingFactories === 0 && _jsdomPool.length < MAX_DOM_POOL_SIZE) _jsdomPool.push(activePool);
            else activePool.window.close?.();
          } catch { activePool.window.close?.(); }
        } else if (domInstance) {
          if (typeof domInstance.close === 'function') domInstance.close();
          else domInstance.window?.close?.();
        }
      }
    });
    cleanup.add(stateCleanup);
    cleanup.add(requestHead);
    for (const registry of Object.values(requestRegistries)) cleanup.add(registry);
    cleanup.add(requestRegistryCleanup);
    cleanup.add(appCleanup);
    cleanup.add(requestStateRegistryCleanup);
    // Stop ambient prepass/factory effects before registries, snapshots and DOM.
    // Leave a disposed owner tombstone in the retired context so late async
    // continuations cannot attach fresh default-owned reactive work.
    cleanup.add(() => { if (requestOwner) disposeOwner(requestOwner); });
    try { domAls.run(initialGlobals, () => cleanup.dispose()); } catch (error) {
      if (!primaryFailure) throw error;
      try { logger.error('[Zenith SSR] Teardown failed after a render error.'); } catch {}
    }

  }
}

export function generateHydrationScript(result: SSRResult, nonce?: string): string {
  const nonceAttr = nonce ? ` nonce="${nonce.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}"` : '';
  // SEC FIX (v1.2.6): SEC-A1 — apply safeScriptValue to BOTH state AND route,
  // and reject unsafe routes (containing `</`) before emitting them.
  const safeState = safeScriptValue(result.state || '{}');
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
/** Metadata available after App/head collection, before body serialization. @public */
export type StreamMetadata = Omit<SSRResult, 'html'>;
export interface StreamOptions extends RenderOptions {
  /** محتوای head (meta, title, styles). */
  head?: RenderOptions['head'];
  /** Trusted document framing; adapters preserve their template's static shell. */
  shell?: { open(result: SSRResult): string; close: string; metadataOnly?: false } | { open(result: StreamMetadata): string; close: string; metadataOnly: true };
  /** Metadata-only hook: does not force a complete rendered HTML string. */
  onReady?: (result: StreamMetadata) => void | Promise<void>;
  /** Runs once after collected rendering, before the first shell byte is yielded. */
  onRendered?: (result: SSRResult) => void | Promise<void>;
  /** Wait for prepass head collection even without an App (legacy fast-head streaming stays available). */
  deferHead?: boolean;
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
  if (signal.aborted) {
    // The caller may have aborted synchronously while creating this promise.
    // Observe its eventual rejection even though cancellation wins immediately.
    void promise.catch(() => {});
    throw createAbortError();
  }
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
  state: Record<string, unknown>,
  options: StreamOptions = {},
): AsyncGenerator<StreamChunk> {
  if (options.signal?.aborted) throw createAbortError();
  const controller = new AbortController(), signal = controller.signal;
  const externalAbort = () => controller.abort();
  options.signal?.addEventListener('abort', externalAbort, { once: true });
  if (options.signal?.aborted) externalAbort();
  const collectedHead = !!options.shell || !!options.onRendered || !!options.onReady || options.deferHead || !!options.app || !!options.i18n || !!options.locale || (options.head !== undefined && typeof options.head !== 'string');
  // Legacy full-result hooks/shells keep their HTML contract. Adapters opt in to
  // metadata-only framing and avoid creating the complete rendered HTML string.
  const buffered = !!options.onRendered || (!!options.shell && !options.shell.metadataOnly);
  const stateCleanup = createDisposer(); let streamState: Record<string, unknown> = state;
  let releaseDOM: (() => void) | undefined, rendering: Promise<void> | undefined;
  let failure: unknown, failed = false, primaryFailure = false, result: SSRResult | undefined, root: HTMLElement | undefined;
  const check = () => { if (failed) throw failure; if (signal.aborted) throw createAbortError(); };
  const start = async () => {
    if (root || result) return;
    if (buffered) { result = await raceWithAbort(renderToString(html, streamState, { ...options, signal }), signal); return; }
    let ready!: (value: { root: HTMLElement; result: SSRResult }) => void, reject!: (error: unknown) => void;
    const available = new Promise<{ root: HTMLElement; result: SSRResult }>((resolve, fail) => { ready = resolve; reject = fail; });
    const released = new Promise<void>(resolve => { releaseDOM = resolve; });
    rendering = renderWithRoot(html, streamState, { ...options, signal }, async (node, finalize) => {
      const metadata = finalize(''); ready({ root: node, result: metadata }); await released;
    });
    // Observe failures even while the consumer is paused at a yield. A timeout
    // invalidates the retained DOM and interrupts an outstanding flush callback.
    void rendering.catch(error => { failure = error; failed = true; reject(error); controller.abort(); });
    const availableDOM = await raceWithAbort(available, signal); root = availableDOM.root; result = availableDOM.result;
  };
  const closeDOM = async () => { releaseDOM?.(); releaseDOM = undefined; if (rendering) await rendering; };
  const flush = async (chunk: StreamChunk) => { check(); await raceWithAbort(Promise.resolve(options.onFlush?.(chunk)), signal); check(); };
  try {
    streamState = cloneRequestState(state, { cleanup: stateCleanup });
    if (collectedHead) await start();
    if (result) {
      await raceWithAbort(Promise.resolve(options.onRendered?.(result)), signal);
      const { html: _body, ...metadata } = result;
      await raceWithAbort(Promise.resolve(options.onReady?.(metadata)), signal);
    }
    check();
    const initial: SSRResult = result ?? { html: '', state: options.serializeState === false ? '{}' : safeScriptValue(JSON.stringify(Object.fromEntries(
      Object.entries(streamState).map(([key, value]) => [key, value && typeof value === 'object' && 'get' in value && typeof value.get === 'function' ? value.get() : value]),
    ))), route: options.route };
    const head = result?.headTags ?? (typeof options.head === 'string' ? options.head : '');
    const opening: StreamChunk = {
      html: options.shell ? options.shell.open(initial) : `<!DOCTYPE html><html${result?.htmlAttrs ?? ''}><head><meta charset="UTF-8">${head}${generateHydrationScript(initial, options.nonce)}</head><body${result?.bodyAttrs ?? ''}><div id="app">`, done: false,
    };
    await flush(opening); yield opening; check();
    if (!result) await start();
    check();
    const size = options.chunkSize && Number.isFinite(options.chunkSize) && options.chunkSize > 0 ? Math.max(1, Math.floor(options.chunkSize)) : 16384;
    if (root) {
      for (const html of serializeDOMChunks(root, size, check)) { const chunk = { html, done: false }; await flush(chunk); yield chunk; check(); }
    } else {
      const body = result!.html;
      for (let offset = 0; offset < body.length;) {
        let end = Math.min(offset + size, body.length);
        if (end < body.length && /[\uD800-\uDBFF]/.test(body[end - 1]!) && /[\uDC00-\uDFFF]/.test(body[end]!)) end++;
        const chunk = { html: body.slice(offset, end), done: false }; await flush(chunk); yield chunk; check(); offset = end;
      }
    }
    // Complete App/registry/DOM teardown before declaring the document complete.
    await closeDOM(); check();
    const closing: StreamChunk = { html: options.shell?.close ?? '</div></body></html>', done: true };
    await flush(closing); yield closing;
  } catch (error) { primaryFailure = true; throw failed ? failure : error; }
  finally {
    controller.abort(); options.signal?.removeEventListener('abort', externalAbort);
    // Returning early aborts pending factories and releases a paused DOM session.
    // A primary render/transport failure must not be replaced by teardown errors.
    releaseDOM?.();
    if (rendering) { try { await rendering; } catch { /* already observed above */ } }
    try { stateCleanup.dispose(); } catch (error) { if (!primaryFailure) throw error; }
  }
}

/**
 * #91: تبدیل جریان SSR به Web `ReadableStream<Uint8Array>` واقعی با پشتیبانی
 * کامل از backpressure (`pull`) و لغو خودکار رندر در `cancel()`.
 */
export function renderToReadableStream(
  html: string,
  state: Record<string, unknown>,
  options: StreamOptions = {},
): ReadableStream<Uint8Array> {
  const internalAbort = new AbortController();
  const externalSignal = options.signal;
  const externalAbort = () => internalAbort.abort();
  const detach = () => externalSignal?.removeEventListener('abort', externalAbort);
  if (externalSignal) {
    if (externalSignal.aborted) {
      internalAbort.abort();
    } else {
      externalSignal.addEventListener('abort', externalAbort, { once: true });
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
          detach(); controller.close();
          return;
        }
        controller.enqueue(encoder.encode(value.html));
        if (value.done) {
          await iterator.return(undefined); detach(); controller.close();
        }
      } catch (err) {
        detach(); internalAbort.abort(); controller.error(err);
      }
    },
    async cancel() {
      detach(); internalAbort.abort();
      try {
        await iterator.return?.(undefined);
      } catch {
        /* ignore generator return error on cancel */
      }
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// #152 — Head Management (createHead, useHead, renderHead, titleFromRoute)
// ═══════════════════════════════════════════════════════════════════════════

export { createHead, renderHead, titleFromRoute } from '@zenith/head';
export type { HeadManager } from '@zenith/head';
/** Legacy facade: explicit manager or the current isolated render request, never last-created global state. */
export function useHead(input: SSRHeadInput, head?: HeadManager) {
  const owner = head ?? domAls.getStore()?.head;
  if (!owner) throw new ZenithError({ code: 'ZEN-1501', category: 'SSR', message: 'useHead requires an explicit manager or isolated SSR request.' });
  return owner.push(input);
}

// ═══════════════════════════════════════════════════════════════════════════
// #156 & #157 — Node & Edge SSR Adapters (createNodeHandler, createFetchHandler)
// ═══════════════════════════════════════════════════════════════════════════

export interface SSRAdapterOptions {
  /** Observe a handled adapter failure without bypassing safe response cleanup. */
  onError?: (error: unknown) => void;
  template: string;
  app?: () => App;
  state?:
    Record<string, unknown> | ((url: string) => Record<string, unknown> | Promise<Record<string, unknown>>);
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
      destroyed?: boolean;
      headersSent?: boolean;
      destroy?: () => void;
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
    let timedOut = false;
    const deadline = setTimeout(() => { timedOut = true; abort(); }, options.timeout ?? 10_000);
    const nonce = options.csp?.nonce ? randomBytes(16).toString('base64') : undefined;

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
        nonce,
      });
      if (abortController.signal.aborted) return;

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
    } catch (err: unknown) {
      if (abortController.signal.aborted && !timedOut) return;
      const error = timedOut ? createReservedError('ZEN-1801', { cause: err }) : err;
      try { options.onError?.(error); } catch { /* Observer failure must not prevent a response. */ }
      if (res.writableEnded || res.destroyed) return;
      if (res.headersSent) { res.destroy?.(); return; }
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      res.statusCode = timedOut || code === 'ZEN-1801' ? 503 : 500;
      res.setHeader?.('Content-Type', 'text/plain; charset=utf-8');
      res.end?.(res.statusCode === 503 ? 'Render timeout' : 'Internal Server Error');
    } finally {
      clearTimeout(deadline);
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

    const controller = new AbortController();
    const aborted = () => controller.abort();
    request.signal.addEventListener('abort', aborted, { once: true });
    if (request.signal.aborted) aborted();
    let timedOut = false;
    const deadline = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeout ?? 10_000);
    const nonce = options.csp?.nonce ? randomBytes(16).toString('base64') : undefined;
    try {
      if (controller.signal.aborted) throw createAbortError();
      const reqState = await raceWithAbort(
        Promise.resolve(
          typeof options.state === 'function'
            ? options.state(parsedUrl.pathname + parsedUrl.search)
            : (options.state ?? {}),
        ),
        controller.signal,
      );
      const headInput = typeof options.head === 'function' ? options.head(cleanPath) : options.head;
      const i18nInput = typeof options.i18n === 'function' ? options.i18n(cleanPath) : options.i18n;

      const ssrRes = await renderToString(options.template, reqState, {
        route: cleanPath,
        app: options.app,
        timeout: options.timeout ?? 10_000,
        head: headInput,
        i18n: i18nInput,
        signal: controller.signal,
        nonce,
      });
      if (controller.signal.aborted) throw createAbortError();
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
    } catch (err) {
      if (request.signal.aborted) throw createAbortError();
      const status = timedOut || (err instanceof ZenithError && err.code === 'ZEN-1801') ? 503 : 500;
      return new Response(status === 503 ? 'Render timeout' : 'Internal Server Error', {
        status,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    } finally { clearTimeout(deadline); request.signal.removeEventListener('abort', aborted); }
  };
}

export const createCloudflareHandler = createFetchHandler;
export const createDenoHandler = createFetchHandler;
