// packages/cache/src/cache.ts
//
// #144 — @zenith/cache: پیاده‌سازی مشترک (SPEC §۲.۴) — جایگزین ۶ کش مستقل
// (http/data/resource/components/expressions/router).
//
// طراحی:
//   • Map ترتیب درج را حفظ می‌کند ⇒ LRU با delete+set (لمس در خواندن) و
//     FIFO بدون لمس؛ حذف از ابتدای ترتیب. بدون ساختار جانبی (حداقل بایت).
//   • انقضا lazy: هیچ timerی نیست (SSR-safe؛ گیت layering آن را قفل می‌کند).
//     ttl=0 و 'never' یعنی بدون انقضا (کاتالوگ ZEN-1201 همین معنا را دارد).
//   • getOrLoad: dedupe با Map «pending»؛ stale ⇒ فوراً سرو مقدار قدیمی +
//     revalidate پس‌زمینه (خطای پس‌زمینه بلعیده می‌شود — دادهٔ stale هنوز
//     سرو می‌شود و زنجیرهٔ promise مصرف‌کننده هرگز unhandled نمی‌شود).
//   • ضدنشت/نسل (bumps): هر کلید در-flight شمارندهٔ تغییر دارد؛ حذف/ست/
//     اینولید همان کلید حین بارگذاری، شمارنده را بالا می‌برد و commit معلق
//     بی‌اثر می‌شود (آخرین نوشتن برنده). شمارنده‌ها فقط تا عمر pending
//     در-flight زنده‌اند ⇒ رشد بی‌پایان ندارند (تست نشت: limits-registry).
import { createReservedError, isZenithError } from '@zenith/errors';
import { invariant } from '@zenith/shared';
import { getSignalAdapter, registerCache, unregisterCache } from './registry';
import type {
  Cache,
  CacheOptions,
  CachePredicate,
  CacheStats,
  EntryOptions,
  EntryTtl,
  EvictReason,
} from './types';

interface Entry<V> {
  v: V;
  /** زمان درج/commit (مبنای ttl) — با لمس LRU تکان نمی‌خورد. */
  t: number;
  /** `undefined` ⇒ از پیش‌فرض کش استفاده کن؛ `null` ⇒ بدون انقضا. */
  ttl: EntryTtl | undefined;
  tags: Set<string> | undefined;
}

function badNumber(n: number | undefined): boolean {
  return n !== undefined && (!Number.isFinite(n) || n < 0);
}

/** ttl ورودی (گرامر §۰.۲) ⇒ ttl entry؛ نامعتبر ⇒ ZEN-1201. */
function toEntryTtl(ttl: number | 'never' | undefined): EntryTtl | undefined {
  if (ttl === undefined) return undefined;
  if (ttl === 'never' || ttl === 0) return null;
  if (badNumber(ttl)) throw createReservedError('ZEN-1201', { context: { ttl } });
  return ttl;
}

export function createCache<V = unknown, K = string>(
  options: CacheOptions<V, K> = {},
): Cache<V, K> {
  const {
    ttl = 'never',
    staleWhileRevalidate = 0,
    maxSize = 500,
    maxBytes,
    sizeOf,
    policy = 'lru',
  } = options;
  const clock = options.clock ?? Date.now;
  const name = options.name;

  // اعتبارسنجی گزینه‌ها — ZEN-1201 (کاتالوگ #171).
  if (typeof ttl === 'number' && badNumber(ttl))
    throw createReservedError('ZEN-1201', { context: { ttl } });
  if (badNumber(staleWhileRevalidate))
    throw createReservedError('ZEN-1201', { context: { staleWhileRevalidate } });
  if (badNumber(maxSize) || maxSize === 0)
    throw createReservedError('ZEN-1201', { context: { maxSize } });
  if (badNumber(maxBytes)) throw createReservedError('ZEN-1201', { context: { maxBytes } });

  const defaultTtl: EntryTtl = ttl === 'never' || ttl === 0 ? null : (ttl as number);
  const entries = new Map<K, Entry<V>>();
  const tagIndex = new Map<string, Set<K>>();
  const pending = new Map<K, Promise<V>>();
  const bumps = new Map<K, number>(); // فقط برای کلیدهای در-flight (تست نشت)
  const evictCbs: Array<(key: K, value: V | undefined, reason: EvictReason) => void> = [];
  if (options.onEvict) evictCbs.push(options.onEvict);

  let bytes = 0;
  let hits = 0;
  let misses = 0;
  let staleHits = 0;
  let evictions = 0;
  let disposed = false;

  function checkAlive(): void {
    invariant(!disposed, '[cache] استفاده پس از dispose — کش تازه بسازید', {
      details: { name: name ?? null },
    });
  }

  /** تغییر کلیدِ در-flight ⇒ هر commit معلق با s0 کهنه بی‌اثر می‌شود. */
  function bump(key: K): void {
    if (pending.has(key)) bumps.set(key, (bumps.get(key) ?? 0) + 1);
  }

  function entrySize(entry: Entry<V>): number {
    if (!sizeOf) return 0;
    const s = sizeOf(entry.v);
    return typeof s === 'number' && Number.isFinite(s) && s > 0 ? s : 0;
  }

  function ttlOf(entry: Entry<V>): EntryTtl {
    return entry.ttl === undefined ? defaultTtl : entry.ttl;
  }

  function ageOf(entry: Entry<V>): number {
    return clock() - entry.t;
  }

  /** مرز سخت: past ttl+swr ⇒ داده واقعاً expired است. */
  function expired(entry: Entry<V>): boolean {
    const t = ttlOf(entry);
    return t !== null && ageOf(entry) > t + staleWhileRevalidate;
  }

  /** داخل پنجرهٔ SWR (past ttl، زیر مرز سخت)؟ */
  function staleWithin(entry: Entry<V>): boolean {
    if (staleWhileRevalidate <= 0) return false;
    const t = ttlOf(entry);
    if (t === null) return false;
    const age = ageOf(entry);
    return age > t && age <= t + staleWhileRevalidate;
  }

  function untag(key: K, entry: Entry<V>): void {
    if (!entry.tags) return;
    for (const tag of entry.tags) {
      const bucket = tagIndex.get(tag);
      if (bucket) {
        bucket.delete(key);
        if (bucket.size === 0) tagIndex.delete(tag);
      }
    }
    entry.tags = undefined;
  }

  function remove(key: K, entry: Entry<V>, reason: EvictReason): void {
    bump(key);
    entries.delete(key);
    bytes -= entrySize(entry);
    untag(key, entry);
    evictions++;
    for (const cb of [...evictCbs]) cb(key, entry.v, reason);
  }

  /** lazy sweep + enforce maxSize/maxBytes (از قدیمی‌ترینِ ترتیب Map). */
  function trim(): void {
    for (const [key, entry] of [...entries]) {
      if (expired(entry)) remove(key, entry, 'ttl');
    }
    for (const key of [...entries.keys()]) {
      if (entries.size <= maxSize) break;
      const e = entries.get(key);
      if (e) remove(key, e, 'size');
    }
    if (sizeOf && maxBytes !== undefined) {
      for (const key of [...entries.keys()]) {
        if (bytes <= maxBytes) break;
        const e = entries.get(key);
        if (e) remove(key, e, 'size');
      }
    }
  }

  /** LRU: با delete+set به انتهای ترتیب؛ FIFO: بدون لمس. */
  function touch(key: K, entry: Entry<V>): void {
    if (policy === 'lru') {
      entries.delete(key);
      entries.set(key, entry);
    }
  }

  function store(key: K, value: V, opts?: EntryOptions): V {
    bump(key);
    const prev = entries.get(key);
    if (prev) {
      bytes -= entrySize(prev);
      untag(key, prev);
      entries.delete(key);
    }
    const explicit = toEntryTtl(opts?.ttl);
    const entry: Entry<V> = {
      v: value,
      t: clock(),
      ttl: opts?.ttl === undefined ? undefined : explicit,
      tags: undefined,
    };
    if (opts?.tags && opts.tags.length > 0) {
      entry.tags = new Set();
      for (const tag of opts.tags) {
        entry.tags.add(tag);
        let bucket = tagIndex.get(tag);
        if (!bucket) tagIndex.set(tag, (bucket = new Set()));
        bucket.add(key);
      }
    }
    entries.set(key, entry);
    bytes += entrySize(entry);
    trim();
    return value;
  }

  function sweepExpired(): void {
    for (const [key, entry] of [...entries]) {
      if (expired(entry)) remove(key, entry, 'ttl');
    }
  }

  /**
   * خواندن با لمس: expired ⇒ حذف+miss؛ stale ⇒ staleHit (recency برای LRU
   * تازه می‌شود، freshness نه — storedAt تکان نمی‌خورد)؛ fresh ⇒ hit.
   */
  function readFresh(key: K): V | undefined {
    const entry = entries.get(key);
    if (!entry) {
      misses++;
      return undefined;
    }
    if (expired(entry)) {
      remove(key, entry, 'ttl');
      misses++;
      return undefined;
    }
    touch(key, entry);
    if (staleWithin(entry)) staleHits++;
    else hits++;
    return entry.v;
  }

  function wrapLoaderError(key: K, err: unknown): unknown {
    if (isZenithError(err) && err.code === 'ZEN-1202') return err;
    return createReservedError('ZEN-1202', { cause: err, context: { key: String(key) } });
  }

  function startLoad(
    key: K,
    loader: () => V | Promise<V>,
    opts: EntryOptions | undefined,
    s0: number,
  ): Promise<V> {
    let result: V | Promise<V>;
    try {
      result = loader();
    } catch (err) {
      // API پرامیس‌محور است: هرگز sync throw نکن، reject کن
      return Promise.reject(wrapLoaderError(key, err));
    }
    if (!(result instanceof Promise)) {
      // مسیر sync: commit در microtask بعدی تا پنجرهٔ dedupe (pending) شکل
      // کند و خطای potential تو در تو ساخته نشود.
      if (!pending.has(key)) {
        const p = Promise.resolve(result);
        pending.set(key, p);
        queueMicrotask(() => {
          if (pending.get(key) === p) pending.delete(key);
          if (!disposed && (bumps.get(key) ?? 0) === s0) store(key, result, opts);
        });
      }
      return Promise.resolve(result);
    }
    const release = () => {
      if (pending.get(key) === promise) pending.delete(key);
      const live = (bumps.get(key) ?? 0) === s0;
      bumps.delete(key);
      return live;
    };
    const promise: Promise<V> = result.then(
      (value) => {
        const commit = release();
        if (commit && !disposed) store(key, value, opts);
        return value;
      },
      (err) => {
        release();
        throw wrapLoaderError(key, err);
      },
    );
    pending.set(key, promise);
    return promise;
  }

  function getOrLoad(key: K, loader: () => V | Promise<V>, opts?: EntryOptions): Promise<V> {
    checkAlive();

    const entry = entries.get(key);
    if (entry && expired(entry)) {
      remove(key, entry, 'ttl');
    } else if (entry && staleWithin(entry)) {
      // stale: فوراً سرو کن؛ دقیقاً یک revalidate پس‌زمینه (dedupe با pending).
      // خطای bg بلعیده می‌شود — دادهٔ stale هنوز سرو می‌شود و unhandled
      // rejection ساخته نمی‌شود.
      staleHits++;
      if (!pending.has(key))
        void startLoad(key, loader, opts, bumps.get(key) ?? 0).catch(() => undefined);
      return Promise.resolve(entry.v);
    } else if (entry) {
      touch(key, entry);
      hits++;
      return Promise.resolve(entry.v);
    }

    // بدون entry: dedupe هم‌زمانی روی یک loader (۱۰۰ فراخوانی = ۱ بار)
    const inflight = pending.get(key);
    if (inflight) return inflight;
    misses++;
    return startLoad(key, loader, opts, bumps.get(key) ?? 0);
  }

  const cache: Cache<V, K> = {
    get size() {
      sweepExpired();
      return entries.size;
    },
    name,
    get(key) {
      checkAlive();
      return readFresh(key);
    },
    peek(key) {
      const entry = entries.get(key);
      if (!entry) return undefined;
      if (expired(entry)) {
        remove(key, entry, 'ttl');
        return undefined;
      }
      return entry.v;
    },
    set(key, value, opts) {
      checkAlive();
      return store(key, value, opts);
    },
    has(key) {
      const entry = entries.get(key);
      if (!entry) return false;
      if (expired(entry)) {
        remove(key, entry, 'ttl');
        return false;
      }
      return true;
    },
    delete(key) {
      const entry = entries.get(key);
      if (!entry) {
        bump(key);
        return false;
      }
      remove(key, entry, 'manual');
      return true;
    },
    clear() {
      for (const key of pending.keys()) bump(key);
      for (const [key, entry] of [...entries]) remove(key, entry, 'manual');
      pending.clear();
      // bumps عمداً پاک نمی‌شود تا commit‌های معلق پس از clear بی‌اثر بمانند
    },
    revalidate(key, value) {
      checkAlive();
      const entry = entries.get(key);
      if (!entry || expired(entry)) {
        if (entry) remove(key, entry, 'ttl');
        return false;
      }
      bump(key);
      bytes -= entrySize(entry);
      entry.v = value;
      entry.t = clock();
      bytes += entrySize(entry);
      touch(key, entry);
      return true;
    },
    isStale(key) {
      const entry = entries.get(key);
      return entry !== undefined && !expired(entry) && staleWithin(entry);
    },
    invalidate(tagsOrPredicate) {
      checkAlive();
      const doomed = new Set<K>();
      if (typeof tagsOrPredicate === 'function') {
        const pred = tagsOrPredicate as CachePredicate<V, K>;
        for (const [key, entry] of entries) {
          if (pred(key, entry.v)) doomed.add(key);
        }
        // بارگذاری‌های در-flight هم هدف‌اند (value هنوز undefined است)
        for (const key of pending.keys()) if (pred(key, undefined)) bump(key);
      } else {
        const tags = typeof tagsOrPredicate === 'string' ? [tagsOrPredicate] : tagsOrPredicate;
        for (const tag of tags) {
          const bucket = tagIndex.get(tag);
          if (bucket) for (const key of bucket) doomed.add(key);
        }
      }
      for (const key of doomed) {
        const entry = entries.get(key);
        if (entry) remove(key, entry, 'manual');
      }
      return [...doomed];
    },
    getOrLoad,
    keys() {
      sweepExpired();
      return [...entries.keys()];
    },
    stats() {
      sweepExpired();
      const total = hits + misses + staleHits;
      const stats: CacheStats = {
        size: entries.size,
        maxSize,
        hits,
        misses,
        staleHits,
        evictions,
        hitRatio: total > 0 ? (hits + staleHits) / total : 0,
        pending: pending.size,
        tagKeys: tagIndex.size,
      };
      if (sizeOf) stats.bytes = Math.max(0, bytes);
      return stats;
    },
    onEvict(cb) {
      checkAlive();
      evictCbs.push(cb);
      let done = false;
      return () => {
        if (done) return;
        done = true;
        const i = evictCbs.indexOf(cb);
        if (i >= 0) evictCbs.splice(i, 1);
      };
    },
    signal(key) {
      checkAlive();
      const adapter = getSignalAdapter<V, K>();
      invariant(adapter !== undefined, '[cache] «signal» بدون adapter؛ setSignalAdapter بدهید', {
        details: { key: String(key) },
      });
      return adapter(key, cache);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      if (name) unregisterCache(name);
      pending.clear();
      bumps.clear();
      sweepExpired();
      for (const [key, entry] of [...entries]) remove(key, entry, 'manual');
      evictCbs.length = 0;
    },
  };

  if (name) registerCache(name, cache as unknown as Cache<unknown, string>);
  return cache;
}
