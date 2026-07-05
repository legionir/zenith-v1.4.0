import { type Signal } from '@zenith/state';
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
 * کلاس Resource — مدیریت کامل یک endpoint.
 *
 * هر Resource یک Signal دارد که وضعیت (loading/error/data) را نگه می‌دارد.
 * عملیات‌های CRUD می‌توانند روی آن انجام شوند.
 */
export declare class Resource<T = any> {
    private _signal;
    private _config;
    private _inflightRequests;
    private _refreshTimer;
    private _mutationQueue;
    constructor(config: ResourceConfig);
    /** دریافت Signal وضعیت. */
    get signal(): Signal<ResourceState<T>>;
    /** دریافت داده‌ی فعلی. */
    get data(): T | null;
    /** آیا در حال loading است؟ */
    get loading(): boolean;
    /** آیا خطا وجود دارد؟ */
    get error(): string | null;
    /**
     * GET — لیست یا تک آیتم.
     *
     * @param id اگر مشخص باشد، تک آیتم fetch می‌شود (GET /api/users/:id).
     *           اگر null باشد، لیست fetch می‌شود (GET /api/users).
     * @param force اگر true باشد، cache نادیده گرفته می‌شود.
     */
    list(force?: boolean): Promise<CrudResult<T>>;
    read(id: string | number, force?: boolean): Promise<CrudResult<T>>;
    /**
     * POST — ایجاد آیتم جدید.
     */
    create(body: any): Promise<CrudResult<T>>;
    /**
     * PUT — به‌روزرسانی آیتم.
     */
    update(id: string | number, body: any): Promise<CrudResult<T>>;
    /**
     * DELETE — حذف آیتم.
     */
    delete(id: string | number): Promise<CrudResult<T>>;
    /**
     * علامت‌گذاری داده به‌عنوان stale (نیاز به refresh).
     */
    invalidate(): void;
    /**
     * به‌روزرسانی دستی داده‌ها (بدون fetch).
     * مفید برای optimistic updates.
     */
    setData(updater: (old: T | null) => any): void;
    /**
     * Reset کامل Resource.
     *
     * این تابع:
     *   - `_refreshTimer` را پاک می‌کند.
     *   - `_mutationQueue` را پاک می‌کند.
     *   - `_inflightRequests` را پاک می‌کند.
     *   - یک AbortController جدید می‌سازد (تا Resource بتواند دوباره استفاده شود).
     *   - `_destroyed` را false می‌کند (تا CRUD methods دوباره کار کنند).
     *   - signal state را به مقادیر اولیه برمی‌گرداند.
     *
     * تفاوت با `destroy()`:
     *   - `destroy()` Resource را از registry حذف می‌کند و `_destroyed=true` می‌کند.
     *   - `reset()` Resource را در registry نگه می‌دارد و `_destroyed=false` می‌کند.
     *   - `reset()` برای revive کردن یک Resource destroyed استفاده می‌شود.
     */
    reset(): void;
    /**
     * FEATURE (v1.0.0): Destroy کامل Resource — teardown همه‌ی منابع.
     *
     * این تابع برای پاکسازی کامل یک Resource طراحی شده است — مخصوصاً وقتی
     * کامپوننتی که Resource را ساخته unmount می‌شود. برخلاف `reset()`، این
     * تابع Resource را از global registry حذف می‌کند و `_destroyed=true` می‌کند
     * تا هیچ CRUD method جدیدی نتواند اجرا شود.
     *
     * عملیات:
     *   1) `stopAutoRefresh()` — پاک کردن `_refreshTimer`.
     *   2) `_abortController.abort()` — لغو تمام درخواست‌های fetch در حال انجام.
     *   3) `_inflightRequests.clear()` — پاک کردن Map درخواست‌های در حال انجام.
     *   4) `_mutationQueue.length = 0` — پاک کردن صف mutation.
     *   5) `_destroyed = true` — جلوگیری از عملیات جدید.
     *   6) signal state به مقادیر اولیه برمی‌گردد (data: null, loading: false, ...).
     *   7) Resource از `resourceRegistry` حذف می‌شود (با reference match).
     *
     * بعد از `destroy()`:
     *   - تمام CRUD methods (`list`, `read`, `create`, `update`, `delete`) فوراً
     *     `{ success: false, error: 'Resource destroyed' }` برمی‌گردانند.
     *   - `_request()` هم در ابتدا چک می‌کند و اگر `_destroyed=true` باشد، رد می‌شود.
     *   - `_executeWithRetry()` برای AbortError یک‌بار fetch می‌زند (retry نمی‌کند).
     *
     * برای revive کردن یک Resource destroyed، از `reset()` استفاده کنید — این کار
     * یک AbortController جدید می‌سازد و `_destroyed=false` می‌کند.
     *
     * @example
     *   const users = createResource('users', { url: '/api/users' });
     *   await users.list();
     *   // ... استفاده از users ...
     *   users.destroy();  // پاکسازی کامل
     *   await users.list(); // → { success: false, error: 'Resource destroyed' }
     *   users.reset();    // revive
     *   await users.list(); // → { success: true, data: [...] }
     */
    destroy(): void;
    /**
     * Start background refresh on interval.
     * بعد از staleTime، داده در پس‌زمینه refresh می‌شود.
     */
    startAutoRefresh(intervalMs?: number): void;
    stopAutoRefresh(): void;
    /**
     * Optimistic create: آیتم را فوراً به لیست اضافه کن، اگر خطا داد حذف کن.
     */
    createOptimistic(body: any): Promise<CrudResult<T>>;
    /**
     * Optimistic update: آیتم را فوراً آپدیت کن، اگر خطا داد rollback کن.
     */
    updateOptimistic(id: string | number, body: any): Promise<CrudResult<T>>;
    /**
     * Optimistic delete: آیتم را فوراً حذف کن، اگر خطا داد rollback کن.
     */
    deleteOptimistic(id: string | number): Promise<CrudResult<T>>;
    /**
     * اضافه کردن یک mutation به صف.
     * Mutations به ترتیب اجرا می‌شوند تا race condition جلوگیری شود.
     */
    enqueueMutation(op: () => Promise<CrudResult<any>>, rollback?: () => void): void;
    private _processing;
    private _processQueue;
    /**
     * انجام درخواست HTTP با retry و deduplication.
     */
    private _request;
    /**
     * اجرای درخواست با retry policy.
     */
    private _executeWithRetry;
}
/**
 * ساخت یا دریافت یک Resource.
 *
 * @param name  نام Resource (مثل 'users').
 * @param config پیکربندی.
 * @returns Resource.
 */
export declare function createResource<T = any>(name: string, config: ResourceConfig): Resource<T>;
/**
 * دریافت یک Resource با نام.
 */
export declare function getResource(name: string): Resource<any> | undefined;
/**
 * پاکسازی همه‌ی Resource ها (برای تست‌ها).
 */
export declare function resetResourceRegistry(): void;
export declare function clearResources(): void;
/**
 * Invalidate همه‌ی Resource ها (مفید بعد از login/logout).
 */
export declare function invalidateAllResources(): void;
