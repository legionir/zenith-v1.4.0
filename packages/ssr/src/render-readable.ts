// packages/ssr/src/render-readable.ts
//
// ReadableStream روی استریم SSR — استخراج مکانیکی از render.ts،
// بدون تغییر رفتار (#40).

import { renderToStream, type StreamOptions } from './render-stream';


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
