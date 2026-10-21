// packages/storage/src/drivers.ts
//
// #145 — درایورهای SPEC §۲.۵: memory / local / session / cookie / indexeddb.
//
// قوانین:
//   • هیچ دسترسی به window/document/localStorage در import-time (گیت
//     env-import) — همه چیز داخل توابع، هنگام *فراخوانی* بررسی می‌شود.
//   • هیچ timerی نیست (ttl در لایهٔ createStorage lazy مدیریت می‌شود).
//   • indexeddb تنها درایور async است (ready())؛ خطای نوشتن به جای throw،
//     به sink تزریق‌شده (logger در createStorage) گزارش می‌شود.
import { hasDOM, hasWindow } from '@zenith/shared';
import { deprecate } from '@zenith/errors';
import type { CookieOptions, DriverName, IDBOptions, StorageDriver } from './types';

/** درایور حافظه‌ای فرّار (پیش‌فرض SSR و fallback). */
export function memoryDriver(): StorageDriver {
  const map = new Map<string, string>();
  return {
    name: 'memory',
    available: () => true,
    get: (k) => map.get(k),
    set: (k, v) => void map.set(k, v),
    remove: (k) => void map.delete(k),
    keys: () => [...map.keys()],
    clear: () => map.clear(),
  };
}

function notSupported(msg: string): never {
  const err = new Error(msg);
  err.name = 'NotSupportedError';
  throw err;
}

function webStorageOf(name: 'local' | 'session'): Storage | null {
  // بررسی هنگام فراخوانی (SSR-safe). حالت private ممکن است throw کند.
  try {
    const ws = name === 'local' ? globalThis.localStorage : globalThis.sessionStorage;
    if (!ws) return null;
    const probe = '__zenith_probe__';
    ws.setItem(probe, '1');
    ws.removeItem(probe);
    return ws;
  } catch {
    return null;
  }
}

function webDriver(name: 'local' | 'session'): StorageDriver {
  return {
    name,
    available: () => webStorageOf(name) !== null,
    get(k) {
      return webStorageOf(name)?.getItem(k) ?? undefined;
    },
    set(k, v) {
      const ws = webStorageOf(name);
      if (!ws) notSupported(`storage-${name} unavailable`);
      ws!.setItem(k, v);
    },
    remove(k) {
      webStorageOf(name)?.removeItem(k);
    },
    // Object.keys روی proxy انبار ذخیره مرورگر/jsdom کلیدهای آیتم را می‌دهد.
    keys() {
      const ws = webStorageOf(name);
      return ws ? Object.keys(ws) : [];
    },
    clear() {
      // درایور سطح پایین؛ createStorage مسیر clear خودش (remove per-key) را
      // دارد تا کل storage کاربر پاک نشود. این متد فقط برای انطباق اینترفیس.
      webStorageOf(name)?.clear();
    },
  };
}

export const localDriver: StorageDriver = webDriver('local');
export const sessionDriver: StorageDriver = webDriver('session');

/** ساخت رشتهٔ کوکی از گزینه‌ها (SPEC: sameSite Strict، secure true، path /). */
export function buildCookieString(
  key: string,
  value: string,
  opts: Partial<CookieOptions> | undefined,
): string {
  const { path = '/', domain, sameSite = 'Strict', secure = true, maxAge } = opts ?? {};
  let text = `${key}=${encodeURIComponent(value)}`;
  text += `; path=${path}`;
  if (domain) text += `; domain=${domain}`;
  if (maxAge !== undefined) text += `; max-age=${maxAge}`;
  text += `; samesite=${sameSite}`;
  if (secure) text += '; secure';
  return text;
}

/**
 * درایور کوکی (SPEC §۲.۵).
 * هشدار امنیتی: کوکی‌نویسی کلاینت هرگز HttpOnly نمی‌تواند باشد — توکن
 * sessions هرگز به این درایور سپرده نمی‌شود (docs/security/auth.md، #62).
 */
export function cookieDriver(opts?: CookieOptions): StorageDriver {
  const readAll = (): Map<string, string> => {
    const map = new Map<string, string>();
    if (!hasDOM()) return map;
    for (const part of document.cookie.split(';')) {
      const eq = part.indexOf('=');
      if (eq < 0) continue;
      const k = part.slice(0, eq).trim();
      const v = part.slice(eq + 1).trim();
      if (k) map.set(k, decodeURIComponent(v));
    }
    return map;
  };
  return {
    name: 'cookie',
    available: () => hasDOM(),
    get: (k) => readAll().get(k),
    set: (k, v) => {
      if (!hasDOM()) notSupported('document unavailable');
      document.cookie = buildCookieString(k, v, opts);
    },
    remove: (k) => {
      if (!hasDOM()) return;
      document.cookie = buildCookieString(k, '', { ...opts, maxAge: 0 });
    },
    keys: () => [...readAll().keys()],
    clear() {
      for (const k of [...readAll().keys()]) this.remove(k);
    },
  };
}

// ── IndexedDB ────────────────────────────────────────────────────────────
// درایور async با snapshot هم‌زمان: خواندن‌ها از Map داخلی است و پس از
// ready() با محتوای DB پر می‌شود؛ نوشتن‌ها بی‌درنگ در snapshot و
// fire-and-forget در DB می‌نشینند (خطا ⇒ onErrorSink؛ هیچ throw لاگ مستقیم).
// فقط addEventListener (همه مرورگرهای هدف پشتیبانی می‌کنند).

type IdbReq = {
  onupgradeneeded?: (() => void) | null;
  result?: unknown;
  addEventListener: (t: string, cb: (e?: unknown) => void) => void;
};
type IdbTx = {
  objectStore: (n: string) => {
    put: (v: unknown) => IdbReq;
    delete: (k: string) => IdbReq;
    getAll: () => IdbReq;
    clear: () => IdbReq;
  };
  addEventListener: (t: string, cb: (e?: unknown) => void) => void;
};
type Idb = {
  transaction: (names: string | string[], mode?: string) => IdbTx;
  createObjectStore: (n: string, params?: { keyPath: string }) => unknown;
  objectStoreNames?: { contains: (n: string) => boolean };
};

function reqAsPromise(req: IdbReq): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const fail = () => reject(new Error('idb-request-failed'));
    req.addEventListener('success', () => resolve(req.result));
    req.addEventListener('error', fail);
    req.addEventListener('abort', fail);
  });
}

export interface IndexedDBDriver extends StorageDriver {
  /** subscribe به خطاهای نوشتن/تراکنش (createStorage به logger وصل می‌کند). */
  onWriteError(cb: (err: unknown) => void): void;
}

export function indexedDBDriver(options: IDBOptions = {}): IndexedDBDriver {
  const dbName = options.db ?? 'zenith-storage';
  const storeName = options.store ?? 'kv';
  const cache = new Map<string, string>();
  let db: Idb | null = null;
  let openPromise: Promise<void> | null = null;
  const errorSinks: Array<(err: unknown) => void> = [];
  const report = (err: unknown): void => {
    for (const sink of [...errorSinks]) {
      try {
        sink(err);
      } catch {
        /* sink خراب نباید نوشتن را بشکند */
      }
    }
  };

  const open = (): Promise<void> => {
    if (openPromise) return openPromise;
    const factory = (globalThis as { indexedDB?: { open: (n: string, v?: number) => IdbReq } })
      .indexedDB;
    if (!factory || !hasWindow()) {
      return (openPromise = Promise.reject(new Error('indexedDB-unavailable')));
    }
    openPromise = new Promise<void>((resolve, reject) => {
      const req = factory.open(dbName, 1);
      const fail = () => reject(new Error('indexedDB-open-failed'));
      req.onupgradeneeded = () => {
        const d = req.result as Idb;
        try {
          if (!d.objectStoreNames?.contains(storeName))
            d.createObjectStore(storeName, { keyPath: 'k' });
        } catch {
          /* موجود */
        }
      };
      const onOpen = () => {
        db = req.result as Idb;
        loadSnapshot().then(
          () => resolve(),
          () => resolve(),
        );
      };
      req.addEventListener('success', onOpen);
      req.addEventListener('error', fail);
      req.addEventListener('abort', fail);
    });
    return openPromise;
  };

  async function loadSnapshot(): Promise<void> {
    if (!db) return;
    try {
      // رکوردها به‌صورت {k,v} ذخیره می‌شوند تا یک getAll() کل snapshot را
      // با کلیدها برگرداند (بدون getAllKeys + N درخواست get).
      const os = db.transaction(storeName, 'readonly').objectStore(storeName);
      const rows = ((await reqAsPromise(os.getAll())) as Array<{ k: string; v: string }>) ?? [];
      for (const r of rows) {
        if (r && typeof r.k === 'string' && typeof r.v === 'string') cache.set(r.k, r.v);
      }
    } catch (err) {
      report(err);
    }
  }

  const write = (k: string, v: string | null): void => {
    if (v === null) cache.delete(k);
    else cache.set(k, v);
    if (!db) return; // پیش از ready: snapshot مرجع است؛ sync پس از open
    try {
      const tx = db.transaction(storeName, 'readwrite');
      const os = tx.objectStore(storeName);
      if (v === null) os.delete(k);
      else os.put({ k, v });
      const failed = () => report(new Error('idb-write-failed'));
      tx.addEventListener('error', failed);
      tx.addEventListener('abort', failed);
    } catch (err) {
      report(err);
    }
  };

  return {
    name: 'indexeddb',
    available: () => (globalThis as { indexedDB?: unknown }).indexedDB !== undefined && hasWindow(),
    get: (k) => cache.get(k),
    set: (k, v) => write(k, v),
    remove: (k) => write(k, null),
    keys: () => [...cache.keys()],
    clear() {
      for (const k of [...cache.keys()]) write(k, null);
    },
    ready: () => open(),
    onWriteError: (cb) => void errorSinks.push(cb),
  };
}

/** گزینه‌های `driverByName(name, options?)` (#55: آبجکت گزینه‌ها). @public */
export interface DriverByNameOptions {
  /** گزینه‌های درایور کوکی (فقط وقتی `name` برابر `'cookie'` است خوانده می‌شود). */
  cookie?: CookieOptions;
  /** گزینه‌های درایور IndexedDB (فقط وقتی `name` برابر `'indexeddb'` است خوانده می‌شود). */
  indexedDB?: IDBOptions;
}

/** درایور نام‌دار (SPEC: گزینهٔ `driver` می‌تواند رشته باشد). @public */
export function driverByName(
  name: DriverName,
  options?: DriverByNameOptions,
): StorageDriver;
/** @public @deprecated #55 — امضای positional؛ از `driverByName(name, { cookie, indexedDB })` استفاده کنید (ZEN-DEPR-106، حذف در ۲.۰). */
export function driverByName(
  name: DriverName,
  cookieOpts?: CookieOptions,
  idbOpts?: IDBOptions,
): StorageDriver;
export function driverByName(
  name: DriverName,
  cookieOptsOrOptions?: CookieOptions | DriverByNameOptions,
  legacyIdbOpts?: IDBOptions,
): StorageDriver {
  // #55: هر دو شکل آرگومان دوم آبجکت‌اند؛ شکل جدید با کلیدهای
  // `cookie`/`indexedDB` (و `{}` خالی) و آرگومان سوم قدیمی از هم جدا می‌شوند.
  // (شکل قدیمِ `(…, undefined, opts)` با legacyIdbOpts شناسایی می‌شود تا
  // گزینه‌های idb گم نشود.)
  const isNewShape =
    legacyIdbOpts === undefined &&
    (cookieOptsOrOptions === undefined ||
      (typeof cookieOptsOrOptions === 'object' &&
        cookieOptsOrOptions !== null &&
        (Object.keys(cookieOptsOrOptions).length === 0 ||
          'cookie' in cookieOptsOrOptions ||
          'indexedDB' in cookieOptsOrOptions)));
  if (!isNewShape) {
    deprecate(
      'ZEN-DEPR-106',
      'driverByName(name, cookieOpts, idbOpts)',
      'driverByName(name, { cookie, indexedDB })',
    );
  }
  const cookieOpts = isNewShape
    ? (cookieOptsOrOptions as DriverByNameOptions | undefined)?.cookie
    : (cookieOptsOrOptions as CookieOptions | undefined);
  const idbOpts = isNewShape
    ? (cookieOptsOrOptions as DriverByNameOptions | undefined)?.indexedDB
    : legacyIdbOpts;
  switch (name) {
    case 'local':
      return localDriver;
    case 'session':
      return sessionDriver;
    case 'memory':
      return memoryDriver();
    case 'cookie':
      return cookieDriver(cookieOpts);
    case 'indexeddb':
      return indexedDBDriver(idbOpts);
  }
}
