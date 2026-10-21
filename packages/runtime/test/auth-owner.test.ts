// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { runGlobalResets } from '@zenith/errors';
import { effect } from '@zenith/state';
import { flushSync } from '@zenith/scheduler';
import * as core from '@zenith/runtime-core';
import {
  createAuth, registerAuth, getAuth, hasAuth, listAuths, unregisterAuth,
  getDefaultAuth, auth, configureAuth, setAuthRegistryOwner, type Auth,
} from '@zenith/auth';
import { clearAuthInternal } from '../../auth/src/auth';
import { installLegacyAuthOwnerBridge } from '../src/auth-owner';

const clients: Auth[] = [];
const uninstalls: Array<() => void> = [];
const config = { loginUrl: '/login', autoRefresh: false };
function client() { const instance = createAuth(config); clients.push(instance); return instance; }
function install() { const stop = installLegacyAuthOwnerBridge(); uninstalls.push(stop); return stop; }
const success = () => ({ ok: true, status: 200, json: async () => ({ token: 'T', user: { id: 1, name: 'One', email: 'one@example.test' } }) });

beforeEach(() => {
  clearAuthInternal(); core.resetDefaultAppForTesting();
  vi.stubGlobal('fetch', vi.fn(async () => success()));
});
afterEach(() => {
  for (const stop of uninstalls.splice(0)) stop();
  clearAuthInternal(); core.resetDefaultAppForTesting();
  for (const instance of clients.splice(0)) instance.dispose();
  vi.restoreAllMocks(); vi.unstubAllGlobals();
});

describe('legacy Auth -> default App bridge (#118, code-first/unrun)', () => {
  it('installs lazily without creating a default App or starting auth', () => {
    const resolve = vi.spyOn(core, 'defaultApp');
    install(); expect(resolve).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    expect(getAuth()).toBeUndefined(); expect(resolve).toHaveBeenCalledTimes(1);
    expect(core.defaultApp().registries.auth.list()).toEqual([]);
  });

  it('uses the actual default App inventory in both directions', () => {
    install(); const app = core.defaultApp(); const instance = client();
    const cleanup = registerAuth('session', instance);
    expect(app.registries.auth.get('session')).toBe(instance);
    expect(getAuth('session')).toBe(instance); expect(hasAuth('session')).toBe(true);
    expect(listAuths()).toEqual(['session']);
    const other = client(); app.registries.auth.register('from-app', other);
    expect(getAuth('from-app')).toBe(other); expect(listAuths()).toEqual(['session', 'from-app']);
    expect(unregisterAuth('from-app')).toBe(true); expect(app.registries.auth.has('from-app')).toBe(false);
    cleanup(); cleanup(); expect(getAuth('session')).toBeUndefined();
  });

  it('uses an App-supplied default engine for the functional facade', async () => {
    install(); const app = core.defaultApp(); const instance = client();
    app.registries.auth.register('default', instance);
    expect(getDefaultAuth()).toBe(instance);
    configureAuth({ autoRefresh: false, endpoints: { login: '/configured' } });
    expect(instance.getConfig().loginUrl).toBe('/configured');
    await auth.login({ email: 'one@example.test', password: 'test-only' });
    expect(instance.token).toBe('T'); expect(auth.tokens.get()?.accessToken).toBe('T');
  });

  it('reacts to direct App reference replacement without retaining the former default engine', () => {
    install(); const app = core.defaultApp(); const first = client(); const next = client();
    registerAuth('default', first); auth.tokens.set({ accessToken: 'first' });
    const values: Array<string | null> = [];
    const stop = effect(() => { values.push(auth.tokens.get()?.accessToken ?? null); });
    next.signal.update(state => ({ ...state, token: 'second', isAuthenticated: true }));
    try {
      app.registries.auth.register('default', next); flushSync();
      expect(values).toEqual(['first', 'second']);
      first.signal.update(state => ({ ...state, token: 'stale' })); flushSync();
      expect(values).toEqual(['first', 'second']);
      app.registries.auth.unregister('default'); flushSync();
      expect(values.at(-1)).toBeNull();
    } finally { stop(); }
  });

  it('disposes an auto-created default engine with its App, including in-flight requests', async () => {
    install(); const instance = getDefaultAuth(); const app = core.defaultApp();
    expect(app.registries.auth.get('default')).toBe(instance);
    let complete!: (response: unknown) => void;
    const request = vi.fn((_url: string, _options: RequestInit) => new Promise(resolve => { complete = resolve; }));
    vi.stubGlobal('fetch', request);
    const login = instance.login({}); app.dispose();
    expect(request.mock.calls[0][1].signal?.aborted).toBe(true);
    complete(success()); expect(await login).toBe(false); expect(instance.token).toBeNull();
    expect(app.registries.auth.list()).toEqual([]);
    expect(getDefaultAuth()).not.toBe(instance); expect(core.defaultApp()).not.toBe(app);
  });

  it('does not destroy borrowed instances when their default App is disposed', async () => {
    install(); const instance = client(); const app = core.defaultApp();
    registerAuth('borrowed', instance); app.dispose();
    expect(await instance.login({})).toBe(true); expect(getAuth('borrowed')).toBeUndefined();
  });

  it('moves pre-bootstrap registrations and preserves the originally returned cleanup', () => {
    const instance = client(); const cleanup = registerAuth('early', instance);
    install(); const app = core.defaultApp();
    expect(getAuth('early')).toBe(instance); expect(app.registries.auth.get('early')).toBe(instance);
    cleanup(); cleanup(); expect(app.registries.auth.get('early')).toBeUndefined();
  });

  it('does not delete a replacement registered reentrantly during unregister notification', () => {
    install(); const app = core.defaultApp(); const previous = client(); const next = client();
    registerAuth('named', previous); let replaced = false;
    const stop = app.registries.auth.subscribe(name => {
      if (name === 'named' && !app.registries.auth.has(name) && !replaced) {
        replaced = true; app.registries.auth.register(name, next);
      }
    });
    try { expect(unregisterAuth('named')).toBe(true); expect(getAuth('named')).toBe(next); }
    finally { stop(); }
  });

  it('a pre-bootstrap stale cleanup cannot delete a replacement of the same value after adoption', () => {
    const instance = client(); const stale = registerAuth('early', instance);
    install(); expect(getAuth('early')).toBe(instance);
    const current = registerAuth('early', instance); stale(); stale();
    expect(getAuth('early')).toBe(instance); current(); expect(getAuth('early')).toBeUndefined();
  });

  it('adopts an early auto-created default and transfers its lifecycle to the App', async () => {
    const early = getDefaultAuth(); install(); const app = core.defaultApp();
    expect(getDefaultAuth()).toBe(early); expect(app.registries.auth.get('default')).toBe(early);
    app.dispose(); expect(await early.login({})).toBe(false);
  });

  it('keeps explicit App registrations on bootstrap collisions and disposes superseded auto defaults', async () => {
    const early = getDefaultAuth(); const preferred = client();
    const app = core.defaultApp(); app.registries.auth.register('default', preferred);
    install(); expect(getDefaultAuth()).toBe(preferred); expect(await early.login({})).toBe(false);
    expect(await preferred.login({})).toBe(true);
  });

  it('preserves an early auto default already registered as the same App value', async () => {
    const early = getDefaultAuth(); const app = core.defaultApp(); app.registries.auth.register('default', early);
    install(); expect(getDefaultAuth()).toBe(early); expect(await early.login({})).toBe(true);
    app.dispose(); expect(await early.login({})).toBe(false);
  });

  it('re-registering the owned default itself does not dispose it or lose ownership', async () => {
    install(); const instance = getDefaultAuth(); registerAuth('default', instance);
    expect(await instance.login({})).toBe(true);
    core.defaultApp().dispose(); expect(await instance.login({})).toBe(false);
  });

  it('replacing an auto-created default disposes the former engine, not the borrowed replacement', async () => {
    install(); const previous = getDefaultAuth(); const next = client(); registerAuth('default', next);
    expect(await previous.login({})).toBe(false); expect(getDefaultAuth()).toBe(next);
    core.defaultApp().dispose(); expect(await next.login({})).toBe(true);
  });

  it('reset releases existing leases without resolving a provider or creating another App', () => {
    const app = core.createApp(); const callbacks = new Set<() => void>();
    const resolve = vi.fn(() => ({ registry: app.registries.auth, onDispose(cleanup: () => void) {
      callbacks.add(cleanup); return () => { callbacks.delete(cleanup); };
    } }));
    const stop = setAuthRegistryOwner(resolve); uninstalls.push(stop);
    getDefaultAuth(); resolve.mockClear(); clearAuthInternal(); clearAuthInternal();
    expect(resolve).not.toHaveBeenCalled(); expect(callbacks.size).toBe(0); expect(app.registries.auth.list()).toEqual([]);
    app.dispose();
  });

  it('aborts an owned default superseded by a direct App reference write', async () => {
    install(); const previous = getDefaultAuth(); const next = client();
    core.defaultApp().registries.auth.register('default', next);
    expect(await previous.login({})).toBe(false); expect(getDefaultAuth()).toBe(next);
    expect(await next.login({})).toBe(true);
  });

  it('fails closed on a conflicting lifecycle plugin rather than falling back to global state', () => {
    const app = core.defaultApp();
    app.use({ name: 'zenith:legacy-auth-owner', install() {} });
    install(); expect(() => getAuth()).toThrow(/ZEN-1090/);
    expect(app.registries.auth.list()).toEqual([]); expect(fetch).not.toHaveBeenCalled();
  });

  it('a stale bridge uninstall does not detach a later installation', () => {
    const first = install(); install(); first(); const instance = client(); registerAuth('current', instance);
    expect(core.defaultApp().registries.auth.get('current')).toBe(instance);
  });

  it('global reset replaces only the default owner, preserving independent Apps', async () => {
    const independent = core.createApp(); const separate = client();
    independent.registries.auth.register('separate', separate);
    install(); const initialApp = core.defaultApp(); const initial = getDefaultAuth();
    runGlobalResets(); runGlobalResets();
    expect(initialApp.registries.auth.list()).toEqual([]); expect(await initial.login({})).toBe(false);
    expect(independent.registries.auth.get('separate')).toBe(separate); expect(await separate.login({})).toBe(true);
    const next = getDefaultAuth(); expect(next).not.toBe(initial); expect(core.defaultApp()).not.toBe(initialApp);
    independent.dispose();
  });

  it('reentrant teardown resolves a fresh default App rather than the disposed owner', () => {
    install(); const previous = core.defaultApp(); getDefaultAuth(); let next: Auth | undefined;
    previous.use({ name: 'reenter-auth', install: () => () => { next = getDefaultAuth(); } });
    previous.dispose(); expect(next).toBeDefined(); expect(core.defaultApp()).not.toBe(previous);
    expect(getDefaultAuth()).toBe(next); expect(previous.registries.auth.list()).toEqual([]);
  });
});
