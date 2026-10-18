import { afterEach, expect, it, vi } from 'vitest';
import * as api from '../src';
import * as registry from '../src/registry';
const cleanups: Array<() => void> = [];
afterEach(() => { for (const stop of cleanups.splice(0).reverse()) stop(); registry.clearRegistry(); vi.unstubAllGlobals(); });
it('retains the established registry facade functions and original weak signal identity after type extraction', () => {
  for (const name of ['registerSignal', 'getSignalInfo', 'getAllSignals', 'getStateTimeline', 'clearRegistry'] as const) expect(api[name]).toBe(registry[name]);
  vi.stubGlobal('__ZENITH_DEVTOOLS__', true);
  const source = api.signal({ payload: true }); cleanups.push(() => source.dispose());
  const id = api.registerSignal(source, 'payload'); const info = registry.getSignalInfo(id)!;
  expect(info.signalRef.deref()).toBe(source); expect(info.value).toBe(source.peek());
  source.set({ payload: false }); expect(registry.getSignalInfo(id)?.value).toBe(source.peek());
  expect(api.getAllSignals()).toContain(info); expect(api.getStateTimeline().some(change => change.signalId === id)).toBe(true);
  api.clearRegistry(); expect(registry.getSignalInfo(id)).toBeUndefined();
});
