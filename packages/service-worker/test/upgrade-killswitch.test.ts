// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { unregisterSW, createKillSwitchScript } from '../src';
import { setupSW, setupKillSwitchSW, cleanupSWListeners } from '../src/sw';

describe('@zenith/service-worker — versioned cache cleanup & emergency kill switch (#96)', () => {
  const originalCaches = (globalThis as any).caches;
  const originalServiceWorker = navigator.serviceWorker;

  beforeEach(() => {
    cleanupSWListeners();
  });

  afterEach(() => {
    cleanupSWListeners();
    (globalThis as any).caches = originalCaches;
    Object.defineProperty(navigator, 'serviceWorker', {
      value: originalServiceWorker,
      configurable: true,
    });
    vi.restoreAllMocks();
  });

  it('deletes old versioned caches on activate when cacheVersion is bumped', async () => {
    const store = new Map<string, Record<string, unknown>>([
      ['zenith-v1-precache', {}],
      ['zenith-v1-users', {}],
      ['zenith-v2-precache', {}],
      ['zenith-v2-users', {}],
    ]);

    (globalThis as any).caches = {
      keys: vi.fn(async () => Array.from(store.keys())),
      delete: vi.fn(async (name: string) => store.delete(name)),
      open: vi.fn(async (name: string) => {
        if (!store.has(name)) store.set(name, {});
        return { add: vi.fn(async () => {}) };
      }),
    };

    setupSW({
      cacheVersion: 2,
      precache: ['/index.html'],
      routes: [{ urlPattern: '/api/users', strategy: 'networkFirst', cacheName: 'users' }],
    });

    let activatePromise: Promise<unknown> = Promise.resolve();
    const activateEvent = new Event('activate') as Event & {
      waitUntil: (p: Promise<unknown>) => void;
    };
    activateEvent.waitUntil = (p) => {
      activatePromise = p;
    };

    self.dispatchEvent(activateEvent);
    await activatePromise;

    expect(store.has('zenith-v1-precache')).toBe(false);
    expect(store.has('zenith-v1-users')).toBe(false);
    expect(store.has('zenith-v2-precache')).toBe(true);
    expect(store.has('zenith-v2-users')).toBe(true);
  });

  it('setupKillSwitchSW purges all caches, unregisters SW, and refreshes open clients on activate', async () => {
    const store = new Map<string, unknown>([
      ['zenith-v1-precache', {}],
      ['zenith-v2-api', {}],
    ]);
    (globalThis as any).caches = {
      keys: vi.fn(async () => Array.from(store.keys())),
      delete: vi.fn(async (name: string) => store.delete(name)),
    };

    const unregisterSpy = vi.fn(async () => true);
    const navigateSpy = vi.fn(async () => {});
    const skipWaitingSpy = vi.fn(async () => {});
    (self as any).skipWaiting = skipWaitingSpy;
    (self as any).registration = { unregister: unregisterSpy };
    (self as any).clients = {
      claim: vi.fn(async () => {}),
      matchAll: vi.fn(async () => [{ url: 'https://example.com/app', navigate: navigateSpy }]),
    };

    setupKillSwitchSW();

    let installWait = Promise.resolve();
    const installEvent = new Event('install') as Event & { waitUntil: (p: Promise<unknown>) => void };
    installEvent.waitUntil = (p) => {
      installWait = p;
    };
    self.dispatchEvent(installEvent);
    await installWait;
    expect(skipWaitingSpy).toHaveBeenCalledTimes(1);

    let activateWait = Promise.resolve();
    const activateEvent = new Event('activate') as Event & {
      waitUntil: (p: Promise<unknown>) => void;
    };
    activateEvent.waitUntil = (p) => {
      activateWait = p;
    };
    self.dispatchEvent(activateEvent);
    await activateWait;

    expect(store.size).toBe(0);
    expect(unregisterSpy).toHaveBeenCalledTimes(1);
    expect(navigateSpy).toHaveBeenCalledWith('https://example.com/app');
  });

  it('unregisterSW() unregisters active registrations and clears CacheStorage on the main thread', async () => {
    const store = new Map<string, unknown>([['zenith-v1-precache', {}]]);
    (globalThis as any).caches = {
      keys: vi.fn(async () => Array.from(store.keys())),
      delete: vi.fn(async (name: string) => store.delete(name)),
    };

    const unregisterRegSpy = vi.fn(async () => true);
    Object.defineProperty(navigator, 'serviceWorker', {
      value: {
        getRegistrations: vi.fn(async () => [{ unregister: unregisterRegSpy }]),
      },
      configurable: true,
    });

    const result = await unregisterSW();
    expect(result).toBe(true);
    expect(unregisterRegSpy).toHaveBeenCalledTimes(1);
    expect(store.size).toBe(0);

    const script = createKillSwitchScript();
    expect(script).toContain('self.registration.unregister()');
    expect(existsSync(join(process.cwd(), 'packages/service-worker/sw-kill.js'))).toBe(true);
    const readme = readFileSync(join(process.cwd(), 'packages/service-worker/README.md'), 'utf8');
    expect(readme).toContain('sw-kill.js');
  });
});
