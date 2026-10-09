// #187: computed() در template واکنشی نیست — createContext آن را Signal نمی‌شمرد
// چون duck-typing مستلزم set بود (Computed فاقد set است).
import { describe, it, expect } from 'vitest';
import { signal, computed, effect } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import { createContext } from '../src/context';

describe('createContext + computed (#187)', () => {
  it('unwraps a writable signal reactively', () => {
    const count = signal(1);
    const ctx = createContext({ count });
    expect(ctx.$count).toBe(1);
    count.set(5);
    expect(ctx.$count).toBe(5);
  });

  it('unwraps a computed (get-only readable) — previously snapshotted/frozen', () => {
    const count = signal(1);
    const double = computed(() => count.get() * 2);
    const ctx = createContext({ double });
    expect(ctx.$double).toBe(2);
    count.set(3);
    // inner tracking effect of Computed runs via the scheduler microtask queue
    flushSync();
    // red قبل از fix: ctx.$double هنوز 2 بود (اسنپ‌شات ساده در context کپی شده بود)
    expect(ctx.$double).toBe(6);
  });

  it('tracks a computed dependency when read inside an effect', () => {
    const count = signal(1);
    const double = computed(() => count.get() * 2);
    const ctx = createContext({ double });
    const seen: number[] = [];
    const dispose = effect(() => seen.push(ctx.$double));
    expect(seen[0]).toBe(2);
    count.set(4);
    flushSync(); // computed inner effect
    flushSync(); // outer subscriber effect
    // effect باید حتماً با مقدار جدید اجرا شده باشد (دو‌نفره‌شدن موقتِ هم‌مقدار
    // به‌دلیل propagation دوباشی signal→computed مجاز است)
    expect(seen.at(-1)).toBe(8);
    expect(seen).toContain(8);
    dispose();
  });

  it('still treats plain objects with get+set as signals (unchanged)', () => {
    const fake = { get: () => 'x', set: () => {} };
    const ctx = createContext({ fake });
    expect(ctx.$fake).toBe('x');
  });

  it('leaves non-signal values (services, functions, literals) as-is', () => {
    const svc = { fetch: () => {} };
    const ctx = createContext({ n: 7, svc, fn: () => 1 });
    expect(ctx.$n).toBe(7);
    expect(ctx.$svc).toBe(svc);
    expect(typeof ctx.$fn).toBe('function');
  });

  it('readonly signals (no set) are unwrapped too', () => {
    const src = signal(2);
    const ro = computed(() => src.get() + 1);
    const ctx = createContext({ ro });
    expect(ctx.$ro).toBe(3);
    src.set(9);
    flushSync();
    expect(ctx.$ro).toBe(10);
  });
});
