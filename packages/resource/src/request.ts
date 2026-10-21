import { createCacheKey } from './cache-key';
import { executeWithRetry } from './transport';
import type { CrudResult } from './types';
import type { ResourceScope } from './scope';
/** Private request identity and cancellation inputs. @internal */
export interface RequestOptions { method: string; id: string | number | null; body?: unknown; force?: boolean; }
/** Owner request orchestration, with live field forwarding. @internal */
export async function request<T>(scope: ResourceScope<T>, options: RequestOptions): Promise<CrudResult<T>> {
  const { method, id, body, force = false } = options;
    // FEATURE (v1.0.0): اگر Resource destroy شده، درخواست جدید رد می‌شود.
    // این یک لایه‌ی دفاعی اضافی است (در کنار guard های متدهای public).
    if (scope._destroyed) return { success: false, error: 'Resource destroyed' };
    // ساخت URL.
    const url = id !== null ? `${scope._config.url}/${encodeURIComponent(String(id))}` : scope._config.url;

    // ── Request Deduplication ──
    // اگر درخواست مشابهی در حال انجام است، به آن بپیوند.
    // FIX (v1.2.3): cacheKey باید شامل body هم باشد. قبلاً POST با body‌های
    // متفاوت به‌اشتباه dedup می‌شدند (چون فقط method+url در key بود). حالا body
    // هم در cacheKey گنجانده می‌شود تا درخواست‌های متفاوت merge نشوند.
    // BUG-RES-01 (v1.3.0): body را canonicalize می‌کنیم تا ترتیب کلیدهای JSON
    // باعث collision نشود. `{a:1,b:2}` و `{b:2,a:1}` حالا cacheKey یکسان دارند.
    let serialized: string | undefined; let cacheKey: string;
    try { serialized = body === undefined ? undefined : JSON.stringify(body); cacheKey = createCacheKey({ method, url, body: serialized === undefined ? undefined : JSON.parse(serialized) }); }
    catch { return { success: false, error: 'Request body must be JSON-serializable' }; }
    // #144: join روی درخواست هم‌زمان یکسان — peek چون entryها promise زنده
    // هستند و delete در settle پاکشان می‌کند؛ هیچ نتیجهٔ settled سرو نمی‌شود.
    if (!force) {
      const inflight = scope._dedupeCache.peek(cacheKey);
      if (inflight) return inflight as Promise<CrudResult<T>>;
    }

    // ── Stale Check ──
    // اگر داده‌ها هنوز stale نشده‌اند و force نیست، skip کن.
    if (!force && method === 'GET') {
      const state = scope._signal.get();
      if (scope._lastReadCacheKey === cacheKey && state.data && state.lastUpdated && !state.isStale) {
        const age = Date.now() - state.lastUpdated;
        if (age < scope._config.staleTime) {
          return { success: true, data: state.data };
        }
      }
    }

    // ── ساخت Request ──
    scope._currentRequestController?.abort();
    const controller = new AbortController(); scope._currentRequestController = controller;
    const generation = ++scope._requestGeneration;
    const current = () => !scope._destroyed && !controller.signal.aborted && generation === scope._requestGeneration;
    const promise = executeWithRetry<T>({ config: scope._config, method, url, body: serialized, signal: controller.signal });
    // #144: `set` مقدار (promise) را برمی‌گرداند ⇒ void برای no-floating-promises.
    void scope._dedupeCache.set(cacheKey, promise);

    // setLoading (فقط برای GET اولیه).
    if (method === 'GET' && !scope._signal.get().data) {
      scope._signal.set({ ...scope._signal.get(), loading: true, error: null });
    }

    try {
      const result = await promise;
      if (scope._dedupeCache.peek(cacheKey) === promise) scope._dedupeCache.delete(cacheKey);

      if (!current()) return { success: false, error: 'aborted' };
      if (result.success && result.data !== undefined) {
        scope._lastReadCacheKey = method === 'GET' ? cacheKey : null;
        scope._signal.set({
          data: result.data,
          loading: false,
          error: null,
          lastUpdated: Date.now(),
          isStale: false,
        });

        // Note: Auto-refresh is not implemented. Data only refreshes when
        // list(force=true) is called or invalidate() + list() is used.
      } else if (result.success) {
        scope._signal.set({ ...scope._signal.get(), loading: false, error: null });
      } else {
        scope._signal.set({
          ...scope._signal.get(),
          loading: false,
          error: result.error || 'Unknown error',
        });
      }

      return result;
    } catch (err) {
      if (scope._dedupeCache.peek(cacheKey) === promise) scope._dedupeCache.delete(cacheKey);
      if (!current()) return { success: false, error: 'aborted' };
      const message = err instanceof Error ? err.message : String(err);
      scope._signal.set({
        ...scope._signal.get(),
        loading: false,
        error: message,
      });
      return { success: false, error: message };
    } finally { if (scope._currentRequestController === controller) scope._currentRequestController = null; }
  }
