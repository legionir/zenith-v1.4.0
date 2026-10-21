// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createApp, defaultApp, resetDefaultAppForTesting } from '@zenith/runtime-core';
import { createAuth, getDefaultAuth, registerAuth } from '@zenith/auth';
import { clearAuthInternal } from '../../auth/src/auth';

// Reuse the wrapper module across resets; do not mutate a private production flag for tests.
afterEach(() => { clearAuthInternal(); resetDefaultAppForTesting(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('lazy runtime Auth facade (code-first, unrun)', () => {
  it('attaches the owner on first invocation, not on importing the module', async () => {
    const app = defaultApp(); const install = vi.spyOn(app, 'use');
    const runtime = await import('../src/auth-api');
    expect(install).not.toHaveBeenCalled();
    runtime.configureAuth({ autoRefresh: false });
    expect(install).toHaveBeenCalledTimes(1);
    expect(app.registries.auth.get('default')).toBe(getDefaultAuth());
    expect(runtime.auth.user.get()).toBeNull();
  });

  it('uses a fresh default App after reset without capturing the previous instance', async () => {
    const runtime = await import('../src/auth-api');
    runtime.configureAuth({ autoRefresh: false }); const old = defaultApp(); const previous = getDefaultAuth();
    resetDefaultAppForTesting();
    const next = getDefaultAuth();
    expect(next).not.toBe(previous); expect(defaultApp()).not.toBe(old);
    expect(runtime.auth.tokens.get()).toBeNull(); expect(defaultApp().registries.auth.get('default')).toBe(next);
  });

  it('routes both helper calls and facade methods through the same App engine', async () => {
    const runtime = await import('../src/auth-api'); runtime.configureAuth({ autoRefresh: false });
    const instance = createAuth({ loginUrl: '/login', autoRefresh: false }); registerAuth('default', instance);
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ token: 'T', user: { id: 1 } }) })));
    const separate = createApp(); const other = createAuth({ loginUrl: '/other', autoRefresh: false });
    separate.registries.auth.register('default', other);
    try {
      await runtime.login({ email: 'one@example.test', password: 'test-only' });
      expect(instance.token).toBe('T'); expect(runtime.auth.tokens.get()?.accessToken).toBe('T');
      expect(other.token).toBeNull(); await runtime.auth.logout(false); expect(instance.token).toBeNull();
    } finally { instance.dispose(); separate.dispose(); other.dispose(); }
  });
});
