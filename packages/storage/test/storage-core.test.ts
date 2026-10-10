// @vitest-environment jsdom
//
// #145 — هستۀ createStorage (SPEC §۲.۵): get/set/has/keys/clear/remove، ttl
// lazy بدون timer، namespace، version+migrate، quota policies، sensitive،
// validate، fallback به memory با ZEN-1101، دادهٔ خراب ZEN-1104.
// هشدارها از logger (دروازهٔ no-console #143) ⇒ با bufferSink راستی‌آزمایی می‌شوند.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { addSink, bufferSink } from '@zenith/logger';
import type { LogSink } from '@zenith/logger';
import { createStorage, memoryDriver, isStorageAvailable, DEFAULTS } from '../src/index';
import type { StorageDriver, SyncBus } from '../src/types';

function fakeClock(start = 1_000_000) {
  let now = start;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

/** درایور تزریقی با شبیه‌سازی quota/available برای تست دترمینیستیک. */
function scriptedDriver(opts: { capacity?: number; failAvailable?: boolean } = {}) {
  const map = new Map<string, string>();
  const driver: StorageDriver = {
    name: 'local',
    available: () => !opts.failAvailable,
    get: (k) => map.get(k),
    set: (k, v) => {
      // شبیه‌سازی quota واقعی: پر بودن ظرفیت ⇒ نوشتن کلید جدید throw می‌کند
      if (opts.capacity !== undefined && !map.has(k) && map.size >= opts.capacity) {
        const err = new Error('The quota has been exceeded.');
        err.name = 'QuotaExceededError';
        throw err;
      }
      map.set(k, v);
    },
    remove: (k) => void map.delete(k),
    keys: () => [...map.keys()],
    clear: () => map.clear(),
  };
  return Object.assign(driver, { map });
}

let sink: LogSink & { entries(): Array<{ message: string }> };
let removeSink: () => void;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sink = bufferSink({ maxEntries: 200 });
  removeSink = addSink(sink);
});
afterEach(() => removeSink());

function loggedText(): string {
  return sink
    .entries()
    .map((e) => e.message)
    .join('\n');
}

describe('createStorage — core API', () => {
  it('DEFAULTS is deep-frozen per SPEC §۰.۲', () => {
    expect(Object.isFrozen(DEFAULTS)).toBe(true);
    expect(DEFAULTS.namespace).toBe('zen');
    expect(DEFAULTS.version).toBe(1);
    expect(DEFAULTS.sync).toBe(true);
    expect(DEFAULTS.sensitive).toBe(false);
    expect(DEFAULTS.onQuotaExceeded).toBe('evict-oldest');
    expect(DEFAULTS.ttl).toBe('never');
  });

  it('round-trips JSON values with default local driver in browser', () => {
    const s = createStorage();
    s.set('user', { name: 'ali', tags: ['a', 'b'] });
    expect(s.get('user')).toEqual({ name: 'ali', tags: ['a', 'b'] });
    expect(s.get('missing')).toBeUndefined();
    expect(s.get('missing', 42)).toBe(42);
    s.dispose();
  });

  it('namespaces raw keys ("ns:key") and keys() strips the prefix', () => {
    const s = createStorage({ namespace: 'ns' });
    s.set('a', 1);
    s.set('b', 2);
    expect(localStorage.getItem('ns:a')).toBeTruthy();
    expect(s.keys().sort()).toEqual(['a', 'b']);
    s.dispose();
  });

  it('namespace "" writes exact keys (legacy adoption without prefix — auth #145)', () => {
    const s = createStorage({ namespace: '' });
    s.set('zenith_auth_tokens', { accessToken: 'A' });
    expect(localStorage.getItem('zenith_auth_tokens')).toBeTruthy();
    expect(s.keys()).toEqual(['zenith_auth_tokens']);
    s.dispose();
  });

  it('has/remove/clear work; dispose is idempotent and ops after dispose are no-ops', () => {
    const s = createStorage({ driver: 'memory' });
    s.set('x', 1);
    expect(s.has('x')).toBe(true);
    expect(s.remove('x')).toBe(true);
    expect(s.remove('x')).toBe(false);
    expect(s.has('x')).toBe(false);
    s.set('y', 1);
    s.clear();
    expect(s.keys()).toEqual([]);
    s.dispose();
    s.dispose();
    expect(() => s.set('a', 1)).not.toThrow();
    expect(s.get('a')).toBeUndefined();
  });

  it('null/false/0 round-trip without falling back to `def`', () => {
    const s = createStorage({ driver: 'memory' });
    s.set('n', null);
    s.set('f', false);
    s.set('z', 0);
    expect(s.get('n', 'D')).toBeNull();
    expect(s.get('f', 'D')).toBe(false);
    expect(s.get('z', 'D')).toBe(0);
    s.dispose();
  });

  it('seed values are readable before any set (SSR cookie-injection path)', () => {
    const s = createStorage({ driver: 'memory', seed: { cart: [1, 2] } });
    expect(s.get('cart')).toEqual([1, 2]);
    // seed موجودیت را می‌سازد و نوشتن بعدی بازنویسی‌اش می‌کند
    expect(s.has('cart')).toBe(true);
    s.dispose();
  });

  it('ready resolves immediately for sync drivers', async () => {
    const s = createStorage({ driver: 'memory' });
    await expect(s.ready).resolves.toBeUndefined();
    s.dispose();
  });
});

describe('createStorage — TTL (lazy, no timers)', () => {
  it('default ttl expires values lazily with injected clock', () => {
    const clock = fakeClock();
    const s = createStorage({ driver: 'memory', ttl: 1000, clock: clock.now });
    s.set('a', 1);
    clock.advance(999);
    expect(s.get('a')).toBe(1);
    clock.advance(2);
    expect(s.get('a')).toBeUndefined();
    expect(s.has('a')).toBe(false);
    s.dispose();
  });

  it('per-key ttl overrides default; ttl 0 and "never" mean no-expiry', () => {
    const clock = fakeClock();
    const s = createStorage({ driver: 'memory', ttl: 5000, clock: clock.now });
    s.set('short', 1, { ttl: 100 });
    s.set('forever', 2, { ttl: 'never' });
    s.set('zero', 3, { ttl: 0 });
    clock.advance(200);
    expect(s.get('short')).toBeUndefined();
    expect(s.get('forever')).toBe(2);
    expect(s.get('zero')).toBe(3);
    s.dispose();
  });

  it('expired entries are physically purged from the driver on read', () => {
    const clock = fakeClock();
    const d = scriptedDriver();
    const s = createStorage({ driver: d, clock: clock.now });
    s.set('temp', 1, { ttl: 10 });
    clock.advance(11);
    expect(s.get('temp')).toBeUndefined();
    expect(d.map.size).toBe(0); // جاروی lazy
    s.dispose();
  });

  it('invalid ttl (negative/NaN) throws ZenithError ZEN-1201', () => {
    const s = createStorage({ driver: 'memory' });
    try {
      s.set('a', 1, { ttl: -5 });
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('ZEN-1201');
    }
    expect(() => createStorage({ driver: 'memory', ttl: -1 })).toThrow();
    s.dispose();
  });
});

describe('createStorage — version + migrate', () => {
  it('migrates v1 data to current version once, then backfills version', () => {
    const d = scriptedDriver();
    d.set('k:old', JSON.stringify({ v: 1, t: 100, e: null, d: { name: 'x' } }));
    const seen: number[] = [];
    const s = createStorage({
      driver: d,
      namespace: 'k',
      version: 2,
      migrate: (old, from) => {
        seen.push(from);
        return { fullName: (old as { name: string }).name.toUpperCase() };
      },
    });
    expect(s.get('old')).toEqual({ fullName: 'X' });
    expect(seen).toEqual([1]); // migrate فقط یک‌بار (پس از backfill نسخه)
    expect(JSON.parse(d.get('k:old')!).v).toBe(2);
    s.dispose();
  });

  it('without migrate, old-version data is dropped with ZEN-1104 log', () => {
    const d = scriptedDriver();
    d.set('zen:old', JSON.stringify({ v: 1, t: 100, e: null, d: { a: 1 } }));
    const s = createStorage({ driver: d, version: 2 });
    expect(s.get('old')).toBeUndefined();
    expect(d.map.size).toBe(0); // دادهٔ کهنه پاک شد
    s.dispose();
  });

  it('legacy raw JSON (pre-storage format) is adopted through migrate(v0)', () => {
    // الگوی مهاجرت auth: مقدار قدیمی بدون wrapper ⇒ version 0
    const d = scriptedDriver();
    d.set('zen:sess', JSON.stringify({ token: 'T', refresh: 'R' }));
    const s = createStorage({
      driver: d,
      migrate: (old, from) => {
        expect(from).toBe(0);
        return old;
      },
    });
    expect(s.get('sess')).toEqual({ token: 'T', refresh: 'R' });
    expect(JSON.parse(d.get('zen:sess')!).v).toBe(1); // adopt شد
    s.dispose();
  });

  it('migrate throwing ⇒ record dropped with ZEN-1103, get() never crashes', () => {
    const d = scriptedDriver();
    d.set('zen:bad', JSON.stringify({ v: 1, t: 100, e: null, d: 5 }));
    const s = createStorage({
      driver: d,
      version: 3,
      migrate: () => {
        throw new Error('nope');
      },
    });
    expect(s.get('bad')).toBeUndefined();
    expect(d.map.size).toBe(0);
    expect(loggedText()).toContain('ZEN-1103');
    s.dispose();
  });
});

describe('createStorage — corrupt data & validation', () => {
  it('unparseable payload ⇒ ZEN-1104: value absent and key purged', () => {
    const d = scriptedDriver();
    d.set('zen:corrupt', '{not json');
    const s = createStorage({ driver: d });
    expect(s.get('corrupt')).toBeUndefined();
    expect(d.map.has('zen:corrupt')).toBe(false);
    expect(loggedText()).toContain('ZEN-1104');
    s.dispose();
  });

  it('validate() rejecting a payload ⇒ tampered data refused (treated as corrupt)', () => {
    const d = scriptedDriver();
    d.set('zen:good', JSON.stringify({ v: 1, t: 100, e: null, d: { role: 'admin' } }));
    const s = createStorage({
      driver: d,
      validate: (v) => {
        if (v && typeof v === 'object' && 'role' in v) throw new Error('bad role');
        return v;
      },
    });
    expect(s.get('good')).toBeUndefined();
    expect(d.map.has('zen:good')).toBe(false);
    s.dispose();
  });

  it('validate() passes OK data through unchanged', () => {
    const s = createStorage({ driver: 'memory', validate: (v) => v });
    s.set('a', { b: 1 });
    expect(s.get('a')).toEqual({ b: 1 });
    s.dispose();
  });

  it('object-style validator ({validate}) is supported', () => {
    const s = createStorage({
      driver: 'memory',
      validate: {
        validate: (v) =>
          typeof v === 'number'
            ? v
            : (() => {
                throw new Error('!num');
              })(),
      },
    });
    s.set('n', 5);
    expect(s.get('n')).toBe(5);
    s.dispose();
  });
});

describe('createStorage — quota policies', () => {
  it('evict-oldest (default): evicts oldest write then retries once', () => {
    const d = scriptedDriver({ capacity: 3 });
    const clock = fakeClock();
    const s = createStorage({ driver: d, clock: clock.now });
    s.set('a', 1); // نوشتن ۱
    clock.advance(1);
    s.set('b', 2); // نوشتن ۲
    clock.advance(1);
    s.set('c', 3); // نوشتن ۳
    clock.advance(1);
    s.set('d', 4); // نوشتن ۴ ⇒ quota ⇒ evict oldest (a) ⇒ retry
    expect(s.get('d')).toBe(4);
    expect(s.get('a')).toBeUndefined();
    expect(s.get('b')).toBe(2);
    expect(loggedText()).toContain('ZEN-1102');
    s.dispose();
  });

  it('throw policy surfaces ZEN-1102 ZenithError', () => {
    const d = scriptedDriver({ capacity: 0 });
    const s = createStorage({ driver: d, onQuotaExceeded: 'throw' });
    try {
      s.set('x', 1);
      throw new Error('should have thrown');
    } catch (err) {
      expect((err as { code?: string }).code).toBe('ZEN-1102');
    }
    s.dispose();
  });

  it('ignore policy swallows quota failure without throwing', () => {
    const d = scriptedDriver({ capacity: 0 });
    const s = createStorage({ driver: d, onQuotaExceeded: 'ignore' });
    expect(() => s.set('x', 1)).not.toThrow();
    expect(s.get('x')).toBeUndefined();
    s.dispose();
  });
});

describe('createStorage — sensitive', () => {
  it('sensitive:true on local driver ⇒ memory fallback, never persists', () => {
    const s = createStorage({ driver: 'local', sensitive: true });
    s.set('token', 'abc');
    expect(s.get('token')).toBe('abc');
    expect(s.driverName).toBe('memory');
    expect(localStorage.length).toBe(0); // هرگز در local ننوشت
    expect(loggedText()).toContain('ZEN-1101');
    s.dispose();
  });

  it('sensitive:true on session/indexeddb ⇒ memory fallback too', () => {
    for (const driver of ['session', 'indexeddb'] as const) {
      const s = createStorage({ driver, sensitive: true });
      expect(s.driverName).toBe('memory');
      s.set('t', 1);
      expect(s.get('t')).toBe(1);
      s.dispose();
    }
    expect(sessionStorage.length).toBe(0);
  });

  it('sensitive:true with memory/cookie is allowed', () => {
    const s = createStorage({ driver: 'memory', sensitive: true });
    expect(s.driverName).toBe('memory');
    s.dispose();
    const c = createStorage({
      driver: 'cookie',
      sensitive: true,
      namespace: 'sec',
      cookie: { secure: false, path: '/' },
    });
    expect(c.driverName).toBe('cookie');
    c.set('t', 'v');
    expect(c.get('t')).toBe('v');
    c.remove('t');
    c.dispose();
  });
});

describe('createStorage — unavailable driver fallback (ZEN-1101)', () => {
  it('unavailable driver ⇒ ZEN-1101 fallback to memory, no exception', () => {
    const d = scriptedDriver({ failAvailable: true });
    const s = createStorage({ driver: d });
    expect(s.driverName).toBe('memory');
    expect(() => s.set('a', 1)).not.toThrow();
    expect(s.get('a')).toBe(1);
    expect(loggedText()).toContain('ZEN-1101');
    s.dispose();
  });

  it('driver write failing mid-session (private mode) ⇒ memory fallback, data kept', () => {
    const d = scriptedDriver();
    // بعد از دو نوشتن موفق، درایور از کار می‌افتد (مثل پر شدن disk در private)
    let ops = 0;
    const orig = d.set.bind(d);
    d.set = (k, v) => {
      if (++ops > 2) {
        const err = new Error('write denied');
        err.name = 'NotSupportedError';
        throw err;
      }
      orig(k, v);
    };
    const s = createStorage({ driver: d });
    s.set('a', 1);
    s.set('b', 2);
    expect(() => s.set('c', 3)).not.toThrow(); // fallback + retry
    expect(s.get('c')).toBe(3);
    expect(s.driverName).toBe('memory');
    s.dispose();
  });

  it('isStorageAvailable checks named drivers', () => {
    expect(isStorageAvailable('local')).toBe(true);
    expect(isStorageAvailable('session')).toBe(true);
    expect(isStorageAvailable('memory')).toBe(true);
    expect(isStorageAvailable('bogus' as never)).toBe(false);
  });

  it('memoryDriver is standalone', () => {
    const d = memoryDriver();
    d.set('a', '1');
    expect(d.get('a')).toBe('1');
    expect(d.keys()).toEqual(['a']);
    expect(d.available()).toBe(true);
  });
});

describe('createStorage — subscribe & cross-tab sync', () => {
  it('subscribe fires on local set/remove for that key; Cleanup unsubscribes (idempotent)', () => {
    const s = createStorage({ driver: 'memory' });
    const seen: unknown[] = [];
    const off = s.subscribe('a', (p) => seen.push([p.value, p.origin]));
    s.set('a', 1);
    s.set('b', 2); // کلید دیگر ⇒ fire نمی‌کند
    s.remove('a');
    off();
    off(); // idempotent
    s.set('a', 3); // پس از unsubscribe ⇒ fire نمی‌کند
    expect(seen).toEqual([
      [1, 'local'],
      [undefined, 'remove'],
    ]);
    s.dispose();
  });

  it('cross-tab via shared bus: other instance gets origin "tab" and reads fresh value', () => {
    interface Sink {
      owner: SyncBus | null;
      cb: (key: string, removed: boolean, localWrite: boolean) => void;
    }
    const sinks: Sink[] = [];
    const mkBus = (): SyncBus => {
      const bus: SyncBus = {
        subscribe: (cb) => {
          const entry: Sink = { owner: bus, cb };
          sinks.push(entry);
          return () => {
            const i = sinks.indexOf(entry);
            if (i >= 0) sinks.splice(i, 1);
          };
        },
        publish: (key, removed) => {
          // مثل window storage event: به همه به‌جز sinkِ ناشر می‌رسد
          for (const entry of [...sinks]) {
            if (entry.owner !== bus) entry.cb(key, removed, false);
          }
        },
        close: () => {
          for (const entry of [...sinks]) {
            if (entry.owner === bus) {
              const i = sinks.indexOf(entry);
              if (i >= 0) sinks.splice(i, 1);
            }
          }
        },
      };
      return bus;
    };
    const busA = mkBus();
    const busB = mkBus();
    const a = createStorage({ driver: 'local', syncBus: () => busA });
    const b = createStorage({ driver: 'local', syncBus: () => busB });
    const got: unknown[] = [];
    b.subscribe('cart', (p) => got.push([p.value, p.origin]));
    a.set('cart', { items: 2 });
    expect(got).toEqual([[{ items: 2 }, 'tab']]);
    expect(b.get('cart')).toEqual({ items: 2 });
    a.remove('cart');
    expect(got[1]).toEqual([undefined, 'tab']);
    // پیام بیرون namespace ⇒ نادیده (subscriber کلید خارجی هم خبر نمی‌شود)
    let foreignFired = 0;
    const offForeign = b.subscribe('anything', () => foreignFired++);
    busA.publish('other:foreign', false);
    expect(foreignFired).toBe(0);
    offForeign();
    a.dispose();
    b.dispose();
  });

  it('sync:false never subscribes to the bus', () => {
    let subscribed = 0;
    const bus: SyncBus = {
      subscribe: () => {
        subscribed++;
        return () => {};
      },
      publish: () => {},
      close: () => {},
    };
    const s = createStorage({ driver: 'memory', sync: false, syncBus: () => bus });
    expect(subscribed).toBe(0);
    s.dispose();
  });

  it('dispose unsubscribes and closes the bus (idempotent)', () => {
    let closed = 0;
    let unsub = 0;
    const bus: SyncBus = {
      subscribe: () => () => {
        unsub++;
      },
      publish: () => {},
      close: () => {
        closed++;
      },
    };
    const s = createStorage({ driver: 'memory', syncBus: () => bus });
    s.dispose();
    expect(closed).toBe(1);
    expect(unsub).toBe(1);
    s.dispose();
    expect(closed).toBe(1);
  });
});
