// packages/resource/src/persistence.ts
//
// FEATURE (v0.3.0): IndexedDB-backed cache persistence for @zenith/resource.
//
// این ماژول یک wrapper ساده و SSR-safe روی IndexedDB فراهم می‌کند تا
// داده‌های cache شده‌ی Resource ها بین reload های صفحه باقی بمانند.
// مشابه persistQueryClient در TanStack Query — offline-first.
//
// طراحی:
//   - lazy: دیتابیس فقط روی اولین use باز می‌شود.
//   - SSR-safe: اگر `indexedDB` تعریف نشده باشد (Node/SSR)، همه‌ی متدها
//     no-op می‌شوند و null برمی‌گردانند.
//   - singleton: یک نمونه‌ی `dbCache` برای کل اپلیکیشن کافی است.
/** نام پیش‌فرض دیتابیس IndexedDB. */
const DEFAULT_DB_NAME = 'zenith-cache-db';
/** نسخه‌ی دیتابیس (برای migration های آینده). */
const DEFAULT_DB_VERSION = 1;
/** نام پیش‌فرض object store. */
const DEFAULT_STORE_NAME = 'zenith-cache';
/**
 * IndexedDBCache — wrapper ساده و lazy روی IndexedDB.
 *
 * اگر IndexedDB در دسترس نباشد (مثلاً در SSR یا Node)، تمام متدها
 * بدون خطا no-op می‌شوند و `get` مقدار `null` برمی‌گرداند.
 *
 * متدها async هستند تا هم در محیط مرورگر و هم در تست‌ها یکنواخت
 * رفتار کنند.
 */
export class IndexedDBCache {
    _db = null;
    _dbName;
    _dbVersion;
    _opening = null;
    constructor(dbName = DEFAULT_DB_NAME, dbVersion = DEFAULT_DB_VERSION) {
        this._dbName = dbName;
        this._dbVersion = dbVersion;
    }
    /**
     * آیا IndexedDB در این محیط در دسترس است؟
     * در SSR/Node برابر false است.
     */
    get available() {
        // FEATURE (v0.3.0): SSR-safe check برای IndexedDB.
        return typeof indexedDB !== 'undefined';
    }
    /**
     * باز کردن (یا ساخت) دیتابیس IndexedDB به‌صورت lazy.
     * اگر IndexedDB در دسترس نباشد، `null` برمی‌گرداند.
     * فقط یکبار باز می‌شود و نمونه‌ی آن cached می‌شود.
     */
    _open() {
        if (!this.available) {
            // FEATURE (v0.3.0): no-op در محیط بدون IndexedDB (SSR/Node).
            return Promise.resolve(null);
        }
        if (this._db) {
            return Promise.resolve(this._db);
        }
        // اگر در حال باز کردن است، به همان Promise بپیوند.
        if (this._opening) {
            return this._opening;
        }
        this._opening = new Promise((resolve) => {
            try {
                const req = indexedDB.open(this._dbName, this._dbVersion);
                // ساخت object store پیش‌فرض هنگام نصب اولیه یا upgrade.
                req.onupgradeneeded = () => {
                    const db = req.result;
                    if (!db.objectStoreNames.contains(DEFAULT_STORE_NAME)) {
                        db.createObjectStore(DEFAULT_STORE_NAME);
                    }
                };
                req.onsuccess = () => {
                    this._db = req.result;
                    resolve(this._db);
                };
                req.onerror = () => {
                    // در صورت خطا، no-op رفتار کن و null برگردان.
                    console.warn('[Zenith Resource] IndexedDB open failed:', req.error);
                    this._opening = null;
                    resolve(null);
                };
                req.onblocked = () => {
                    console.warn('[Zenith Resource] IndexedDB open blocked.');
                    this._opening = null;
                    resolve(null);
                };
            }
            catch (err) {
                // FEATURE (v0.3.0): در صورت هر خطای غیرمنتظره، no-op کن.
                console.warn('[Zenith Resource] IndexedDB unavailable:', err);
                this._opening = null;
                resolve(null);
            }
        });
        return this._opening;
    }
    /**
     * دریافت یک مقدار از object store.
     *
     * @param store نام object store.
     * @param key   کلید ذخیره‌سازی.
     * @returns مقدار ذخیره شده یا `null` اگر وجود نداشت/IndexedDB در دسترس نبود.
     */
    async get(store, key) {
        const db = await this._open();
        if (!db)
            return null;
        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(store)) {
                    resolve(null);
                    return;
                }
                const tx = db.transaction(store, 'readonly');
                const os = tx.objectStore(store);
                const req = os.get(key);
                req.onsuccess = () => {
                    resolve(req.result === undefined ? null : req.result);
                };
                req.onerror = () => {
                    console.warn('[Zenith Resource] IndexedDB get failed:', req.error);
                    resolve(null);
                };
            }
            catch (err) {
                console.warn('[Zenith Resource] IndexedDB get error:', err);
                resolve(null);
            }
        });
    }
    /**
     * ذخیره یک مقدار در object store.
     * اگر object store وجود نداشته باشد، آن را (از طریق upgrade) می‌سازد
     * — اما چون upgrade فقط روی version change رخ می‌دهد، در عمل وقتی
     * store پیش‌فرض (`zenith-cache`) استفاده شود همیشه موجود است.
     *
     * @param store نام object store.
     * @param key   کلید ذخیره‌سازی.
     * @param value مقدار برای ذخیره.
     */
    async set(store, key, value) {
        const db = await this._open();
        if (!db)
            return;
        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(store)) {
                    // store وجود ندارد؛ بدون upgrade نمی‌توان نوشت.
                    // در نسخه‌ی پیش‌فرض این حالت پیش نمی‌آید.
                    console.warn(`[Zenith Resource] IndexedDB store "${store}" not found.`);
                    resolve();
                    return;
                }
                const tx = db.transaction(store, 'readwrite');
                const os = tx.objectStore(store);
                os.put(value, key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => {
                    console.warn('[Zenith Resource] IndexedDB set failed:', tx.error);
                    resolve();
                };
                tx.onabort = () => {
                    console.warn('[Zenith Resource] IndexedDB set aborted.');
                    resolve();
                };
            }
            catch (err) {
                console.warn('[Zenith Resource] IndexedDB set error:', err);
                resolve();
            }
        });
    }
    /**
     * حذف یک مقدار از object store.
     *
     * @param store نام object store.
     * @param key   کلید برای حذف.
     */
    async delete(store, key) {
        const db = await this._open();
        if (!db)
            return;
        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(store)) {
                    resolve();
                    return;
                }
                const tx = db.transaction(store, 'readwrite');
                const os = tx.objectStore(store);
                os.delete(key);
                tx.oncomplete = () => resolve();
                tx.onerror = () => {
                    console.warn('[Zenith Resource] IndexedDB delete failed:', tx.error);
                    resolve();
                };
            }
            catch (err) {
                console.warn('[Zenith Resource] IndexedDB delete error:', err);
                resolve();
            }
        });
    }
    /**
     * پاکسازی کل object store.
     *
     * @param store نام object store.
     */
    async clear(store) {
        const db = await this._open();
        if (!db)
            return;
        return new Promise((resolve) => {
            try {
                if (!db.objectStoreNames.contains(store)) {
                    resolve();
                    return;
                }
                const tx = db.transaction(store, 'readwrite');
                const os = tx.objectStore(store);
                os.clear();
                tx.oncomplete = () => resolve();
                tx.onerror = () => {
                    console.warn('[Zenith Resource] IndexedDB clear failed:', tx.error);
                    resolve();
                };
            }
            catch (err) {
                console.warn('[Zenith Resource] IndexedDB clear error:', err);
                resolve();
            }
        });
    }
}
/**
 * نمونه‌ی singleton از IndexedDBCache برای استفاده‌ی سراسری.
 * همه‌ی Resource ها از همین نمونه استفاده می‌کنند.
 */
export const dbCache = new IndexedDBCache();
//# sourceMappingURL=persistence.js.map
