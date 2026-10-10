// #145 — import در Node خالص (SSR): هیچ دسترسی window/document در import-time
// و کارکردن createStorage با memory بدون DOM (معیار پذیرش #145).
import { describe, it, expect } from 'vitest';

describe('@zenith/storage imports cleanly in Node (no DOM)', () => {
  it('barrel exports the full SPEC §۲.۵ surface', async () => {
    const mod = await import('../src/index');
    for (const name of [
      'createStorage',
      'memoryDriver',
      'localDriver',
      'sessionDriver',
      'cookieDriver',
      'indexedDBDriver',
      'isStorageAvailable',
      'persistStore',
      'parsePersistAttr',
      'getDefaultStorage',
      'resetDefaultStorage',
      'DEFAULTS',
    ]) {
      expect(mod).toHaveProperty(name);
    }
  });

  it('signal subpath exports signal + createStorageSignal', async () => {
    const mod = await import('../src/signal');
    expect(typeof mod.signal).toBe('function');
    expect(typeof mod.createStorageSignal).toBe('function');
  });

  it('createStorage works without window/document at all (memory default)', async () => {
    expect(typeof globalThis.window).toBe('undefined');
    const { createStorage } = await import('../src/index');
    const s = createStorage(); // سرور ⇒ memory
    expect(s.driverName).toBe('memory');
    s.set('a', 1);
    expect(s.get('a')).toBe(1);
    s.dispose();
  });

  it('local driver reports unavailable on the server (no throw)', async () => {
    const { isStorageAvailable } = await import('../src/index');
    expect(isStorageAvailable('local')).toBe(false);
    expect(isStorageAvailable('session')).toBe(false);
    expect(isStorageAvailable('cookie')).toBe(false);
    expect(isStorageAvailable('indexeddb')).toBe(false);
    expect(isStorageAvailable('memory')).toBe(true);
  });

  it('explicit local driver on server falls back to memory without crashing', async () => {
    const { createStorage } = await import('../src/index');
    const s = createStorage({ driver: 'local' });
    expect(s.driverName).toBe('memory');
    expect(() => s.set('k', 'v')).not.toThrow();
    expect(s.get('k')).toBe('v');
    s.dispose();
  });
});
