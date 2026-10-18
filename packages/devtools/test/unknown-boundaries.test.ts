// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { devtoolsAPI, registerPanelSignal, recordPanelStateChange } from '../src';
afterEach(() => { devtoolsAPI.disable(); });
it('inspects get-only/readonly values without asserting writable Signal capabilities', () => {
  devtoolsAPI.enable(); const payload = { nested: ['kept'] }; registerPanelSignal({ get: () => payload }, 'readonly');
  const info = devtoolsAPI.getSignals()[0]; expect(info?.value).toBe(payload); expect(info?.name).toBe('readonly');
});
it('preserves arbitrary timeline payloads and callback ownership', () => {
  devtoolsAPI.enable(); registerPanelSignal({ get: () => 1 }, 'one'); const id = devtoolsAPI.getSignals()[0]!.id;
  const changes: unknown[] = [], stop = devtoolsAPI.subscribeToStateChanges(change => changes.push(change.newValue));
  const oldValue = { previous: true }, nextValue = ['new']; recordPanelStateChange(id, oldValue, nextValue);
  expect(changes).toEqual([nextValue]); expect(devtoolsAPI.getSignal(id)?.value).toBe(nextValue); expect(devtoolsAPI.getStateTimeline()[0]?.oldValue).toBe(oldValue);
  stop(); recordPanelStateChange(id, nextValue, null); expect(changes).toHaveLength(1);
});
it('retains zero registration work while the panel is disabled', () => {
  devtoolsAPI.disable(); let reads = 0; registerPanelSignal({ get() { reads++; return 'ignored'; } });
  expect(reads).toBe(0); expect(devtoolsAPI.getSignals()).toEqual([]);
});
