// #144 — getOrLoad: dedupe هم‌زمانی (معیار پذیرش: ۱۰۰ فراخوانی = ۱ loader)،
// SWR پس‌زمینه، و خطای ZEN-1202 با cause.
import { describe, it, expect } from 'vitest';
import { createCache } from '../src/cache';
import { isZenithError } from '@zenith/errors';

describe('getOrLoad — dedupe (SPEC §۲.۴ تست: ۱۰۰ فراخوانی هم‌زمان = ۱ loader)', () => {
  it('100 concurrent getOrLoad on the same key call the loader exactly once', async () => {
    const c = createCache<number>();
    let calls = 0;
    const loader = () =>
      new Promise<number>((resolve) => {
        calls++;
        setTimeout(() => resolve(42), 5);
      });
    const results = await Promise.all(
      Array.from({ length: 100 }, () => c.getOrLoad('k', () => loader())),
    );
    expect(calls).toBe(1);
    expect(results).toEqual(Array.from({ length: 100 }, () => 42));
    expect(c.get('k')).toBe(42);
    c.dispose();
  });

  it('different keys load independently and concurrently', async () => {
    const c = createCache<string>();
    const loading: string[] = [];
    const mk = (k: string) => () =>
      new Promise<string>((resolve) => {
        loading.push(k);
        setTimeout(() => resolve(`v-${k}`), 5);
      });
    const [a, b] = await Promise.all([c.getOrLoad('a', mk('a')), c.getOrLoad('b', mk('b'))]);
    expect(a).toBe('v-a');
    expect(b).toBe('v-b');
    expect(loading.sort()).toEqual(['a', 'b']);
    c.dispose();
  });

  it('sync loader: value cached immediately, called once', async () => {
    const c = createCache<number>();
    let calls = 0;
    const first = await c.getOrLoad('k', () => ++calls);
    const second = await c.getOrLoad('k', () => ++calls);
    expect(calls).toBe(1);
    expect(first).toBe(1);
    expect(second).toBe(1);
    c.dispose();
  });

  it('fresh cached value short-circuits the loader', async () => {
    const c = createCache<number>({ ttl: 1000 });
    c.set('k', 7);
    let called = false;
    expect(
      await c.getOrLoad('k', () => {
        called = true;
        return 0;
      }),
    ).toBe(7);
    expect(called).toBe(false);
    c.dispose();
  });

  it('per-entry options on getOrLoad (ttl/tags) apply to the committed value', async () => {
    let now = 0;
    const clock = () => now;
    const c = createCache<number>({ clock });
    await c.getOrLoad('k', async () => 1, { ttl: 50, tags: ['t'] });
    now = 60;
    expect(c.get('k')).toBeUndefined();
    await c.getOrLoad('k2', async () => 1, { tags: ['t'] });
    expect(c.invalidate(['t'])).toEqual(['k2']);
    c.dispose();
  });
});

describe('getOrLoad — failures (ZEN-1202)', () => {
  it('rejected loader throws ZEN-1202 with cause and leaves no entry', async () => {
    const c = createCache<number>();
    const boom = new Error('boom');
    const p = c.getOrLoad('k', () => Promise.reject(boom));
    await expect(p).rejects.toSatisfy((e: unknown) => {
      expect(isZenithError(e)).toBe(true);
      const ze = e as { code: string; cause: unknown };
      expect(ze.code).toBe('ZEN-1202');
      expect(ze.cause).toBe(boom);
      return true;
    });
    expect(c.has('k')).toBe(false);
    // dedupe نباید بشکند: فراخوانی بعدی loader را دوباره اجرا می‌کند
    let calls = 0;
    await expect(
      c.getOrLoad('k', () => ++calls && Promise.reject(new Error('x'))),
    ).rejects.toBeTruthy();
    expect(calls).toBe(1);
    c.dispose();
  });

  it('synchronous throw in loader also wraps as ZEN-1202', async () => {
    const c = createCache<number>();
    await expect(
      c.getOrLoad('k', () => {
        throw new Error('sync boom');
      }),
    ).rejects.toSatisfy((e: unknown) => (e as { code?: string }).code === 'ZEN-1202');
    expect(c.size).toBe(0);
    c.dispose();
  });

  it('concurrent failures all see the same ZEN-1202 (one loader call)', async () => {
    const c = createCache<number>();
    let calls = 0;
    const loader = () => {
      calls++;
      return Promise.reject(new Error('down'));
    };
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => c.getOrLoad('k', loader)),
    );
    expect(calls).toBe(1);
    expect(results.every((r) => r.status === 'rejected')).toBe(true);
    c.dispose();
  });
});

describe('getOrLoad — stale-while-revalidate', () => {
  function deferred<T>() {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  it('stale entry: returns stale value now, revalidates in background, commits fresh', async () => {
    let now = 0;
    const c = createCache<number>({ clock: () => now, ttl: 100, staleWhileRevalidate: 200 });
    const d = deferred<number>();
    let calls = 0;
    const loader = () => {
      calls++;
      return d.promise;
    };
    // miss اول: loader صدا می‌شود ولی عمداً resolve نمی‌کنیم؛ به‌جایش مستقیم set می‌کنیم
    c.set('k', 2);
    now = 150; // stale window (100..300)
    const stale = c.getOrLoad('k', loader);
    expect(await stale).toBe(2); // فوراً stale برمی‌گردد
    expect(calls).toBe(1); // و پس‌زمینه شروع شده
    expect(c.peek('k')).toBe(2); // هنوز قدیمی
    d.resolve(3);
    await stale.then(() => undefined).then(() => undefined);
    // microtask دو مرحله: commit پس‌زمینه
    await Promise.resolve();
    expect(c.peek('k')).toBe(3); // commit شده
    now = 160; // storedAt=160 ⇒ ttl=100 ⇒ fresh
    expect(await c.getOrLoad('k', loader)).toBe(3); // hit؛ loader مجدد صدا نمی‌شود
    expect(calls).toBe(1);
    c.dispose();
  });

  it('background revalidation failure keeps serving stale (swallowed)', async () => {
    let now = 0;
    const c = createCache<number>({ clock: () => now, ttl: 10, staleWhileRevalidate: 100 });
    c.set('k', 1);
    now = 20;
    const d = deferred<number>();
    const v = await c.getOrLoad('k', () => d.promise);
    expect(v).toBe(1);
    d.reject(new Error('offline'));
    await Promise.resolve();
    await Promise.resolve();
    expect(c.peek('k')).toBe(1); // خطای پس‌زمینه بلعیده شد؛ داده باقی است
    expect(c.stats().staleHits).toBeGreaterThanOrEqual(1);
    c.dispose();
  });

  it('concurrent stale getOrLoad coalesces into ONE background load', async () => {
    let now = 0;
    const c = createCache<number>({ clock: () => now, ttl: 10, staleWhileRevalidate: 50 });
    c.set('k', 1);
    now = 20;
    const d = deferred<number>();
    let calls = 0;
    const loader = () => {
      calls++;
      return d.promise;
    };
    const vals = await Promise.all([c.getOrLoad('k', loader), c.getOrLoad('k', loader)]);
    expect(vals).toEqual([1, 1]);
    expect(calls).toBe(1);
    d.resolve(2);
    await Promise.resolve();
    await Promise.resolve();
    expect(c.peek('k')).toBe(2);
    c.dispose();
  });
});
