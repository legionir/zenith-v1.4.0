// @vitest-environment jsdom
import { afterEach, expect, it } from 'vitest';
import * as api from '../src';
import * as facade from '../src/testing';
import * as reactivity from '../src/reactivity';
import * as dom from '../src/render';
import * as accessibility from '../src/accessibility';
import * as reset from '../src/reset';
import * as timers from '../src/timers';
import * as fetchHelpers from '../src/fetch';
import * as router from '../src/router';
import * as directives from '../src/directive';
import { onGlobalReset } from '@zenith/errors';
const cleanups: Array<() => void> = [];
afterEach(() => { for (const stop of cleanups.splice(0).reverse()) stop(); document.body.innerHTML = ''; });
it('preserves entry/facade/leaf identities rather than wrapping factories', () => {
  for (const [key, fn] of Object.entries({ createTestHarness: reactivity.createTestHarness, trackEffect: reactivity.trackEffect, render: dom.render, zenithMatchers: dom.zenithMatchers, auditAccessibility: accessibility.auditAccessibility, registerTestingReset: reset.registerTestingReset, resetForTesting: reset.resetForTesting, useFakeTimers: timers.useFakeTimers, mockFetch: fetchHelpers.mockFetch, mockHttp: fetchHelpers.mockHttp, mockRouter: router.mockRouter, testDirective: directives.testDirective })) {
    expect(Reflect.get(api, key)).toBe(fn); expect(Reflect.get(facade, key)).toBe(fn);
  }
});
it('keeps root ownership, actual signal objects and resource counters', () => {
  const harness = api.createTestHarness(); cleanups.push(() => harness.dispose());
  const mocked = api.createMockSignal(1);
  const tracked = api.trackEffect(() => mocked.signal.get()); cleanups.push(() => tracked.dispose());
  harness.flush(); mocked.signal.set(2); harness.flush();
  expect(mocked.history).toEqual([1, 2]); expect(mocked.setCount).toBe(1);
  expect(tracked.lastValue).toBe(2); expect(tracked.runCount).toBeGreaterThan(0);
  const resource = api.createMockResource('initial');
  resource.resolve('next'); expect(resource.data.get()).toBe('next'); expect(resource.requestCount).toBe(1);
  const failure = new Error('resource'); resource.reject(failure);
  expect(resource.error.get()).toBe(failure); expect(resource.requestCount).toBe(2);
  resource.reset(); expect(resource.data.get()).toBe('initial'); expect(resource.requestCount).toBe(0);
});
it('keeps the reset-hook singleton shared across all import routes, removal idempotence and best-effort ordering', () => {
  const seen: string[] = [];
  cleanups.push(onGlobalReset(() => seen.push('global')));
  const remove = facade.registerTestingReset(() => { seen.push('first'); throw new Error('teardown'); });
  cleanups.push(remove, reset.registerTestingReset(() => seen.push('second')));
  api.resetForTesting(); expect(seen).toEqual(['global', 'first', 'second']);
  remove(); remove(); seen.length = 0; reset.resetForTesting(); expect(seen).toEqual(['global', 'second']);
});
it('keeps the dynamic Zen lookup count, method receiver and caller state identity', () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'Zen');
  cleanups.push(() => { if (descriptor) Object.defineProperty(window, 'Zen', descriptor); else Reflect.deleteProperty(window, 'Zen'); });
  const seen: string[] = []; let lookups = 0;
  const state = { name: 'Ada' };
  const second = { get start() { seen.push('second.start'); return function(this: unknown, element: HTMLElement, supplied: unknown) {
    seen.push('call'); expect(this).toBe(second); expect(supplied).toBe(state); expect(element.innerHTML).toBe('<p>hello</p>');
  }; } };
  const first = { get start() { seen.push('first.start'); return () => {}; } };
  Object.defineProperty(window, 'Zen', { configurable: true, get() { seen.push('Zen'); return ++lookups === 1 ? first : second; } });
  const rendered = api.render({ template: '<p>hello</p>', state, attachToBody: true }); cleanups.push(rendered.unmount);
  expect(seen).toEqual(['Zen', 'first.start', 'Zen', 'second.start', 'call']);
  expect(document.body.contains(rendered.container)).toBe(true);
  expect(rendered.query('p')?.textContent).toBe('hello');
  rendered.unmount(); expect(document.body.contains(rendered.container)).toBe(false);
});
it('supports no-runtime DOM rendering and maintains non-callable runtime failure', () => {
  const descriptor = Object.getOwnPropertyDescriptor(window, 'Zen');
  cleanups.push(() => { if (descriptor) Object.defineProperty(window, 'Zen', descriptor); else Reflect.deleteProperty(window, 'Zen'); });
  Object.defineProperty(window, 'Zen', { configurable: true, writable: true, value: undefined });
  const rendered = api.render({ template: '<b>static</b>' }); cleanups.push(rendered.unmount);
  expect(rendered.text()).toBe('static');
  Reflect.set(window, 'Zen', { start: true }); expect(() => api.render({ template: '<i></i>' })).toThrow(TypeError);
});
it('retains router signal identity, replace/history/reset behavior and directive cleanup', () => {
  const controller = api.mockRouter('/first'); const signal = controller.currentPath;
  controller.navigate('/second'); controller.navigate('/replaced', { replace: true });
  expect(controller.history).toEqual(['/first', '/replaced']); expect(signal.get()).toBe('/replaced');
  controller.dispose(); expect(controller.currentPath).toBe(signal); expect(signal.get()).toBe('/first');
  const state = { value: { get: () => 'evaluated' } }; const captures: unknown[] = []; let stopped = 0;
  const bound = api.testDirective({ name: 'capture', bind(el, ctx) { captures.push(ctx.state, ctx.arg, ctx.modifiers, ctx.eval()); el.textContent = 'bound'; return () => { stopped++; }; } }, { html: '<span zen-capture:item.once="$value"></span>', state });
  cleanups.push(bound.dispose);
  expect(bound.state).toBe(state); expect(bound.el.textContent).toBe('bound');
  expect(captures).toEqual([state, 'item', ['once'], 'evaluated']);
  bound.dispose(); bound.dispose(); expect(stopped).toBe(1); expect(bound.container.isConnected).toBe(false);
});
it('retains matchers and DOM audit behavior across leaf imports', () => {
  expect(api.zenithMatchers.toHaveValue({ get: () => 3 }, 3).pass).toBe(true);
  expect(api.zenithMatchers.toBeReadonly({ get: () => 3 }).pass).toBe(true);
  expect(api.zenithMatchers.toBeReadonly({ get: () => 3, set: () => {} }).pass).toBe(false);
  const container = document.createElement('div'); container.innerHTML = '<img src="/x.png"><button aria-label="Save"></button>';
  expect(api.auditAccessibility(container).violations.some(item => item.id === 'image-alt')).toBe(true);
  expect(() => api.expectAccessible(container)).toThrow();
  expect(api.auditAccessibility(container, { allowlist: ['image-alt'] }).violations).toEqual([]);
});
it('keeps fetch patch ownership and original fetch identity through reset/disposal', async () => {
  const original = globalThis.fetch;
  const mocked = api.mockFetch((url, init) => ({ data: { url, method: init.method ?? 'GET' } })); cleanups.push(mocked.restore);
  const response = await fetch('/api/refactor', { method: 'POST' });
  expect(await response.json()).toEqual({ url: '/api/refactor', method: 'POST' });
  expect(mocked.calls).toHaveLength(1);
  api.resetForTesting(); expect(globalThis.fetch).toBe(original);
  mocked.dispose(); expect(globalThis.fetch).toBe(original);
});
