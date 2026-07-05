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
import { signal } from '@zenith/state';
// FEATURE (v1.0.0): کتابخانه‌ی خطاها برای پیام‌های بهبودیافته.
import { resourceDestroyedError, resourceHttpError } from '@zenith/errors';
// FEATURE (v0.3.0): IndexedDB persistence — import cache singleton.
import { dbCache } from './persistence.js';
/**
 * کلاس Resource — مدیریت کامل یک endpoint.
 *
 * هر Resource یک Signal دارد که وضعیت (loading/error/data) را نگه می‌دارد.
 * عملیات‌های CRUD می‌توانند روی آن انجام شوند.
 */
export class Resource {
    _signal;
    _config;
    _inflightRequests = new Map();
    _refreshTimer = null;
    _mutationQueue = [];
    // FEATURE (v1.0.0): AbortController برای cancel کردن in-flight fetch ها.
    // در destroy() متد abort() صدا زده می‌شود تا تمام درخواست‌های شبکه‌ی در حال
    // انجام بلافاصله لغو شوند. در reset() یک نمونه‌ی جدید ساخته می‌شود تا
    // Resource دوباره قابل استفاده شود.
    _abortController = new AbortController();
    // FEATURE (v1.0.0): فلگ destroyed — پس از destroy()، تمام متدهای public
    // (list/read/create/update/delete) و _request از این فلگ استفاده می‌کنند
    // تا هرگونه درخواست جدید با خطای 'Resource destroyed' رد شود.
    _destroyed = false;
    // FEATURE (v1.0.0): stack trace هنگام destroy() — برای پیام‌های خطای بعدی.
    _destroyStack = null;
    // FEATURE (v0.3.0): تنظیمات persistence مشتق شده از config.
    _persistConfig;
    constructor(config) {
        this._signal = signal({
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
            // FEATURE (v0.3.0): مقادیر پیش‌فرض persistence (توسط ...config بازنویسی می‌شوند).
            persist: false,
            persistStore: 'zenith-cache',
            persistTtl: 24 * 60 * 60 * 1000, // ۲۴ ساعت
            persistKey: config.url,
            // FEATURE (v0.4.0): پیش‌فرض swCacheName — documentation-level فقط.
            // خود Resource از این مقدار استفاده نمی‌کند؛ صرفاً برای انطباق با SW.
            swCacheName: config.swCacheName || '',
            ...config,
        };
        // FEATURE (v0.3.0): استخراج تنظیمات persistence از config.
        // پیش‌فرض: disabled. اگر persist:true باشد، با مقادیر پیش‌فرض فعال می‌شود.
        this._persistConfig = {
            enabled: !!config.persist,
            store: config.persistStore || 'zenith-cache',
            ttl: config.persistTtl ?? 24 * 60 * 60 * 1000,
            key: config.persistKey || config.url,
        };
        // FEATURE (v0.3.0): اگر persistence فعال است، cache را از IndexedDB بازگردان.
        // fire-and-forget — قبل از اولین network request اجرا می‌شود تا UI داده‌ی stale را سریع نشان دهد.
        if (this._persistConfig.enabled) {
            this.restoreFromCache().catch((err) => {
                console.warn('[Zenith Resource] restoreFromCache failed:', err);
            });
        }
    }
    /** دریافت Signal وضعیت. */
    get signal() {
        return this._signal;
    }
    /** دریافت داده‌ی فعلی. */
    get data() {
        return this._signal.get().data;
    }
    /** آیا در حال loading است؟ */
    get loading() {
        return this._signal.get().loading;
    }
    /** آیا خطا وجود دارد؟ */
    get error() {
        return this._signal.get().error;
    }
    /**
     * GET — لیست یا تک آیتم.
     *
     * @param id اگر مشخص باشد، تک آیتم fetch می‌شود (GET /api/users/:id).
     *           اگر null باشد، لیست fetch می‌شود (GET /api/users).
     * @param force اگر true باشد، cache نادیده گرفته می‌شود.
     */
    async list(force = false) {
        // FEATURE (v1.0.0): پیام خطای بهبودیافته با stack trace.
        if (this._destroyed) {
            const err = resourceDestroyedError(this._config.url, 'list()', this._destroyStack || undefined);
            console.error(err.toUserString());
            return { success: false, error: err.toUserString() };
        }
        return this._request('GET', null, undefined, force);
    }
    async read(id, force = false) {
        // FEATURE (v1.0.0): پیام خطای بهبودیافته با stack trace.
        if (this._destroyed) {
            const err = resourceDestroyedError(this._config.url, `read(${id})`, this._destroyStack || undefined);
            console.error(err.toUserString());
            return { success: false, error: err.toUserString() };
        }
        return this._request('GET', id, undefined, force);
    }
    /**
     * POST — ایجاد آیتم جدید.
     */
    async create(body) {
        // FEATURE (v1.0.0): پیام خطای بهبودیافته با stack trace.
        if (this._destroyed) {
            const err = resourceDestroyedError(this._config.url, 'create()', this._destroyStack || undefined);
            console.error(err.toUserString());
            return { success: false, error: err.toUserString() };
        }
        return this._request('POST', null, body);
    }
    /**
     * PUT — به‌روزرسانی آیتم.
     */
    async update(id, body) {
        // FEATURE (v1.0.0): پیام خطای بهبودیافته با stack trace.
        if (this._destroyed) {
            const err = resourceDestroyedError(this._config.url, `update(${id})`, this._destroyStack || undefined);
            console.error(err.toUserString());
            return { success: false, error: err.toUserString() };
        }
        return this._request('PUT', id, body);
    }
    /**
     * DELETE — حذف آیتم.
     */
    async delete(id) {
        // FEATURE (v1.0.0): پیام خطای بهبودیافته با stack trace.
        if (this._destroyed) {
            const err = resourceDestroyedError(this._config.url, `delete(${id})`, this._destroyStack || undefined);
            console.error(err.toUserString());
            return { success: false, error: err.toUserString() };
        }
        return this._request('DELETE', id);
    }
    /**
     * علامت‌گذاری داده به‌عنوان stale (نیاز به refresh).
     */
    invalidate() {
        this._signal.set({ ...this._signal.get(), isStale: true });
    }
    /**
     * به‌روزرسانی دستی داده‌ها (بدون fetch).
     * مفید برای optimistic updates.
     */
    setData(updater) {
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
    reset() {
        if (this._refreshTimer) {
            clearInterval(this._refreshTimer);
            this._refreshTimer = null;
        }
        this._mutationQueue.length = 0;
        this._inflightRequests.clear();
        // FEATURE (v1.0.0): ساخت AbortController تازه — تا reset() بتواند
        // Resource را از حالت destroyed خارج کند و درخواست‌های جدید دوباره کار کنند.
        this._abortController = new AbortController();
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
    destroy() {
        // FEATURE (v1.0.0): ذخیره‌ی stack trace هنگام destroy() برای پیام‌های خطای بعدی.
        this._destroyStack = new Error().stack || '(stack unavailable)';
        // ۱. توقف تایمر auto-refresh (clearInterval).
        this.stopAutoRefresh();
        // ۲. Abort تمام درخواست‌های in-flight — fetch ها با signal لغو می‌شوند.
        this._abortController.abort();
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
    startAutoRefresh(intervalMs) {
        // FIX (v1.2.3): guard برای destroyed — اگر Resource بعد از destroy دوباره
        // auto-refresh را start کرد، تایمر ساخته می‌شد ولی callback روی signal تخریب‌شده
        // می‌نوشت و خطا می‌داد. حالا early return.
        if (this._destroyed)
            return;
        if (this._refreshTimer)
            clearInterval(this._refreshTimer);
        const interval = intervalMs || this._config.staleTime;
        this._refreshTimer = setInterval(() => {
            // FIX (v1.2.3): re-check destroyed داخل callback.
            if (this._destroyed)
                return;
            if (this._signal.get().data) {
                // SWR: return stale data immediately, revalidate in background
                this._signal.set({ ...this._signal.get(), isStale: true });
                this.list(true).then(() => { });
            }
        }, interval);
    }
    stopAutoRefresh() {
        if (this._refreshTimer) {
            clearInterval(this._refreshTimer);
            this._refreshTimer = null;
        }
    }
    // ── Optimistic Updates ──
    /**
     * Optimistic create: آیتم را فوراً به لیست اضافه کن، اگر خطا داد حذف کن.
     */
    async createOptimistic(body) {
        // Snapshot for rollback
        const snapshot = this._signal.get().data;
        const tempId = `temp-${Date.now()}`;
        // Optimistic: add to list immediately
        if (Array.isArray(snapshot)) {
            this.setData(old => [...old, { ...body, id: tempId, _optimistic: true }]);
        }
        // Actual request
        const result = await this.create(body);
        if (!result.success) {
            // Rollback
            this.setData(() => snapshot);
        }
        else if (Array.isArray(this._signal.get().data) && result.data) {
            // Replace temp item with real one
            this.setData(old => old.map(item => item.id === tempId ? result.data : item));
        }
        else if (Array.isArray(this._signal.get().data) && result.data === undefined) {
            // FIX (v1.2.3): ۲۰۴ (No Content) از create — tempId را فیلتر کن (نه map).
            this.setData(old => old.filter(item => item.id !== tempId));
        }
        return result;
    }
    /**
     * Optimistic update: آیتم را فوراً آپدیت کن، اگر خطا داد rollback کن.
     */
    async updateOptimistic(id, body) {
        const snapshot = this._signal.get().data;
        // Optimistic: update immediately
        if (Array.isArray(snapshot)) {
            this.setData(old => old.map(item => String(item.id) === String(id) ? { ...item, ...body } : item));
        }
        const result = await this.update(id, body);
        if (!result.success) {
            // Rollback
            this.setData(() => snapshot);
        }
        return result;
    }
    /**
     * Optimistic delete: آیتم را فوراً حذف کن، اگر خطا داد rollback کن.
     */
    async deleteOptimistic(id) {
        const snapshot = this._signal.get().data;
        // Optimistic: remove immediately
        if (Array.isArray(snapshot)) {
            this.setData(old => old.filter(item => String(item.id) !== String(id)));
        }
        const result = await this.delete(id);
        if (!result.success) {
            // Rollback
            this.setData(() => snapshot);
        }
        else if (result.data === undefined) {
            // FIX (v1.2.3): ۲۰۴ (No Content) از delete — isStale:true ست کن.
            this._signal.set({ ...this._signal.get(), isStale: true });
        }
        return result;
    }
    // ── Mutation Queue ──
    /**
     * اضافه کردن یک mutation به صف.
     * Mutations به ترتیب اجرا می‌شوند تا race condition جلوگیری شود.
     */
    enqueueMutation(op, rollback) {
        this._mutationQueue.push({ op, rollback });
        this._processQueue();
    }
    _processing = false;
    async _processQueue() {
        if (this._processing)
            return;
        this._processing = true;
        while (this._mutationQueue.length > 0) {
            const item = this._mutationQueue.shift();
            try {
                const result = await item.op();
                // FIX (v1.2.3): در صورت success:false (نه throw)، rollback کن.
                if (result && result.success === false && item.rollback) {
                    item.rollback();
                    console.error('[Zenith Resource] Mutation failed:', result.error);
                }
            }
            catch (err) {
                if (item.rollback)
                    item.rollback();
                console.error('[Zenith Resource] Mutation failed:', err);
            }
        }
        this._processing = false;
    }
    /**
     * انجام درخواست HTTP با retry و deduplication.
     */
    async _request(method, id, body, force = false) {
        // FEATURE (v1.0.0): اگر Resource destroy شده، درخواست جدید رد می‌شود.
        // این یک لایه‌ی دفاعی اضافی است (در کنار guard های متدهای public).
        if (this._destroyed)
            return { success: false, error: 'Resource destroyed' };
        // ساخت URL.
        const url = id !== null ? `${this._config.url}/${id}` : this._config.url;
        // ── Request Deduplication ──
        // FIX (v1.2.3): cacheKey باید شامل body هم باشد. قبلاً POST با body‌های
        // متفاوت به‌اشتباه dedup می‌شدند. حالا body هم در cacheKey گنجانده می‌شود.
        const cacheKey = body ? `${method}:${url}:${JSON.stringify(body)}` : `${method}:${url}`;
        if (!force && this._inflightRequests.has(cacheKey)) {
            return this._inflightRequests.get(cacheKey);
        }
        // ── Stale Check ──
        // اگر داده‌ها هنوز stale نشده‌اند و force نیست، skip کن.
        if (!force && method === 'GET') {
            const state = this._signal.get();
            if (state.data && state.lastUpdated && !state.isStale) {
                const age = Date.now() - state.lastUpdated;
                if (age < this._config.staleTime) {
                    return { success: true, data: state.data };
                }
            }
        }
        // ── ساخت Request ──
        const promise = this._executeWithRetry(method, url, body);
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
                    data: result.data,
                    loading: false,
                    error: null,
                    lastUpdated: Date.now(),
                    isStale: false,
                });
                // FEATURE (v0.3.0): ذخیره‌ی cache در IndexedDB (fire-and-forget).
                // بعد از هر fetch موفق، داده‌ی جدید را persist می‌کنیم تا در reload بعدی سریع‌تر لود شود.
                if (this._persistConfig.enabled) {
                    this.persistToCache().catch((err) => {
                        console.warn('[Zenith Resource] persistToCache failed:', err);
                    });
                }
                // Note: Auto-refresh is not implemented. Data only refreshes when
                // list(force=true) is called or invalidate() + list() is used.
            }
            else if (!result.success) {
                this._signal.set({
                    ...this._signal.get(),
                    loading: false,
                    error: result.error || 'Unknown error',
                });
            }
            return result;
        }
        catch (err) {
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
    // ── IndexedDB Persistence (v0.3.0) ──
    /**
     * FEATURE (v0.3.0): بازگرداندن cache از IndexedDB.
     *
     * اگر cache موجود باشد و هنوز معتبر باشد (درون persistTtl)، داده‌ی آن
     * را در `_signal` قرار می‌دهد و `isStale=true` می‌گذارد تا یک refresh
     * در پس‌زمینه توسط `list()` بعدی انجام شود (SWR).
     *
     * No-op اگر persistence غیرفعال باشد یا IndexedDB در دسترس نباشد.
     */
    async restoreFromCache() {
        if (!this._persistConfig.enabled)
            return;
        if (!dbCache.available)
            return;
        try {
            const entry = await dbCache.get(this._persistConfig.store, this._persistConfig.key);
            if (!entry || typeof entry.timestamp !== 'number')
                return;
            // بررسی اعتبار cache بر اساس persistTtl.
            const age = Date.now() - entry.timestamp;
            if (age > this._persistConfig.ttl) {
                // cache منقضی شده — حذف کن و چیزی باز نگردان.
                await dbCache.delete(this._persistConfig.store, this._persistConfig.key);
                return;
            }
            // فقط اگر الان داده‌ای نداریم (یعنی هنوز fetch اولیه انجام نشده)
            // cache را restore کن. اگر داده‌ی تازه‌تری داریم، cache قدیمی را بازنویسی نکن.
            const current = this._signal.get();
            if (current.data)
                return;
            // داده‌ی cache را با isStale=true قرار بده تا list() بعدی revalidate کند.
            this._signal.set({
                data: entry.data,
                loading: false,
                error: null,
                lastUpdated: entry.timestamp,
                isStale: true,
            });
        }
        catch (err) {
            console.warn('[Zenith Resource] restoreFromCache error:', err);
        }
    }
    /**
     * FEATURE (v0.3.0): ذخیره‌ی cache در IndexedDB.
     *
     * داده‌ی فعلی + timestamp را در IndexedDB می‌نویسد. این متد بعد از هر
     * fetch موفق به‌صورت fire-and-forget صدا زده می‌شود.
     *
     * No-op اگر persistence غیرفعال باشد.
     */
    async persistToCache() {
        if (!this._persistConfig.enabled)
            return;
        if (!dbCache.available)
            return;
        const state = this._signal.get();
        if (state.data === null || state.data === undefined)
            return;
        if (!state.lastUpdated)
            return;
        const entry = {
            data: state.data,
            timestamp: state.lastUpdated,
        };
        try {
            await dbCache.set(this._persistConfig.store, this._persistConfig.key, entry);
        }
        catch (err) {
            console.warn('[Zenith Resource] persistToCache error:', err);
        }
    }
    /**
     * اجرای درخواست با retry policy.
     */
    async _executeWithRetry(method, url, body) {
        let lastError;
        // Only retry GET requests — POST/PUT/DELETE are not idempotent.
        const maxRetries = method === 'GET' ? this._config.retryCount : 0;
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const options = {
                    method,
                    headers: {
                        'Content-Type': 'application/json',
                        ...this._config.headers,
                    },
                    credentials: this._config.credentials,
                    // FEATURE (v1.0.0): ارسال signal برای امکان abort توسط destroy().
                    // وقتی destroy() صدا زده شود، abort() این signal را reject می‌کند
                    // و fetch بلافاصله با AbortError لغو می‌شود.
                    signal: this._abortController.signal,
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
                    return { success: true, data: undefined };
                }
                const contentType = res.headers.get('content-type') || '';
                const data = contentType.includes('application/json')
                    ? await res.json()
                    : await res.text();
                return { success: true, data };
            }
            catch (err) {
                // FEATURE (v1.0.0): AbortError نباید retry شود — destroy() آن را
                // صدا زده و نباید منابع (تلاش مجدد، wait) هدر برود. for-loop را با
                // return مستقیم ترک می‌کنیم تا نتیجه‌ی 'aborted' برگردد.
                if (err instanceof Error && err.name === 'AbortError') {
                    return { success: false, error: 'aborted' };
                }
                lastError = err instanceof Error ? err.message : String(err);
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
const resourceRegistry = new Map();
/**
 * ساخت یا دریافت یک Resource.
 *
 * @param name  نام Resource (مثل 'users').
 * @param config پیکربندی.
 * @returns Resource.
 */
export function createResource(name, config) {
    const resource = new Resource(config);
    resourceRegistry.set(name, resource);
    return resource;
}
/**
 * دریافت یک Resource با نام.
 */
export function getResource(name) {
    return resourceRegistry.get(name);
}
/**
 * پاکسازی همه‌ی Resource ها (برای تست‌ها).
 */
export function resetResourceRegistry() {
    for (const resource of resourceRegistry.values()) {
        resource.reset();
    }
    resourceRegistry.clear();
}
export function clearResources() {
    for (const resource of resourceRegistry.values()) {
        resource.reset();
    }
    resourceRegistry.clear();
}
/**
 * Invalidate همه‌ی Resource ها (مفید بعد از login/logout).
 */
export function invalidateAllResources() {
    for (const resource of resourceRegistry.values()) {
        resource.invalidate();
    }
}
//# sourceMappingURL=resource.js.map