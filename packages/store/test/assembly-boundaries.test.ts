import { afterEach, expect, it } from 'vitest';
import { createApp, type App } from '@zenith/runtime-core';
import { flushSync } from '@zenith/scheduler';
import { defineStore, getStore } from '../src';
import { assignStateKey } from '../src/state-write';
const apps: App[] = [];
afterEach(() => { for (const app of apps.splice(0)) app.dispose(); });
function owner(): App { const app = createApp(); apps.push(app); return app; }
it('retains true store/getter/action identity in an App-owned heterogeneous registry', () => {
  const app = owner(); const useCounter = defineStore('assembly-counter', { state: () => ({ count: 1 }), getters: { double: (state: { count: number }) => state.count * 2 }, actions: { add(amount: number) { this.state.count += amount; return this.state.count; } } });
  const store = app.run(useCounter); expect(app.run(useCounter)).toBe(store); expect(app.run(() => getStore('assembly-counter'))).toBe(store); expect(store.double.get()).toBe(2);
  const getter = store.double; expect(store.add(2)).toBe(3); flushSync(); expect(store.double).toBe(getter); expect(getter.get()).toBe(6);
});
it('keeps synchronous action completion/error callbacks and the original dynamic action receiver', () => {
  const app = owner(), events: unknown[] = [];
  const store = app.run(defineStore('assembly-actions', { state: () => ({ count: 1 }), actions: { add(amount: number) { this.state.count += amount; return this.state.count; }, fail() { throw new Error('action'); } } }));
  store.$onAction(context => { events.push(context.name, context.args); context.after(result => events.push(result)); context.onError(error => events.push(error)); });
  expect(store.add(2)).toBe(3); expect(events.slice(0, 3)).toEqual(['add', [2], 3]); expect(() => store.fail()).toThrow('action'); expect(events.at(-1)).toBeInstanceOf(Error);
});
it('retains thenable getter reads, callback order and native receiver instead of wrapping with Promise.resolve', () => {
  const app = owner(), events: unknown[] = []; let reads = 0;
  const thenable = { get then() { reads++; return function(this: object, resolve: (value: unknown) => void) { expect(this).toBe(thenable); resolve('done'); return 'native result'; }; } };
  const store = app.run(defineStore('assembly-thenable', { state: () => ({}), actions: { task() { return thenable; } } }));
  store.$onAction(context => { context.after(result => events.push(result)); }); expect(store.task()).toBe('native result'); expect(reads).toBe(2); expect(events).toEqual(['done']);
});
it('keeps symbol-keyed reset/patch mutations on the same raw object and proxy owner', () => {
  const app = owner(), key = Symbol('counter');
  const store = app.run(defineStore('assembly-symbols', { state: () => ({ [key]: { value: 1 }, label: 'initial' }) }));
  const raw = store._signal.get(), proxy = store.state; store.$patch({ [key]: { value: 3 } }); expect(store.state[key].value).toBe(3);
  store.$reset(); expect(store._signal.get()).toBe(raw); expect(store.state).toBe(proxy); expect(store.state[key].value).toBe(1); store.state[key].value = 4; expect(store.state[key].value).toBe(4);
});
it('keeps strict assignment rejection and value/receiver identity at the private dynamic boundary', () => {
  const value = {}, state = { value: null as unknown }; assignStateKey(state, { key: 'value', value }); expect(state.value).toBe(value);
  expect(() => assignStateKey(Object.freeze({ value: 1 }), { key: 'value', value: 2 })).toThrow(TypeError);
});
