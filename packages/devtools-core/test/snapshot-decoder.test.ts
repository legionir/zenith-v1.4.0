import { afterEach, expect, it } from 'vitest';
import { signal } from '@zenith/state';
import {
  DEVTOOLS_HOOK_VERSION, clearDevtoolsRegistryInternal, hook,
  installDevtoolsCore, registerSignal, restore, snapshot,
} from '../src';
const cleanups: Array<() => void> = [];
afterEach(() => { for (const cleanup of cleanups.splice(0).reverse()) cleanup(); clearDevtoolsRegistryInternal(); });
function enabled() { const core = installDevtoolsCore({ enabled: true }); cleanups.push(() => core.dispose()); }

it('normalizes legacy metadata and emits a constructed concrete Snapshot, never the unchecked payload', () => {
  enabled(); const source = signal(1), id = registerSignal(source);
  cleanups.push(() => source.dispose());
  const received: unknown[] = []; cleanups.push(hook.on('snapshot:restore', payload => { received.push(payload); }));
  const input = { version: DEVTOOLS_HOOK_VERSION, timestamp: 123, signals: { [id]: { value: 2 } }, extension: 'ignored' };
  restore(input); expect(source.get()).toBe(2);
  expect(received).toEqual([{ version: DEVTOOLS_HOOK_VERSION, timestamp: 123, timelineLength: 0, signals: { [id]: { value: 2 } } }]);
  expect(received[0]).not.toBe(input);
});
for (const invalid of [
  { timelineLength: -1 }, { timelineLength: 0.5 }, { timelineLength: '1' },
  { signals: { item: { name: 1, value: 2 } } }, { signals: { item: { name: 'missing value' } } },
  { timestamp: Number.NaN }, { signals: [] },
]) it('rejects malformed snapshot fields before writing or emitting a fabricated domain value', () => {
  enabled(); const source = signal(0), id = registerSignal(source); cleanups.push(() => source.dispose());
  const input = { version: DEVTOOLS_HOOK_VERSION, timestamp: 123, timelineLength: 0, signals: { [id]: { value: 4 } }, ...invalid };
  expect(() => restore(input)).toThrow(/ZEN-2402/); expect(source.get()).toBe(0);
});

it('drops a snapshot invalidated by an actual reader reset', () => {
  enabled(); registerSignal({ get: () => { clearDevtoolsRegistryInternal(); return 'not retained'; } });
  // Register a stable reader first, then switch its native behavior for capture.
  let reset = false;
  const source = { get: () => { if (reset) clearDevtoolsRegistryInternal(); return 'private'; } };
  registerSignal(source); reset = true; expect(snapshot().signals).toEqual({});
});

it('does not write an old target after a decoded value getter resets its registration epoch', () => {
  enabled(); const source = signal(0), id = registerSignal(source); cleanups.push(() => source.dispose());
  const value = { get native() { clearDevtoolsRegistryInternal(); return 2; } };
  restore({ version: DEVTOOLS_HOOK_VERSION, timestamp: 1, signals: { [id]: { value } } });
  expect(source.get()).toBe(0);
});

it('does not invoke a native setter resolved after its getter retired the operation epoch', () => {
  enabled(); let writes = 0;
  const source = { get: () => 1, get set() { clearDevtoolsRegistryInternal(); return () => { writes++; }; } };
  const id = registerSignal(source);
  restore({ version: DEVTOOLS_HOOK_VERSION, timestamp: 1, signals: { [id]: { value: 2 } } });
  expect(writes).toBe(0);
});
