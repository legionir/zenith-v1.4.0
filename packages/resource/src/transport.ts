import { resourceHttpError } from '@zenith/errors';
import type { CrudResult, ResourceConfig } from './types';

/** Private transport request. @internal */
export interface TransportRequest { config: Required<ResourceConfig>; method: string; url: string; body: string | undefined; signal: AbortSignal; }

function isNetworkError(err: unknown): boolean {
    return (
      err instanceof TypeError ||
      (err instanceof Error &&
        (err.message.includes('network') ||
          err.message.includes('NetworkError') ||
          err.message.includes('Failed to fetch') ||
          err.message.includes('Load failed') ||
          err.name === 'TimeoutError'))
    );
  }

function waitForRetry(ms: number, signal: AbortSignal): Promise<boolean> {
    if (signal.aborted) return Promise.resolve(false);
    return new Promise(resolve => {
      const finish = (completed: boolean) => { clearTimeout(timer); signal.removeEventListener('abort', abort); resolve(completed); };
      const abort = () => finish(false);
      const timer = setTimeout(() => finish(true), ms);
      signal.addEventListener('abort', abort, { once: true }); if (signal.aborted) abort();
    });
  }

/** Native transport retry/decode boundary. @internal */
export async function executeWithRetry<R>(options: TransportRequest): Promise<CrudResult<R>> {
  const { config, method, url, body, signal } = options;
    let lastError: string | undefined;
    // BUG-RES-03 (v1.3.0): Non-GET methods now retry on network errors too.
    // Previously non-GET was never retried (maxRetries = 0 for POST/PUT/DELETE)
    // which meant a transient network error (DNS flake, connection reset) killed
    // the mutation outright. Now we retry network errors for all methods.
    // HTTP errors (4xx/5xx) still only retry for GET (idempotent).
    const maxRetries = config.retryCount;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal.aborted) return { success: false, error: 'aborted' };
      try {
        const options: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...config.headers,
          },
          credentials: config.credentials,
          // FEATURE (v1.0.0): ارسال signal برای امکان abort توسط destroy().
          // وقتی destroy() صدا زده شود، abort() این signal را reject می‌کند
          // و fetch بلافاصله با AbortError لغو می‌شود.
          // IMP-RES-02 (v1.3.0): Also listen to the per-request controller so
          // that rapid successive calls cancel the previous in-flight request.
          signal,
        };

        if (body !== undefined) {
          options.body = body;
        }

        const res = await fetch(url, options);

        if (signal.aborted) return { success: false, error: 'aborted' };
        if (!res.ok) {
          throw resourceHttpError(url, res.status, res.statusText);
        }

        // برای DELETE، ممکن است response خالی باشد.
        if (res.status === 204) {
          return { success: true };
        }

        const contentType = res.headers.get('content-type') || '';
        const data: unknown = contentType.includes('application/json') ? await res.json() : await res.text();

        if (signal.aborted) return { success: false, error: 'aborted' };
        // The caller-selected response generic is the transport decode boundary.
        return { success: true, data: data as R };
      } catch (err) {
        // FEATURE (v1.0.0): AbortError نباید retry شود — destroy() آن را
        // صدا زده و نباید منابع (تلاش مجدد، wait) هدر برود. for-loop را با
        // return مستقیم ترک می‌کنیم تا نتیجه‌ی 'aborted' برگردد.
        if (signal.aborted || (err instanceof Error && err.name === 'AbortError')) {
          return { success: false, error: 'aborted' };
        }
        lastError = err instanceof Error ? err.message : String(err);

        // BUG-RES-03 (v1.3.0): فقط خطاهای شبکه برای non-GET retry می‌شوند.
        // HTTP errors (4xx/5xx) برای non-GET مستقیماً به caller می‌روند.
        if (method !== 'GET' && !isNetworkError(err)) {
          return { success: false, error: lastError };
        }

        // اگر این آخرین تلاش نیست، صبر کن و دوباره تلاش کن.
        if (attempt < maxRetries) {
          if (!await waitForRetry(config.retryDelay * (attempt + 1), signal)) return { success: false, error: 'aborted' };
        }
      }
    }

    return { success: false, error: lastError };
  }
