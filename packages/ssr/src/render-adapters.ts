// packages/ssr/src/render-adapters.ts
//
// آداپتورهای Node و Edge — استخراج مکانیکی از render.ts،
// بدون تغییر رفتار (#40).

import { randomBytes } from 'node:crypto';
import { createReservedError, ZenithError } from '@zenith/errors';
import { renderToString } from './render-ssr';
import { generateFullPage } from './render-page';
import { createAbortError, raceWithAbort } from './render-abort';
import type { App } from '@zenith/runtime';
import type { SSRHeadInput, SSRI18nInput } from './render-serialize';


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
