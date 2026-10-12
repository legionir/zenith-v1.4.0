// @vitest-environment jsdom
//
// #145 — parsePersistAttr (گرامر §۰.۳) + persistStore (hydrate/debounce/
// cleanup، الگوی directive zen-persist).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createStorage, parsePersistAttr, persistStore, resetDefaultStorage } from '../src/index';
import type { PersistTarget } from '../src/types';

describe('parsePersistAttr (SPEC §۲.۵ attribute grammar)', () => {
  it('parses a bare key with defaults', () => {
    expect(parsePersistAttr('cart')).toEqual({ key: 'cart' });
  });

  it('parses driver/ttl/version/debounce', () => {
    expect(
      parsePersistAttr('cart', {
        driver: 'session',
        ttl: '30s',
        version: '2',
        debounce: '500ms',
      }),
    ).toEqual({ key: 'cart', driver: 'session', ttl: 30_000, version: 2, debounce: 500 });
  });

  it('ttl never is allowed; driver is case-insensitive', () => {
    expect(parsePersistAttr('k', { driver: 'Local', ttl: 'never' })).toEqual({
      key: 'k',
      driver: 'local',
      ttl: 'never',
    });
  });

  it('empty attribute value / empty key ⇒ invalid', () => {
    expect(parsePersistAttr('')).toEqual({ key: '', invalid: true });
    expect(parsePersistAttr('   ')).toEqual({ key: '', invalid: true });
  });

  it('unknown driver ⇒ invalid (cookie/memory خراب‌شده در directive رایج نیست)', () => {
    expect(parsePersistAttr('k', { driver: 'cookie' }).invalid).toBe(true);
    expect(parsePersistAttr('k', { driver: 'wat' }).invalid).toBe(true);
  });

  it('bad ttl / bad version / bad debounce ⇒ invalid, keeping key', () => {
    expect(parsePersistAttr('k', { ttl: '-5' })).toEqual({ key: 'k', invalid: true });
    expect(parsePersistAttr('k', { ttl: 'abc' })).toEqual({ key: 'k', invalid: true });
    expect(parsePersistAttr('k', { version: '0' })).toEqual({ key: 'k', invalid: true });
    expect(parsePersistAttr('k', { version: '1.5' })).toEqual({ key: 'k', invalid: true });
    expect(parsePersistAttr('k', { debounce: 'never' })).toEqual({ key: 'k', invalid: true });
  });

  it('null/empty option values mean default (not invalid)', () => {
    expect(parsePersistAttr('k', { driver: '', ttl: null, version: undefined })).toEqual({
      key: 'k',
    });
  });
});

interface CounterState {
  count: number;
  label?: string;
}

function makeTarget(initial: CounterState): PersistTarget<CounterState> & {
  notify(): void;
  listeners: Set<(s: CounterState) => void>;
} {
  let state: CounterState = { ...initial };
  const listeners = new Set<(s: CounterState) => void>();
  return {
    listeners,
    get state() {
      return state;
    },
    $subscribe(cb) {
      listeners.add(cb);
      let done = false;
      return () => {
        if (done) return;
        done = true;
        listeners.delete(cb);
      };
    },
    $patch(partial) {
      state = { ...state, ...partial };
    },
    notify() {
      for (const cb of [...listeners]) cb(state);
    },
  };
}

describe('persistStore', () => {
  beforeEach(() => {
    localStorage.clear();
    resetDefaultStorage();
    vi.useRealTimers();
  });

  it('hydrates existing storage into the store on attach', () => {
    const s = createStorage({ namespace: 'zen' });
    s.set('cart', { count: 7 });
    s.dispose();
    const target = makeTarget({ count: 0 });
    const off = persistStore(target, { key: 'cart', debounce: 0 });
    expect(target.state.count).toBe(7);
    off();
  });

  it('writes state on change (debounce 0) and selector restricts keys', () => {
    const storage = createStorage({ driver: 'memory' });
    const target = makeTarget({ count: 1, label: 'x' });
    const off = persistStore(target, {
      storage,
      key: 'k',
      debounce: 0,
      selector: (st) => ({ count: st.count }),
    });
    target.notify();
    expect(storage.get('k')).toEqual({ count: 1 });
    target.$patch({ count: 2 });
    target.notify();
    expect(storage.get('k')).toEqual({ count: 2 });
    off();
    storage.dispose();
  });

  it('debounces writes (default 300ms)', async () => {
    vi.useFakeTimers();
    const storage = createStorage({ driver: 'memory' });
    const target = makeTarget({ count: 1 });
    const off = persistStore(target, { storage, key: 'k' });
    target.notify();
    target.notify();
    target.notify();
    expect(storage.get('k')).toBeUndefined();
    await vi.advanceTimersByTimeAsync(301);
    expect(storage.get('k')).toEqual({ count: 1 }); // یک نوشتن تجمیعی
    off();
    storage.dispose();
    vi.useRealTimers();
  });

  it('Cleanup stops writes and is idempotent (no listener leak)', async () => {
    vi.useFakeTimers();
    const storage = createStorage({ driver: 'memory' });
    const target = makeTarget({ count: 1 });
    const off = persistStore(target, { storage, key: 'k' });
    target.notify();
    off();
    off();
    expect(target.listeners.size).toBe(0);
    await vi.advanceTimersByTimeAsync(400);
    expect(storage.get('k')).toBeUndefined(); // نوشتن معلق لغو شد
    storage.dispose();
    vi.useRealTimers();
  });
});
