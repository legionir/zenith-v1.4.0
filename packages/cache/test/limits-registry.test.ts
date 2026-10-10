// #144 — بودجه بایتی (maxBytes+sizeOf)، رجیستری devtools، آداپتر سیگنال
// (DEC-021: یال به state ممنوع — تزریق در زمان اجرا) و تست نشت حافظه.
import { describe, it, expect } from 'vitest';
import { createCache } from '../src/cache';
import { registerCache, listCaches, setSignalAdapter } from '../src/registry';

describe('maxBytes + sizeOf', () => {
  it('evicts by insertion order until within budget; reason is "size"', () => {
    const evicted: string[] = [];
    const c = createCache<string>({
      sizeOf: (v) => v.length,
      maxBytes: 10,
      onEvict: (k, _v, r) => r === 'size' && evicted.push(k),
    });
    c.set('a', 'xxxxx'); // 5
    c.set('b', 'yyyyy'); // 10 — دقیقاً بودجه؛ هنوز سالم
    expect(evicted).toEqual([]);
    c.set('c', 'zz'); // 12 ⇒ باید از انتها کم کند تا ≤10
    expect(evicted).toEqual(['a']);
    expect(c.has('a')).toBe(false);
    expect(c.stats().bytes).toBe(7);
    c.dispose();
  });

  it('a single oversized value evicts everything else and itself', () => {
    const evicted: string[] = [];
    const c = createCache<string>({
      sizeOf: (v) => v.length,
      maxBytes: 5,
      onEvict: (k) => evicted.push(k),
    });
    c.set('a', 'ab');
    c.set('big', '1234567');
    expect(c.size).toBe(0);
    expect(evicted).toEqual(['a', 'big']);
    c.dispose();
  });

  it('without sizeOf, maxBytes is ignored (no byte accounting)', () => {
    const c = createCache<string>({ maxBytes: 1 });
    c.set('a', 'xxxxxxxxxx');
    expect(c.has('a')).toBe(true);
    expect(c.stats().bytes).toBeUndefined();
    c.dispose();
  });

  it('replace of the same key reaccounts bytes (old size removed)', () => {
    const c = createCache<string>({ sizeOf: (v) => v.length, maxBytes: 100 });
    c.set('a', 'xxxx');
    c.set('a', 'y');
    expect(c.stats().bytes).toBe(1);
    c.dispose();
  });

  it('delete/invalidate/ttl-eviction decrease bytes', () => {
    const clock = (() => {
      let t = 0;
      return { now: () => t, adv: (n: number) => void (t += n) };
    })();
    const c = createCache<string>({
      clock: clock.now,
      sizeOf: (v) => v.length,
      maxBytes: 100,
      ttl: 10,
    });
    c.set('a', 'abc');
    expect(c.stats().bytes).toBe(3);
    c.delete('a');
    expect(c.stats().bytes).toBe(0);
    c.set('b', 'de');
    clock.adv(11);
    expect(c.get('b')).toBeUndefined();
    expect(c.stats().bytes).toBe(0);
    c.dispose();
  });
});

describe('registerCache / listCaches (devtools)', () => {
  it('opts.name auto-registers; listCaches reports name+stats; dispose unregisters', () => {
    const c = createCache<number>({ name: 'e2e-auto', maxSize: 7 });
    const entry = listCaches().find((x) => x.name === 'e2e-auto');
    expect(entry).toBeDefined();
    expect(entry!.stats.maxSize).toBe(7);
    c.set('k', 1);
    expect(listCaches().find((x) => x.name === 'e2e-auto')!.stats.size).toBe(1);
    c.dispose();
    expect(listCaches().find((x) => x.name === 'e2e-auto')).toBeUndefined();
  });

  it('registerCache returns a Cleanup; duplicate name ⇒ ZEN-1090', () => {
    const a = createCache<number>();
    const off = registerCache('e2e-manual', a);
    expect(listCaches().some((x) => x.name === 'e2e-manual')).toBe(true);
    // نام تکراری = خطای برنامه‌نویس ⇒ invariant (ZEN-1090)؛ ZEN-1201 مخصوص ttl است
    expect(() => registerCache('e2e-manual', createCache<number>())).toThrowError(
      expect.objectContaining({ code: 'ZEN-1090' }),
    );
    off();
    off(); // idempotent
    expect(listCaches().some((x) => x.name === 'e2e-manual')).toBe(false);
    a.dispose();
  });

  it('auto-register on a name already used by a manual cache ⇒ ZEN-1090', () => {
    const m = createCache<number>();
    const off = registerCache('e2e-clash', m);
    expect(() => createCache({ name: 'e2e-clash' })).toThrowError(
      expect.objectContaining({ code: 'ZEN-1090' }),
    );
    off();
    m.dispose();
  });
});

describe('setSignalAdapter (DEC-021 — cache به state یال ندارد)', () => {
  // نبود آداپتر = خطای برنامه‌نویس/محیط ⇒ invariant (ZEN-1090)؛ ZEN-1201 فقط
  // مخصوص ttl/stale/تکرار نام است (کاتالوگ errors #171).
  it('without adapter, signal(key) throws ZEN-1090 with a helpful message', () => {
    const c = createCache<number>();
    expect(() => c.signal('k')).toThrowError(
      expect.objectContaining({ code: 'ZEN-1090', message: expect.stringContaining('adapter') }),
    );
    c.dispose();
  });

  it('injected adapter receives (key, cache) and its return passes through', () => {
    const c = createCache<number>();
    const seen: unknown[] = [];
    const fake = { get: () => 9 };
    const off = setSignalAdapter((key, cache) => {
      seen.push(key, cache === c);
      return fake;
    });
    expect(c.signal('k')).toBe(fake);
    expect(seen).toEqual(['k', true]);
    off();
    expect(() => c.signal('k')).toThrowError(expect.objectContaining({ code: 'ZEN-1090' }));
    c.dispose();
  });
});

describe(' Leak prevention (معیار پذیرش #144: تست نشت حافظه)', () => {
  it('settled getOrLoad promises are released — pending map does not grow', async () => {
    const c = createCache<number>();
    for (let i = 0; i < 50; i++) {
      await c.getOrLoad(`k${i}`, () => Promise.resolve(i));
    }
    expect(c.stats().pending).toBe(0);
    // و در مسیر rejected هم:
    await c.getOrLoad('bad', () => Promise.reject(new Error('x'))).catch(() => undefined);
    expect(c.stats().pending).toBe(0);
    c.dispose();
  });

  it('invalidate/delete during an in-flight load drops the late commit', async () => {
    const c = createCache<number>();
    let release!: (v: number) => void;
    const p = c.getOrLoad('k', () => new Promise<number>((r) => void (release = r)));
    c.invalidate(() => true); // همه را پاک کن درحالی‌که load در جریانه
    release(1);
    expect(await p).toBe(1);
    expect(c.has('k')).toBe(false); // commit نباید برگردد
    c.dispose();
  });

  it('clear/dispose cancels pending bookkeeping; disposed cache rejects new loads', async () => {
    const c = createCache<number>();
    const p = c.getOrLoad('k', () => new Promise<number>(() => undefined)); // هرگز resolve نمی‌شود
    c.clear();
    void p.catch(() => undefined);
    expect(c.stats().pending).toBe(0);
    c.dispose();
    // getOrLoad روی کش disposed به‌صورت sync throw (ZEN-1090) خطا می‌دهد
    expect(() => c.getOrLoad('z', () => Promise.resolve(1))).toThrowError(
      expect.objectContaining({ code: 'ZEN-1090' }),
    );
  });

  it('tags index shrinks with entries — no dangling tag keys', () => {
    const c = createCache<number>();
    for (let i = 0; i < 20; i++) c.set(`k${i}`, i, { tags: [`t${i % 4}`] });
    c.invalidate(['t0']);
    c.delete('k1');
    for (let i = 2; i < 20; i++) {
      if (i % 4 !== 0 && i !== 1) c.delete(`k${i}`);
    }
    expect(c.size).toBe(0);
    expect(c.stats().tagKeys).toBe(0);
    c.dispose();
  });

  it('no timers anywhere: cache never schedules work (SSR/lazy expiry)', async () => {
    const realSetTimeout = globalThis.setTimeout;
    let used = 0;
    // @ts-expect-error — فقط برای شمارش؛ امضا لازم نیست
    globalThis.setTimeout = (...args: Parameters<typeof realSetTimeout>) => {
      used++;
      return realSetTimeout(...args);
    };
    try {
      const clock = (() => {
        let t = 0;
        return { now: () => t, adv: (n: number) => void (t += n) };
      })();
      const c = createCache<number>({ clock: clock.now, ttl: 5, staleWhileRevalidate: 5 });
      c.set('a', 1, { tags: ['x'] });
      clock.adv(10);
      c.get('a');
      c.invalidate(['x']);
      await c.getOrLoad('b', () => Promise.resolve(2));
      c.clear();
      c.dispose();
      expect(used).toBe(0);
    } finally {
      globalThis.setTimeout = realSetTimeout;
    }
  });
});
