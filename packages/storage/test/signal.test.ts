// @vitest-environment jsdom
//
// #145 — storage.signal / زیرمسیر @zenith/storage/signal (SPEC §۲.۵):
// همگام با ذخیره و تب‌های دیگر، Readable ساختاری (DEC-021)، dispose پاک.
import { describe, it, expect, beforeEach } from 'vitest';
import { createStorage, resetDefaultStorage, getDefaultStorage } from '../src/index';
import { signal } from '../src/signal';
import type { Readable } from '@zenith/shared';

beforeEach(() => {
  localStorage.clear();
  resetDefaultStorage();
});

describe('storage.signal', () => {
  it('hydrates from stored value and falls back to initial', () => {
    const s = createStorage({ driver: 'memory' });
    s.set('theme', 'dark');
    const sig = s.signal('theme', 'light');
    expect(sig.get()).toBe('dark');
    const fresh = s.signal('lang', 'fa');
    expect(fresh.get()).toBe('fa');
    s.dispose();
  });

  it('set() writes through to storage (visible from another instance of same driver)', () => {
    const s = createStorage({ driver: 'memory' });
    const sig = s.signal('count', 0);
    sig.set(5);
    expect(s.get('count')).toBe(5);
    s.dispose();
  });

  it('subscriber fires on signal.set and on external storage changes', () => {
    const s = createStorage({ driver: 'memory' });
    const sig = s.signal('k', 'a');
    const seen: string[] = [];
    const off = sig.subscribe((v) => seen.push(v));
    sig.set('b');
    // تغییر بیرونی روی همان کلید (مثل set معمولی) ⇒ سیگنال همگام می‌شود
    s.set('k', 'c');
    expect(seen).toEqual(['b', 'c']);
    expect(sig.get()).toBe('c');
    off();
    sig.set('d');
    expect(seen).toEqual(['b', 'c']); // دیگر fire نمی‌کند
    s.dispose();
  });

  it('remove() resets to initial value', () => {
    const s = createStorage({ driver: 'memory' });
    const sig = s.signal('k', 'init');
    sig.set('x');
    s.remove('k');
    expect(sig.get()).toBe('init');
    s.dispose();
  });

  it('ttl options pass through to storage.set', () => {
    const s = createStorage({ driver: 'memory' });
    const sig = s.signal('t', 1);
    sig.set(2);
    expect(s.get('t')).toBe(2);
    s.dispose();
  });

  it('dispose stops sync and is idempotent', () => {
    const s = createStorage({ driver: 'memory' });
    const sig = s.signal('k', 0);
    sig.dispose();
    sig.dispose();
    sig.set(9); // پس از dispose بی‌اثر
    expect(s.get('k')).toBeUndefined();
    s.set('k', 1); // سیگنال disposed fire نمی‌کند (بدون throw)
    s.dispose();
  });

  it('satisfies structural Readable<T> (DEC-021)', () => {
    const s = createStorage({ driver: 'memory' });
    const sig = s.signal('k', 1);
    const readable: Readable<number> = sig; // سازگاری نوعی
    expect(readable.get()).toBe(1);
    s.dispose();
  });
});

describe('@zenith/storage/signal subpath', () => {
  it('signal() binds to the default storage singleton', () => {
    const sig = signal('demo.key', 'x');
    expect(sig.get()).toBe('x');
    sig.set('y');
    expect(getDefaultStorage().get('demo.key')).toBe('y');
    sig.dispose();
  });
});
