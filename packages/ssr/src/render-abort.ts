// packages/ssr/src/render-abort.ts
//
// خطا و abort استریم — استخراج مکانیکی از render.ts، بدون تغییر رفتار (#40).


export function createAbortError(): Error {
  if (typeof DOMException !== 'undefined') {
    return new DOMException('SSR streaming aborted.', 'AbortError');
  }
  const err = new Error('SSR streaming aborted.');
  err.name = 'AbortError';
  return err;
}

export async function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
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
