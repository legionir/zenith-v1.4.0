import { signal, type Signal } from '@zenith/state';
import { deprecate, resourceDestroyedError } from '@zenith/errors';
import { logger } from '@zenith/logger';
import type { Disposable } from '@zenith/shared';
import { createCache, type Cache } from '@zenith/cache';
import type { ResourceState, ResourceConfig, CrudResult } from './types';
import type { ResourceScope } from './scope';
import { request } from './request';
import { resetResource, disposeResource, registerDOMCleanup, unregisterDOMCleanup } from './lifecycle';
import { captureSnapshot, finalizeSnapshot, rollbackSnapshot, processQueue } from './mutations';
/** A reactive endpoint owner; helpers retain its state and request generations. @public */
export class Resource<T = unknown> implements Disposable {
  private _signal: Signal<ResourceState<T>>;
  private _config: Required<ResourceConfig>;
  private _dedupeCache: Cache<Promise<CrudResult<unknown>>>;
  private _refreshTimer: ReturnType<typeof setInterval> | null = null;
  private _mutationQueue: Array<{ op: () => Promise<CrudResult<unknown>>; rollback?: () => void }> = [];
  private _optimisticSnapshots: Map<number, T | null> = new Map();
  private _optimisticVersion = 0;
  private _disposing = false;
  private _domCleanups = new Map<() => void, Set<symbol>>();
  private _abortController: AbortController = new AbortController();
  private _currentRequestController: AbortController | null = null;
  private _requestGeneration = 0;
  private _lifecycleGeneration = 0;
  private _lastReadCacheKey: string | null = null;
  private _destroyed = false;
  private _destroyStack: string | null = null;

  constructor(config: ResourceConfig) {
    this._signal = signal<ResourceState<T>>({
      data: null,
      loading: false,
      error: null,
      lastUpdated: null,
      isStale: false,
    });

    this._config = {
      staleTime: 60000,
      retryCount: 3,
      retryDelay: 1000,
      optimistic: true,
      headers: {},
      credentials: 'same-origin',
      // FEATURE (v0.4.0): پیش‌فرض swCacheName — documentation-level فقط.
      // خود Resource از این مقدار استفاده نمی‌کند؛ صرفاً برای انطباق با SW.
      swCacheName: config.swCacheName || '',
      ...config,
    };

    // #144: رجیستری dedupe. ttl=never + پاک‌سازی در settle ⇒ فقط join
    // هم‌زمانی (نتیجهٔ settled هرگز سرو نمی‌شود — رفتار `_inflightRequests`
    // قبلی). ظرفیت 32 صرف دفاع در برابر نشت است (LRU).
    this._dedupeCache = createCache<Promise<CrudResult<unknown>>>({ ttl: 'never', maxSize: 32 });
  }

  /** دریافت Signal وضعیت. */
  get signal(): Signal<ResourceState<T>> {
    return this._signal;
  }

  /** دریافت داده‌ی فعلی. */
  get data(): T | null {
    return this._signal.get().data;
  }

  /** آیا در حال loading است؟ */
  get loading(): boolean {
    return this._signal.get().loading;
  }

  /** آیا خطا وجود دارد؟ */
  get error(): string | null {
    return this._signal.get().error;
  }

  /**
   * GET — لیست یا تک آیتم.
   *
   * @param id اگر مشخص باشد، تک آیتم fetch می‌شود (GET /api/users/:id).
   *           اگر null باشد، لیست fetch می‌شود (GET /api/users).
   * @param force اگر true باشد، cache نادیده گرفته می‌شود.
   */
  async list(force = false): Promise<CrudResult<T>> {
    // FEATURE (v1.0.0): پیام خطای بهبودیافته با stack trace.
    if (this._destroyed) {
      const err = resourceDestroyedError(
        this._config.url,
        'list()',
        this._destroyStack || undefined,
      );
      logger.error('[Zenith Resource] Operation requested after disposal.', { code: err.code });
      return { success: false, error: err.toUserString() };
    }
    return this._request('GET', null, undefined, force);
  }

  async read(id: string | number, force = false): Promise<CrudResult<T>> {
    // FEATURE (v1.0.0): پیام خطای بهبودیافته با stack trace.
    if (this._destroyed) {
      const err = resourceDestroyedError(
        this._config.url,
        `read(${id})`,
        this._destroyStack || undefined,
      );
      logger.error('[Zenith Resource] Operation requested after disposal.', { code: err.code });
      return { success: false, error: err.toUserString() };
    }
    return this._request('GET', id, undefined, force);
  }

  /**
   * POST — ایجاد آیتم جدید.
   */
  async create(body: unknown): Promise<CrudResult<T>> {
    // FEATURE (v1.0.0): پیام خطای بهبودیافته با stack trace.
    if (this._destroyed) {
      const err = resourceDestroyedError(
        this._config.url,
        'create()',
        this._destroyStack || undefined,
      );
      logger.error('[Zenith Resource] Operation requested after disposal.', { code: err.code });
      return { success: false, error: err.toUserString() };
    }
    return this._request('POST', null, body);
  }

  /**
   * PUT — به‌روزرسانی آیتم.
   */
  async update(id: string | number, body: unknown): Promise<CrudResult<T>> {
    // FEATURE (v1.0.0): پیام خطای بهبودیافته با stack trace.
    if (this._destroyed) {
      const err = resourceDestroyedError(
        this._config.url,
        `update(${id})`,
        this._destroyStack || undefined,
      );
      logger.error('[Zenith Resource] Operation requested after disposal.', { code: err.code });
      return { success: false, error: err.toUserString() };
    }
    return this._request('PUT', id, body);
  }

  /**
   * DELETE — حذف آیتم.
   */
  async delete(id: string | number): Promise<CrudResult<T>> {
    // FEATURE (v1.0.0): پیام خطای بهبودیافته با stack trace.
    if (this._destroyed) {
      const err = resourceDestroyedError(
        this._config.url,
        `delete(${id})`,
        this._destroyStack || undefined,
      );
      logger.error('[Zenith Resource] Operation requested after disposal.', { code: err.code });
      return { success: false, error: err.toUserString() };
    }
    return this._request('DELETE', id);
  }

  /**
   * علامت‌گذاری داده به‌عنوان stale (نیاز به refresh).
   */
  invalidate(): void {
    if (this._destroyed) return;
    this._signal.set({ ...this._signal.get(), isStale: true });
  }

  /**
   * به‌روزرسانی دستی داده‌ها (بدون fetch).
   * مفید برای optimistic updates.
   */
  setData(updater: (old: T | null) => T | null): void {
    if (this._destroyed) return;
    const current = this._signal.get();
    const newData = updater(current.data);
    this._signal.set({
      ...current,
      data: newData,
      lastUpdated: Date.now(),
    });
  }

  /**
   * BUG-RES-04 (v1.3.0): Register a DOM element that depends on this Resource.
   * When destroy() is called, all registered DOM cleanup functions are invoked
   * to remove element references, preventing memory leaks.
   *
   * Usage from @zenith/resource/directive:
   *   resource.registerDOMElement(el, () => { el.removeAttribute('zen-state'); });
   *
   * @param cb A cleanup function that removes DOM references.
   */
  registerDOMCleanup(cb: () => void): () => void { return registerDOMCleanup(this.helperScope, cb); }

  /**
   * BUG-RES-04 (v1.3.0): Unregister a DOM cleanup function.
   * Called automatically when the element's zen:detach event fires.
   */
  unregisterDOMCleanup(cb: () => void): void { unregisterDOMCleanup(this.helperScope, cb); }

  /**
   * @deprecated #116 — نام قدیمی چرخهٔ عمر؛ از `dispose()` استفاده کن
   * (ZEN-DEPR-023؛ حذف در ۲.۰ — DEC-026). `reset()` دوباره قابل-dispose می‌کند.
   */
  destroy(): void {
    deprecate('ZEN-DEPR-023', 'resource.destroy()', 'resource.dispose()');
    this.dispose();
  }

  /**
   * Start background refresh on interval.
   * بعد از staleTime، داده در پس‌زمینه refresh می‌شود.
   */
  startAutoRefresh(intervalMs?: number): void {
    // FIX (v1.2.3): guard برای destroyed — اگر Resource بعد از destroy دوباره
    // auto-refresh را start کرد، تایمر ساخته می‌شد ولی callback روی signal تخریب‌شده
    // می‌نوشت و خطا می‌داد. حالا early return.
    if (this._destroyed) return;
    if (this._refreshTimer) clearInterval(this._refreshTimer);
    const interval = intervalMs || this._config.staleTime;
    this._refreshTimer = setInterval(() => {
      // FIX (v1.2.3): re-check destroyed داخل callback — ممکن است بین start و
      // tick، destroy() صدا زده شده باشد.
      if (this._destroyed) return;
      if (this._signal.get().data) {
        // SWR: return stale data immediately, revalidate in background
        this._signal.set({ ...this._signal.get(), isStale: true });
        void this.list(true).then(() => {});
      }
    }, interval);
  }

  stopAutoRefresh(): void {
    if (this._refreshTimer) {
      clearInterval(this._refreshTimer);
      this._refreshTimer = null;
    }
  }

  /**
   * Optimistic create: آیتم را فوراً به لیست اضافه کن، اگر خطا داد حذف کن.
   */
  // Legacy optimistic operations assume property-bag rows; this is not a decoder.
  async createOptimistic(body: Record<string, unknown>): Promise<CrudResult<T>> {
    // BUG-RES-02 (v1.3.0): versioned snapshot to prevent cross-update corruption.
    const version = this._captureSnapshot();

    const tempId = `temp-${Date.now()}`;

    // Optimistic: add to list immediately
    const snapshot = this._optimisticSnapshots.get(version);
    if (Array.isArray(snapshot)) {
      this.setData((old) => [...(old as unknown as Record<string, unknown>[]), { ...body, id: tempId, _optimistic: true }] as unknown as T);
    }

    // Actual request
    const pending = this.create(body); const generation = this._requestGeneration;
    const result = await pending;
    if (generation !== this._requestGeneration || this._destroyed) { this._finalizeSnapshot(version); return { success: false, error: 'aborted' }; }
    if (!result.success) {
      // BUG-RES-02: versioned rollback — only reverted if no newer update saved.
      this._rollbackSnapshot(version);
    } else if (Array.isArray(this._signal.get().data) && result.data) {
      this._finalizeSnapshot(version);
      // Replace temp item with real one
      this.setData(
        (old) => (old as unknown as Record<string, unknown>[]).map((item) => (item.id === tempId ? result.data : item)) as unknown as T,
      );
    } else if (Array.isArray(this._signal.get().data) && result.data === undefined) {
      this._finalizeSnapshot(version);
      // FIX (v1.2.3): سرور ۲۰۴ (No Content) برگردانده — یعنی آیتم ساخته شد ولی
      // body ندارد. قبلاً در این حالت tempId در UI باقی می‌ماند. حالا tempId را
      // از لیست فیلتر می‌کنیم (به‌جای map کردن).
      this.setData((old) => (old as unknown as Record<string, unknown>[]).filter((item) => item.id !== tempId) as unknown as T);
    } else {
      this._finalizeSnapshot(version);
    }
    return result;
  }

  /**
   * Optimistic update: آیتم را فوراً آپدیت کن، اگر خطا داد rollback کن.
   */
  async updateOptimistic(id: string | number, body: Record<string, unknown>): Promise<CrudResult<T>> {
    // BUG-RES-02 (v1.3.0): versioned snapshot to prevent cross-update corruption.
    const version = this._captureSnapshot();

    // Optimistic: update immediately
    const snapshot = this._optimisticSnapshots.get(version);
    if (Array.isArray(snapshot)) {
      this.setData(
        (old) =>
          (old as unknown as Record<string, unknown>[]).map((item) =>
            String(item.id) === String(id) ? { ...item, ...body } : item,
          ) as unknown as T,
      );
    }

    const pending = this.update(id, body); const generation = this._requestGeneration;
    const result = await pending;
    if (generation !== this._requestGeneration || this._destroyed) { this._finalizeSnapshot(version); return { success: false, error: 'aborted' }; }
    if (!result.success) {
      // BUG-RES-02: versioned rollback
      this._rollbackSnapshot(version);
    } else {
      this._finalizeSnapshot(version);
    }
    return result;
  }

  /**
   * Optimistic delete: آیتم را فوراً حذف کن، اگر خطا داد rollback کن.
   */
  async deleteOptimistic(id: string | number): Promise<CrudResult<T>> {
    // BUG-RES-02 (v1.3.0): versioned snapshot to prevent cross-update corruption.
    const version = this._captureSnapshot();

    // Optimistic: remove immediately
    const snapshot = this._optimisticSnapshots.get(version);
    if (Array.isArray(snapshot)) {
      this.setData((old) => (old as unknown as Record<string, unknown>[]).filter((item) => String(item.id) !== String(id)) as unknown as T);
    }

    const pending = this.delete(id); const generation = this._requestGeneration;
    const result = await pending;
    if (generation !== this._requestGeneration || this._destroyed) { this._finalizeSnapshot(version); return { success: false, error: 'aborted' }; }
    if (!result.success) {
      // BUG-RES-02: versioned rollback
      this._rollbackSnapshot(version);
    } else if (result.data === undefined) {
      // FIX (v1.2.3): سرور ۲۰۴ (No Content) برگردانده — یعنی حذف موفق بود ولی
      // body ندارد. قبلاً در این حالت isStale:false باقی می‌ماند و داده‌های stale
      // به‌روزرسانی نمی‌شدند. حالا isStale:true ست می‌کنیم تا list() بعدی revalidate کند.
      this._finalizeSnapshot(version);
      this._signal.set({ ...this._signal.get(), isStale: true });
    } else {
      this._finalizeSnapshot(version);
    }
    return result;
  }

  /**
   * اضافه کردن یک mutation به صف.
   * Mutations به ترتیب اجرا می‌شوند تا race condition جلوگیری شود.
   */
  enqueueMutation(op: () => Promise<CrudResult<unknown>>, rollback?: () => void): void {
    if (this._destroyed) return;
    this._mutationQueue.push({ op, rollback });
    void this._processQueue();
  }

  private _processing = false;

  /** Reset state and cancellation generations; revive a disposed signal. */
  reset(): void { resetResource(this.helperScope); }
  /** Release DOM callbacks, requests and registration tokens, once. */
  dispose(): void { disposeResource(this.helperScope); }
  private _captureSnapshot(): number { return captureSnapshot(this.helperScope); }
  private _finalizeSnapshot(version: number): void { finalizeSnapshot(this.helperScope, version); }
  private _rollbackSnapshot(version: number): void { rollbackSnapshot(this.helperScope, version); }
  private _processQueue(): Promise<void> { return processQueue(this.helperScope); }
  private _request(method: string, id: string | number | null, body?: unknown, force = false): Promise<CrudResult<T>> {
    return request(this.helperScope, { method, id, body, force });
  }
  private _helperScope?: ResourceScope<T>;
  private get helperScope(): ResourceScope<T> {
    const engine = this;
    return this._helperScope ??= {
      owner: engine,
      get _signal() { return engine._signal; }, set _signal(value) { engine._signal = value; },
      get _config() { return engine._config; }, set _config(value) { engine._config = value; },
      get _dedupeCache() { return engine._dedupeCache; }, set _dedupeCache(value) { engine._dedupeCache = value; },
      get _refreshTimer() { return engine._refreshTimer; }, set _refreshTimer(value) { engine._refreshTimer = value; },
      get _mutationQueue() { return engine._mutationQueue; }, set _mutationQueue(value) { engine._mutationQueue = value; },
      get _optimisticSnapshots() { return engine._optimisticSnapshots; }, set _optimisticSnapshots(value) { engine._optimisticSnapshots = value; },
      get _optimisticVersion() { return engine._optimisticVersion; }, set _optimisticVersion(value) { engine._optimisticVersion = value; },
      get _disposing() { return engine._disposing; }, set _disposing(value) { engine._disposing = value; },
      get _domCleanups() { return engine._domCleanups; }, set _domCleanups(value) { engine._domCleanups = value; },
      get _abortController() { return engine._abortController; }, set _abortController(value) { engine._abortController = value; },
      get _currentRequestController() { return engine._currentRequestController; }, set _currentRequestController(value) { engine._currentRequestController = value; },
      get _requestGeneration() { return engine._requestGeneration; }, set _requestGeneration(value) { engine._requestGeneration = value; },
      get _lifecycleGeneration() { return engine._lifecycleGeneration; }, set _lifecycleGeneration(value) { engine._lifecycleGeneration = value; },
      get _lastReadCacheKey() { return engine._lastReadCacheKey; }, set _lastReadCacheKey(value) { engine._lastReadCacheKey = value; },
      get _destroyed() { return engine._destroyed; }, set _destroyed(value) { engine._destroyed = value; },
      get _destroyStack() { return engine._destroyStack; }, set _destroyStack(value) { engine._destroyStack = value; },
      get _processing() { return engine._processing; }, set _processing(value) { engine._processing = value; },
      setData: updater => engine.setData(updater), stopAutoRefresh: () => engine.stopAutoRefresh(),
    };
  }
}
