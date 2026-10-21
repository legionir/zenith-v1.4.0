// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '@zenith/runtime-core';
import { createAuth, createAuthRegistry, authPlugin, getAppAuth, type AuthRegistryStore } from '../src/index';
import { clearAuthInternal, registerAuth, getAuth, unregisterAuth } from '../src/auth';

afterEach(() => { clearAuthInternal(); vi.unstubAllGlobals(); });
const config = { loginUrl: '/login', autoRefresh: false };

describe('Auth references and explicit App ownership (#118/#139, unrun)', () => {
  it('protects replacement registrations even when the exact same value is reused', () => {
    const instance = createAuth(config); const registry = createAuthRegistry();
    const old = registry.register('same', instance); const current = registry.register('same', instance);
    old(); old(); expect(registry.get('same')).toBe(instance);
    const names = registry.list(); names.length = 0; expect(registry.has('same')).toBe(true);
    current(); current(); expect(registry.list()).toEqual([]);
    registry.dispose(); instance.dispose();
  });

  it('gives the legacy adapter registration-token cleanup and borrowed-reference semantics', async () => {
    const instance = createAuth(config); const old = registerAuth('same', instance);
    registerAuth('same', instance); old(); expect(getAuth('same')).toBe(instance);
    expect(unregisterAuth('same')).toBe(true);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ token: 'still-live' }) })));
    expect(await instance.login({})).toBe(true); instance.dispose();
  });

  it('does not dispose borrowed engines on reference cleanup, unregister or registry disposal', async () => {
    const registry = createAuthRegistry(); const instance = createAuth(config);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ token: 'live' }) })));
    registry.register('one', instance); registry.unregister('one'); registry.register('two', instance);
    registry.dispose(); registry.dispose(); expect(await instance.login({})).toBe(true);
    expect(() => registry.register('late', instance)).toThrow(/ZEN-1090/); instance.dispose();
  });

  it('finishes every owned cleanup if a structural host release throws', () => {
    const releases: string[] = [];
    const store: AuthRegistryStore = {
      register: name => () => { releases.push(name); if (name === 'one') throw new Error('fixture-cleanup'); },
      get: () => undefined, has: () => false, list: () => [], unregister: () => false,
    };
    const registry = createAuthRegistry(store); const instance = createAuth(config);
    registry.register('one', instance); registry.register('two', instance);
    expect(() => registry.dispose()).toThrow(AggregateError);
    expect(releases).toEqual(['one', 'two']); expect(() => registry.dispose()).not.toThrow();
    expect(registry.unregister('two')).toBe(false); instance.dispose();
  });

  it('creates a separate engine for each App and disposes only the creating App engine', async () => {
    const a = createApp(); const b = createApp();
    const plugin = authPlugin(config); a.use(plugin); b.use(plugin);
    const first = getAppAuth(a)!; const second = getAppAuth(b)!;
    expect(first).not.toBe(second); expect(getAuth()).toBeUndefined();
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ token: 'T' }) })));
    try {
      await first.login({}); expect(second.token).toBeNull();
      a.dispose(); a.dispose(); expect(getAppAuth(a)).toBeUndefined();
      expect(await first.login({})).toBe(false); expect(await second.login({})).toBe(true);
    } finally { a.dispose(); b.dispose(); }
  });

  it('refuses to overwrite another owner reference during install', () => {
    const app = createApp(); const borrowed = createAuth(config);
    app.registries.auth.register('default', borrowed);
    expect(() => app.use(authPlugin(config))).toThrow(/ZEN-1090/);
    expect(getAppAuth(app)).toBe(borrowed); app.dispose(); borrowed.dispose();
  });

  it('keeps 100 asynchronous App owners isolated without changing an ambient current App', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => ({ ok: true,
      json: async () => ({ token: `owner-${JSON.parse(String(init.body)).id}` }) }));
    vi.stubGlobal('fetch', fetchMock);
    await Promise.all(Array.from({ length: 100 }, async (_, id) => {
      const app = createApp(); app.use(authPlugin(config));
      try {
        const instance = getAppAuth(app)!; await instance.login({ id }); await Promise.resolve();
        expect(instance.token).toBe(`owner-${id}`); expect(getAppAuth(app)).toBe(instance);
      } finally { app.dispose(); }
    }));
    expect(getAuth()).toBeUndefined();
  });

  it('validates plugin/config options before client creation and detaches the caller headers', () => {
    expect(() => authPlugin(config, { crossTab: 'yes' } as never)).toThrow(/ZEN-1001/);
    expect(() => authPlugin({ loginUrl: '' })).toThrow(/ZEN-1004/);
    const headers = { 'X-App': 'original' }; const plugin = authPlugin({ ...config, headers }); headers['X-App'] = 'mutated';
    const app = createApp(); app.use(plugin);
    expect(getAppAuth(app)?.getConfig().headers['X-App']).toBe('original'); app.dispose();
  });
});
