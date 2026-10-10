// #144 — تست‌های contract/cache (SPEC §۲.۴). red-before-fix: این فایل پیش از
// پیاده‌سازی نوشته شد و import از src می‌کند که هنوز وجود ندارد.
import { describe, it, expect } from 'vitest';
import { createCache } from '../src/cache';
import { parseCacheAttr } from '../src/attr';

function fakeClock() {
  let now = 0;
  return { now: () => now, advance: (ms: number) => void (now += ms) };
}

describe('createCache — get/set/has/peek/delete/clear/keys', () => {
  it('stores and reads values; peek does not touch recency', () => {
    const c = createCache<number>({ maxSize: 3 });
    c.set('a', 1);
    expect(c.get('a')).toBe(1);
    expect(c.peek('a')).toBe(1);
    expect(c.has('b')).toBe(false);
    expect(c.get('b')).toBeUndefined();
    expect(c.keys()).toEqual(['a']);
    c.delete('a');
    expect(c.has('a')).toBe(false);
    c.set('x', 1);
    c.set('y', 2);
    c.clear();
    expect(c.size).toBe(0);
    c.dispose();
  });

  it('size reflects entries and lazy-expired ones vanish on read', () => {
    const clock = fakeClock();
    const c = createCache<number>({ clock: clock.now, ttl: 100 });
    c.set('a', 1);
    expect(c.size).toBe(1);
    clock.advance(150);
    expect(c.get('a')).toBeUndefined();
    expect(c.size).toBe(0);
    c.dispose();
  });

  it('set returns the value for chaining-friendly call sites', () => {
    const c = createCache<string>();
    expect(c.set('k', 'v')).toBe('v');
    c.dispose();
  });
});

describe('createCache — options validation (ZEN-1201)', () => {
  it('throws ZEN-1201 for negative/non-finite ttl', () => {
    for (const bad of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => createCache({ ttl: bad }), String(bad)).toThrowError(
        expect.objectContaining({ code: 'ZEN-1201' }),
      );
    }
  });

  it('throws ZEN-1201 for non-finite/negative maxSize or staleWhileRevalidate', () => {
    expect(() => createCache({ maxSize: -5 })).toThrowError(
      expect.objectContaining({ code: 'ZEN-1201' }),
    );
    expect(() => createCache({ staleWhileRevalidate: Number.NaN })).toThrowError(
      expect.objectContaining({ code: 'ZEN-1201' }),
    );
  });

  it('ttl: 0 means «بدون انقضا» طبق کاتالوگ ZEN-1201', () => {
    const clock = fakeClock();
    const c = createCache<number>({ clock: clock.now, ttl: 0 });
    c.set('a', 1);
    clock.advance(10_000_000);
    expect(c.get('a')).toBe(1);
    c.dispose();
  });

  it("ttl: 'never' (پیش‌فرض) never expires", () => {
    const clock = fakeClock();
    const c = createCache<number>({ clock: clock.now });
    c.set('a', 1);
    clock.advance(Number.MAX_SAFE_INTEGER);
    expect(c.get('a')).toBe(1);
    c.dispose();
  });
});

describe('createCache — LRU / FIFO eviction', () => {
  it('LRU: get refreshes recency; eviction removes least-recently-used', () => {
    const evicted: Array<[string, number | undefined, string]> = [];
    const c = createCache<number>({
      maxSize: 2,
      policy: 'lru',
      onEvict: (k, v, r) => evicted.push([k, v, r]),
    });
    c.set('a', 1);
    c.set('b', 2);
    c.get('a'); // a حالا تازه‌ترین است
    c.set('c', 3); // باید b را بیرون کند
    expect(c.has('b')).toBe(false);
    expect(c.has('a')).toBe(true);
    expect(c.has('c')).toBe(true);
    expect(evicted).toEqual([['b', 2, 'size']]);
    c.dispose();
  });

  it('FIFO: eviction removes oldest inserted regardless of reads', () => {
    const c = createCache<number>({ maxSize: 2, policy: 'fifo' });
    c.set('a', 1);
    c.set('b', 2);
    c.get('a');
    c.set('c', 3);
    expect(c.has('a')).toBe(false);
    expect(c.has('b')).toBe(true);
    c.dispose();
  });

  it('maxSize: 1 works; evicted entry reports reason "size"', () => {
    const reasons: string[] = [];
    const c = createCache<number>({ maxSize: 1, onEvict: (_k, _v, r) => reasons.push(r) });
    c.set('a', 1);
    c.set('b', 2);
    expect(c.keys()).toEqual(['b']);
    expect(reasons).toEqual(['size']);
    c.dispose();
  });

  it('delete/clear report manual eviction with the live value', () => {
    const evicted: Array<[string, number, string]> = [];
    const c = createCache<number>({ onEvict: (k, v, r) => evicted.push([k, v, r]) });
    c.set('a', 1);
    c.delete('a');
    c.set('b', 2);
    c.clear();
    expect(evicted).toEqual([
      ['a', 1, 'manual'],
      ['b', 2, 'manual'],
    ]);
    // delete روی کلید ناموجود: بدون callback، بدون خطا
    expect(c.delete('zz')).toBe(false);
    c.dispose();
  });
});

describe('createCache — lazy TTL eviction', () => {
  it('expired entry: get evicts with reason ttl and misses; stats count it', () => {
    const clock = fakeClock();
    const evicted: string[] = [];
    const c = createCache<number>({
      clock: clock.now,
      ttl: 50,
      onEvict: (k, _v, r) => r === 'ttl' && evicted.push(k),
    });
    c.set('a', 1);
    clock.advance(51);
    expect(c.get('a')).toBeUndefined();
    expect(evicted).toEqual(['a']);
    const s = c.stats();
    expect(s.misses).toBe(1);
    expect(s.evictions).toBe(1);
    expect(s.size).toBe(0);
    c.dispose();
  });

  it('per-entry ttl overrides default; ttl:"never" pins an entry', () => {
    const clock = fakeClock();
    const c = createCache<number>({ clock: clock.now, ttl: 10 });
    c.set('short', 1);
    c.set('long', 2, { ttl: 1000 });
    c.set('forever', 3, { ttl: 'never' });
    clock.advance(20);
    expect(c.get('short')).toBeUndefined();
    expect(c.get('long')).toBe(2);
    expect(c.get('forever')).toBe(3);
    c.dispose();
  });

  it('no timers: expiring happens only on access (SSR-safe, lazy)', () => {
    // هیچ setTimeout در src وجود ندارد — گیت layering آن را lock می‌کند.
    const clock = fakeClock();
    const c = createCache<number>({ clock: clock.now, ttl: 5 });
    c.set('a', 1);
    clock.advance(6);
    expect(c.stats().size).toBe(0); // peek آمار هم lazy sweep می‌کند
    c.dispose();
  });
});

describe('createCache — stats (شکل سازگار با expressions.getCacheStats)', () => {
  it('hits/misses/hitRatio/staleHits/evictions evolve as specified', () => {
    const clock = fakeClock();
    const c = createCache<number>({ clock: clock.now, ttl: 100, staleWhileRevalidate: 200 });
    // toMatchObject: آمار پایه دقیقاً شکل expressions است؛ فیلدهای افزودهٔ
    // جدید (pending/tagKeys/bytes) در تست‌های نشت بررسی می‌شوند.
    expect(c.stats()).toMatchObject({
      size: 0,
      maxSize: 500,
      hits: 0,
      misses: 0,
      staleHits: 0,
      evictions: 0,
      hitRatio: 0,
    });
    c.set('a', 1);
    c.get('a'); // hit
    clock.advance(150); // stale window: 100..300
    expect(c.get('a')).toBe(1); // stale hit
    // get روی stale مقدار stale برمی‌گرداند؛ storedAt تکان نمی‌خورد پس
    // هنوز تا ۳۰۰ stale است (recency برای LRU تازه می‌شود، freshness نه).
    expect(c.isStale('a')).toBe(true);
    clock.advance(200); // حالا ۳۵۰ ⇒ beyond SWR
    expect(c.get('a')).toBeUndefined(); // expired ⇒ miss + eviction(ttl)
    const s = c.stats();
    expect(s.hits).toBe(1);
    expect(s.staleHits).toBe(1);
    expect(s.misses).toBe(1);
    expect(s.evictions).toBe(1);
    expect(s.hitRatio).toBeCloseTo(2 / 3); // (hits+staleHits)/total
    expect(s.size).toBe(0);
    c.dispose();
  });

  it('isStale answers without mutating stats', () => {
    const clock = fakeClock();
    const c = createCache<number>({ clock: clock.now, ttl: 10, staleWhileRevalidate: 20 });
    c.set('a', 1);
    clock.advance(15);
    const before = c.stats();
    expect(c.isStale('a')).toBe(true);
    expect(c.stats()).toEqual(before);
    c.dispose();
  });

  it('revalidate commits fresh data and counts the hit', () => {
    const clock = fakeClock();
    const c = createCache<number>({ clock: clock.now, ttl: 10, staleWhileRevalidate: 20 });
    c.set('a', 1);
    clock.advance(15);
    expect(c.get('a')).toBe(1);
    c.revalidate('a', 2);
    clock.advance(15); // 30؛ ttl=10 از commit جدید ⇒ 20 تازه ⇒ stale
    expect(c.get('a')).toBe(2);
    expect(c.stats().staleHits).toBe(2);
    c.dispose();
  });

  it('revalidate on unknown/expired key is a no-op false', () => {
    const c = createCache<number>();
    expect(c.revalidate('ghost', 1)).toBe(false);
    c.dispose();
  });
});

describe('createCache — tags / invalidate', () => {
  it('set tags per-entry; invalidate(tags[]) removes all tagged', () => {
    const c = createCache<number>();
    c.set('a', 1, { tags: ['users'] });
    c.set('b', 2, { tags: ['users', 'v2'] });
    c.set('c', 3);
    const removed = c.invalidate(['users']);
    expect(removed).toEqual(['a', 'b']);
    expect(c.has('a')).toBe(false);
    expect(c.has('b')).toBe(false);
    expect(c.has('c')).toBe(true);
    c.dispose();
  });

  it('invalidate(predicate) and invalidate(tag string)', () => {
    const c = createCache<number>();
    c.set('x', 10);
    c.set('y', 20, { tags: ['t'] });
    expect(c.invalidate((k, v) => (v ?? 0) >= 20)).toEqual(['y']);
    c.set('z', 1, { tags: ['t'] });
    expect(c.invalidate('t')).toEqual(['z']);
    c.dispose();
  });

  it('invalidate([]) removes nothing', () => {
    const c = createCache<number>();
    c.set('a', 1, { tags: ['x'] });
    expect(c.invalidate([])).toEqual([]);
    c.dispose();
  });

  it('re-set of same key replaces tags (new tags only survive)', () => {
    const c = createCache<number>();
    c.set('a', 1, { tags: ['x'] });
    c.set('a', 2, { tags: ['y'] });
    expect(c.invalidate(['x'])).toEqual([]);
    expect(c.invalidate(['y'])).toEqual(['a']);
    c.dispose();
  });

  it('tags survive ttl/stale reads and are removed with the entry', () => {
    const clock = fakeClock();
    const c = createCache<number>({ clock: clock.now, ttl: 10 });
    c.set('a', 1, { tags: ['t'] });
    clock.advance(11);
    expect(c.get('a')).toBeUndefined();
    expect(c.invalidate(['t'])).toEqual([]);
    c.dispose();
  });
});

describe('createCache — dispose', () => {
  it('dispose clears everything, is idempotent, and kills the cache', () => {
    const c = createCache<number>({ onEvict: () => undefined });
    c.set('a', 1, { tags: ['t'] });
    c.dispose();
    c.dispose();
    expect(c.size).toBe(0);
    expect(c.stats().size).toBe(0);
    expect(() => c.set('b', 2)).toThrowError(
      // استفاده-after-dispose خطای برنامه‌نویس است ⇒ invariant (ZEN-1090)،
      // نه ZEN-1201 (که مخصوص ttl نامعتبر است).
      expect.objectContaining({ code: 'ZEN-1090' }),
    );
  });
});

describe('parseCacheAttr (گرامر §۰.۳ + بندهای ۲.۴)', () => {
  it('"30s" ⇒ ttl 30000', () => {
    expect(parseCacheAttr('30s')).toEqual({ ttl: 30000 });
  });

  it('"30s,swr=2m" ⇒ ttl + staleWhileRevalidate', () => {
    expect(parseCacheAttr('30s,swr=2m')).toEqual({ ttl: 30000, staleWhileRevalidate: 120000 });
  });

  it('"never" ⇒ ttl never', () => {
    expect(parseCacheAttr('never')).toEqual({ ttl: 'never' });
  });

  it('"false" ⇒ disabled', () => {
    expect(parseCacheAttr('false')).toEqual({ disabled: true });
  });

  it('bare number = ms; ms/h units; extra spaces; tag= list', () => {
    expect(parseCacheAttr('1500')).toEqual({ ttl: 1500 });
    expect(parseCacheAttr(' 500ms , swr = 1h ').ttl).toBe(500);
    expect(parseCacheAttr('1h,swr=30m')).toEqual({ ttl: 3600000, staleWhileRevalidate: 1800000 });
    expect(parseCacheAttr('30s,tag=users,v2')).toEqual({ ttl: 30000, tags: ['users', 'v2'] });
  });

  it('garbage ⇒ NaN ttl (directive مسئول خطای UI است)', () => {
    expect(parseCacheAttr('abc')).toEqual({ ttl: Number.NaN });
    expect(parseCacheAttr('-1')).toEqual({ ttl: Number.NaN });
    expect(parseCacheAttr('')).toEqual({ ttl: Number.NaN });
  });

  it('swr alone is allowed', () => {
    expect(parseCacheAttr('swr=1m')).toEqual({ ttl: 'never', staleWhileRevalidate: 60000 });
  });
});
