// packages/ssr/src/render-ssr.ts
//
// renderToString — استخراج مکانیکی از render.ts، بدون تغییر رفتار (#40).

import { cloneRequestState } from './request-state';
import { createHead as createRequestHead } from '@zenith/head';
import { isReadable, createDisposer, createReferenceRegistry, type RegistryOwner } from '@zenith/shared';
import { flushSync } from '@zenith/scheduler';
import { createOwner, disposeOwner, setOwner, type Owner } from '@zenith/state';
import { logger } from '@zenith/logger';
import { inlineServerComponents, type ServerComponent } from './server-component';
import { ssrEnvironmentError, ZenithError, ErrorCode, createReservedError } from '@zenith/errors';
import { domAls, bindSSRCallback, type DOMGlobals } from './dom-context';
import { raceWithTimeout, setEffectContextStoreOnce } from './render-await';
import { createAbortError, raceWithAbort } from './render-abort';
import { safeScriptValue, isRouteSafe, type SSRResult } from './render-serialize';
import { renderSSRHead } from './render-head';
import { _jsdomPool, templateCacheEpoch, recordTemplateParse, type PooledDOMEntry } from './render-pool';
import { factoryApps, activeApps } from './render-context';
import { ActionRegistry, type App } from '@zenith/runtime';
import type { SSRDOMInstance } from './dom-types';


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
    const renderedHead = renderSSRHead(typeof options.head === 'string' ? options.head : requestHead, { i18n: options.i18n, fallbackLocale: options.locale });
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
    return await raceWithTimeout(raceWithAbort(runTask(), options.signal), { timeoutMs: effectiveTimeout });
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
