// packages/ssr/src/render-stream.ts
//
// استریم SSR — استخراج مکانیکی از render.ts، بدون تغییر رفتار (#40).

import { cloneRequestState } from './request-state';
import { serializeDOMChunks } from './dom-stream';
import { createDisposer } from '@zenith/shared';
import { renderToString, renderWithRoot } from './render-ssr';
import { generateHydrationScript } from './render-page';
import { createAbortError, raceWithAbort } from './render-abort';
import type { RenderOptions } from './render-context';
import { safeScriptValue, type SSRResult } from './render-serialize';


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
