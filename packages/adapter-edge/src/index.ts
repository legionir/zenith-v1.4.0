/** Request-isolated Fetch adapters, without importing the Node SSR entry. @packageDocumentation */
import { renderToString, type EdgeRenderContext, type EdgeI18nInput } from '@zenith/ssr/edge';
import { createReservedError } from '@zenith/errors';
import { logger } from '@zenith/logger';
import type { App } from '@zenith/runtime-core';
import { createDisposer } from '@zenith/shared';
import { cloneRequestState } from './state';
import type { HeadInput } from '@zenith/head';

/** @public */
export interface EdgeExecutionContext { waitUntil(promise: Promise<unknown>): void; }
/** A fresh DOM per invocation, never a shared/global window. @public */
export interface EdgeDOM { document: Document; dispose?(): void | Promise<void>; }
/** @public */
export interface EdgeRequestContext<Env = unknown> { request: Request; url: URL; env: Env | undefined; executionContext: EdgeExecutionContext | undefined; signal: AbortSignal; }
/** @public */
export interface EdgeHandlerOptions<Env = unknown> {
  template: string;
  app?: (context: EdgeRenderContext & EdgeRequestContext<Env>) => App;
  state?: Record<string, unknown> | ((url: string, context: EdgeRequestContext<Env>) => Record<string, unknown> | Promise<Record<string, unknown>>);
  head?: HeadInput | ((url: string, context: EdgeRequestContext<Env>) => HeadInput | Promise<HeadInput>);
  i18n?: EdgeI18nInput | ((url: string, context: EdgeRequestContext<Env>) => EdgeI18nInput | Promise<EdgeI18nInput>);
  /** Return undefined only for a clean asset miss. */
  assets?: (path: string, context: EdgeRequestContext<Env>) => Promise<Response | undefined>;
  root?: string;
  timeout?: number;
  health?: string | false;
  cacheControl?: string;
  csp?: { nonce?: boolean; policy?: string };
  domImpl?: 'linkedom' | 'happy-dom';
  /** Happy DOM requires an explicit compatible host factory; Workers use linkedom. */
  createDOM?: (template: string, context: EdgeRequestContext<Env>) => EdgeDOM | Promise<EdgeDOM>;
  waitUntil?: boolean;
  onResponse?: (response: Response, context: EdgeRequestContext<Env>) => void | Promise<void>;
}
const documents = new WeakSet<Document>();
function abortError(): Error { const error = new Error('Request aborted.'); error.name = 'AbortError'; return error; }
function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) { void work.catch(() => {}); return Promise.reject(signal.reason ?? abortError()); }
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason ?? abortError()); signal.addEventListener('abort', abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
async function createDOM(template: string): Promise<EdgeDOM> {
  try {
    const { parseHTML } = await import('linkedom/worker');
    const html = /<html(?:\s|>)/i.test(template) ? template : `<!DOCTYPE html><html><head></head><body>${template}</body></html>`;
    const { document } = parseHTML(html);
    return { document: document as unknown as Document };
  } catch { throw createReservedError('ZEN-1812'); }
}
function nonce(): string {
  if (typeof globalThis.crypto?.getRandomValues !== 'function') throw createReservedError('ZEN-1811');
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
}
/**
 * Every await occurs outside the synchronous explicit-document renderer. An
 * aborted/late data producer cannot mount an App or publish a stale response.
 * @public
 */
export function createFetchHandler<Env = unknown>(options: EdgeHandlerOptions<Env>): (request: Request, env?: Env, context?: EdgeExecutionContext) => Promise<Response> {
  if (typeof globalThis.Request !== 'function' || typeof globalThis.Response !== 'function' || !options || typeof options.template !== 'string' || !Number.isFinite(options.timeout ?? 30_000) || (options.timeout ?? 30_000) <= 0) throw createReservedError('ZEN-1811');
  if (options.domImpl === 'happy-dom' && !options.createDOM) throw createReservedError('ZEN-1811');
  if (options.domImpl && !['linkedom', 'happy-dom'].includes(options.domImpl)) throw createReservedError('ZEN-1811');
  return async (request, env, executionContext) => {
    const url = new URL(request.url); const method = request.method.toUpperCase(); const headers = new Headers({ 'X-Content-Type-Options': 'nosniff' });
    const controller = new AbortController(); const signal = controller.signal; const deadline = Date.now() + (options.timeout ?? 30_000);
    const context: EdgeRequestContext<Env> = { request, url, env, executionContext, signal };
    const abort = () => controller.abort(request.signal.reason ?? abortError()); request.signal.addEventListener('abort', abort, { once: true }); if (request.signal.aborted) abort();
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; controller.abort(abortError()); }, options.timeout ?? 30_000);
    let dom: EdgeDOM | undefined; let claimed = false; const stateCleanup = createDisposer();
    const check = () => { if (Date.now() >= deadline) { timedOut = true; controller.abort(abortError()); } if (signal.aborted) throw signal.reason ?? abortError(); };
    const response = (body: BodyInit | null, status = 200) => new Response(method === 'HEAD' ? null : body, { status, headers });
    try {
      check();
      if (method !== 'GET' && method !== 'HEAD') { headers.set('Allow', 'GET, HEAD'); return response('Method Not Allowed', 405); }
      if (options.health !== false && url.pathname === (options.health ?? '/health')) { headers.set('Content-Type', 'text/plain; charset=utf-8'); return response('OK'); }
      if (options.assets) {
        let path: string; try { path = decodeURIComponent(url.pathname); } catch { return response('Bad Request', 400); }
        if (path.includes('\\') || path.includes('\0') || path.split('/').includes('..')) return response('Forbidden', 403);
        const asset = await abortable(Promise.resolve(options.assets(path, context)), signal); check();
        if (asset) { const assetHeaders = new Headers(asset.headers); assetHeaders.set('X-Content-Type-Options', 'nosniff'); return new Response(method === 'HEAD' ? null : asset.body, { status: asset.status, statusText: asset.statusText, headers: assetHeaders }); }
      }
      // A late DOM allocation has a rejection handler and disposes itself, but
      // can never publish a response or enter the synchronous App mount.
      const allocation = Promise.resolve().then(() => options.createDOM ? options.createDOM(options.template, context) : createDOM(options.template));
      try { dom = await abortable(allocation, signal); } catch (error) {
        void allocation.then(async late => { if (!documents.has(late.document)) await late.dispose?.(); }).catch(() => { try { logger.error(createReservedError('ZEN-1812')); } catch { /* diagnostic isolation */ } });
        throw error;
      }
      check();
      if (!dom?.document || documents.has(dom.document)) throw createReservedError('ZEN-1812'); documents.add(dom.document); claimed = true;
      const route = url.pathname + url.search;
      const loadedState = typeof options.state === 'function' ? await abortable(Promise.resolve(options.state(route, context)), signal) : options.state ?? {};
      const state = cloneRequestState(loadedState, stateCleanup);
      const head = typeof options.head === 'function' ? await abortable(Promise.resolve(options.head(route, context)), signal) : options.head; check();
      const i18n = typeof options.i18n === 'function' ? await abortable(Promise.resolve(options.i18n(route, context)), signal) : options.i18n; check();
      const value = options.csp?.nonce ? nonce() : undefined;
      const rendered = renderToString(state, { document: dom.document, root: options.root, signal, head, i18n, route, nonce: value,
        app: options.app ? renderContext => options.app!({ ...renderContext, ...context }) : undefined }); check();
      headers.set('Content-Type', 'text/html; charset=utf-8'); headers.set('Cache-Control', options.cacheControl ?? 'no-store');
      if (options.csp) headers.set('Content-Security-Policy', options.csp.policy?.replaceAll('{{nonce}}', value ?? '') ?? `default-src 'self'; script-src 'self'${value ? ` 'nonce-${value}'` : ''}`);
      const result = response(rendered.html);
      if (options.onResponse) {
        const task = Promise.resolve().then(() => options.onResponse!(result.clone(), context)).catch(() => { try { logger.error(createReservedError('ZEN-1811')); } catch { /* diagnostic isolation */ } });
        if (executionContext && options.waitUntil !== false) executionContext.waitUntil(task); else await abortable(task, signal);
      }
      return result;
    } catch {
      headers.set('Content-Type', 'text/plain; charset=utf-8'); headers.set('Cache-Control', 'no-store');
      if (!signal.aborted) { try { logger.error(createReservedError('ZEN-1811')); } catch { /* never expose request data */ } }
      return response(timedOut ? 'Gateway Timeout' : signal.aborted ? 'Request Aborted' : 'Internal Server Error', timedOut ? 504 : signal.aborted ? 499 : 500);
    } finally {
      try {
        if (dom && (claimed || !documents.has(dom.document))) {
          const ownedDOM = dom;
          const cleanup = Promise.resolve().then(() => ownedDOM.dispose?.()).catch(() => { try { logger.error(createReservedError('ZEN-1812')); } catch { /* diagnostic isolation */ } }).finally(() => { if (claimed) documents.delete(ownedDOM.document); });
          if (executionContext && options.waitUntil !== false) { try { executionContext.waitUntil(cleanup); } catch { await abortable(cleanup, signal).catch(() => {}); } }
          else await abortable(cleanup, signal).catch(() => {});
        }
      } finally {
        try { stateCleanup.dispose(); } catch { try { logger.error(createReservedError('ZEN-1811')); } catch { /* diagnostic isolation */ } }
        clearTimeout(timer); request.signal.removeEventListener('abort', abort);
      }
    }
  };
}
/** Cloudflare module-worker shape. @public */
export function createCloudflareHandler<Env = unknown>(options: EdgeHandlerOptions<Env>) { return { fetch: createFetchHandler(options) }; }
/** Deno.serve-compatible function, without importing Deno or Node globals. @public */
export function createDenoHandler(options: EdgeHandlerOptions) { const handler = createFetchHandler(options); return (request: Request): Promise<Response> => handler(request); }

export type { EdgeRenderContext, EdgeI18nInput } from '@zenith/ssr/edge';
