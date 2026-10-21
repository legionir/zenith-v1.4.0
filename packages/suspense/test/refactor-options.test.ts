// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest';
import { setHostPrinter } from '@zenith/errors/internal';
import { resetDeprecationWarnings } from '@zenith/errors';
import { createSuspense, createSuspenseContext, processSuspense, trackPromise, withTimeout } from '../src';
import { createSuspense as Controller } from '../src/controller';
import { createSuspenseContext as Context } from '../src/context';
import { processSuspense as Directive } from '../src/directive';
import { withTimeout as Timeout } from '../src/promises';
const releases: Array<() => void> = [];
afterEach(() => { for (const stop of releases.splice(0).reverse()) stop(); resetDeprecationWarnings(); vi.useRealTimers(); document.body.innerHTML = ''; });
it('keeps controller/context/directive/promise function identities through the established facade', () => {
  expect(createSuspense).toBe(Controller); expect(createSuspenseContext).toBe(Context); expect(processSuspense).toBe(Directive); expect(withTimeout).toBe(Timeout);
});
it('uses canonical defaults without legacy warnings in direct and production controller construction', () => {
  const messages: string[] = []; releases.push(setHostPrinter((_severity, title) => { messages.push(title); }));
  const context = createSuspenseContext(), controller = createSuspense(); releases.push(() => context.reset(), () => controller.dispose());
  expect(context.signal.get().pendingCount).toBe(0); expect(messages.some(message => message.includes('ZEN-DEPR-065'))).toBe(false);
});
it('validates canonical context options while retaining explicit undefined legacy timeout/callback arity', () => {
  const messages: string[] = []; releases.push(setHostPrinter((_severity, title) => { messages.push(title); }));
  // @ts-expect-error Deliberately invalid JavaScript configuration.
  expect(() => createSuspenseContext({ timeoutMs: '1' })).toThrow();
  const events: boolean[] = [], legacy = createSuspenseContext(undefined, settled => events.push(settled)); releases.push(() => legacy.reset());
  legacy.startLoading('child'); legacy.stopLoading('child'); expect(events).toEqual([false, true]); expect(messages.some(message => message.includes('ZEN-DEPR-065'))).toBe(true);
});
it('keeps the legacy negative-timeout no-op but validates canonical nonnegative timeouts', () => {
  const original = Promise.resolve('value'); expect(withTimeout(original, -1)).toBe(original); expect(withTimeout(original, { ms: 0 })).toBe(original);
  expect(() => withTimeout(original, { ms: -1 })).toThrow();
});
it('retains tracking identity and real context callbacks rather than wrapping the context', async () => {
  const settled: boolean[] = [], context = createSuspenseContext({ onSettle: value => settled.push(value) }); releases.push(() => context.reset());
  let resolve!: (value: number) => void; const original = new Promise<number>(done => { resolve = done; });
  const tracked = trackPromise(original, { suspense: context, key: 'known' }); expect(context.signal.get().pendingCount).toBe(1); resolve(2); expect(await tracked).toBe(2); expect(settled).toEqual([false, true]);
  const plain = Promise.resolve(3); expect(trackPromise(plain, {})).toBe(plain);
});
it('validates canonical tracking capabilities and timer messages without changing legacy bridges', () => {
  const original = Promise.resolve(1);
  // @ts-expect-error Context capabilities must be callable.
  expect(() => trackPromise(original, { suspense: { startLoading: true } })).toThrow();
  // @ts-expect-error Canonical timeout messages are strings.
  expect(() => withTimeout(original, { ms: 0, message: 1 })).toThrow();
});
it('keeps directive children on inherited unknown context and does not warn for its internal canonical registration', () => {
  const messages: string[] = []; releases.push(setHostPrinter((_severity, title) => { messages.push(title); }));
  const element = document.createElement('zen-suspense'); element.innerHTML = '<b>content</b>'; document.body.append(element); const parent = { payload: { id: 1 } }, contexts: Array<Record<string, unknown>> = [], disposes: Array<() => void> = [];
  const stop = processSuspense(element, (_node, context) => { contexts.push(context); }, parent, disposes); releases.push(stop);
  expect(contexts).toHaveLength(1); expect(Object.getPrototypeOf(contexts[0])).toBe(parent); expect(contexts[0]?.payload).toBe(parent.payload); expect(messages.some(message => message.includes('ZEN-DEPR-065'))).toBe(false);
});
