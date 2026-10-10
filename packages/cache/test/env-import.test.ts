// #144 — import در Node خالص (SSR): هیچ دسترسی window/document در import-time.
import { describe, it, expect } from 'vitest';

describe('@zenith/cache imports cleanly in Node (no DOM)', () => {
  it('barrel exports the full SPEC §۲.۴ surface', async () => {
    const mod = await import('../src/index');
    for (const name of [
      'createCache',
      'registerCache',
      'listCaches',
      'parseCacheAttr',
      'setSignalAdapter',
    ]) {
      expect(typeof (mod as Record<string, unknown>)[name], name).toBe('function');
    }
  });

  it('usable without window/document at all', async () => {
    const { createCache } = await import('../src/index');
    const c = createCache<number>({ ttl: 10 });
    c.set('a', 1);
    expect(c.get('a')).toBe(1);
    c.dispose();
  });
});
