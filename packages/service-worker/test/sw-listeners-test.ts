// #6 test: setupSW must register install/activate/fetch/sync/message listeners
// through the tracked addSWListener path, and cleanupSWListeners must remove
// exactly those listeners (no leaked addEventListener without removeEventListener).

import assert from 'node:assert/strict';
import { setupSW, cleanupSWListeners, getConfig } from '../src/sw.js';

type Listener = (event: any) => void;

const registered: Array<{ type: string; listener: Listener }> = [];
const removed: Array<{ type: string; listener: Listener }> = [];

(globalThis as any).self = {
  addEventListener: (type: string, listener: Listener) => {
    registered.push({ type, listener });
  },
  removeEventListener: (type: string, listener: Listener) => {
    removed.push({ type, listener });
  },
};

// --- red-check: before this fix, addSWListener was dead code and
// cleanupSWListeners removed nothing. ---

setupSW({ precache: [], routes: [] });

const expectedTypes = ['install', 'activate', 'fetch', 'sync', 'message'];
for (const t of expectedTypes) {
  assert.ok(
    registered.some((r) => r.type === t),
    `listener for "${t}" should be registered by setupSW`,
  );
}
assert.equal(registered.length, 5, `expected exactly 5 listeners, got ${registered.length}`);

// getConfig should reflect setup (behavior sanity).
const cfg = getConfig();
assert.ok(cfg, 'getConfig should return config after setupSW');
assert.equal(cfg!.defaultStrategy, 'networkOnly');

// cleanup must remove every registered listener, by identity.
cleanupSWListeners();
assert.equal(removed.length, 5, `cleanupSWListeners should remove 5 listeners, removed ${removed.length}`);
for (const t of expectedTypes) {
  const reg = registered.find((r) => r.type === t)!;
  assert.ok(
    removed.some((r) => r.type === t && r.listener === reg.listener),
    `listener for "${t}" should be removed with the same reference`,
  );
}

// idempotency: second cleanup removes nothing more.
cleanupSWListeners();
assert.equal(removed.length, 5, 'cleanup must be idempotent');

console.log('✅ sw-listeners-test: all assertions passed');
