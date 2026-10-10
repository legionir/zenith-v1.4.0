// @vitest-environment jsdom
//
// #62 — راهنمای رسمی ذخیرهٔ توکن + پیش‌فرض امن در auth:
//   * هشدار dev (با کد ZEN-404) هنگام انتخاب localStorage/cookie برای توکن.
//   * سکوت در production و در حالت پیش‌فرض memory.
//   * refresh race: دو فراخوانی هم‌زمان refresh() → تنها یک درخواست شبکه.
//   * logout: پاک‌سازی state + storage + رویداد logout.
//   * credentials: login با same-origin؛ secureLogout (بدون sendBeacon) با
//     credentials: 'include' تا کوکی‌های HttpOnly سمت سرور هم invalidate شوند.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Auth, createAuth } from '../src/auth';

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'ERR',
    json: async () => body,
  } as unknown as Response;
}

const baseConfig = {
  loginUrl: '/api/auth/login',
  logoutUrl: '/api/auth/logout',
  refreshUrl: '/api/auth/refresh',
  meUrl: '/api/auth/me',
};

async function loginOk(auth: Auth): Promise<boolean> {
  return auth.login({ email: 'a@b.c', password: 'x' });
}

describe('dev-mode storage warning (#62)', () => {
  let warn: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    delete (globalThis as any).__ZENITH_DEV__;
    localStorage.clear();
  });

  afterEach(() => {
    warn.mockRestore();
    localStorage.clear();
  });

  it('warns with ZEN-404 when tokenStorage is localStorage in dev', () => {
    new Auth({ ...baseConfig, tokenStorage: 'localStorage' });
    const calls = warn.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(calls).toContain('ZEN-404');
    expect(calls.toLowerCase()).toContain('localstorage');
  });

  it('warns with ZEN-404 when tokenStorage is cookie in dev', () => {
    new Auth({ ...baseConfig, tokenStorage: 'cookie' });
    const calls = warn.mock.calls.map((c) => c.join(' ')).join('\n');
    expect(calls).toContain('ZEN-404');
  });

  it('does NOT warn for the secure default (memory)', () => {
    const auth = createAuth({ ...baseConfig });
    expect(warn).not.toHaveBeenCalled();
    auth.destroy();
  });

  it('does NOT warn in production (__ZENITH_DEV__ = false)', () => {
    (globalThis as any).__ZENITH_DEV__ = false;
    const auth = new Auth({ ...baseConfig, tokenStorage: 'localStorage' });
    expect(warn).not.toHaveBeenCalled();
    auth.destroy();
  });
});

describe('refresh race guard (#62)', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    delete (globalThis as any).__ZENITH_DEV__;
    (globalThis as any).__ZENITH_DEV__ = false; // silence storage warn
    localStorage.clear();
    fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (String(url) === baseConfig.loginUrl) {
        return jsonResponse({
          token: 'T1',
          refreshToken: 'R1',
          user: { id: 1, name: 'A', email: 'a@b.c' },
          expiresIn: 3600,
        });
      }
      if (String(url) === baseConfig.refreshUrl) {
        return jsonResponse({ token: 'T2', refreshToken: 'R2', expiresIn: 3600 });
      }
      return jsonResponse({}, false, 404);
    });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('two concurrent refresh() calls issue exactly one network request', async () => {
    const auth = new Auth({ ...baseConfig, autoRefresh: false });
    expect(await loginOk(auth)).toBe(true);
    fetchMock.mockClear();

    const [a, b] = await Promise.all([auth.refresh(), auth.refresh()]);
    expect(a).toBe(true);
    expect(b).toBe(true);

    const refreshCalls = fetchMock.mock.calls.filter((c) => String(c[0]) === baseConfig.refreshUrl);
    expect(refreshCalls.length).toBe(1);
    // rotated token applied once
    expect(auth.token).toBe('T2');
    auth.destroy();
  });

  it('a failed refresh does not poison the guard — a later refresh retries', async () => {
    const auth = new Auth({ ...baseConfig, autoRefresh: false });
    await loginOk(auth);
    fetchMock.mockClear();

    // خطای موقت (503) نباید logout کند — refresh بعدی باید دوباره تلاش کند.
    fetchMock.mockImplementationOnce(async () => jsonResponse({}, false, 503));
    const first = await auth.refresh();
    expect(first).toBe(false);
    expect(auth.token).toBe('T1'); // still logged in after transient failure

    const second = await auth.refresh();
    expect(second).toBe(true);
    expect(auth.token).toBe('T2');
    auth.destroy();
  });
});

describe('logout (#62)', () => {
  beforeEach(() => {
    (globalThis as any).__ZENITH_DEV__ = false;
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    localStorage.clear();
  });

  it('clears state, storage and emits logout event', async () => {
    // refresh/restore مسیر ناموفق (503، موقت — logout نمی‌کند)؛ logout دستی تست می‌شود.
    const fetchMock = vi.fn(async () => jsonResponse({}, false, 503));
    vi.stubGlobal('fetch', fetchMock);

    // توکن‌ها از قبل در storage هستند تا instance آن‌ها را restore کند.
    localStorage.setItem('zenith_token', 'T1');
    localStorage.setItem('zenith_refresh_token', 'R1');

    const auth = new Auth({ ...baseConfig, tokenStorage: 'localStorage', autoRefresh: false });

    const events: string[] = [];
    auth.on('logout', (e) => events.push(e));

    await auth.logout();

    expect(auth.token).toBe(null);
    expect(auth.isAuthenticated).toBe(false);
    expect(localStorage.getItem('zenith_token')).toBe(null);
    expect(localStorage.getItem('zenith_refresh_token')).toBe(null);
    expect(events).toEqual(['logout']);
  });
});

describe('credentials mode (#62)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('login fetches with credentials: same-origin by default', async () => {
    (globalThis as any).__ZENITH_DEV__ = false;
    const fetchMock = vi.fn(async () =>
      jsonResponse({ token: 'T1', user: { id: 1, name: 'A', email: 'a@b.c' } }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const auth = new Auth({ ...baseConfig, autoRefresh: false });
    await auth.login({ email: 'a@b.c', password: 'x' });

    const loginCall = fetchMock.mock.calls.find((c) => String(c[0]) === baseConfig.loginUrl);
    expect(loginCall).toBeDefined();
    expect((loginCall![1] as RequestInit).credentials).toBe('same-origin');
    auth.destroy();
  });

  it('secureLogout falls back to fetch with credentials: include when sendBeacon is unavailable', async () => {
    (globalThis as any).__ZENITH_DEV__ = false;
    const fetchMock = vi.fn(async () => jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);
    // jsdom: navigator.sendBeacon does not exist → fetch fallback path.
    expect(typeof navigator.sendBeacon).not.toBe('function');

    const auth = new Auth({ ...baseConfig, autoRefresh: false });
    await auth.secureLogout('/api/auth/logout');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const init = fetchMock.mock.calls[0]![1] as RequestInit;
    expect(init.credentials).toBe('include');
    expect(init.keepalive).toBe(true);
    auth.destroy();
  });
});
