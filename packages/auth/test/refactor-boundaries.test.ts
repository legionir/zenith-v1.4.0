import { afterEach, expect, it, vi } from 'vitest';
import { Auth, clearAuthInternal, createAuth } from '../src/auth';
import { Auth as Engine } from '../src/engine';
import { resolveAuthConfig } from '../src/options';
import { decodeAuthSession } from '../src/response';
import { openAuthSynchronization } from '../src/cross-tab';
import type { AuthEvent, AuthEventListener } from '../src/types';
afterEach(() => { clearAuthInternal(); vi.unstubAllGlobals(); });
it('retains the canonical constructor identity through the existing facade', () => {
  expect(Auth).toBe(Engine);
  const client = createAuth({ loginUrl: '/login' });
  try { expect(client).toBeInstanceOf(Engine); } finally { client.dispose(); }
});
it('does not eagerly read former session signals while decoding an unrelated response', () => {
  const previousRefreshToken = vi.fn(() => null), previousUser = vi.fn(() => null);
  const options = { config: resolveAuthConfig({ loginUrl: '/login' }), refreshing: true, previousRefreshToken, previousUser };
  expect(decodeAuthSession(null, options)).toBeNull();
  expect(previousRefreshToken).not.toHaveBeenCalled(); expect(previousUser).not.toHaveBeenCalled();
  const session = decodeAuthSession({ token: 'access', refreshToken: 'refresh', user: { id: 1 } }, options);
  expect(session?.tokens.accessToken).toBe('access');
  expect(previousRefreshToken).not.toHaveBeenCalled(); expect(previousUser).not.toHaveBeenCalled();
});
it('preserves lazy refresh/user fallback when those response fields are absent', () => {
  const user = { id: 1, name: 'One', email: 'one@example.test' };
  const previousRefreshToken = vi.fn(() => 'refresh'), previousUser = vi.fn(() => user);
  const session = decodeAuthSession({ token: 'access' }, { config: resolveAuthConfig({ loginUrl: '/login' }), refreshing: true, previousRefreshToken, previousUser });
  expect(session?.user).toBe(user); expect(session?.tokens.refreshToken).toBe('refresh');
  expect(previousRefreshToken).toHaveBeenCalledTimes(1); expect(previousUser).toHaveBeenCalledTimes(1);
});
it('scopes cross-tab invalidations and releases every listener exactly once', () => {
  const channels: FakeChannel[] = [];
  class FakeChannel extends EventTarget {
    sent: unknown[] = []; close = vi.fn();
    constructor(readonly name: string) { super(); channels.push(this); }
    postMessage(value: unknown): void { this.sent.push(value); }
  }
  vi.stubGlobal('BroadcastChannel', FakeChannel);
  const handlers = new Map<AuthEvent, AuthEventListener>();
  const receive = vi.fn(), onStop = vi.fn();
  const stop = openAuthSynchronization({ channelName: 'auth', scope: 'one', receive, isReceiving: () => false,
    on(event, callback) { handlers.set(event, callback); return () => { handlers.delete(event); }; }, onStop });
  const channel = channels[0]!;
  channel.dispatchEvent(new MessageEvent('message', { data: { version: 1, scope: 'other', type: 'logout' } }));
  expect(receive).not.toHaveBeenCalled();
  channel.dispatchEvent(new MessageEvent('message', { data: { version: 1, scope: 'one', type: 'refresh' } }));
  expect(receive).toHaveBeenCalledWith('refresh');
  handlers.get('logout')?.('logout'); expect(channel.sent).toEqual([{ version: 1, scope: 'one', type: 'logout' }]);
  stop(); stop(); expect(channel.close).toHaveBeenCalledTimes(1); expect(onStop).toHaveBeenCalledTimes(1); expect(handlers.size).toBe(0);
});
