// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import { setHostPrinter } from '@zenith/errors/internal';
import { resetDeprecationWarnings } from '@zenith/errors';
import { render, testDirective, type TestDirectiveDefinition } from '../src';
const cleanups: Array<() => void> = [];
afterEach(() => { for (const stop of cleanups.splice(0).reverse()) stop(); resetDeprecationWarnings(); document.body.innerHTML = ''; });
it('validates canonical render options and preserves state identity without decoding its contents', () => {
  const messages: string[] = []; cleanups.push(setHostPrinter((_severity, title) => messages.push(title)));
  const state = { payload: { nested: true } }; let seen: unknown;
  const descriptor = Object.getOwnPropertyDescriptor(window, 'Zen');
  cleanups.push(() => { if (descriptor) Object.defineProperty(window, 'Zen', descriptor); else Reflect.deleteProperty(window, 'Zen'); });
  Object.defineProperty(window, 'Zen', { configurable: true, value: { start(_container: HTMLElement, input: unknown) { seen = input; } } });
  const result = render({ template: '<p>canonical</p>', state, attachToBody: true }); cleanups.push(result.unmount);
  expect(seen).toBe(state); expect(result.container.isConnected).toBe(true);
  expect(messages.some(message => message.includes('ZEN-DEPR-093'))).toBe(false);
  // @ts-expect-error Canonical template strings must be strings.
  expect(() => render({ template: 1 })).toThrow();
  // @ts-expect-error Canonical attachment flags are boolean.
  expect(() => render({ template: '', attachToBody: 'yes' })).toThrow();
  // @ts-expect-error Canonical state is a record, not an array.
  expect(() => render({ template: '', state: [] })).toThrow();
});
it('keeps legacy render state/options/default arity and emits its warning once', () => {
  const messages: string[] = []; cleanups.push(setHostPrinter((_severity, title) => messages.push(title)));
  const state = {}; let seen: unknown;
  const descriptor = Object.getOwnPropertyDescriptor(window, 'Zen');
  cleanups.push(() => { if (descriptor) Object.defineProperty(window, 'Zen', descriptor); else Reflect.deleteProperty(window, 'Zen'); });
  Object.defineProperty(window, 'Zen', { configurable: true, value: { start(_container: HTMLElement, input: unknown) { seen = input; } } });
  const first = render('<p>legacy</p>', state, { attachToBody: true }); cleanups.push(first.unmount);
  expect(seen).toBe(state); expect(first.container.isConnected).toBe(true);
  const second = render('<b>defaults</b>', undefined, undefined); cleanups.push(second.unmount);
  expect(second.text()).toBe('defaults'); expect(second.container.isConnected).toBe(false);
  expect(messages.filter(message => message.includes('ZEN-DEPR-093'))).toHaveLength(1);
});
it('preserves canonical directive generic state, signal objects and bind receivers', () => {
  const messages: string[] = []; cleanups.push(setHostPrinter((_severity, title) => messages.push(title)));
  const state = { signal: { get: () => 42 } };
  let receiver: unknown, seen: unknown;
  const directive: TestDirectiveDefinition<typeof state> = { name: 'typed', bind(_el, ctx) { receiver = this; seen = ctx.state; expect(ctx.eval()).toBe(42); } };
  const result = testDirective(directive, { html: '<div zen-typed="$signal"></div>', state }); cleanups.push(result.dispose);
  expect(receiver).toBe(directive); expect(seen).toBe(state); expect(result.state.signal).toBe(state.signal);
  expect(messages.some(message => message.includes('ZEN-DEPR-094'))).toBe(false);
});
it('keeps legacy directive defaults/cleanup and warns once independently of canonical validation', () => {
  const messages: string[] = []; cleanups.push(setHostPrinter((_severity, title) => messages.push(title)));
  let cleanupsCalled = 0; const directive: TestDirectiveDefinition = { name: 'old', bind() { return () => cleanupsCalled++; } };
  const first = testDirective(directive, '<div zen-old></div>'); cleanups.push(first.dispose);
  const second = testDirective(directive, '<div zen-old></div>', undefined); cleanups.push(second.dispose);
  expect(first.state).toEqual({}); expect(second.state).toEqual({}); first.dispose(); first.dispose(); expect(cleanupsCalled).toBe(1);
  expect(messages.filter(message => message.includes('ZEN-DEPR-094'))).toHaveLength(1);
  // @ts-expect-error Canonical directive HTML must be a string.
  expect(() => testDirective(directive, { html: 1 })).toThrow();
  // @ts-expect-error Canonical state is a record, not an array.
  expect(() => testDirective(directive, { html: '', state: [] })).toThrow();
});
