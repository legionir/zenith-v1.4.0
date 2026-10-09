// #6 / #27: setupSW must register install/activate/fetch/sync/message listeners
// through the tracked addSWListener path, and cleanupSWListeners must remove
// exactly those listeners (no leaked addEventListener without removeEventListener).
import { describe, it, expect, beforeEach } from 'vitest';
import { setupSW, cleanupSWListeners, getConfig } from '@zenith/service-worker/sw';

type Listener = (event: any) => void;

let registered: Array<{ type: string; listener: Listener }> = [];
let removed: Array<{ type: string; listener: Listener }> = [];

function mockSelf() {
  registered = [];
  removed = [];
  (globalThis as any).self = {
    addEventListener: (type: string, listener: Listener) => {
      registered.push({ type, listener });
    },
    removeEventListener: (type: string, listener: Listener) => {
      removed.push({ type, listener });
    },
  };
  // Drain any handlers left over from a previous test (swHandlers is a
  // module-level registry shared across the whole file).
  cleanupSWListeners();
  registered = [];
  removed = [];
}

const expectedTypes = ['install', 'activate', 'fetch', 'sync', 'message'];

beforeEach(mockSelf);

describe('service-worker listener lifecycle (#6)', () => {
  // red-check: before the fix, addSWListener was dead code and
  // cleanupSWListeners removed nothing.
  it('registers the five lifecycle listeners through the tracked path', () => {
    setupSW({ precache: [], routes: [] });
    for (const t of expectedTypes) {
      expect(
        registered.some((r) => r.type === t),
        `listener "${t}" registered`,
      ).toBe(true);
    }
    expect(registered.length).toBe(5);
    const cfg = getConfig();
    expect(cfg).toBeTruthy();
    expect(cfg!.defaultStrategy).toBe('networkOnly');
  });

  it('cleanupSWListeners removes every registered listener by reference (idempotent)', () => {
    setupSW({ precache: [], routes: [] });
    cleanupSWListeners();
    expect(removed.length).toBe(5);
    for (const t of expectedTypes) {
      const reg = registered.find((r) => r.type === t)!;
      expect(removed.some((r) => r.type === t && r.listener === reg.listener)).toBe(true);
    }
    cleanupSWListeners();
    expect(removed.length).toBe(5);
  });

  it('is SSR/Node-safe when self is undefined (import without side effects)', async () => {
    delete (globalThis as any).self;
    const mod = await import('@zenith/service-worker/sw');
    expect(() => mod.setupSW({ precache: [], routes: [] })).not.toThrow();
  });
});
