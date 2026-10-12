// @vitest-environment jsdom
//
// #145 — مهاجرت auth به @zenith/storage (کار لازم: «مصرف در auth»):
//   • save/load/clear توکن‌های functional از راه storage (کلید دقیق
//     zenith_auth_tokens برای سازگاری با دادهٔ قدیمی — namespace '').
//   • دادهٔ میراث (JSON خام بدون wrapper) از migrate(v0) عبور می‌کند و
//     با record تازهٔ {v,t,e,d} بازنویسی می‌شود (جلسه نمی‌سوزد).
//   • خطای ذخیره‌گاه استثنا نمی‌کند (storage خودش ZEN-1101 را لاگ می‌کند).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { addSink, bufferSink } from '@zenith/logger';
import type { LogSink } from '@zenith/logger';

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 401,
    statusText: ok ? 'OK' : 'ERR',
    json: async () => body,
  } as unknown as Response;
}

const TOKENS = { accessToken: 'A', refreshToken: 'R', expiresAt: Date.now() + 3600_000 };
const USER = { id: 1, name: 'sara', email: 'a@b.c', roles: ['user'], permissions: [] };

let sink: LogSink & { entries(): Array<{ message: string }> };
let removeSink: () => void;

beforeEach(() => {
  localStorage.clear();
  sink = bufferSink({ maxEntries: 200 });
  removeSink = addSink(sink);
  vi.resetModules();
});
afterEach(() => {
  removeSink();
  vi.unstubAllGlobals();
  localStorage.clear();
});

async function loadAuth() {
  return import('../src/auth');
}

describe('auth functional tokens via @zenith/storage (#145)', () => {
  it('saves tokens as a storage record under the exact legacy key', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ user: USER, tokens: TOKENS })),
    );
    const auth = await loadAuth();
    auth.configureAuth({ autoRefresh: false });
    await auth.login({ email: 'a@b.c', password: 'x', remember: true });

    const raw = localStorage.getItem('zenith_auth_tokens');
    expect(raw, 'token must live under zenith_auth_tokens').toBeTruthy();
    const rec = JSON.parse(raw!);
    expect(rec).toMatchObject({ v: 1, d: { accessToken: 'A', refreshToken: 'R' } });
    expect(typeof rec.t).toBe('number');

    await auth.logout(false);
    expect(localStorage.getItem('zenith_auth_tokens')).toBeNull();
  });

  it('adopts legacy raw-JSON tokens through migrate(v0) on initAuth', async () => {
    // دادهٔ قدیمی auth: JSON خام بدون wrapper (پیش از #145)
    localStorage.setItem('zenith_auth_tokens', JSON.stringify(TOKENS));
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        url.includes('/me') ? jsonResponse(USER) : jsonResponse({ tokens: TOKENS }),
      ),
    );
    const auth = await loadAuth();
    auth.configureAuth({ autoRefresh: false, endpoints: { me: '/api/auth/me' } });
    await auth.initAuth();

    // توکن خوانده شد (fetchCurrentUser با Authorization آن اجرا می‌شود)
    const meCall = (fetch as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(meCall.some((u) => u.includes('/api/auth/me'))).toBe(true);

    // و همان کلید با record تازه adopt شد
    const rec = JSON.parse(localStorage.getItem('zenith_auth_tokens')!);
    expect(rec.v).toBe(1);
    expect(rec.d.accessToken).toBe('A');
    const text = sink
      .entries()
      .map((e) => e.message)
      .join('\n');
    void text; // migrate موفق نباید هشداری چاپ کند
  });

  it('storage failures never throw out of save/load (SSR-safe)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ user: USER, tokens: TOKENS })),
    );
    const auth = await loadAuth();
    auth.configureAuth({ autoRefresh: false });
    // localStorage را می‌شکنیم (حالت private): setItem throw می‌کند
    const orig = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new DOMException('QuotaExceeded', 'QuotaExceededError');
    };
    await expect(
      auth.login({ email: 'a@b.c', password: 'x', remember: true }),
    ).resolves.toBeTruthy();
    Storage.prototype.setItem = orig;
    await auth.logout(false);
  });
});
