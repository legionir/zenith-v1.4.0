import type { IncomingMessage, ServerResponse } from 'node:http';
import { randomUUID, randomBytes } from 'node:crypto';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGzip, createBrotliCompress } from 'node:zlib';
import { renderToString, renderToStream, cloneRequestState, isAsyncLocalStorageAvailable, type SSRAppContext, type SSRResult, type SSRHeadInput, type SSRI18nInput } from '@zenith/ssr';
import { logger } from '@zenith/logger';
import type { App } from '@zenith/runtime-core';
import { createReservedError } from '@zenith/errors';
import { serveStatic, type StaticOptions } from './static';
import { encodingFor, type Compression } from './compression';
import { nodeHandlerOptions } from './options';
import { prepareTemplate } from './template';
import { untilAbort, requestURL, requestOwner, InvalidRequestURL } from './request';

/** Request-local loader inputs; forwarded values require trustProxy:true. @public */
export interface NodeRequestContext {
  req: IncomingMessage; res: ServerResponse; url: URL; ip?: string;
  requestId: string; nonce?: string; signal: AbortSignal;
  /** Release a loader's acquired resources on success, failure, timeout or abort. */
  onDispose(cleanup: () => void): void;
}
/** @public */
export interface NodeAppContext extends SSRAppContext, NodeRequestContext {}
/** @public */
export interface NodeHeadInput extends Omit<SSRHeadInput, 'jsonLd'> { jsonLd?: Record<string, unknown> | Array<Record<string, unknown>>; }
/** @public */
export interface NodeI18nInput extends Omit<SSRI18nInput, 'messages'> { messages?: Record<string, unknown>; }
/** @public */
export interface NodeHandlerOptions {
  template: string | ((context: NodeRequestContext) => string | Promise<string>);
  /** Must return a fresh App; ownership always transfers to this request. */
  app: (context: NodeAppContext) => App | Promise<App>;
  state?: Record<string, unknown> | ((url: string, context: NodeRequestContext) => Record<string, unknown> | Promise<Record<string, unknown>>);
  head?: NodeHeadInput | ((url: string, context: NodeRequestContext) => NodeHeadInput | Promise<NodeHeadInput>);
  i18n?: NodeI18nInput | ((url: string, context: NodeRequestContext) => NodeI18nInput | Promise<NodeI18nInput>);
  stream?: boolean; timeout?: number; trustProxy?: boolean;
  health?: string | false;
  cacheControl?: string | ((req: IncomingMessage, result: Readonly<SSRResult>) => string);
  csp?: { nonce?: boolean; policy?: string };
  staticDir?: string; staticOptions?: StaticOptions;
  /** @deprecated Use staticDir and staticOptions. */
  static?: StaticOptions & { root: string };
  compression?: Compression; etag?: boolean;
  routes?: string[] | ((path: string) => boolean);
  onError?: (error: unknown, req: IncomingMessage, res: ServerResponse) => void;
  onAbort?: (req: IncomingMessage) => void;
  logger?: { info(message: string, fields: Record<string, unknown>): void; error(message: string, fields: Record<string, unknown>): void };
}
/** Uses the shared SSR engine and native transport backpressure. @public */
export function createNodeHandler(rawOptions: NodeHandlerOptions) {
  const resolved = nodeHandlerOptions.resolve(rawOptions);
  if (!isAsyncLocalStorageAvailable()) throw createReservedError('ZEN-1803');
  if (typeof resolved.template === 'string' && !resolved.template.includes('<!--zen-outlet-->')) throw createReservedError('ZEN-1802');
  const options = { ...resolved, csp: { nonce: true, ...resolved.csp } };
  const assets = options.staticDir ? serveStatic(options.staticDir, { compression: options.compression, etag: options.etag, ...options.staticOptions }) : options.static ? serveStatic(options.static) : undefined;
  const log = options.logger ?? logger;
  return async (req: IncomingMessage, res: ServerResponse, next?: () => void): Promise<void> => {
    if (res.writableEnded || res.destroyed) return;
    const requestId = randomUUID(), start = Date.now(); res.setHeader('X-Request-Id', requestId);
    const controller = new AbortController(), scope = requestOwner();
    let timedOut = false, reported = false, abortNotified = false;
    const notifyAbort = () => {
      controller.abort();
      if (!abortNotified) { abortNotified = true; try { options.onAbort?.(req); } catch {} }
    };
    const complete = () => {
      if (reported) return; reported = true;
      req.off('aborted', notifyAbort); res.off('close', closed); res.off('finish', complete);
      try { log.info('Request complete.', { requestId, method: req.method, status: res.statusCode, durationMs: Date.now() - start }); } catch {}
    };
    const closed = () => { if (!res.writableEnded && !timedOut) notifyAbort(); complete(); };
    req.once('aborted', notifyAbort); res.once('close', closed); res.once('finish', complete);
    if (req.aborted) notifyAbort();
    let deadline: ReturnType<typeof setTimeout> | undefined, closeStream: (() => Promise<void>) | undefined;
    const fail = (error: unknown) => {
      try { options.onError?.(error, req, res); } catch {}
      try { log.error('Request failed.', { requestId }); } catch {}
      if (res.writableEnded || res.destroyed) return;
      if (res.headersSent) { res.destroy(); return; }
      // A hook may have set representation headers before failing. Never send
      // a plain error marked as Brotli/gzip or as cacheable rendered content.
      for (const header of ['Content-Encoding', 'Content-Length', 'ETag', 'Cache-Control', 'Content-Security-Policy']) res.removeHeader(header);
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      res.statusCode = timedOut || code === 'ZEN-1801' ? 503 : error instanceof InvalidRequestURL ? 400 : 500;
      res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.setHeader('Cache-Control', 'no-store');
      res.end(res.statusCode === 503 ? 'Render timeout' : res.statusCode === 400 ? 'Bad Request' : 'Internal Server Error');
    };
    try {
      await scope.run(async () => {
        if (controller.signal.aborted) return;
        if (assets && await assets(req, res)) return;
        if (res.writableEnded || res.destroyed || controller.signal.aborted) return;
        const { url, ip } = requestURL(req, options.trustProxy ?? false), path = url.pathname;
        if (options.health !== false && path === (options.health ?? '/healthz')) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end('{"status":"ok"}'); return; }
        const accepted = !options.routes || (Array.isArray(options.routes) ? options.routes.includes(path) : options.routes(path));
        if (!accepted) { if (next) next(); else { res.statusCode = 404; res.end('Not Found'); } return; }
        deadline = setTimeout(() => { timedOut = true; controller.abort(); }, options.timeout ?? 10000);
        const nonce = options.csp.nonce ? randomBytes(16).toString('base64') : undefined;
        const context: NodeRequestContext = Object.freeze({ req, res, url, ip, requestId, nonce, signal: controller.signal, onDispose: (fn: () => void) => scope.owner.addCleanup(fn) });
        const load = <T>(fn: () => T | Promise<T>) => untilAbort(Promise.resolve().then(() => { if (controller.signal.aborted) throw new Error('Request aborted.'); return fn(); }), controller.signal);
        const template = await load(() => typeof options.template === 'function' ? options.template(context) : options.template);
        const frame = prepareTemplate(template, url, nonce); scope.cleanup.add(frame);
        const input = await load(() => typeof options.state === 'function' ? options.state(url.pathname + url.search, context) : options.state ?? {});
        const state = cloneRequestState(input, { cleanup: scope.cleanup });
        const head = await load(() => typeof options.head === 'function' ? options.head(url.pathname + url.search, context) : options.head);
        const i18n = await load(() => typeof options.i18n === 'function' ? options.i18n(url.pathname + url.search, context) : options.i18n);
        const renderOptions = { app: (appContext: SSRAppContext) => options.app({ ...context, ...appContext }), route: path, signal: controller.signal, head, i18n, nonce };
        const rendered = (result: SSRResult) => {
          const cache = typeof options.cacheControl === 'function' ? options.cacheControl(req, result) : options.cacheControl ?? 'no-store';
          if (typeof cache !== 'string' || /[\r\n]/.test(cache)) throw createReservedError('ZEN-1001', { details: { expected: 'a Cache-Control header string' } });
          res.setHeader('Cache-Control', cache);
        };
        let source: Readable;
        if (options.stream !== false) {
          const iterator = renderToStream(frame.source, state, { ...renderOptions, shell: frame.shell, ...(typeof options.cacheControl === 'function' ? { onRendered: rendered } : { onReady: (metadata: Omit<SSRResult, 'html'>) => rendered({ ...metadata, html: '' }) }), chunkSize: 16384 });
          closeStream = async () => { await iterator.return(undefined); };
          // Resolve before pipeline owns the response: an SSR failure must still
          // produce a normal 500/503, not a premature socket destruction.
          const first = await untilAbort(iterator.next(), controller.signal);
          source = Readable.from((async function* () {
            if (!first.done) yield first.value.html;
            for await (const chunk of iterator) yield chunk.html;
          })(), { objectMode: false, highWaterMark: 16384 });
        } else {
          const result = await renderToString(frame.source, state, renderOptions); rendered(result);
          source = Readable.from([frame.shell.open(result) + result.html + frame.shell.close], { objectMode: false });
        }
        scope.cleanup.add(() => { source.destroy(); });
        if (controller.signal.aborted || res.writableEnded || res.destroyed) return;
        const vary = String(res.getHeader('Vary') ?? '').split(',').map(value => value.trim()).filter(Boolean);
        if (!vary.some(value => value.toLowerCase() === 'accept-encoding')) vary.push('Accept-Encoding');
        res.setHeader('Vary', vary.join(', '));
        const encoding = encodingFor(req.headers['accept-encoding'], options.compression ?? true);
        if (encoding === false) { res.statusCode = 406; res.end(); return; }
        res.statusCode = 200; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('X-Content-Type-Options', 'nosniff');
        if (encoding) res.setHeader('Content-Encoding', encoding);
        if (nonce || options.csp.policy) res.setHeader('Content-Security-Policy', options.csp.policy?.replaceAll('{{nonce}}', nonce ?? '') ?? `default-src 'self'; script-src 'self' 'nonce-${nonce}'; style-src 'self' 'nonce-${nonce}'`);
        if (req.method === 'HEAD') { res.end(); return; }
        if (encoding) await pipeline(source, encoding === 'br' ? createBrotliCompress() : createGzip(), res, { signal: controller.signal });
        else await pipeline(source, res, { signal: controller.signal });
      });
    } catch (error) {
      if (!controller.signal.aborted || timedOut) scope.run(() => fail(timedOut ? createReservedError('ZEN-1801', { cause: error }) : error));
    } finally {
      if (deadline !== undefined) clearTimeout(deadline);
      controller.abort();
      // SSR is a child lifetime of loader/request acquisitions, including HEAD
      // and 406 paths that never start the Readable transport. Await its return.
      if (closeStream) { try { await scope.run(closeStream); } catch (error) { scope.run(() => fail(error)); } }
      try { scope.run(() => scope.dispose()); } catch (error) { scope.run(() => fail(error)); }
      if (res.writableEnded || res.destroyed) complete();
    }
  };
}
/** @public */
export type NodeAdapterOptions = NodeHandlerOptions;
/** @public */
export type NodeHandler = ReturnType<typeof createNodeHandler>;
