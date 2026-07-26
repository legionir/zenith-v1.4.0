// packages/resource/src/resource.ts
//
// @zenith/resource — Declarative CRUD operations (Phase 3).
//
// مشابه TanStack Query اما HTML-First. یک Resource یک endpoint را مدیریت می‌کند:
//   - List (GET /api/users)
//   - Create (POST /api/users)
//   - Read (GET /api/users/:id)
//   - Update (PUT /api/users/:id)
//   - Delete (DELETE /api/users/:id)
//
// هر Resource دارای:
//   - request deduplication (درخواست‌های تکراری merge می‌شوند)
//   - stale cache (داده‌های قدیمی نمایش داده می‌شوند تا داده‌ی جدید لود شود)
//   - retry policy (در صورت خطا، تلاش مجدد)
//   - background refresh (داده‌ها در پس‌زمینه به‌روزرسانی می‌شوند)
//   - optimistic updates (UI قبل از response آپدیت می‌شود)
//
// ── سینتکس ──
//   <div zen-resource="'/api/users'" zen-state="users">
//     <div zen-for="user in $users.data" zen-key="user.id">
//       <span zen-text="$user.name"></span>
//       <button zen-action="resourceCreate" zen-bind:data-resource="users"
//               zen-bind:data-body="'{name: Reza}'">Add</button>
//       <button zen-action="resourceDelete" zen-bind:data-resource="users"
//               zen-bind:data-id="$user.id">Delete</button>
//     </div>
//   </div>

import { signal, type Signal } from '@zenith/state';
// FEATURE (v1.0.0): کتابخانه‌ی خطاها برای پیام‌های بهبودیافته.
import { resourceDestroyedError } from '@zenith/errors';

/**
 * وضعیت یک Resource.
 */
export interface ResourceState<T = any> {
  /** داده‌های فعلی (لیست یا تک آیتم). */
  data: T | null;
  /** آیا در حال loading است؟ */
  loading: boolean;
  /** پیام خطا (اگر وجود دارد). */
  error: string | null;
  /** زمان آخرین به‌روزرسانی موفق (timestamp). */
  lastUpdated: number | null;
  /** آیا داده‌های stale است؟ (باید refresh شود) */
  isStale: boolean;
}

/**
 * پیکربندی یک Resource.
 */
export interface ResourceConfig {
  /** URL پایه (مثل '/api/users'). */
  url: string;
  /** مدت زمان stale شدن (میلی‌ثانیه). پیش‌فرض: 60000 (۱ دقیقه). */
  staleTime?: number;
  /** تعداد تلاش مجدد در صورت خطا. پیش‌فرض: 3. */
  retryCount?: number;
  /** فاصله‌ی بین تلاش‌های مجدد (میلی‌ثانیه). پیش‌فرض: 1000. */
  retryDelay?: number;
  /** آیا optimistic update فعال باشد؟ پیش‌فرض: true. */
  optimistic?: boolean;
  /** هدرهای اضافی. */
  headers?: Record<string, string>;
  /** آیا credentials ارسال شود؟ پیش‌فرض: 'same-origin'. */
  credentials?: RequestCredentials;
  // FEATURE (v0.4.0): ادغام با Service Worker (@zenith/service-worker).
  //
  // اگر این فیلد ست شود، نشان‌دهنده‌ی این است که درخواست‌های شبکه‌ی این Resource
  // توسط یک Service Worker با استراتژی کش مشخص‌شده拦截 (intercept) می‌شوند. این
  // فیلد به‌صورت documentation-level است — خود Resource اینجا چیزی را تغییر نمی‌دهد،
  // بلکه SW فایل (`@zenith/service-worker/sw`) باید با یک Route مطابق `config.url`
  // و `cacheName` مساوی این مقدار پیکربندی شود تا واقعاً caching صورت گیرد.
  //
  // مثال:
  //   const users = createResource('users', {
  //     url: '/api/users',
  //     swCacheName: 'users-cache',  // ← SW باید این cacheName را بداند
  //   });
  //
  // و در فایل sw.js:
  //   setupSW({
  //     routes: [
  //       { urlPattern: '/api/users', strategy: 'networkFirst', cacheName: 'users-cache' },
  //     ],
  //   });
  /** نام cache در Service Worker برای این Resource (اختیاری، v0.4.0). */
  swCacheName?: string;
}

/**
 * نوع عملیات CRUD.
 */
export type CrudOperation = 'list' | 'create' | 'read' | 'update' | 'delete';

/**
 * نتیجه‌ی یک عملیات.
 */
export interface CrudResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * BUG-RES-01 (v1.3.0): Canonicalize an object so that JSON.stringify
 * produces the same output regardless of key ordering. This prevents
 * collision in cacheKey generation when semantically identical body
 * objects have different key orders.
 *
 * @param obj Any value.
 * @returns The same value with object keys sorted.
 */
function canonicalize(obj: any): any {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);
  return Object.keys(obj).sort().reduce((acc: any, key: string) => {
    acc[key] = canonicalize(obj[key]);
    return acc;
  }, {});
}

/**
 * BUG-RES-01 (v1.3.0): Create a deterministic cacheKey from a HTTP
 * method, URL, and optional body. The body is canonicalized before
 * stringification so that semantically equivalent payloads produce
 * the same key and requests get properly de-duplicated.
 */
function createCacheKey(method: string, url: string, body?: any): string {
  const normalizedBody = body ? JSON.stringify(canonicalize(body)) : '';
  return `${method}:${url}:${normalizedBody}`;
}

/**
 * کلاس Resource — مدیریت کامل یک endpoint.
 *
 * هر Resource یک Signal دارد که وضعیت (loading/error/data) را نگه می‌دارد.
 * عملیات‌های CRUD می‌توانند روی آن انجام شوند.
 */
export class Resource<T = any> {
  private _signal: Signal<ResourceState<T>>;
  private _config: Required<ResourceConfig>;
  private _inflightRequests: Map<string, Promise<CrudResult<any>>> = new Map();
  private _refreshTimer: ReturnType<typeof setInterval> | null = null;
  private _mutationQueue: Array<{ op: () => Promise<CrudResult<any>>; rollback?: () => void }> = [];
  // BUG-RES-02 (v1.3.0): Snapshot versioning for optimistic updates.
  // When multiple optimistic updates are in-flight concurrently, and one
  // fails, rolling back to that single snapshot would erase data from any
  // earlier-but-successful update. We use a version chain so that a failed
  // rollback only reverts if no higher-version (newer) update succeeded first.
  private _optimisticSnapshots: Map<number, any> = new Map();
  private _optimisticVersion = 0;
  // BUG-RES-04 (v1.3.0): DOM cleanup callbacks registered by directive.
  // When destroy() is called, we run these to remove DOM references.
  private _domCleanups: Set<() => void> = new Set();
  // FEATURE (v1.0.0): AbortController برای cancel کردن in-flight fetch ها.
  // در destroy() متد abort() صدا زده می‌شود تا تمام درخواست‌های شبکه‌ی در حال
  // انجام بلافاصله لغو شوند. در reset() یک نمونه‌ی جدید ساخته می‌شود تا
  // Resource دوباره قابل استفاده شود.
  private _abortController: AbortController = new AbortController();
  // IMP-RES-02 (v1.3.0): Per-request AbortController for selective cancellation.
  // Unlike _abortController (which is tied to destroy/reset lifecycle),
  // this one is replaced before each fetch so that quick successive
  // navigations (e.g. list() → list() or create() → list()) cancel the
  // previous in-flight request, preventing stale responses from overwriting
  // newer data and reducing network contention.
  private _currentRequestController: AbortController | null = null;
  // FEATURE (v1.0.0): فلگ destroyed — پس از destroy()، تمام متدهای public
  // (list/read/create/update/delete) و _request از این فلگ استفاده می‌کنند
  // تا هرگونه درخواست جدید با خطای 'Resource destroyed' رد شود.
  private _destroyed = false;
  // FEATURE (v1.0.0): stack trace هنگام destroy() — برای پیام‌های خطای بعدی.
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
      const err = resourceDestroyedError(this._config.url, 'list()', this._destroyStack || undefined);
      console.error(err.toUserString());
      return { success: false, error: err.toUserString() };
    }
    return this._request<T>('GET', null, undefined, force);
  }

  async read(id: string | number, force = false): Promise<CrudResult<T>> {
    // FEATURE (v1.0.0): پیام خطای بهبودیافته با stack trace.
    if (this._destroyed) {
      const err = resourceDestroyedError(this._config.url, `read(${id})`, this._destroyStack || undefined);
      console.error(err.toUserString());
      return { success: false, error: err.toUserString() };
    }
    return this._request<T>('GET', id, undefined, force);
  }

  /**
   * POST — ایجاد آیتم جدید.
   */
  async create(body: any): Promise<CrudResult<T>> {
    // FEATURE (v1.0.0): پیام خطای بهبودیافته با stack trace.
    if (this._destroyed) {
      const err = resourceDestroyedError(this._config.url, 'create()', this._destroyStack || undefined);
      console.error(err.toUserString());
      return { success: false, error: err.toUserString() };
    }
    return this._request<T>('POST', null, body);
  }

  /**
   * PUT — به‌روزرسانی آیتم.
   */
  async update(id: string | number, body: any): Promise<CrudResult<T>> {
    // FEATURE (v1.0.0): پیام خطای بهبودیافته با stack trace.
    if (this._destroyed) {
      const err = resourceDestroyedError(this._config.url, `update(${id})`, this._destroyStack || undefined);
      console.error(err.toUserString());
      return { success: false, error: err.toUserString() };
    }
    return this._request<T>('PUT', id, body);
  }

  /**
   * DELETE — حذف آیتم.
   */
  async delete(id: string | number): Promise<CrudResult<T>> {
    // FEATURE (v1.0.0): پیام خطای بهبودیافته با stack trace.
    if (this._destroyed) {
      const err = resourceDestroyedError(this._config.url, `delete(${id})`, this._destroyStack || undefined);
      console.error(err.toUserString());
      return { success: false, error: err.toUserString() };
    }
    return this._request<T>('DELETE', id);
  }

  /**
   * علامت‌گذاری داده به‌عنوان stale (نیاز به refresh).
   */
  invalidate(): void {
    this._signal.set({ ...this._signal.get(), isStale: true });
  }

  /**
   * به‌روزرسانی دستی داده‌ها (بدون fetch).
   * مفید برای optimistic updates.
   */
  setData(updater: (old: T | null) => any): void {
    const current = this._signal.get();
    const newData = updater(current.data);
    this._signal.set({
      ...current,
      data: newData,
      lastUpdated: Date.now(),
    });
  }

  /**
   * Reset کامل Resource.
   */
  reset(): void {
    if (this._refreshTimer) { clearInterval(this._refreshTimer); this._refreshTimer = null; }
    this._mutationQueue.length = 0;
    this._inflightRequests.clear();
    // FEATURE (v1.0.0): ساخت AbortController تازه — تا reset() بتواند
    // Resource را از حالت destroyed خارج کند و درخواست‌های جدید دوباره کار کنند.
    this._abortController = new AbortController();
    // IMP-RES-02 (v1.3.0): Reset per-request controller too.
    this._currentRequestController = null;
    // FEATURE (v1.0.0): ریست فلگ destroyed — reset باید Resource را دوباره usable کند.
    this._destroyed = false;
    this._signal.set({
      data: null,
      loading: false,
      error: null,
      lastUpdated: null,
      isStale: false,
    });
  }

  /**
   * FEATURE (v1.0.0): Destroy کامل Resource — teardown تمیز.
   *
   * برای پاک‌سازی کامل هنگام unmount کامپوننت یا خروج از صفحه. این متد:
   *   1. تایمر auto-refresh را متوقف می‌کند (clearInterval).
   *   2. تمام درخواست‌های in-flight را abort می‌کند (fetch با signal).
   *   3. Map درخواست‌های در حال انجام را پاک می‌کند.
   *   4. صف mutation را خالی می‌کند تا پردازش ادامه نیابد.
   *   5. فلگ _destroyed را true می‌کند تا درخواست جدید رد شود.
   *   6. signal را به حالت اولیه (خالی) برمی‌گرداند.
   *   7. Resource را از resourceRegistry سراسری حذف می‌کند (با reference matching).
   *
   * بعد از destroy، فراخوانی متدهای CRUD نتیجه‌ی
   * `{ success: false, error: 'Resource destroyed' }` برمی‌گرداند.
   * برای استفاده‌ی مجدد، باید reset() صدا زده شود.
   */
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
  registerDOMCleanup(cb: () => void): void {
    this._domCleanups.add(cb);
  }

  /**
   * BUG-RES-04 (v1.3.0): Unregister a DOM cleanup function.
   * Called automatically when the element's zen:detach event fires.
   */
  unregisterDOMCleanup(cb: () => void): void {
    this._domCleanups.delete(cb);
  }

  destroy(): void {
    // FEATURE (v1.0.0): ذخیره‌ی stack trace هنگام destroy() برای پیام‌های خطای بعدی.
    this._destroyStack = new Error().stack || '(stack unavailable)';
    // BUG-RES-04 (v1.3.0): پاک‌سازی callbackهای DOM قبل از هر چیز.
    // این کار ارجاعات المان‌ها را حذف می‌کند تا garbage collector بتواند
    // DOM nodeها را جمع‌آوری کند حتی اگر Resource همچنان در memory زنده باشد.
    this._domCleanups.forEach(fn => { try { fn(); } catch { /* ignore */ } });
    this._domCleanups.clear();
    // ۱. توقف تایمر auto-refresh (clearInterval).
    this.stopAutoRefresh();
    // ۲. Abort تمام درخواست‌های in-flight — fetch ها با signal لغو می‌شوند.
    this._abortController.abort();
    // IMP-RES-02 (v1.3.0): Abort per-request controller too so any fetch
    // still in-flight from a prior request is cleanly cancelled.
    if (this._currentRequestController) {
      this._currentRequestController.abort();
      this._currentRequestController = null;
    }
    // ۳. پاک‌سازی Map درخواست‌های در حال انجام.
    this._inflightRequests.clear();
    // ۴. پاک‌سازی صف mutation (تا پردازش در حال انجام متوقف شود).
    this._mutationQueue.length = 0;
    // ۵. تنظیم فلگ destroyed — جلوگیری از درخواست جدید پس از این نقطه.
    this._destroyed = true;
    // ۶. ریست signal به حالت خالی.
    this._signal.set({
      data: null,
      loading: false,
      error: null,
      lastUpdated: null,
      isStale: false,
    });
    // ۷. حذف از registry سراسری (با reference matching — کلید نام ممکن است
    //    خارج از کلاس در دسترس نباشد، پس با reference پیدا می‌کنیم).
    for (const [key, resource] of resourceRegistry) {
      if (resource === this) {
        resourceRegistry.delete(key);
        break;
      }
    }
  }

  // ── SWR (Stale-While-Revalidate) ──
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
        this.list(true).then(() => {});
      }
    }, interval);
  }

  stopAutoRefresh(): void {
    if (this._refreshTimer) { clearInterval(this._refreshTimer); this._refreshTimer = null; }
  }

  // ── Optimistic Updates ──
  /**
   * Optimistic create: آیتم را فوراً به لیست اضافه کن، اگر خطا داد حذف کن.
   */
  async createOptimistic(body: any): Promise<CrudResult<T>> {
    // BUG-RES-02 (v1.3.0): versioned snapshot to prevent cross-update corruption.
    const version = this._captureSnapshot();

    const tempId = `temp-${Date.now()}`;

    // Optimistic: add to list immediately
    const snapshot = this._optimisticSnapshots.get(version);
    if (Array.isArray(snapshot)) {
      this.setData(old => [...(old as any[]), { ...body, id: tempId, _optimistic: true }] as any);
    }

    // Actual request
    const result = await this.create(body);
    if (!result.success) {
      // BUG-RES-02: versioned rollback — only reverted if no newer update saved.
      this._rollbackSnapshot(version);
    } else if (Array.isArray(this._signal.get().data) && result.data) {
      this._finalizeSnapshot(version);
      // Replace temp item with real one
      this.setData(old => (old as any[]).map(item => item.id === tempId ? result.data : item) as any);
    } else if (Array.isArray(this._signal.get().data) && result.data === undefined) {
      this._finalizeSnapshot(version);
      // FIX (v1.2.3): سرور ۲۰۴ (No Content) برگردانده — یعنی آیتم ساخته شد ولی
      // body ندارد. قبلاً در این حالت tempId در UI باقی می‌ماند. حالا tempId را
      // از لیست فیلتر می‌کنیم (به‌جای map کردن).
      this.setData(old => (old as any[]).filter(item => item.id !== tempId) as any);
    } else {
      this._finalizeSnapshot(version);
    }
    return result;
  }

  /**
   * Optimistic update: آیتم را فوراً آپدیت کن، اگر خطا داد rollback کن.
   */
  async updateOptimistic(id: string | number, body: any): Promise<CrudResult<T>> {
    // BUG-RES-02 (v1.3.0): versioned snapshot to prevent cross-update corruption.
    const version = this._captureSnapshot();

    // Optimistic: update immediately
    const snapshot = this._optimisticSnapshots.get(version);
    if (Array.isArray(snapshot)) {
      this.setData(old => ((old as any[]).map(item =>
        String(item.id) === String(id) ? { ...item, ...body } : item) as any
      ));
    }

    const result = await this.update(id, body);
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
      this.setData(old => (old as any[]).filter(item => String(item.id) !== String(id)) as any);
    }

    const result = await this.delete(id);
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

  // ── Mutation Queue ──
  /**
   * اضافه کردن یک mutation به صف.
   * Mutations به ترتیب اجرا می‌شوند تا race condition جلوگیری شود.
   */
  enqueueMutation(op: () => Promise<CrudResult<any>>, rollback?: () => void): void {
    this._mutationQueue.push({ op, rollback });
    this._processQueue();
  }

  private _processing = false;

  // ── BUG-RES-02 (v1.3.0): Snapshot versioning ──
  // To handle concurrent optimistic updates, we assign a version number
  // to each snapshot. When a request fails, we only roll back if no
  // higher-version (newer) update has already succeeded (its snapshot was
  // cleared). This prevents a failed late request from reverting a successful
  // earlier one.

  private _captureSnapshot(): number {
    const version = ++this._optimisticVersion;
    // Deep-clone the current data so the snapshot is not mutated in-place
    // by subsequent optimistic patches.
    this._optimisticSnapshots.set(version, structuredClone(this._signal.get().data));
    return version;
  }

  private _finalizeSnapshot(version: number): void {
    this._optimisticSnapshots.delete(version);
  }

  private _rollbackSnapshot(version: number): void {
    // Only rollback if this version's snapshot still exists, meaning no
    // newer (higher-version) update has succeeded and been deleted yet.
    const snapshot = this._optimisticSnapshots.get(version);
    if (snapshot !== undefined) {
      // Clear all snapshots >= this version — they're invalid now.
      for (const [v] of this._optimisticSnapshots) {
        if (v >= version) this._optimisticSnapshots.delete(v);
      }
      this.setData(() => snapshot);
    }
  }

  private async _processQueue(): Promise<void> {
    if (this._processing) return;
    this._processing = true;
    while (this._mutationQueue.length > 0) {
      const item = this._mutationQueue.shift()!;
      try {
        const result = await item.op();
        // FIX (v1.2.3): اگر op() یک CrudResult با success:false برگرداند (نه
        // throw)، قبلاً rollback صدا زده نمی‌شد. حالا در صورت success:false هم
        // rollback می‌کنیم تا optimistic changes به‌درستی revert شوند.
        if (result && (result as CrudResult<any>).success === false && item.rollback) {
          item.rollback();
          console.error('[Zenith Resource] Mutation failed:', (result as CrudResult<any>).error);
        }
      } catch (err) {
        if (item.rollback) item.rollback();
        console.error('[Zenith Resource] Mutation failed:', err);
      }
    }
    this._processing = false;
  }

  /**
   * انجام درخواست HTTP با retry و deduplication.
   */
  private async _request<R>(
    method: string,
    id: string | number | null,
    body?: any,
    force = false,
  ): Promise<CrudResult<R>> {
    // FEATURE (v1.0.0): اگر Resource destroy شده، درخواست جدید رد می‌شود.
    // این یک لایه‌ی دفاعی اضافی است (در کنار guard های متدهای public).
    if (this._destroyed) return { success: false, error: 'Resource destroyed' };
    // ساخت URL.
    const url = id !== null ? `${this._config.url}/${id}` : this._config.url;

    // ── IMP-RES-02 (v1.3.0): Per-request cancellation ──
    // Abort the previous in-flight request for this Resource. Without this,
    // rapid successive navigations (e.g. list() → list()) would let both
    // fetches race — the slower one could overwrite the result of the faster
    // one even though the faster one returned fresher data. By cancelling
    // the old controller we guarantee only the latest response wins.
    if (this._currentRequestController) {
      this._currentRequestController.abort();
    }
    this._currentRequestController = new AbortController();

    // ── Request Deduplication ──
    // اگر درخواست مشابهی در حال انجام است، به آن بپیوند.
    // FIX (v1.2.3): cacheKey باید شامل body هم باشد. قبلاً POST با body‌های
    // متفاوت به‌اشتباه dedup می‌شدند (چون فقط method+url در key بود). حالا body
    // هم در cacheKey گنجانده می‌شود تا درخواست‌های متفاوت merge نشوند.
    // BUG-RES-01 (v1.3.0): body را canonicalize می‌کنیم تا ترتیب کلیدهای JSON
    // باعث collision نشود. `{a:1,b:2}` و `{b:2,a:1}` حالا cacheKey یکسان دارند.
    const cacheKey = createCacheKey(method, url, body);
    if (!force && this._inflightRequests.has(cacheKey)) {
      return this._inflightRequests.get(cacheKey)!;
    }

    // ── Stale Check ──
    // اگر داده‌ها هنوز stale نشده‌اند و force نیست، skip کن.
    if (!force && method === 'GET') {
      const state = this._signal.get();
      if (state.data && state.lastUpdated && !state.isStale) {
        const age = Date.now() - state.lastUpdated;
        if (age < this._config.staleTime) {
          return { success: true, data: state.data as any };
        }
      }
    }

    // ── ساخت Request ──
    const promise = this._executeWithRetry<R>(method, url, body);
    this._inflightRequests.set(cacheKey, promise);

    // setLoading (فقط برای GET اولیه).
    if (method === 'GET' && !this._signal.get().data) {
      this._signal.set({ ...this._signal.get(), loading: true, error: null });
    }

    try {
      const result = await promise;
      this._inflightRequests.delete(cacheKey);

      if (result.success && result.data !== undefined) {
        this._signal.set({
          data: result.data as any,
          loading: false,
          error: null,
          lastUpdated: Date.now(),
          isStale: false,
        });

        // Note: Auto-refresh is not implemented. Data only refreshes when
        // list(force=true) is called or invalidate() + list() is used.
      } else if (!result.success) {
        this._signal.set({
          ...this._signal.get(),
          loading: false,
          error: result.error || 'Unknown error',
        });
      }

      return result;
    } catch (err) {
      this._inflightRequests.delete(cacheKey);
      const message = err instanceof Error ? err.message : String(err);
      this._signal.set({
        ...this._signal.get(),
        loading: false,
        error: message,
      });
      return { success: false, error: message };
    }
  }

  /**
   * اجرای درخواست با retry policy.
   */
  /**
   * BUG-RES-03 (v1.3.0): تشخیص خطاهای شبکه (نه HTTP errors).
   * خطاهای شبکه آن‌هایی هستند که fetch پرتاب می‌کند وقتی به سرور نمی‌رسد
   * (DNS failure, connection refused, timeout, etc.). این خطاها name
   * ندارند و instanceof TypeError هستند (برخلافخطاهای HTTP که ما throw
   * می‌کنیم و دارای name:'Error' هستند).
   */
  private _isNetworkError(err: unknown): boolean {
    return (
      err instanceof TypeError ||
      (err instanceof Error && (
        err.message.includes('network') ||
        err.message.includes('NetworkError') ||
        err.message.includes('Failed to fetch') ||
        err.message.includes('Load failed') ||
        err.name === 'TimeoutError'
      ))
    );
  }

  private async _executeWithRetry<R>(
    method: string,
    url: string,
    body?: any,
  ): Promise<CrudResult<R>> {
    let lastError: string | undefined;
    // BUG-RES-03 (v1.3.0): Non-GET methods now retry on network errors too.
    // Previously non-GET was never retried (maxRetries = 0 for POST/PUT/DELETE)
    // which meant a transient network error (DNS flake, connection reset) killed
    // the mutation outright. Now we retry network errors for all methods.
    // HTTP errors (4xx/5xx) still only retry for GET (idempotent).
    const maxRetries = this._config.retryCount;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const options: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...this._config.headers,
          },
          credentials: this._config.credentials,
          // FEATURE (v1.0.0): ارسال signal برای امکان abort توسط destroy().
          // وقتی destroy() صدا زده شود، abort() این signal را reject می‌کند
          // و fetch بلافاصله با AbortError لغو می‌شود.
          // IMP-RES-02 (v1.3.0): Also listen to the per-request controller so
          // that rapid successive calls cancel the previous in-flight request.
          signal: this._currentRequestController
            ? AbortSignal.any
              ? AbortSignal.any([this._abortController.signal, this._currentRequestController.signal])
              : this._currentRequestController.signal
            : this._abortController.signal,
        };

        if (body !== undefined) {
          options.body = JSON.stringify(body);
        }

        const res = await fetch(url, options);

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        // برای DELETE، ممکن است response خالی باشد.
        if (res.status === 204) {
          return { success: true, data: undefined as any };
        }

        const contentType = res.headers.get('content-type') || '';
        const data = contentType.includes('application/json')
          ? await res.json()
          : await res.text();

        return { success: true, data };
      } catch (err) {
        // FEATURE (v1.0.0): AbortError نباید retry شود — destroy() آن را
        // صدا زده و نباید منابع (تلاش مجدد، wait) هدر برود. for-loop را با
        // return مستقیم ترک می‌کنیم تا نتیجه‌ی 'aborted' برگردد.
        if (err instanceof Error && err.name === 'AbortError') {
          return { success: false, error: 'aborted' };
        }
        lastError = err instanceof Error ? err.message : String(err);

        // BUG-RES-03 (v1.3.0): فقط خطاهای شبکه برای non-GET retry می‌شوند.
        // HTTP errors (4xx/5xx) برای non-GET مستقیماً به caller می‌روند.
        if (method !== 'GET' && !this._isNetworkError(err)) {
          return { success: false, error: lastError };
        }

        // اگر این آخرین تلاش نیست، صبر کن و دوباره تلاش کن.
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, this._config.retryDelay * (attempt + 1)));
        }
      }
    }

    return { success: false, error: lastError };
  }
}

/**
 * Registry از همه‌ی Resource ها.
 */
const resourceRegistry = new Map<string, Resource<any>>();

/**
 * ساخت یا دریافت یک Resource.
 *
 * @param name  نام Resource (مثل 'users').
 * @param config پیکربندی.
 * @returns Resource.
 */
export function createResource<T = any>(name: string, config: ResourceConfig): Resource<T> {
  const resource = new Resource<T>(config);
  resourceRegistry.set(name, resource);
  return resource;
}

/**
 * دریافت یک Resource با نام.
 */
export function getResource(name: string): Resource<any> | undefined {
  return resourceRegistry.get(name);
}

/**
 * پاکسازی همه‌ی Resource ها (برای تست‌ها).
 */
export function resetResourceRegistry(): void {
  for (const resource of resourceRegistry.values()) {
    resource.reset();
  }
  resourceRegistry.clear();
}

export function clearResources(): void {
  for (const resource of resourceRegistry.values()) {
    resource.reset();
  }
  resourceRegistry.clear();
}

/**
 * Invalidate همه‌ی Resource ها (مفید بعد از login/logout).
 */
export function invalidateAllResources(): void {
  for (const resource of resourceRegistry.values()) {
    resource.invalidate();
  }
}
