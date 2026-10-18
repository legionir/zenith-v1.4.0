// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effect } from '@zenith/state';
import { logger, bufferSink } from '@zenith/logger';
import {
  createAuth, getDefaultAuth, registerAuth, clearAuthInternal, configureAuth,
  login, logout, refreshToken, fetchCurrentUser, auth, getAuthConfig, type Auth,
} from '../src/auth';

const USER = { id: 1, name: 'One', email: 'one@example.test', roles: ['user'], permissions: ['read'] };
const config = { loginUrl: '/login', refreshUrl: '/refresh', meUrl: '/me', autoRefresh: false };
const tokens = { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3_600_000 };
const response = (data: unknown, status = 200): Response => ({ ok: status < 400, status, json: async () => data } as Response);
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(accept => { resolve = accept; });
  return { promise, resolve };
}
const owned: Auth[] = [];
function client(extra: Parameters<typeof createAuth>[0] = config): Auth {
  const instance = createAuth(extra); owned.push(instance); return instance;
}

beforeEach(() => { localStorage.clear(); clearAuthInternal(); });
afterEach(() => {
  for (const instance of owned.splice(0)) instance.dispose();
  clearAuthInternal(); vi.unstubAllGlobals(); vi.useRealTimers(); localStorage.clear();
});

describe('one canonical engine behind both public styles (#139, unrun code-first)', () => {
  it('uses the registered class instance for functional login, refresh, user and logout', async () => {
    const fetchMock = vi.fn(async (url: string) => url === '/refresh'
      ? response({ accessToken: 'B', refreshToken: 'R2' })
      : url === '/me' ? response({ ...USER, name: 'Updated' }) : response({ user: USER, tokens }));
    vi.stubGlobal('fetch', fetchMock);
    const instance = client(); registerAuth('default', instance);
    expect(getDefaultAuth()).toBe(instance);
    expect(await login({ email: USER.email, password: 'not-logged' })).toMatchObject(USER);
    expect(instance.token).toBe('A'); expect(auth.tokens.get()?.accessToken).toBe('A');
    expect(await refreshToken()).toMatchObject({ accessToken: 'B', refreshToken: 'R2' });
    expect(instance.token).toBe('B');
    expect(await fetchCurrentUser()).toMatchObject({ name: 'Updated' });
    expect(instance.user?.name).toBe('Updated');
    await logout(false);
    expect(instance.token).toBeNull(); expect(auth.tokens.get()).toBeNull();
    expect(fetchMock.mock.calls.filter(([url]) => url === '/refresh')).toHaveLength(1);
  });

  it('accepts the flat class response as well as the nested functional response', async () => {
    const instance = client(); registerAuth('default', instance);
    vi.stubGlobal('fetch', vi.fn(async () => response({ token: 'flat', user: USER, expiresIn: 3600 })));
    expect(await login({ email: USER.email, password: 'x' })).toMatchObject(USER);
    expect(instance.token).toBe('flat'); expect(auth.isAuthenticated.get()).toBe(true);
  });

  it('writes compatibility views through to canonical state with reactive reads and peek/update', async () => {
    const instance = client(); registerAuth('default', instance);
    const observations: Array<string | null> = [];
    const stop = effect(() => { observations.push(auth.user.get()?.name ?? null); });
    auth.tokens.set(tokens); auth.user.set(USER);
    await Promise.resolve(); await Promise.resolve();
    expect(instance.user?.name).toBe('One'); expect(instance.isAuthenticated).toBe(true);
    expect(observations).toContain('One');
    auth.user.update(user => user ? { ...user, name: 'Changed' } : null);
    expect(instance.user?.name).toBe('Changed'); expect(auth.user.peek()?.name).toBe('Changed');
    stop();
  });

  it('keeps read-only views live across reset/replacement without cached global effects', async () => {
    const first = client(); registerAuth('default', first); auth.tokens.set(tokens); auth.user.set(USER);
    expect(auth.isAuthenticated.get()).toBe(true); expect(auth.roles.get()).toEqual(['user']);
    clearAuthInternal();
    const next = client(); registerAuth('default', next);
    expect(auth.isAuthenticated.get()).toBe(false); expect(auth.roles.get()).toEqual([]);
    auth.tokens.set(tokens); auth.user.set({ ...USER, roles: ['admin'] });
    expect(auth.isAuthenticated.get()).toBe(true); expect(auth.roles.get()).toEqual(['admin']);
    await next.logout(false); expect(auth.isAuthenticated.get()).toBe(false);
  });

  it('keeps the same instance on configure and returns detached endpoint/header snapshots', () => {
    configureAuth({ autoRefresh: false, endpoints: { login: '/v2/login' } });
    const instance = getDefaultAuth();
    configureAuth({ endpoints: { refresh: '/v2/refresh' } });
    expect(getDefaultAuth()).toBe(instance);
    expect(instance.getConfig().loginUrl).toBe('/v2/login');
    const snapshot = getAuthConfig(); snapshot.endpoints.login = '/mutated';
    expect(getAuthConfig().endpoints.login).toBe('/v2/login');
    const canonical = instance.getConfig(); canonical.headers.Authorization = 'injected';
    expect(instance.getConfig().headers.Authorization).toBeUndefined();
  });

  it('keeps canonical memory init free of persistent-token restore unless a restore key was configured', async () => {
    localStorage.setItem('zenith_token_session', JSON.stringify({ v: 1, t: Date.now(), e: null, d: tokens }));
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    const instance = client(); await instance.init();
    expect(instance.token).toBeNull(); expect(fetchMock).not.toHaveBeenCalled();
  });

  it('supports explicit HttpOnly-cookie refresh without exposing or requiring a JSON refresh token', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => response({ accessToken: 'cookie-access', user: USER, expiresIn: 600 }));
    vi.stubGlobal('fetch', fetchMock);
    const instance = client({ ...config, refreshMode: 'cookie', headers: { 'X-CSRF-Token': 'test-csrf' } });
    expect(await instance.refresh()).toBe(true); expect(instance.token).toBe('cookie-access');
    expect(instance.signal.peek().refreshToken).toBeNull();
    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({}); expect(init.credentials).toBe('same-origin');
    expect(init.headers).toMatchObject({ 'X-CSRF-Token': 'test-csrf' });
  });

  it('does not read browser persistence in a request marked as SSR', async () => {
    localStorage.setItem('server-scope', JSON.stringify({ v: 1, t: Date.now(), e: null, d: tokens }));
    const marked = document as Document & { __zenithSSR__?: boolean };
    const previous = marked.__zenithSSR__; marked.__zenithSSR__ = true;
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    try {
      const instance = client({ ...config, tokenStorage: 'localStorage', storageKey: 'server-scope' });
      await instance.init(); expect(instance.token).toBeNull(); expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      if (previous === undefined) delete marked.__zenithSSR__; else marked.__zenithSSR__ = previous;
    }
  });

  it('clears an older remembered identity when a new non-remembered login succeeds', async () => {
    configureAuth({ autoRefresh: false });
    localStorage.setItem('zenith_auth_tokens', JSON.stringify(tokens));
    vi.stubGlobal('fetch', vi.fn(async () => response({ user: USER, tokens: { accessToken: 'new' } })));
    await login({ email: USER.email, password: 'x', remember: false });
    expect(localStorage.getItem('zenith_auth_tokens')).toBeNull();
    expect(getDefaultAuth().token).toBe('new');
  });
});

describe('session-generation and request ownership', () => {
  it.each(['logout', 'dispose'] as const)('cannot resurrect a late login after %s, even when fetch ignores abort', async action => {
    const pending = deferred<Response>(); const fetchMock = vi.fn(() => pending.promise);
    vi.stubGlobal('fetch', fetchMock);
    const instance = client(); const loginPromise = instance.login({ password: 'secret' });
    const request = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    if (action === 'logout') await instance.logout(false); else instance.dispose();
    expect(request[1].signal?.aborted).toBe(true);
    pending.resolve(response({ token: 'late', user: USER }));
    expect(await loginPromise).toBe(false); expect(instance.token).toBeNull();
    expect(instance.signal.peek().loading).toBe(false);
  });

  it('cancels the response-body phase too, and an older login cannot overwrite a newer one', async () => {
    const body = deferred<unknown>();
    const fetchMock = vi.fn().mockResolvedValueOnce({ ok: true, status: 200, json: () => body.promise })
      .mockResolvedValueOnce(response({ token: 'new', user: USER }));
    vi.stubGlobal('fetch', fetchMock);
    const instance = client(); const first = instance.login({ password: 'old' });
    await Promise.resolve();
    const second = instance.login({ password: 'new' });
    expect(await second).toBe(true);
    body.resolve({ token: 'old', user: USER });
    expect(await first).toBe(false); expect(instance.token).toBe('new');
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
  });

  it('does not apply a late user response or 401 to a subsequent session', async () => {
    const pending = deferred<Response>();
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ token: 'A', user: USER }))
      .mockImplementationOnce(() => pending.promise).mockResolvedValueOnce(response({ token: 'B', user: { ...USER, id: 2 } }));
    vi.stubGlobal('fetch', fetchMock);
    const instance = client(); await instance.login({}); const me = instance.fetchUser();
    await instance.logout(false); await instance.login({}); pending.resolve(response({}, 401));
    expect(await me).toBe(false); expect(instance.token).toBe('B'); expect(instance.user?.id).toBe(2);
  });

  it('a stale refresh cannot release the new session refresh lease', async () => {
    const oldRefresh = deferred<Response>(); const newRefresh = deferred<Response>();
    const fetchMock = vi.fn().mockResolvedValueOnce(response({ token: 'A', refreshToken: 'R', user: USER }))
      .mockImplementationOnce(() => oldRefresh.promise)
      .mockResolvedValueOnce(response({ token: 'B', refreshToken: 'S', user: USER }))
      .mockImplementationOnce(() => newRefresh.promise);
    vi.stubGlobal('fetch', fetchMock);
    const instance = client(); await instance.login({}); const old = instance.refresh();
    await instance.logout(false); await instance.login({}); const current = instance.refresh();
    oldRefresh.resolve(response({ token: 'stale', refreshToken: 'old' })); expect(await old).toBe(false);
    const parallel = instance.refresh(); expect(parallel).toBe(current);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    newRefresh.resolve(response({ token: 'C', refreshToken: 'S2' }));
    expect(await current).toBe(true); expect(instance.token).toBe('C');
  });

  it('does not restore a late MFA response after logout', async () => {
    const pending = deferred<Response>(); vi.stubGlobal('fetch', vi.fn(() => pending.promise));
    const instance = client(); const mfa = instance.verifyMfa('123456');
    await instance.logout(false); pending.resolve(response({ token: 'late', user: USER }));
    expect(await mfa).toBe(false); expect(instance.token).toBeNull();
  });

  it('rejects tokenless MFA success rather than treating the current token as proof', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response({}))); const instance = client();
    expect(await instance.verifyMfa('123456')).toBe(false);
  });

  it('clears remembered storage immediately even when secureLogout network never settles', async () => {
    configureAuth({ autoRefresh: false });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ user: USER, tokens })).mockReturnValue(new Promise(() => {})));
    await login({ email: USER.email, password: 'x', remember: true });
    expect(localStorage.getItem('zenith_auth_tokens')).not.toBeNull();
    const pending = getDefaultAuth().secureLogout('/logout');
    expect(getDefaultAuth().token).toBeNull(); expect(localStorage.getItem('zenith_auth_tokens')).toBeNull();
    await pending;
  });

  it('owns and removes offline listeners when disposed', async () => {
    vi.useFakeTimers();
    const previous = Object.getOwnPropertyDescriptor(navigator, 'onLine');
    Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
    const fetchMock = vi.fn(async () => response({ token: 'A', refreshToken: 'R', expiresIn: 3600 }));
    vi.stubGlobal('fetch', fetchMock);
    try {
      const instance = client({ ...config, autoRefresh: true }); await instance.login({});
      instance.dispose(); fetchMock.mockClear();
      window.dispatchEvent(new Event('online')); await vi.advanceTimersByTimeAsync(3_600_000);
      expect(fetchMock).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
    } finally { if (previous) Object.defineProperty(navigator, 'onLine', previous); else Reflect.deleteProperty(navigator, 'onLine'); }
  });

  it('restores and validates a legacy class session only once and migrates away from raw token keys', async () => {
    localStorage.setItem('zenith_token', 'A'); localStorage.setItem('zenith_refresh_token', 'R');
    const fetchMock = vi.fn(async () => response(USER)); vi.stubGlobal('fetch', fetchMock);
    const instance = client({ ...config, tokenStorage: 'localStorage' }); await instance.init();
    expect(fetchMock).toHaveBeenCalledTimes(1); expect(instance.user?.id).toBe(USER.id);
    expect(JSON.parse(localStorage.getItem('zenith_token_session')!).d.accessToken).toBe('A');
    expect(localStorage.getItem('zenith_token')).toBeNull();
  });

  it('does not erase a valid session on transient refresh network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(response({ token: 'A', refreshToken: 'R', user: USER }))
      .mockRejectedValueOnce(new Error('secret upstream details')));
    const instance = client(); await instance.login({}); expect(await instance.refresh()).toBe(false);
    expect(instance.token).toBe('A');
  });

  it('never copies response/error/listener secrets into auth error state or diagnostics', async () => {
    const sink = bufferSink(); const remove = logger.addSink(sink);
    const instance = client(); instance.on('error', () => { throw new Error('listener-secret'); });
    vi.stubGlobal('fetch', vi.fn(async () => response({ message: 'password-secret' }, 401)));
    try {
      expect(await instance.login({ password: 'password-secret' })).toBe(false);
      expect(instance.signal.peek().error).toBe('Authentication failed');
      expect(JSON.stringify(sink.entries())).not.toMatch(/password-secret|listener-secret/);
    } finally { remove(); }
  });

  it('rejects credential-bearing/cross-origin endpoints before network access', async () => {
    const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
    for (const loginUrl of ['https://evil.example/login', 'javascript:alert(1)', 'https://user:password@example.test/login']) {
      const instance = client({ ...config, loginUrl }); expect(await instance.login({ password: 'secret' })).toBe(false);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([{}, { accessToken: 42 }, { accessToken: 'A', expiresAt: 'tomorrow' }, { accessToken: 'A', refreshToken: {} }])(
    'rejects invalid token response %j without setting authentication', async invalid => {
      vi.stubGlobal('fetch', vi.fn(async () => response({ user: USER, tokens: invalid })));
      const instance = client(); expect(await instance.login({})).toBe(false); expect(instance.token).toBeNull();
    });
});
