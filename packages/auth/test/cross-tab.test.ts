// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAuth, type Auth } from '../src/auth';

/** Faithful sender exclusion; synchronous delivery exposes rebroadcast loops. */
class FakeChannel {
  static channels = new Set<FakeChannel>();
  static messages: unknown[] = [];
  readonly listeners = new Set<(event: MessageEvent<unknown>) => void>();
  closed = false;
  constructor(readonly name: string) { FakeChannel.channels.add(this); }
  addEventListener(_type: string, listener: (event: MessageEvent<unknown>) => void) { this.listeners.add(listener); }
  removeEventListener(_type: string, listener: (event: MessageEvent<unknown>) => void) { this.listeners.delete(listener); }
  postMessage(data: unknown) {
    FakeChannel.messages.push(data);
    for (const peer of [...FakeChannel.channels]) if (peer !== this && peer.name === this.name) {
      for (const listener of [...peer.listeners]) listener(new MessageEvent('message', { data }));
    }
  }
  close() { this.closed = true; FakeChannel.channels.delete(this); }
}
const owned: Auth[] = [];
const user = { id: 1, name: 'One', email: 'one@example.test' };
function client(storageKey = 'shared-session', persistent = false) {
  const instance = createAuth({ loginUrl: '/login', refreshUrl: '/refresh', meUrl: '/me', storageKey,
    autoRefresh: false, tokenStorage: persistent ? 'localStorage' : 'memory' });
  owned.push(instance); return instance;
}
async function settle() { for (let i = 0; i < 12; i++) await Promise.resolve(); }

beforeEach(() => {
  localStorage.clear(); FakeChannel.messages = []; vi.stubGlobal('BroadcastChannel', FakeChannel);
  vi.stubGlobal('fetch', vi.fn(async (url: string) => ({ ok: true, status: 200,
    json: async () => url === '/me' ? user : { token: url === '/refresh' ? 'rotated-secret' : 'access-secret',
      refreshToken: 'refresh-secret', user, expiresIn: 3600 } })));
});
afterEach(() => {
  for (const instance of owned.splice(0)) instance.dispose();
  for (const channel of FakeChannel.channels) channel.close();
  vi.unstubAllGlobals(); localStorage.clear();
});

describe('owned cross-tab invalidation (#139, unrun code-first)', () => {
  it('clears remote memory sessions without sending credentials or creating a logout echo', async () => {
    const a = client(); const b = client(); await a.login({}); await b.login({});
    a.enableCrossTabSync(); b.enableCrossTabSync(); await a.logout(false);
    expect(b.token).toBeNull(); expect(b.signal.peek().isAuthenticated).toBe(false);
    expect(FakeChannel.messages).toEqual([{ version: 1, scope: 'shared-session', type: 'logout' }]);
    expect(JSON.stringify(FakeChannel.messages)).not.toMatch(/access-secret|refresh-secret/);
  });

  it('does not log out another configured scope', async () => {
    const a = client('tenant-one'); const b = client('tenant-two'); await a.login({}); await b.login({});
    a.enableCrossTabSync(); b.enableCrossTabSync(); await a.logout(false);
    expect(b.token).toBe('access-secret');
  });

  it('refreshes a persistent peer from storage and validates its user without refresh echo', async () => {
    const a = client('shared-session', true); await a.login({});
    const b = client('shared-session', true); await b.init();
    a.enableCrossTabSync(); b.enableCrossTabSync(); await a.refresh(); await settle();
    expect(b.token).toBe('rotated-secret'); expect(b.user?.id).toBe(1);
    expect(FakeChannel.messages).toEqual([{ version: 1, scope: 'shared-session', type: 'refresh' }]);
  });

  it('reads the updated persistent record, not the old memory cache, for remembered peers', async () => {
    const a = client(); const b = client();
    await a.login({}, { remember: true }); await b.init();
    a.enableCrossTabSync(); b.enableCrossTabSync(); await a.refresh(); await settle();
    expect(b.token).toBe('rotated-secret'); expect(b.isAuthenticated).toBe(true);
  });

  it('never imports persisted credentials into a non-remembered memory peer on refresh', async () => {
    const a = client(); const b = client(); await a.login({}, { remember: true }); await b.login({});
    a.enableCrossTabSync(); b.enableCrossTabSync(); await a.refresh(); await settle();
    expect(b.token).toBe('access-secret');
  });

  it('owns channel/listeners on disposal and supports idempotent explicit unsubscribe', async () => {
    const a = client(); const stop = a.enableCrossTabSync(); const channel = [...FakeChannel.channels][0];
    stop(); stop(); expect(channel.closed).toBe(true); expect(channel.listeners.size).toBe(0);
    a.enableCrossTabSync(); const next = [...FakeChannel.channels][0]; a.dispose(); a.dispose();
    expect(next.closed).toBe(true); expect(next.listeners.size).toBe(0); expect(FakeChannel.channels.size).toBe(0);
  });

  it('falls back to owned storage events if channel construction fails', async () => {
    vi.stubGlobal('BroadcastChannel', class { constructor() { throw new Error('blocked'); } });
    const a = client(); await a.login({}); a.enableCrossTabSync();
    window.dispatchEvent(new StorageEvent('storage', { key: 'shared-session', newValue: null }));
    expect(a.token).toBeNull(); a.dispose();
    // No surviving callback may emit an event on a disposed client.
    expect(() => window.dispatchEvent(new StorageEvent('storage', { key: 'shared-session', newValue: null }))).not.toThrow();
  });

  it('invalidates pending work on remote logout even if fetch ignores cancellation', async () => {
    const a = client(); const b = client(); a.enableCrossTabSync(); b.enableCrossTabSync();
    let release!: (value: unknown) => void;
    vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => { release = resolve; })));
    const pending = b.login({}); await a.logout(false);
    release({ ok: true, json: async () => ({ token: 'zombie', user }) });
    expect(await pending).toBe(false); expect(b.token).toBeNull();
  });
});
