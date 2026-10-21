// packages/storage/src/storage.ts
//
// #145 — createStorage (SPEC §۲.۵): لایهٔ واحد ذخیره‌سازی کل ورک‌اسپیس.
//
// طراحی:
//   • record چهارمظرفی {v,t,e,d} سریال‌شده در درایور رشته‌ای؛ ttl lazy بدون
//     timer (SSR-safe؛ همان قاعدهٔ #144)؛ `t` (زمان نوشتن) مبنای evict-oldest.
//   • JSON که parse می‌شود ولی record نیست ⇒ دادهٔ «میراث» (version 0) ⇒
//     از migrate(v0) عبور می‌کند و با wrapper تازه adopt می‌شود (جلسه‌های
//     موجود auth هنگام مهاجرت حفظ می‌شوند). JSON خراب ⇒ ZEN-1104 + پاک‌سازی.
//   • درایور غیرقابل‌دسترس یا sensitive روی local/session/indexeddb ⇒
//     fallback به memory با هشدار ZEN-1101، بدون استثنا (معیار پذیرش #145).
//   • هشدارها از logger (دروازهٔ no-console #143)؛ هیچ لاگ مستقیم در این پکیج.
//   • پیام‌های لاگ ASCII (بودجۀ gzip): فارشی/جزئیات در context می‌نشیند.
//   • همگام‌سازی بین‌تب: پیش‌فرض window `storage` event؛ تزریق SyncBus در تست.

import { createReservedError } from '@zenith/errors';
import { logger } from '@zenith/logger';
import { isServer } from '@zenith/shared';
import { driverByName, memoryDriver } from './drivers';
import { createStorageSignal } from './signal-core';
import { DEFAULTS, isQuotaError, runValidate, defaultSyncBus, KNOWN_DRIVERS, validateTtl, isStorageAvailable } from './storage-helpers';
import type { DriverName, SetOptions, StorageDriver, StorageEventPayload, StorageOptions, StorageRecord, SyncBus, ZenithStorage } from './types';

export { DEFAULTS, isStorageAvailable };
export function createStorage(options: StorageOptions = {}): ZenithStorage {
  const namespace = options.namespace ?? DEFAULTS.namespace;
  // namespace '' ⇒ بدون پیشوند (کلیدهای دقیق میراث مثل zenith_auth_tokens).
  const prefix = namespace ? `${namespace}:` : '';
  const version = options.version ?? DEFAULTS.version;
  const clock = options.clock ?? Date.now;
  const serializer = options.serializer ?? DEFAULTS.serializer;
  const sync = options.sync ?? DEFAULTS.sync;
  const sensitive = options.sensitive ?? DEFAULTS.sensitive;
  const quotaPolicy = options.onQuotaExceeded ?? DEFAULTS.onQuotaExceeded;
  // ttl نامعتبر هنگام ساخت ⇒ ZEN-1201 (validateTtl همان‌جا throw می‌کند).
  const defaultTtlMs =
    options.ttl === undefined || options.ttl === 'never' ? null : validateTtl(options.ttl);

  // ── انتخاب درایور + fallback ZEN-1101 ──────────────────────────────────
  let driver: StorageDriver;
  if (options.driver && typeof options.driver === 'object') {
    driver = options.driver;
  } else {
    const name = (options.driver ?? (isServer() ? 'memory' : 'local')) as DriverName;
    if (!KNOWN_DRIVERS.includes(name)) {
      // driver ناشناخته ⇒ «در دسترس نیست» (ZEN-1101) — throw نمی‌کنیم.
      logger.warn('ZEN-1101: unknown driver', { driver: name });
      driver = memoryDriver();
    } else {
      driver = driverByName(name, { cookie: options.cookie, indexedDB: options.indexedDB });
    }
  }
  function fallBackToMemory(why: string): void {
    logger.warn(`ZEN-1101: ${why}`, { attempted: driver.name });
    driver = memoryDriver();
  }
  if (sensitive && driver.name !== 'memory' && driver.name !== 'cookie') {
    // معیار پذیرش #145: sensitive هرگز در local/session/indexeddb نمی‌نویسد.
    // SPEC: sensitive:true ⇒ فقط memory/cookie.
    fallBackToMemory('sensitive: memory/cookie only');
  } else if (!driver.available()) {
    // حالت private / نبود محیط ⇒ fallback memory با هشدار، بدون استثنا.
    fallBackToMemory('storage unavailable');
  }

  const keyFor = (key: string): string => `${prefix}${key}`;
  const bareOf = (rawKey: string): string | null =>
    rawKey.startsWith(prefix) ? rawKey.slice(prefix.length) : null;

  // ── record encode/decode ───────────────────────────────────────────────
  function encode(value: unknown, ttlMs: number | null): string {
    const now = clock();
    const record: StorageRecord = {
      v: version,
      t: now,
      e: ttlMs === null ? null : now + ttlMs,
      d: value,
    };
    return serializer.stringify(record);
  }

  type Decoded =
    { ok: true; rec: StorageRecord } | { ok: false; corrupt: boolean; legacy: unknown };

  function decode(raw: string): Decoded {
    let parsed: unknown;
    try {
      parsed = serializer.parse(raw);
    } catch {
      return { ok: false, corrupt: true, legacy: undefined };
    }
    const rec = parsed as StorageRecord;
    // آرایه/null با این بررسی‌ها رد می‌شوند (Array هرگز «.v» عددی ندارد).
    if (
      rec !== null &&
      typeof rec === 'object' &&
      typeof rec.v === 'number' &&
      'd' in rec &&
      'e' in rec
    ) {
      return { ok: true, rec };
    }
    // JSON سالم ولی record ما نیست ⇒ دادهٔ میراث (version 0).
    return { ok: false, corrupt: false, legacy: parsed };
  }

  // ── subscribe / sync ───────────────────────────────────────────────────
  const listeners = new Map<string, Set<(payload: StorageEventPayload) => void>>();
  function notify(key: string, payload: StorageEventPayload): void {
    const set = listeners.get(key);
    if (!set) return;
    for (const cb of [...set]) cb(payload);
  }

  let bus: SyncBus | null = null;
  let busOff: (() => void) | null = null;

  // ── core ───────────────────────────────────────────────────────────────
  let disposed = false;

  function purge(key: string, code: 'ZEN-1103' | 'ZEN-1104' | null, err?: unknown): void {
    try {
      driver.remove(keyFor(key));
    } catch {
      /* پاک‌سازی بی‌صدا */
    }
    if (code) {
      logger.warn(code ?? '', { key, cause: err instanceof Error ? err.message : err });
    }
  }

  /** مسیر مشترک پذیرش داده (record یا legacy): migrate/validate/backfill. */
  function accept(key: string, decoded: Decoded, resync: boolean): unknown {
    const rec = decoded.ok ? decoded.rec : null;
    const legacy = decoded.ok ? undefined : decoded.legacy;
    let value: unknown;
    let needsBackfill = false;

    if (rec && rec.e !== null && rec.e <= clock()) {
      if (!resync) purge(key, null); // انقضا lazy
      return undefined;
    }
    const remainTtl = rec && rec.e !== null ? Math.max(0, rec.e - clock()) : null;
    const from = rec ? rec.v : 0; // دادهٔ میراث = version 0

    if (rec && from === version) {
      value = rec.d;
    } else if (from < version && typeof options.migrate === 'function') {
      try {
        value = options.migrate(rec ? rec.d : legacy, from);
      } catch (err) {
        if (!resync) purge(key, 'ZEN-1103', err);
        return undefined;
      }
      needsBackfill = true;
    } else {
      // بدون migrate (یا legacy بی‌migrate، یا نسخهٔ جدیدتر از کد) ⇒ دور ریختن.
      // legacy بی‌ سرپرست ⇒ ZEN-1104؛ record کهنه ⇒ بی‌صدا.
      if (!resync) purge(key, rec ? null : 'ZEN-1104');
      return undefined;
    }

    try {
      value = runValidate(options.validate, value);
    } catch (err) {
      if (!resync) purge(key, 'ZEN-1104', err);
      return undefined;
    }
    if (needsBackfill && !resync) writeValue(key, value, remainTtl, false);
    return value;
  }

  function readValue(key: string, resync = false): unknown {
    const raw = driver.get(keyFor(key));
    if (raw === undefined) return undefined;
    const decoded = decode(raw);
    if (!decoded.ok && decoded.corrupt) {
      if (!resync) purge(key, 'ZEN-1104');
      return undefined;
    }
    return accept(key, decoded, resync);
  }

  function announce(key: string, rawKey: string, value: unknown): void {
    bus?.publish(rawKey, false);
    notify(key, { key, value, origin: 'local' });
  }

  function writeValue(
    key: string,
    value: unknown,
    ttlMs: number | null,
    announceLocal: boolean,
  ): void {
    const rawKey = keyFor(key);
    const payload = encode(value, ttlMs);
    try {
      driver.set(rawKey, payload);
    } catch (err) {
      if (isQuotaError(err)) {
        applyQuotaPolicy(key, payload, err, value, announceLocal); // خود announce می‌کند
        return;
      }
      // درایور حین نوشتن از دسترس افتاد (private mode) ⇒ fallback + retry یک‌بار
      if (driver.name === 'memory') throw err;
      fallBackToMemory('write failed');
      driver.set(rawKey, payload);
    }
    if (announceLocal) announce(key, rawKey, value);
  }

  function applyQuotaPolicy(
    key: string,
    payload: string,
    err: unknown,
    value: unknown,
    announceLocal: boolean,
  ): void {
    if (quotaPolicy === 'throw') {
      throw createReservedError('ZEN-1102', { cause: err, context: { key } });
    }
    if (quotaPolicy === 'ignore') {
      logger.warn('ZEN-1102: quota ignored', { key });
      return;
    }
    // evict-oldest: قدیمی‌ترین record ما (کمترین t) + یک retry.
    // استخراج t با regex (record همیشه «"t":<number>» دارد؛ legacy ⇒ 0).
    let oldest: { k: string; t: number } | null = null;
    for (const rk of driver.keys()) {
      if (!rk.startsWith(prefix)) continue;
      const t = Number(/"t":(\d+)/.exec(driver.get(rk) ?? '')?.[1] ?? 0);
      if (!oldest || t < oldest.t) oldest = { k: rk, t };
    }
    if (!oldest || oldest.k === keyFor(key)) {
      logger.warn('ZEN-1102: nothing to evict', { key });
      return;
    }
    driver.remove(oldest.k);
    logger.warn('ZEN-1102: evicted oldest', {
      evicted: bareOf(oldest.k) ?? oldest.k,
    });
    try {
      driver.set(keyFor(key), payload);
      if (announceLocal) announce(key, keyFor(key), value);
    } catch (err2) {
      logger.warn('ZEN-1102: retry failed', {
        key,
        cause: err2 instanceof Error ? err2.message : err2,
      });
    }
  }

  const storage: ZenithStorage = {
    get driverName() {
      return driver.name;
    },
    ready: (async () => {
      const d = driver as StorageDriver & {
        ready?: () => Promise<void>;
        onWriteError?: (cb: (err: unknown) => void) => void;
      };
      d.onWriteError?.((err) => logger.warn('ZEN-1102: idb write failed', { cause: String(err) }));
      if (!d.ready) return;
      try {
        await d.ready();
      } catch (err) {
        // indexeddb باز نشد ⇒ fallback memory با هشدار، بدون exception
        logger.warn('ZEN-1101: driver not ready', { cause: String(err) });
        driver = memoryDriver();
      }
    })(),

    get<T = unknown>(key: string, def?: T): T | undefined {
      if (disposed) return def;
      // فقط undefined به def می‌رسد؛ null/false/0 حفظ می‌شوند (SPEC §۲.۵).
      const value = readValue(key) as T | undefined;
      return value === undefined ? def : value;
    },
    set<T = unknown>(key: string, value: T, setOpts?: SetOptions): void {
      if (disposed) return;
      let ttlMs: number | null = defaultTtlMs;
      if (setOpts?.ttl !== undefined) {
        ttlMs = setOpts.ttl === 'never' ? null : validateTtl(setOpts.ttl);
      }
      writeValue(key, value, ttlMs, true);
    },
    remove(key: string): boolean {
      if (disposed) return false;
      const existed = driver.get(keyFor(key)) !== undefined;
      driver.remove(keyFor(key));
      if (existed) {
        bus?.publish(keyFor(key), true);
        notify(key, { key, value: undefined, origin: 'remove' });
      }
      return existed;
    },
    has(key: string): boolean {
      if (disposed) return false;
      return readValue(key) !== undefined;
    },
    keys(): string[] {
      if (disposed) return [];
      const out: string[] = [];
      for (const rk of driver.keys()) {
        const bare = bareOf(rk);
        if (bare === null) continue;
        if (readValue(bare) !== undefined) out.push(bare);
      }
      return out;
    },
    clear(): void {
      if (disposed) return;
      // حذف per-key از مسیر remove (announce یکسان؛ کل storage کاربر پاک نمی‌شود)
      for (const rk of [...driver.keys()]) {
        const bare = bareOf(rk);
        if (bare !== null) storage.remove(bare);
      }
    },
    subscribe<T = unknown>(key: string, cb: (payload: StorageEventPayload<T>) => void) {
      if (disposed) return () => {};
      let set = listeners.get(key);
      if (!set) listeners.set(key, (set = new Set()));
      const wrapped = cb as (payload: StorageEventPayload) => void;
      set.add(wrapped);
      return () => void set.delete(wrapped);
    },
    signal<T = unknown>(key: string, initial: T) {
      if (disposed) {
        throw createReservedError('ZEN-1090', { context: { key } });
      }
      return createStorageSignal(storage, key, initial);
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      busOff?.();
      bus?.close();
      busOff = null;
      bus = null;
      listeners.clear();
    },
  };

  if (sync) {
    bus = (options.syncBus ?? defaultSyncBus)();
    busOff = bus.subscribe((rawKey, removed, localWrite) => {
      if (localWrite) return;
      const key = bareOf(rawKey);
      if (key === null) return; // بیرون namespace ⇒ بی‌ربط
      const value = removed ? undefined : readValue(key, true);
      notify(key, { key, value, origin: 'tab' });
    });
  }

  // seed (SSR: تزریق مقادیر از کوکی درخواست) — بدون announce.
  if (options.seed) {
    for (const [k, v] of Object.entries(options.seed)) {
      if (v !== undefined && driver.get(keyFor(k)) === undefined) {
        writeValue(k, v, defaultTtlMs, false);
      }
    }
  }

  return storage;
}